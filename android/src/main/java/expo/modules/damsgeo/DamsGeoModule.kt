package expo.modules.damsgeo

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.os.Build
import android.os.Looper
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.google.android.gms.location.*
import com.google.android.gms.location.ActivityRecognition
import com.google.android.gms.location.ActivityRecognitionClient
import com.google.android.gms.location.ActivityTransition
import com.google.android.gms.location.ActivityTransitionRequest
import com.google.android.gms.location.DetectedActivity
import com.google.android.gms.location.Geofence
import com.google.android.gms.location.GeofencingClient
import com.google.android.gms.location.GeofencingRequest
import java.util.concurrent.TimeUnit
import java.security.KeyStore
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.PrivateKey
import java.security.Signature
import android.os.Environment
import android.util.Log
import java.io.File
import android.os.BatteryManager
import android.content.IntentFilter

class DamsGeoModule : Module() {
  companion object {
    var instance: DamsGeoModule? = null
  }
  
  private lateinit var fusedLocationClient: FusedLocationProviderClient
  private lateinit var locationCallback: LocationCallback
  private lateinit var activityRecognitionClient: ActivityRecognitionClient
  private lateinit var geofencingClient: GeofencingClient
  private var activityPendingIntent: android.app.PendingIntent? = null
  private var geofencePendingIntent: android.app.PendingIntent? = null
  private var isTracking = false
  private var lastActivity = "unknown"
  private var activeGeofences = mutableListOf<Map<String, Any>>()
  private var zoneStates = mutableMapOf<String, Boolean>()
  private var useNativeGeofencing = false
  
  override fun definition() = ModuleDefinition {
    Name("DamsGeo")
    
    Constants(
      "isTracking" to false
    )
    
    Events("onLocationUpdate", "onGeofenceEnter", "onGeofenceExit", "onActivityChange", "onError")
    
    OnCreate {
      val context = appContext.reactContext ?: return@OnCreate
      instance = this
      fusedLocationClient = LocationServices.getFusedLocationProviderClient(context)
      activityRecognitionClient = ActivityRecognition.getClient(context)
      geofencingClient = LocationServices.getGeofencingClient(context)
      setupLocationCallback()
      setupGeofenceIntent(context)
    }
    
    AsyncFunction("startTracking") { config: Map<String, Any>, promise: Promise ->
      startLocationTracking(config, promise)
    }
    
    AsyncFunction("stopTracking") { reason: String, promise: Promise ->
      stopLocationTracking(reason, promise)
    }
    
    Function("setGeofences") { zones: List<Map<String, Any>> ->
      setGeofenceZones(zones)
    }
    
    Function("getCurrentActivity") {
      return@Function lastActivity
    }
    
    Property("isTracking") {
      return@Property isTracking
    }
    
    // Encryption key management functions
    AsyncFunction("getEncryptionKey") { keyAlias: String, promise: Promise ->
      promise.resolve(getFromKeystore(keyAlias))
    }
    
    AsyncFunction("storeEncryptionKey") { keyAlias: String, key: String, promise: Promise ->
      try {
        saveToKeystore(keyAlias, key)
        promise.resolve(null)
      } catch (e: Exception) {
        promise.reject("KEYSTORE_ERROR", "Failed to store encryption key", e)
      }
    }
    
    AsyncFunction("deleteEncryptionKey") { keyAlias: String, promise: Promise ->
      try {
        deleteFromKeystore(keyAlias)
        promise.resolve(null)
      } catch (e: Exception) {
        promise.reject("KEYSTORE_ERROR", "Failed to delete encryption key", e)
      }
    }
    
    AsyncFunction("isEncryptionAvailable") { promise: Promise ->
      promise.resolve(isKeystoreAvailable())
    }
    
    // Update tracking configuration while tracking
    AsyncFunction("updateTrackingConfig") { config: Map<String, Any>, promise: Promise ->
      if (!isTracking) {
        promise.resolve(null)
        return@AsyncFunction
      }
      // Recreate a new LocationRequest with updated params
      val context = appContext.reactContext ?: run {
        promise.reject("NO_CONTEXT", "No React context")
        return@AsyncFunction
      }

      val builder = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 10000L)
      config["distanceFilter"]?.let { df ->
        if (df is Number) builder.setMinUpdateDistanceMeters(df.toFloat())
      }
      when (config["desiredAccuracy"] as? String) {
        "best", "high" -> builder.setPriority(Priority.PRIORITY_HIGH_ACCURACY)
        "medium" -> builder.setPriority(Priority.PRIORITY_BALANCED_POWER_ACCURACY)
        "low" -> builder.setPriority(Priority.PRIORITY_LOW_POWER)
      }

      fusedLocationClient.removeLocationUpdates(locationCallback).addOnCompleteListener {
        fusedLocationClient.requestLocationUpdates(
          builder.build(),
          locationCallback,
          Looper.getMainLooper()
        )
        promise.resolve(null)
      }
    }

