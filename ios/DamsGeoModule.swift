import ExpoModulesCore
import CoreLocation
import CoreMotion
import BackgroundTasks

public class DamsGeoModule: Module, CLLocationManagerDelegate {
  private var locationManager: CLLocationManager?
  private var activityManager: CMMotionActivityManager?
  private var lastActivity: String = "unknown"
  private var isTracking = false
  private var activityUpdateTimer: Timer?
  private var activeGeofences: [[String: Any]] = []
  private var useNativeGeofencing = true // Feature flag for native geofencing
  private var monitoredRegions: Set<CLCircularRegion> = []
  
  public func definition() -> ModuleDefinition {
    Name("DamsGeo")
    
    // Constants
    Constants([
      "isTracking": false
    ])
    
    // Events
    Events("onLocationUpdate", "onGeofenceEnter", "onGeofenceExit", "onActivityChange", "onError", "onBackgroundSync")
    
    // Functions
    AsyncFunction("startTracking") { (config: [String: Any]) -> Void in
      self.startLocationTracking(config: config)
    }
    
    AsyncFunction("stopTracking") { (reason: String) -> Void in
      self.stopLocationTracking(reason: reason)
    }
    
    Function("setGeofences") { (zones: [[String: Any]]) -> Void in
      self.setGeofenceZones(zones)
    }
    
    Function("getCurrentActivity") { () -> String in
      return self.lastActivity
    }
    
    Property("isTracking") {
      return self.isTracking
    }
    
    // Encryption key management functions
    AsyncFunction("getEncryptionKey") { (keyAlias: String) -> String? in
      return self.getKeychainItem(key: keyAlias)
    }
    
    AsyncFunction("storeEncryptionKey") { (keyAlias: String, key: String) -> Void in
      self.saveToKeychain(key: keyAlias, value: key)
    }
    
    AsyncFunction("deleteEncryptionKey") { (keyAlias: String) -> Void in
      self.deleteFromKeychain(key: keyAlias)
    }
    
    AsyncFunction("isEncryptionAvailable") { () -> Bool in
      return true // Keychain is always available on iOS
    }
    
    // Update tracking parameters (distanceFilter & desiredAccuracy)
    AsyncFunction("updateTrackingConfig") { (params: [String: Any]) -> Void in
      DispatchQueue.main.async {
        if let df = params["distanceFilter"] as? Double {
          self.locationManager?.distanceFilter = df
        }
        if let accuracy = params["desiredAccuracy"] as? String {
          switch accuracy {
          case "best":
            self.locationManager?.desiredAccuracy = kCLLocationAccuracyBest
          case "high":
            self.locationManager?.desiredAccuracy = kCLLocationAccuracyNearestTenMeters
          case "medium":
            self.locationManager?.desiredAccuracy = kCLLocationAccuracyHundredMeters
          case "low":
            self.locationManager?.desiredAccuracy = kCLLocationAccuracyKilometer
          default:
            break
          }
        }
      }
    }
    
    // Battery status fetcher
    AsyncFunction("getBatteryStatus") { () -> [String: Any] in
      UIDevice.current.isBatteryMonitoringEnabled = true
      let level = Int(UIDevice.current.batteryLevel * 100)
      let state = UIDevice.current.batteryState
      let charging = (state == .charging || state == .full)
      return [
        "level": level,
        "isCharging": charging
      ]
    }
    
    OnCreate {
      self.locationManager = CLLocationManager()
      self.locationManager?.delegate = self
      self.locationManager?.desiredAccuracy = kCLLocationAccuracyBest
      self.locationManager?.allowsBackgroundLocationUpdates = true
      self.locationManager?.pausesLocationUpdatesAutomatically = false
      self.locationManager?.showsBackgroundLocationIndicator = true
      
      // Initialize activity manager
      if CMMotionActivityManager.isActivityAvailable() {
        self.activityManager = CMMotionActivityManager()
      }
      
      // Setup background tasks
      self.setupBackgroundTasks()
      
      // Initialize geofencing and restore persisted regions
      self.initializeGeofencing()
    }
  }
  
