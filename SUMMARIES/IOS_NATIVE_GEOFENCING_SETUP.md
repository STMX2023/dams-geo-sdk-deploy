# iOS Native Geofencing Setup Guide

## Info.plist Permissions Required

Add the following keys to your app's `Info.plist` file for native geofencing to work properly:

```xml
<!-- Location Permissions -->
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>This app needs location access to track your trips and notify you when entering/exiting delivery zones, even when the app is in the background.</string>

<key>NSLocationWhenInUseUsageDescription</key>
<string>This app needs location access to track your current position and nearby delivery zones.</string>

<key>NSLocationAlwaysUsageDescription</key>
<string>This app needs background location access to track trips and monitor delivery zones.</string>

<!-- Background Modes -->
<key>UIBackgroundModes</key>
<array>
    <string>location</string>
    <string>fetch</string>
    <string>processing</string>
</array>

<!-- Background Task Identifiers (iOS 13+) -->
<key>BGTaskSchedulerPermittedIdentifiers</key>
<array>
    <string>com.dams.geo.refresh</string>
</array>
```

## Capabilities Required

In Xcode, enable the following capabilities:

1. **Background Modes**
   - Location updates ✓
   - Background fetch ✓
   - Background processing ✓

2. **Location Services**
   - Always authorization required for geofencing

## Implementation Details

### Native Geofencing Features

1. **Automatic Wake on Boundary Cross**
   - iOS will wake the app when entering/exiting a monitored region
   - Works even when app is terminated
   - Minimal battery impact

2. **20 Region Limit**
   - iOS enforces a maximum of 20 monitored regions per app
   - Implementation automatically prioritizes closest zones
   - Handles overflow gracefully

3. **Polygon to Circle Conversion**
   - Converts polygon zones to circular regions
   - Calculates centroid and max radius
   - Adds 10% safety buffer

4. **Background Events**
   - Events include `triggeredInBackground` flag
   - App can process events when woken from terminated state
   - Persistent storage for offline events

### Code Integration

The native geofencing is automatically activated when:
1. Feature flag `useNativeGeofencing` is true
2. Location permissions are granted
3. Zones are set via `setGeofences()`

### Testing Background Wake

1. **Deploy to Physical Device** (Simulator limitations)
2. **Grant "Always" Location Permission**
3. **Set Test Geofences**
4. **Force Quit App** (swipe up from app switcher)
5. **Move Device** to trigger boundary crossing
6. **Verify Events** are received when app wakes

### Battery Performance

Native geofencing provides significant battery savings:
- **Manual Polygon Mode**: Continuous GPS updates
- **Native Region Mode**: OS-managed, event-driven
- **Expected Savings**: 80-90% battery reduction

### Debug Logging

Enable verbose logging to monitor geofencing:
```swift
// In DamsGeoModule.swift
print("[DamsGeo] Started monitoring \(monitoredRegions.count) native regions")
print("[DamsGeo] Native geofence entered: \(circularRegion.identifier)")
print("[DamsGeo] Native geofence exited: \(circularRegion.identifier)")
```

### Common Issues

1. **"Location Services Not Authorized"**
   - Ensure "Always" permission is granted
   - Check Info.plist has all required keys

2. **"Region Monitoring Not Available"**
   - Verify device has GPS capability
   - Check airplane mode is off
   - Ensure location services enabled

3. **"Maximum Regions Exceeded"**
   - Limit zones to 20 for iOS
   - Implement zone prioritization logic

4. **"No Background Events"**
   - Verify UIBackgroundModes includes "location"
   - Check app isn't being terminated by iOS for memory
   - Test with real device movement (>100m)

### Migration Checklist

- [ ] Update Info.plist with all permission keys
- [ ] Enable Background Modes capability
- [ ] Test on physical iOS device
- [ ] Verify "Always" location permission flow
- [ ] Test background wake functionality
- [ ] Monitor battery usage improvement
- [ ] Validate zone conversion accuracy