    // Simple battery status fetcher
    AsyncFunction("getBatteryStatus") { promise: Promise ->
      val context = appContext.reactContext ?: run {
        promise.reject("NO_CONTEXT", "No React context")
        return@AsyncFunction
      }
      val ifilter = IntentFilter(Intent.ACTION_BATTERY_CHANGED)
      val batteryStatus = context.registerReceiver(null, ifilter)
      val level = batteryStatus?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
      val scale = batteryStatus?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
      val percent = if (level >= 0 && scale > 0) level * 100 / scale else -1
      val plugged = batteryStatus?.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0) ?: 0
      val charging = plugged != 0
      promise.resolve(mapOf("level" to percent, "isCharging" to charging))
    }

    // Export audit data to Documents directory
    AsyncFunction("exportAuditData") { exportData: String, fileName: String, promise: Promise ->
      val context = appContext.reactContext ?: run {
        promise.reject("NO_CONTEXT", "No React context")
        return@AsyncFunction
      }
      try {
        val dir = context.getExternalFilesDir(Environment.DIRECTORY_DOCUMENTS) ?: context.filesDir
        val file = File(dir, fileName)
        file.writeText(exportData)
        promise.resolve(file.absolutePath)
      } catch (e: Exception) {
        promise.reject("FILE_ERROR", "Failed to write export file", e)
      }
    }
  }
  
  private fun setupLocationCallback() {
    locationCallback = object : LocationCallback() {
      override fun onLocationResult(locationResult: LocationResult) {
        for (location in locationResult.locations) {
          sendLocationUpdate(location)
        }
      }
    }
  }
  
  private fun setupGeofenceIntent(context: Context) {
    val intent = Intent(context, GeofenceBroadcastReceiver::class.java)
    geofencePendingIntent = android.app.PendingIntent.getBroadcast(
      context,
      1234, // Different request code from activity
      intent,
      android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_MUTABLE
    )
  }
  
  private fun startLocationTracking(config: Map<String, Any>, promise: Promise) {
    // Basic root detection – block if device appears rooted
    if (isDeviceRooted()) {
      promise.reject("DEVICE_COMPROMISED", "Rooted or compromised device detected")
      return
    }
    
    val context = appContext.reactContext ?: run {
      promise.reject(LocationPermissionException())
      return
    }
    
    // Check permissions
    if (!hasLocationPermission(context)) {
      promise.reject(LocationPermissionException())
      return
    }
    
    // Start foreground service for Android 8+ to ensure background tracking
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val serviceIntent = Intent(context, LocationService::class.java)
      ContextCompat.startForegroundService(context, serviceIntent)
    }
    
    // Build location request
    val locationRequest = LocationRequest.Builder(
      Priority.PRIORITY_HIGH_ACCURACY,
      10000L // 10 seconds
    ).apply {
      // Apply config
      config["distanceFilter"]?.let { filter ->
        if (filter is Number) {
          setMinUpdateDistanceMeters(filter.toFloat())
        }
      }
      
      when (config["desiredAccuracy"] as? String) {
        "best" -> setPriority(Priority.PRIORITY_HIGH_ACCURACY)
        "high" -> setPriority(Priority.PRIORITY_HIGH_ACCURACY)
        "medium" -> setPriority(Priority.PRIORITY_BALANCED_POWER_ACCURACY)
        "low" -> setPriority(Priority.PRIORITY_LOW_POWER)
      }
    }.build()
    
    // Start location updates
    try {
      fusedLocationClient.requestLocationUpdates(
        locationRequest,
        locationCallback,
        Looper.getMainLooper()
      )
      isTracking = true
      
      // Start activity recognition
      startActivityRecognition()
      
      promise.resolve(null)
      println("[DamsGeo] Started tracking with config: $config")
    } catch (e: SecurityException) {
      promise.reject(LocationPermissionException())
    }
  }
  
  private fun stopLocationTracking(reason: String, promise: Promise) {
    val context = appContext.reactContext
    
    fusedLocationClient.removeLocationUpdates(locationCallback)
    stopActivityRecognition()
    isTracking = false
    
    // Stop foreground service
    if (context != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val serviceIntent = Intent(context, LocationService::class.java)
      context.stopService(serviceIntent)
    }
    
    promise.resolve(null)
    println("[DamsGeo] Stopped tracking. Reason: $reason")
  }
  
  private fun sendLocationUpdate(location: Location) {
    val locationUpdate = mapOf(
      "lat" to location.latitude,
      "lon" to location.longitude,
      "accuracy" to location.accuracy,
      "speed" to if (location.hasSpeed()) location.speed else null,
      "heading" to if (location.hasBearing()) location.bearing else null,
      "altitude" to if (location.hasAltitude()) location.altitude else null,
      "activityType" to lastActivity,
      "timestamp" to location.time
    )
    
    sendEvent("onLocationUpdate", locationUpdate)
    
    // Check geofences
    checkGeofences(location)
  }
  
  private fun hasLocationPermission(context: Context): Boolean {
    return ActivityCompat.checkSelfPermission(
      context,
      Manifest.permission.ACCESS_FINE_LOCATION
    ) == PackageManager.PERMISSION_GRANTED
  }
  
  // Custom exception
  internal class LocationPermissionException : 
    CodedException("Location permission is not granted")
  
  // Activity Recognition
  private fun startActivityRecognition() {
    val context = appContext.reactContext ?: return
    
    // Check for activity recognition permission (required on Android 10+)
    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
      if (ActivityCompat.checkSelfPermission(
          context,
          Manifest.permission.ACTIVITY_RECOGNITION
        ) != PackageManager.PERMISSION_GRANTED
      ) {
        println("[DamsGeo] Activity recognition permission not granted")
        return
      }
    }
    
    // Create pending intent for activity updates
    val intent = android.content.Intent(context, ActivityRecognitionReceiver::class.java)
    activityPendingIntent = android.app.PendingIntent.getBroadcast(
      context,
      0,
      intent,
      android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_MUTABLE
    )
    
    // Request activity updates every 30 seconds
    activityRecognitionClient.requestActivityUpdates(
      30000L, // 30 seconds
      activityPendingIntent!!
    ).addOnSuccessListener {
      println("[DamsGeo] Activity recognition started")
    }.addOnFailureListener { e ->
      println("[DamsGeo] Failed to start activity recognition: ${e.message}")
    }
  }
  
  private fun stopActivityRecognition() {
    activityPendingIntent?.let { pendingIntent ->
      activityRecognitionClient.removeActivityUpdates(pendingIntent)
        .addOnSuccessListener {
          println("[DamsGeo] Activity recognition stopped")
        }
    }
  }
  
  // Convert DetectedActivity to our activity type
  private fun getActivityString(detectedActivityType: Int): String {
    return when (detectedActivityType) {
      DetectedActivity.STILL -> "stationary"
      DetectedActivity.ON_FOOT, DetectedActivity.WALKING -> "walking"
      DetectedActivity.IN_VEHICLE -> "vehicle"
      else -> "unknown"
    }
  }
  
  // Geofencing
  private fun setGeofenceZones(zones: List<Map<String, Any>>) {
    val context = appContext.reactContext ?: return
    
    // Check if we should use native geofencing (from feature flags)
    useNativeGeofencing = shouldUseNativeGeofencing()
    
    // Validate zone count based on platform limits
    val maxZones = if (useNativeGeofencing) 100 else 10 // Android allows 100 native geofences
    if (zones.size > maxZones) {
      sendEvent("onError", mapOf(
        "code" to "GEOFENCE_LIMIT",
        "message" to "Maximum $maxZones geofence zones allowed"
      ))
      return
    }
    
    // Store active zones
    activeGeofences.clear()
    zones.forEach { zone ->
      if (zone["isActive"] as? Boolean == true) {
        activeGeofences.add(zone)
      }
    }
    
    if (useNativeGeofencing && activeGeofences.isNotEmpty()) {
      setupNativeGeofences(activeGeofences)
    } else {
      // Remove any existing native geofences
      removeAllNativeGeofences()
    }
    
    println("[DamsGeo] Set ${activeGeofences.size} active geofences (native: $useNativeGeofencing)")
  }
  
  private fun checkGeofences(location: Location) {
    // Skip manual checking if using native geofencing
    if (useNativeGeofencing) {
      return
    }
    
    activeGeofences.forEach { zone ->
      val zoneId = zone["id"] as? String ?: return@forEach
      val zoneName = zone["name"] as? String ?: return@forEach
      @Suppress("UNCHECKED_CAST")
      val coordinates = zone["coordinates"] as? List<Map<String, Double>> ?: return@forEach
      
      // Convert to coordinate pairs
      val polygon = coordinates.map { coord ->
        Pair(coord["lat"] ?: 0.0, coord["lon"] ?: 0.0)
      }
      
      // Check if location is inside polygon
      val isInside = isLocationInPolygon(location.latitude, location.longitude, polygon)
      val wasInside = zoneStates[zoneId] ?: false
      
      if (isInside && !wasInside) {
        // Entered zone
        zoneStates[zoneId] = true
        sendEvent("onGeofenceEnter", mapOf(
          "zoneId" to zoneId,
          "zoneName" to zoneName,
          "location" to mapOf(
            "lat" to location.latitude,
            "lon" to location.longitude,
            "timestamp" to location.time
          )
        ))
      } else if (!isInside && wasInside) {
        // Exited zone
        zoneStates[zoneId] = false
        sendEvent("onGeofenceExit", mapOf(
          "zoneId" to zoneId,
          "zoneName" to zoneName,
          "location" to mapOf(
            "lat" to location.latitude,
            "lon" to location.longitude,
            "timestamp" to location.time
          )
        ))
      }
    }
  }
  
  // Handle geofence transitions from native API
  fun handleGeofenceTransition(geofencingEvent: GeofencingEvent) {
    if (geofencingEvent.hasError()) {
      println("[DamsGeo] Geofencing error: ${geofencingEvent.errorCode}")
      return
    }
    
    val geofenceTransition = geofencingEvent.geofenceTransition
    val triggeringGeofences = geofencingEvent.triggeringGeofences ?: return
    val location = geofencingEvent.triggeringLocation
    
    triggeringGeofences.forEach { geofence ->
      val zoneId = geofence.requestId
      val zone = activeGeofences.find { it["id"] == zoneId }
      val zoneName = zone?.get("name") as? String ?: "Unknown Zone"
      
      when (geofenceTransition) {
        Geofence.GEOFENCE_TRANSITION_ENTER -> {
          sendEvent("onGeofenceEnter", mapOf(
            "zoneId" to zoneId,
            "zoneName" to zoneName,
            "location" to mapOf(
              "lat" to location.latitude,
              "lon" to location.longitude,
              "timestamp" to System.currentTimeMillis()
            )
          ))
        }
        Geofence.GEOFENCE_TRANSITION_EXIT -> {
          sendEvent("onGeofenceExit", mapOf(
            "zoneId" to zoneId,
            "zoneName" to zoneName,
            "location" to mapOf(
              "lat" to location.latitude,
              "lon" to location.longitude,
              "timestamp" to System.currentTimeMillis()
            )
          ))
        }
      }
    }
  }
  
  // Native Geofencing Implementation
  private fun shouldUseNativeGeofencing(): Boolean {
    // This would check feature flags from the TypeScript side
    // For now, we'll default to true for Phase 2 implementation
    return true
  }
  
  private fun setupNativeGeofences(zones: List<Map<String, Any>>) {
    val context = appContext.reactContext ?: return
    
    if (!hasLocationPermission(context)) {
      println("[DamsGeo] Cannot setup native geofences without location permission")
      return
    }
    
    // Convert zones to native Geofence objects
    val geofences = mutableListOf<Geofence>()
    
    zones.forEach { zone ->
      val geofence = convertToNativeGeofence(zone)
      if (geofence != null) {
        geofences.add(geofence)
      }
    }
    
    if (geofences.isEmpty()) return
    
    // Build geofencing request
    val request = GeofencingRequest.Builder().apply {
      setInitialTrigger(GeofencingRequest.INITIAL_TRIGGER_ENTER)
      addGeofences(geofences)
    }.build()
    
    // Add geofences
    try {
      geofencingClient.removeGeofences(geofencePendingIntent!!).addOnCompleteListener {
        geofencingClient.addGeofences(request, geofencePendingIntent!!)
          .addOnSuccessListener {
            println("[DamsGeo] Successfully added ${geofences.size} native geofences")
          }
          .addOnFailureListener { e ->
            println("[DamsGeo] Failed to add native geofences: ${e.message}")
            sendEvent("onError", mapOf(
              "code" to "GEOFENCE_ERROR",
              "message" to "Failed to setup native geofences: ${e.message}"
            ))
          }
      }
    } catch (e: SecurityException) {
      println("[DamsGeo] Security exception adding geofences: ${e.message}")
    }
  }
  
  private fun convertToNativeGeofence(zone: Map<String, Any>): Geofence? {
    val id = zone["id"] as? String ?: return null
    
    // Check if zone has circular data (center + radius)
    val center = zone["center"] as? Map<String, Double>
    val radius = zone["radius"] as? Number
    
    if (center != null && radius != null) {
      // Use circular zone data directly
      val lat = center["latitude"] ?: return null
      val lon = center["longitude"] ?: return null
      
      return Geofence.Builder()
        .setRequestId(id)
        .setCircularRegion(lat, lon, radius.toFloat())
        .setExpirationDuration(Geofence.NEVER_EXPIRE)
        .setTransitionTypes(Geofence.GEOFENCE_TRANSITION_ENTER or Geofence.GEOFENCE_TRANSITION_EXIT)
        .build()
    } else {
      // Convert polygon to circular zone
      @Suppress("UNCHECKED_CAST")
      val coordinates = zone["coordinates"] as? List<Map<String, Double>> ?: return null
      
      if (coordinates.size < 3) return null
      
      // Calculate centroid
      var sumLat = 0.0
      var sumLon = 0.0
      coordinates.forEach { coord ->
        sumLat += coord["lat"] ?: 0.0
        sumLon += coord["lon"] ?: 0.0
      }
      val centerLat = sumLat / coordinates.size
      val centerLon = sumLon / coordinates.size
      
      // Calculate radius as max distance from center to any vertex + 10% buffer
      var maxDistance = 0.0
      coordinates.forEach { coord ->
        val lat = coord["lat"] ?: 0.0
        val lon = coord["lon"] ?: 0.0
        val distance = calculateDistance(centerLat, centerLon, lat, lon)
        if (distance > maxDistance) {
          maxDistance = distance
        }
      }
      
      // Add 10% safety buffer
      val radiusMeters = (maxDistance * 1.1).toFloat()
      
      return Geofence.Builder()
        .setRequestId(id)
        .setCircularRegion(centerLat, centerLon, radiusMeters)
        .setExpirationDuration(Geofence.NEVER_EXPIRE)
        .setTransitionTypes(Geofence.GEOFENCE_TRANSITION_ENTER or Geofence.GEOFENCE_TRANSITION_EXIT)
        .build()
    }
  }
  
  private fun removeAllNativeGeofences() {
    geofencePendingIntent?.let { pendingIntent ->
      geofencingClient.removeGeofences(pendingIntent)
        .addOnSuccessListener {
          println("[DamsGeo] Removed all native geofences")
        }
        .addOnFailureListener { e ->
          println("[DamsGeo] Failed to remove native geofences: ${e.message}")
        }
    }
  }
  
  private fun calculateDistance(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
    val earthRadius = 6371000.0 // meters
    val lat1Rad = Math.toRadians(lat1)
    val lat2Rad = Math.toRadians(lat2)
    val deltaLat = Math.toRadians(lat2 - lat1)
    val deltaLon = Math.toRadians(lon2 - lon1)
    
    val a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
            Math.cos(lat1Rad) * Math.cos(lat2Rad) *
            Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2)
    val c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    
    return earthRadius * c
  }
  
  // Ray-casting algorithm for point-in-polygon
  private fun isLocationInPolygon(lat: Double, lon: Double, polygon: List<Pair<Double, Double>>): Boolean {
    if (polygon.size < 3) return false
    
    var inside = false
    var p1 = polygon[0]
    
    for (i in 1..polygon.size) {
      val p2 = polygon[i % polygon.size]
      
      if (lon > minOf(p1.second, p2.second)) {
        if (lon <= maxOf(p1.second, p2.second)) {
          if (lat <= maxOf(p1.first, p2.first)) {
            if (p1.second != p2.second) {
              val xinters = (lon - p1.second) * (p2.first - p1.first) / (p2.second - p1.second) + p1.first
              if (p1.first == p2.first || lat <= xinters) {
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
  
  // Handle activity update from receiver
  fun handleActivityUpdate(activityType: String, confidence: Int) {
    if (activityType != lastActivity) {
      lastActivity = activityType
      sendEvent("onActivityChange", mapOf(
        "activity" to activityType,
        "confidence" to confidence
      ))
    }
  }
  
  // Keystore Management
  private val ANDROID_KEYSTORE = "AndroidKeyStore"
  private val TRANSFORMATION = "AES/GCM/NoPadding"
  private val IV_SIZE = 12
  private val TAG_SIZE = 128
  
  private fun isKeystoreAvailable(): Boolean {
    return try {
      val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE)
      keyStore.load(null)
      true
    } catch (e: Exception) {
      false
    }
  }
  
  private fun saveToKeystore(keyAlias: String, value: String) {
    try {
      // Generate or get the secret key
      val secretKey = getOrCreateSecretKey(keyAlias)
      
      // Encrypt the value
      val cipher = Cipher.getInstance(TRANSFORMATION)
      cipher.init(Cipher.ENCRYPT_MODE, secretKey)
      val iv = cipher.iv
      val encryptedData = cipher.doFinal(value.toByteArray(Charsets.UTF_8))
      
      // Store encrypted data and IV in SharedPreferences
      val context = appContext.reactContext ?: return
      val prefs = context.getSharedPreferences("dams_geo_encryption", Context.MODE_PRIVATE)
      val editor = prefs.edit()
      
      // Combine IV and encrypted data
      val combined = ByteArray(iv.size + encryptedData.size)
      System.arraycopy(iv, 0, combined, 0, iv.size)
      System.arraycopy(encryptedData, 0, combined, iv.size, encryptedData.size)
      
      editor.putString(keyAlias, Base64.encodeToString(combined, Base64.DEFAULT))
      editor.apply()
    } catch (e: Exception) {
      throw e
    }
  }
  
  private fun getFromKeystore(keyAlias: String): String? {
    try {
      val context = appContext.reactContext ?: return null
      val prefs = context.getSharedPreferences("dams_geo_encryption", Context.MODE_PRIVATE)
      val encodedData = prefs.getString(keyAlias, null) ?: return null
      
      val combined = Base64.decode(encodedData, Base64.DEFAULT)
      if (combined.size < IV_SIZE) return null
      
      // Extract IV and encrypted data
      val iv = combined.sliceArray(0 until IV_SIZE)
      val encryptedData = combined.sliceArray(IV_SIZE until combined.size)
      
      // Get the secret key
      val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE)
      keyStore.load(null)
      val secretKey = keyStore.getKey(keyAlias, null) as? SecretKey ?: return null
      
      // Decrypt
      val cipher = Cipher.getInstance(TRANSFORMATION)
      val spec = GCMParameterSpec(TAG_SIZE, iv)
      cipher.init(Cipher.DECRYPT_MODE, secretKey, spec)
      val decryptedData = cipher.doFinal(encryptedData)
      
      return String(decryptedData, Charsets.UTF_8)
    } catch (e: Exception) {
      return null
    }
  }
  
  private fun deleteFromKeystore(keyAlias: String) {
    try {
      // Delete from Keystore
      val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE)
      keyStore.load(null)
      keyStore.deleteEntry(keyAlias)
      
      // Delete from SharedPreferences
      val context = appContext.reactContext ?: return
      val prefs = context.getSharedPreferences("dams_geo_encryption", Context.MODE_PRIVATE)
      prefs.edit().remove(keyAlias).apply()
    } catch (e: Exception) {
      // Ignore errors during deletion
    }
  }
  
  private fun getOrCreateSecretKey(keyAlias: String): SecretKey {
    val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE)
    keyStore.load(null)
    
    // Check if key already exists
    if (keyStore.containsAlias(keyAlias)) {
      return keyStore.getKey(keyAlias, null) as SecretKey
    }
    
    // Generate new key
    val keyGenerator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE)
    val keyGenParameterSpec = KeyGenParameterSpec.Builder(
      keyAlias,
      KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
    )
      .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
      .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
      .setKeySize(256)
      .build()
    
    keyGenerator.init(keyGenParameterSpec)
    return keyGenerator.generateKey()
  }
  
  // RSA Signing for Audit Exports
  
  private val SIGNING_KEY_ALIAS = "DamsGeoSigningKey"
  private val SIGNING_ALGORITHM = "SHA256withRSA"
  
  AsyncFunction("hasSigningKeyPair") { ->
    hasSigningKeyPair()
  }
  
  AsyncFunction("generateSigningKeyPair") { ->
    generateSigningKeyPair()
  }
  
  AsyncFunction("signData") { data: String ->
    signData(data)
  }
  
  AsyncFunction("verifySignature") { data: String, signature: String ->
    verifySignature(data, signature)
  }
  
  AsyncFunction("getSigningPublicKey") { ->
    getSigningPublicKey()
  }
  
  AsyncFunction("deleteSigningKeyPair") { ->
    deleteSigningKeyPair()
  }
  
  private fun hasSigningKeyPair(): Boolean {
    return try {
      val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE)
      keyStore.load(null)
      keyStore.containsAlias(SIGNING_KEY_ALIAS)
    } catch (e: Exception) {
      false
    }
  }
  
  private fun generateSigningKeyPair() {
    try {
      // Delete existing key if any
      deleteSigningKeyPair()
      
      val keyPairGenerator = KeyPairGenerator.getInstance(
        KeyProperties.KEY_ALGORITHM_RSA, 
        ANDROID_KEYSTORE
      )
      
      val keyGenParameterSpec = KeyGenParameterSpec.Builder(
        SIGNING_KEY_ALIAS,
        KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY
      )
        .setDigests(KeyProperties.DIGEST_SHA256)
        .setSignaturePaddings(KeyProperties.SIGNATURE_PADDING_RSA_PKCS1)
        .setKeySize(2048)
        .build()
      
      keyPairGenerator.initialize(keyGenParameterSpec)
      keyPairGenerator.generateKeyPair()
    } catch (e: Exception) {
      throw Exception("Failed to generate signing key pair: ${e.message}")
    }
  }
  
  private fun getSigningPrivateKey(): PrivateKey {
    val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE)
    keyStore.load(null)
    return keyStore.getKey(SIGNING_KEY_ALIAS, null) as PrivateKey
  }
  
  private fun getSigningPublicKey(): String {
    try {
      val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE)
      keyStore.load(null)
      val certificate = keyStore.getCertificate(SIGNING_KEY_ALIAS)
      val publicKey = certificate.publicKey
      return Base64.encodeToString(publicKey.encoded, Base64.NO_WRAP)
    } catch (e: Exception) {
      throw Exception("Failed to get public key: ${e.message}")
    }
  }
  
  private fun signData(data: String): String {
    try {
      val privateKey = getSigningPrivateKey()
      val signature = Signature.getInstance(SIGNING_ALGORITHM)
      signature.initSign(privateKey)
      signature.update(data.toByteArray(Charsets.UTF_8))
      val signedData = signature.sign()
      return Base64.encodeToString(signedData, Base64.NO_WRAP)
    } catch (e: Exception) {
      throw Exception("Failed to sign data: ${e.message}")
    }
  }
  
  private fun verifySignature(data: String, signatureStr: String): Boolean {
    return try {
      val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE)
      keyStore.load(null)
      val certificate = keyStore.getCertificate(SIGNING_KEY_ALIAS)
      val publicKey = certificate.publicKey
      
      val signature = Signature.getInstance(SIGNING_ALGORITHM)
      signature.initVerify(publicKey)
      signature.update(data.toByteArray(Charsets.UTF_8))
      
      val signatureBytes = Base64.decode(signatureStr, Base64.NO_WRAP)
      signature.verify(signatureBytes)
    } catch (e: Exception) {
      Log.e("DamsGeo", "Failed to verify signature: ${e.message}")
      false
    }
  }
  
  private fun deleteSigningKeyPair() {
    try {
      val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE)
      keyStore.load(null)
      if (keyStore.containsAlias(SIGNING_KEY_ALIAS)) {
        keyStore.deleteEntry(SIGNING_KEY_ALIAS)
      }
    } catch (e: Exception) {
      Log.e("DamsGeo", "Failed to delete signing key pair: ${e.message}")
    }
  }
  
  // -------- Root detection helpers --------

  private fun isDeviceRooted(): Boolean {
    val paths = arrayOf(
      "/system/app/Superuser.apk",
      "/sbin/su",
      "/system/bin/su",
      "/system/xbin/su",
      "/data/local/xbin/su",
      "/data/local/bin/su",
      "/system/sd/xbin/su",
      "/system/bin/failsafe/su",
      "/data/local/su"
    )
    return paths.any { File(it).exists() }
  }
}