  private func startLocationTracking(config: [String: Any]) {
    guard let locationManager = self.locationManager else { return }
    
    // Request permissions
    let authStatus = locationManager.authorizationStatus
    switch authStatus {
    case .notDetermined:
      locationManager.requestAlwaysAuthorization()
    case .restricted, .denied:
      self.sendEvent("onError", [
        "code": "PERMISSION_DENIED",
        "message": "Location permission denied"
      ])
      return
    default:
      break
    }
    
    // Configure based on config
    if let desiredAccuracy = config["desiredAccuracy"] as? String {
      switch desiredAccuracy {
      case "best":
        locationManager.desiredAccuracy = kCLLocationAccuracyBest
      case "high":
        locationManager.desiredAccuracy = kCLLocationAccuracyNearestTenMeters
      case "medium":
        locationManager.desiredAccuracy = kCLLocationAccuracyHundredMeters
      default:
        locationManager.desiredAccuracy = kCLLocationAccuracyBest
      }
    }
    
    if let distanceFilter = config["distanceFilter"] as? Double {
      locationManager.distanceFilter = distanceFilter
    }
    
    // Start tracking
    locationManager.startUpdatingLocation()
    self.isTracking = true
    
    // Start activity recognition
    self.startActivityRecognition()
    
    print("[DamsGeo] Started tracking with config: \(config)")
  }
  
  private func stopLocationTracking(reason: String) {
    self.locationManager?.stopUpdatingLocation()
    self.isTracking = false
    self.stopActivityRecognition()
    print("[DamsGeo] Stopped tracking. Reason: \(reason)")
  }
  
  // MARK: - CLLocationManagerDelegate
  
  public func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
    guard let location = locations.last else { return }
    
    // Determine if this is a significant location change
    var isSignificantChange = false
    if let lastKnownLocation = self.locationManager?.location {
      let distance = location.distance(from: lastKnownLocation)
      isSignificantChange = distance > 50 // 50 meters threshold
    }
    
    let locationUpdate: [String: Any] = [
      "lat": location.coordinate.latitude,
      "lon": location.coordinate.longitude,
      "accuracy": location.horizontalAccuracy,
      "speed": location.speed >= 0 ? location.speed : NSNull(),
      "heading": location.course >= 0 ? location.course : NSNull(),
      "altitude": location.altitude,
      "activityType": self.lastActivity,
      "timestamp": Int(location.timestamp.timeIntervalSince1970 * 1000),
      "isSignificantChange": isSignificantChange
    ]
    
    self.sendEvent("onLocationUpdate", locationUpdate)
    
    // Check geofences only in manual mode
    if !useNativeGeofencing {
      self.checkGeofences(for: location)
    }
    
    // Schedule background refresh if needed
    if #available(iOS 13.0, *), isSignificantChange {
      self.scheduleAppRefresh()
    }
  }
  
  public func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
    self.sendEvent("onError", [
      "code": "LOCATION_ERROR",
      "message": error.localizedDescription
    ])
  }
  
  public func locationManager(_ manager: CLLocationManager, didChangeAuthorization status: CLAuthorizationStatus) {
    if status == .denied || status == .restricted {
      self.sendEvent("onError", [
        "code": "PERMISSION_DENIED",
        "message": "Location permission denied"
      ])
      self.stopLocationTracking(reason: "permission-denied")
    } else if status == .authorizedAlways || status == .authorizedWhenInUse {
      // Re-setup native geofences if needed after permission granted
      if useNativeGeofencing && !activeGeofences.isEmpty {
        setupNativeGeofences()
      }
    }
  }
  
  // MARK: - Native Geofencing Delegates
  
  public func locationManager(_ manager: CLLocationManager, didEnterRegion region: CLRegion) {
    guard let circularRegion = region as? CLCircularRegion else { return }
    
    // Find the corresponding zone
    if let zone = activeGeofences.first(where: { $0["id"] as? String == circularRegion.identifier }) {
      let zoneName = zone["name"] as? String ?? "Unknown Zone"
      
      // Get current location for the event
      let location = manager.location ?? CLLocation(
        latitude: circularRegion.center.latitude,
        longitude: circularRegion.center.longitude
      )
      
      self.sendEvent("onGeofenceEnter", [
        "zoneId": circularRegion.identifier,
        "zoneName": zoneName,
        "location": [
          "lat": location.coordinate.latitude,
          "lon": location.coordinate.longitude,
          "timestamp": Int(location.timestamp.timeIntervalSince1970 * 1000)
        ],
        "triggeredInBackground": UIApplication.shared.applicationState != .active
      ])
      
      print("[DamsGeo] Native geofence entered: \(circularRegion.identifier)")
    }
  }
  
  public func locationManager(_ manager: CLLocationManager, didExitRegion region: CLRegion) {
    guard let circularRegion = region as? CLCircularRegion else { return }
    
    // Find the corresponding zone
    if let zone = activeGeofences.first(where: { $0["id"] as? String == circularRegion.identifier }) {
      let zoneName = zone["name"] as? String ?? "Unknown Zone"
      
      // Get current location for the event
      let location = manager.location ?? CLLocation(
        latitude: circularRegion.center.latitude,
        longitude: circularRegion.center.longitude
      )
      
      self.sendEvent("onGeofenceExit", [
        "zoneId": circularRegion.identifier,
        "zoneName": zoneName,
        "location": [
          "lat": location.coordinate.latitude,
          "lon": location.coordinate.longitude,
          "timestamp": Int(location.timestamp.timeIntervalSince1970 * 1000)
        ],
        "triggeredInBackground": UIApplication.shared.applicationState != .active
      ])
      
      print("[DamsGeo] Native geofence exited: \(circularRegion.identifier)")
    }
  }
  
  public func locationManager(_ manager: CLLocationManager, monitoringDidFailFor region: CLRegion?, withError error: Error) {
    print("[DamsGeo] Failed to monitor region: \(error.localizedDescription)")
    self.sendEvent("onError", [
      "code": "GEOFENCE_ERROR",
      "message": "Failed to monitor region: \(error.localizedDescription)"
    ])
  }
  
  // MARK: - Activity Recognition
  
  private func startActivityRecognition() {
    guard let activityManager = self.activityManager else { 
      print("[DamsGeo] Activity recognition not available")
      return 
    }
    
    // Start activity updates
    activityManager.startActivityUpdates(to: OperationQueue.main) { [weak self] activity in
      guard let self = self, let activity = activity else { return }
      
      var activityType = "unknown"
      var confidence = 0
      
      if activity.stationary {
        activityType = "stationary"
        confidence = Int(activity.confidence.rawValue * 33.33)
      } else if activity.walking {
        activityType = "walking"
        confidence = Int(activity.confidence.rawValue * 33.33)
      } else if activity.automotive {
        activityType = "vehicle"
        confidence = Int(activity.confidence.rawValue * 33.33)
      }
      
      if activityType != self.lastActivity {
        self.lastActivity = activityType
        self.sendEvent("onActivityChange", [
          "activity": activityType,
          "confidence": confidence
        ])
      }
    }
    
    // Also start a timer for periodic activity queries
    self.activityUpdateTimer = Timer.scheduledTimer(withTimeInterval: 30.0, repeats: true) { [weak self] _ in
      self?.queryCurrentActivity()
    }
  }
  
  private func stopActivityRecognition() {
    self.activityManager?.stopActivityUpdates()
    self.activityUpdateTimer?.invalidate()
    self.activityUpdateTimer = nil
  }
  
  private func queryCurrentActivity() {
    guard let activityManager = self.activityManager else { return }
    
    activityManager.queryActivityStarting(from: Date(timeIntervalSinceNow: -60), to: Date(), to: OperationQueue.main) { [weak self] activities, error in
      guard let self = self, let activities = activities, !activities.isEmpty else { return }
      
      // Get the most recent activity
      if let mostRecent = activities.last {
        var activityType = "unknown"
        var confidence = 0
        
        if mostRecent.stationary {
          activityType = "stationary"
          confidence = Int(mostRecent.confidence.rawValue * 33.33)
        } else if mostRecent.walking {
          activityType = "walking"
          confidence = Int(mostRecent.confidence.rawValue * 33.33)
        } else if mostRecent.automotive {
          activityType = "vehicle"
          confidence = Int(mostRecent.confidence.rawValue * 33.33)
        }
        
        if activityType != self.lastActivity {
          self.lastActivity = activityType
          self.sendEvent("onActivityChange", [
            "activity": activityType,
            "confidence": confidence
          ])
        }
      }
    }
  }
  
  // MARK: - Geofencing
  
  private func setGeofenceZones(_ zones: [[String: Any]]) {
    // Check if we should use native geofencing
    self.useNativeGeofencing = shouldUseNativeGeofencing()
    
    // Validate zone count based on mode
    let maxZones = useNativeGeofencing ? 20 : 10 // iOS allows 20 native regions
    guard zones.count <= maxZones else {
      self.sendEvent("onError", [
        "code": "GEOFENCE_LIMIT",
        "message": "Maximum \(maxZones) geofence zones allowed"
      ])
      return
    }
    
    // Store zones for manual checking or native setup
    self.activeGeofences = zones.filter { zone in
      return zone["isActive"] as? Bool ?? false
    }
    
    if useNativeGeofencing {
      setupNativeGeofences()
    } else {
      // Remove all monitored regions if switching to manual mode
      removeAllNativeGeofences()
    }
    
    print("[DamsGeo] Set \(self.activeGeofences.count) active geofences (native: \(useNativeGeofencing))")
  }
  
  private func checkGeofences(for location: CLLocation) {
    for zone in self.activeGeofences {
      guard let zoneId = zone["id"] as? String,
            let zoneName = zone["name"] as? String,
            let coordinates = zone["coordinates"] as? [[String: Double]] else {
        continue
      }
      
      // Convert coordinates to CLLocationCoordinate2D array
      let polygonCoordinates = coordinates.compactMap { coord -> CLLocationCoordinate2D? in
        guard let lat = coord["lat"], let lon = coord["lon"] else { return nil }
        return CLLocationCoordinate2D(latitude: lat, longitude: lon)
      }
      
      // Check if location is inside polygon
      let isInside = self.isLocation(location.coordinate, insidePolygon: polygonCoordinates)
      let wasInside = self.wasLocationInsideZone(zoneId)
      
      if isInside && !wasInside {
        // Entered zone
        self.markLocationInsideZone(zoneId, inside: true)
        self.sendEvent("onGeofenceEnter", [
          "zoneId": zoneId,
          "zoneName": zoneName,
          "location": [
            "lat": location.coordinate.latitude,
            "lon": location.coordinate.longitude,
            "timestamp": Int(location.timestamp.timeIntervalSince1970 * 1000)
          ]
        ])
      } else if !isInside && wasInside {
        // Exited zone
        self.markLocationInsideZone(zoneId, inside: false)
        self.sendEvent("onGeofenceExit", [
          "zoneId": zoneId,
          "zoneName": zoneName,
          "location": [
            "lat": location.coordinate.latitude,
            "lon": location.coordinate.longitude,
            "timestamp": Int(location.timestamp.timeIntervalSince1970 * 1000)
          ]
        ])
      }
    }
  }
  
  // Ray-casting algorithm for point-in-polygon
  private func isLocation(_ coordinate: CLLocationCoordinate2D, insidePolygon polygon: [CLLocationCoordinate2D]) -> Bool {
    guard polygon.count >= 3 else { return false }
    
    var inside = false
    let lat = coordinate.latitude
    let lon = coordinate.longitude
    
    var p1 = polygon[0]
    for i in 1...polygon.count {
      let p2 = polygon[i % polygon.count]
      
      if lon > min(p1.longitude, p2.longitude) {
        if lon <= max(p1.longitude, p2.longitude) {
          if lat <= max(p1.latitude, p2.latitude) {
            if p1.longitude != p2.longitude {
              let xinters = (lon - p1.longitude) * (p2.latitude - p1.latitude) / (p2.longitude - p1.longitude) + p1.latitude
              if p1.latitude == p2.latitude || lat <= xinters {
                inside = !inside
              }
            }
          }
        }
      }
      p1 = p2
    }
    
    return inside
  }
  
  // Track zone states
  private var zoneStates: [String: Bool] = [:]
  
  private func wasLocationInsideZone(_ zoneId: String) -> Bool {
    return zoneStates[zoneId] ?? false
  }
  
  private func markLocationInsideZone(_ zoneId: String, inside: Bool) {
    zoneStates[zoneId] = inside
  }
  
  // MARK: - Background Services
  
  private func setupBackgroundTasks() {
    // Enable significant location changes for better battery life in background
    self.locationManager?.startMonitoringSignificantLocationChanges()
    
    // Register for background app refresh
    if #available(iOS 13.0, *) {
      BGTaskScheduler.shared.register(forTaskWithIdentifier: "com.dams.geo.refresh", using: nil) { task in
        self.handleBackgroundRefresh(task: task as! BGAppRefreshTask)
      }
    }
  }
  
  @available(iOS 13.0, *)
  private func handleBackgroundRefresh(task: BGAppRefreshTask) {
    // Schedule next background refresh
    scheduleAppRefresh()
    
    task.expirationHandler = {
      task.setTaskCompleted(success: false)
    }
    
    // Sync any pending location data
    Task {
      do {
        // Emit event to JS layer to trigger database sync
        self.sendEvent("onBackgroundSync", [
          "timestamp": Date().timeIntervalSince1970 * 1000,
          "reason": "background_refresh"
        ])
        
        // Allow time for JS to process
        try await Task.sleep(nanoseconds: 2_000_000_000) // 2 seconds
        
        print("[DamsGeo] Background refresh: sync requested")
        task.setTaskCompleted(success: true)
      } catch {
        print("[DamsGeo] Background refresh failed: \(error)")
        task.setTaskCompleted(success: false)
      }
    }
  }
  
  @available(iOS 13.0, *)
  private func scheduleAppRefresh() {
    let request = BGAppRefreshTaskRequest(identifier: "com.dams.geo.refresh")
    request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60) // 15 minutes
    
    do {
      try BGTaskScheduler.shared.submit(request)
    } catch {
      print("[DamsGeo] Could not schedule app refresh: \(error)")
    }
  }
  
  // MARK: - Keychain Management
  
  private func saveToKeychain(key: String, value: String) {
    let data = value.data(using: .utf8)!
    
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrAccount as String: key,
      kSecAttrService as String: "com.dams.geo.encryption",
      kSecValueData as String: data,
      kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock
    ]
    
    // First try to delete any existing item
    SecItemDelete(query as CFDictionary)
    
    // Then add the new item
    let status = SecItemAdd(query as CFDictionary, nil)
    if status != errSecSuccess {
      print("[DamsGeo] Failed to save encryption key to keychain: \(status)")
    }
  }
  
  private func getKeychainItem(key: String) -> String? {
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrAccount as String: key,
      kSecAttrService as String: "com.dams.geo.encryption",
      kSecReturnData as String: kCFBooleanTrue!,
      kSecMatchLimit as String: kSecMatchLimitOne
    ]
    
    var dataTypeRef: AnyObject?
    let status = SecItemCopyMatching(query as CFDictionary, &dataTypeRef)
    
    if status == errSecSuccess {
      if let data = dataTypeRef as? Data {
        return String(data: data, encoding: .utf8)
      }
    }
    
    return nil
  }
  
  private func deleteFromKeychain(key: String) {
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrAccount as String: key,
      kSecAttrService as String: "com.dams.geo.encryption"
    ]
    
    let status = SecItemDelete(query as CFDictionary)
    if status != errSecSuccess && status != errSecItemNotFound {
      print("[DamsGeo] Failed to delete encryption key from keychain: \(status)")
    }
  }
  
  // MARK: - RSA Signing for Audit Exports
  
  AsyncFunction("hasSigningKeyPair") { () -> Bool in
    return self.hasSigningKeys()
  }
  
  AsyncFunction("generateSigningKeyPair") { () in
    try self.generateSigningKeyPair()
  }
  
  AsyncFunction("signData") { (data: String) -> String in
    return try self.signData(data)
  }
  
  AsyncFunction("verifySignature") { (data: String, signature: String) -> Bool in
    return self.verifySignature(data: data, signature: signature)
  }
  
  AsyncFunction("getSigningPublicKey") { () -> String in
    return try self.getPublicKeyString()
  }
  
  AsyncFunction("deleteSigningKeyPair") { () in
    self.deleteSigningKeys()
  }
  
  AsyncFunction("exportAuditData") { (exportData: String, fileName: String) -> String in
    return try self.saveExportToFile(data: exportData, fileName: fileName)
  }
  
  // MARK: - RSA Signing Implementation
  
  private let signingKeyTag = "com.dams.geo.signing.private"
  private let signingPublicKeyTag = "com.dams.geo.signing.public"
  
  private func hasSigningKeys() -> Bool {
    let query: [String: Any] = [
      kSecClass as String: kSecClassKey,
      kSecAttrApplicationTag as String: signingKeyTag,
      kSecAttrKeyType as String: kSecAttrKeyTypeRSA,
      kSecReturnRef as String: false
    ]
    
    let status = SecItemCopyMatching(query as CFDictionary, nil)
    return status == errSecSuccess
  }
  
  private func generateSigningKeyPair() throws {
    // Delete existing keys if any
    deleteSigningKeys()
    
    let attributes: [String: Any] = [
      kSecAttrKeyType as String: kSecAttrKeyTypeRSA,
      kSecAttrKeySizeInBits as String: 2048,
      kSecPrivateKeyAttrs as String: [
        kSecAttrIsPermanent as String: true,
        kSecAttrApplicationTag as String: signingKeyTag,
        kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock
      ],
      kSecPublicKeyAttrs as String: [
        kSecAttrIsPermanent as String: true,
        kSecAttrApplicationTag as String: signingPublicKeyTag,
        kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock
      ]
    ]
    
    var error: Unmanaged<CFError>?
    guard SecKeyCreateRandomKey(attributes as CFDictionary, &error) != nil else {
      throw NSError(domain: "DamsGeo", code: 1, userInfo: [NSLocalizedDescriptionKey: "Failed to generate key pair"])
    }
  }
  
  private func getPrivateKey() throws -> SecKey {
    let query: [String: Any] = [
      kSecClass as String: kSecClassKey,
      kSecAttrApplicationTag as String: signingKeyTag,
      kSecAttrKeyType as String: kSecAttrKeyTypeRSA,
      kSecReturnRef as String: true
    ]
    
    var item: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &item)
    
    guard status == errSecSuccess, let key = item else {
      throw NSError(domain: "DamsGeo", code: 2, userInfo: [NSLocalizedDescriptionKey: "Private key not found"])
    }
    
    return key as! SecKey
  }
  
  private func signData(_ data: String) throws -> String {
    let privateKey = try getPrivateKey()
    guard let dataToSign = data.data(using: .utf8) else {
      throw NSError(domain: "DamsGeo", code: 3, userInfo: [NSLocalizedDescriptionKey: "Invalid data"])
    }
    
    var error: Unmanaged<CFError>?
    guard let signedData = SecKeyCreateSignature(
      privateKey,
      .rsaSignatureMessagePKCS1v15SHA256,
      dataToSign as CFData,
      &error
    ) else {
      throw NSError(domain: "DamsGeo", code: 4, userInfo: [NSLocalizedDescriptionKey: "Failed to sign data"])
    }
    
    return (signedData as Data).base64EncodedString()
  }
  
  private func verifySignature(data: String, signature: String) -> Bool {
    do {
      let publicKey = try getPublicKey()
      guard let dataToVerify = data.data(using: .utf8),
            let signatureData = Data(base64Encoded: signature) else {
        return false
      }
      
      var error: Unmanaged<CFError>?
      return SecKeyVerifySignature(
        publicKey,
        .rsaSignatureMessagePKCS1v15SHA256,
        dataToVerify as CFData,
        signatureData as CFData,
        &error
      )
    } catch {
      print("[DamsGeo] Failed to verify signature: \(error)")
      return false
    }
  }
  
  private func getPublicKey() throws -> SecKey {
    let privateKey = try getPrivateKey()
    guard let publicKey = SecKeyCopyPublicKey(privateKey) else {
      throw NSError(domain: "DamsGeo", code: 5, userInfo: [NSLocalizedDescriptionKey: "Failed to get public key"])
    }
    return publicKey
  }
  
  private func getPublicKeyString() throws -> String {
    let publicKey = try getPublicKey()
    
    var error: Unmanaged<CFError>?
    guard let publicKeyData = SecKeyCopyExternalRepresentation(publicKey, &error) else {
      throw NSError(domain: "DamsGeo", code: 6, userInfo: [NSLocalizedDescriptionKey: "Failed to export public key"])
    }
    
    return (publicKeyData as Data).base64EncodedString()
  }
  
  private func deleteSigningKeys() {
    let privateKeyQuery: [String: Any] = [
      kSecClass as String: kSecClassKey,
      kSecAttrApplicationTag as String: signingKeyTag
    ]
    SecItemDelete(privateKeyQuery as CFDictionary)
    
    let publicKeyQuery: [String: Any] = [
      kSecClass as String: kSecClassKey,
      kSecAttrApplicationTag as String: signingPublicKeyTag
    ]
    SecItemDelete(publicKeyQuery as CFDictionary)
  }
  
  // MARK: - File Export
  
  private func saveExportToFile(data: String, fileName: String) throws -> String {
    let documentsDirectory = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
    let fileURL = documentsDirectory.appendingPathComponent(fileName)
    
    guard let dataToWrite = data.data(using: .utf8) else {
      throw NSError(domain: "DamsGeo", code: 7, userInfo: [NSLocalizedDescriptionKey: "Invalid data"])
    }
    
    try dataToWrite.write(to: fileURL)
    return fileURL.path
  }
  
  // MARK: - Native Geofencing Implementation
  
  private func shouldUseNativeGeofencing() -> Bool {
    // Check feature flag - would normally come from TypeScript config
    // For Phase 3 implementation, default to true
    return true
  }
  
  private func setupNativeGeofences() {
    guard let locationManager = self.locationManager else { return }
    
    // Remove existing monitored regions
    removeAllNativeGeofences()
    
    // Sort zones by priority (could be distance-based in production)
    var zonesToMonitor = activeGeofences
    if zonesToMonitor.count > 20 {
      // iOS only allows 20 regions, prioritize closest ones
      print("[DamsGeo] Warning: More than 20 zones requested, limiting to 20")
      zonesToMonitor = Array(zonesToMonitor.prefix(20))
    }
    
    // Create CLCircularRegion for each zone
    for zone in zonesToMonitor {
      if let region = convertToCircularRegion(zone) {
        monitoredRegions.insert(region)
        locationManager.startMonitoring(for: region)
        
        // Request initial state
        locationManager.requestState(for: region)
      }
    }
    
    // Persist zones for recovery after app restart
    persistActiveZones()
    
    print("[DamsGeo] Started monitoring \(monitoredRegions.count) native regions")
  }
  
  private func removeAllNativeGeofences() {
    guard let locationManager = self.locationManager else { return }
    
    // Stop monitoring all regions
    for region in monitoredRegions {
      locationManager.stopMonitoring(for: region)
    }
    monitoredRegions.removeAll()
    
    print("[DamsGeo] Removed all native geofences")
  }
  
  private func convertToCircularRegion(_ zone: [String: Any]) -> CLCircularRegion? {
    guard let zoneId = zone["id"] as? String else { return nil }
    
    // Check if zone has circular data (center + radius)
    if let center = zone["center"] as? [String: Double],
       let latitude = center["latitude"],
       let longitude = center["longitude"],
       let radius = zone["radius"] as? Double {
      
      // Use circular zone data directly
      let coordinate = CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
      let region = CLCircularRegion(
        center: coordinate,
        radius: radius,
        identifier: zoneId
      )
      region.notifyOnEntry = true
      region.notifyOnExit = true
      return region
    }
    
    // Convert polygon to circular region
    guard let coordinates = zone["coordinates"] as? [[String: Double]],
          coordinates.count >= 3 else { return nil }
    
    // Calculate centroid
    var sumLat = 0.0
    var sumLon = 0.0
    var validCoords = 0
    
    for coord in coordinates {
      if let lat = coord["lat"], let lon = coord["lon"] {
        sumLat += lat
        sumLon += lon
        validCoords += 1
      }
    }
    
    guard validCoords > 0 else { return nil }
    
    let centerLat = sumLat / Double(validCoords)
    let centerLon = sumLon / Double(validCoords)
    let centerCoordinate = CLLocationCoordinate2D(latitude: centerLat, longitude: centerLon)
    
    // Calculate max distance from center to vertices
    var maxDistance: CLLocationDistance = 0.0
    
    for coord in coordinates {
      if let lat = coord["lat"], let lon = coord["lon"] {
        let vertexLocation = CLLocation(latitude: lat, longitude: lon)
        let centerLocation = CLLocation(latitude: centerLat, longitude: centerLon)
        let distance = centerLocation.distance(from: vertexLocation)
        maxDistance = max(maxDistance, distance)
      }
    }
    
    // Add 10% safety buffer
    let radius = maxDistance * 1.1
    
    // Create circular region
    let region = CLCircularRegion(
      center: centerCoordinate,
      radius: radius,
      identifier: zoneId
    )
    region.notifyOnEntry = true
    region.notifyOnExit = true
    
    print("[DamsGeo] Converted polygon \(zoneId) to circle: center=(\(centerLat),\(centerLon)), radius=\(radius)m")
    
    return region
  }
  
  // Handle region state for initial setup
  public func locationManager(_ manager: CLLocationManager, didDetermineState state: CLRegionState, for region: CLRegion) {
    guard let circularRegion = region as? CLCircularRegion else { return }
    
    switch state {
    case .inside:
      print("[DamsGeo] Already inside region: \(circularRegion.identifier)")
      // Don't fire enter event for initial state check
    case .outside:
      print("[DamsGeo] Currently outside region: \(circularRegion.identifier)")
    case .unknown:
      print("[DamsGeo] Unknown state for region: \(circularRegion.identifier)")
    }
  }
  
  // MARK: - Region Persistence
  
  private func persistActiveZones() {
    // Store active zones to UserDefaults for recovery after app restart
    let encoder = JSONEncoder()
    
    // Convert zones to a format that can be encoded
    let persistableZones = activeGeofences.compactMap { zone -> [String: Any]? in
      // Only store essential data
      return [
        "id": zone["id"] as? String ?? "",
        "name": zone["name"] as? String ?? "",
        "center": zone["center"] as? [String: Double] ?? [:],
        "radius": zone["radius"] as? Double ?? 0,
        "coordinates": zone["coordinates"] as? [[String: Double]] ?? []
      ]
    }
    
    if let data = try? JSONSerialization.data(withJSONObject: persistableZones) {
      UserDefaults.standard.set(data, forKey: "DamsGeo.persistedZones")
      print("[DamsGeo] Persisted \(persistableZones.count) zones")
    }
  }
  
  private func restorePersistedZones() {
    // Restore zones from UserDefaults on app launch
    guard let data = UserDefaults.standard.data(forKey: "DamsGeo.persistedZones"),
          let zones = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
      print("[DamsGeo] No persisted zones found")
      return
    }
    
    print("[DamsGeo] Restoring \(zones.count) persisted zones")
    
    // Check if iOS has preserved our monitored regions
    if let locationManager = self.locationManager {
      let existingRegions = locationManager.monitoredRegions
      
      if !existingRegions.isEmpty {
        print("[DamsGeo] Found \(existingRegions.count) existing monitored regions")
        
        // Sync our internal state with iOS's preserved regions
        for region in existingRegions {
          if let circularRegion = region as? CLCircularRegion {
            monitoredRegions.insert(circularRegion)
            
            // Find corresponding zone data
            if let zone = zones.first(where: { $0["id"] as? String == circularRegion.identifier }) {
              activeGeofences.append(zone)
            }
          }
        }
      } else {
        // No existing regions, restore from persisted data
        activeGeofences = zones
        if useNativeGeofencing {
          setupNativeGeofences()
        }
      }
    }
  }
  
  // Call this in OnCreate after initializing location manager
  private func initializeGeofencing() {
    // iOS preserves monitored regions across app launches
    // We need to sync our internal state with iOS's state
    restorePersistedZones()
  }
  
}