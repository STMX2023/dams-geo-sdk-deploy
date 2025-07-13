# DAMS Geo SDK - Platform-Specific Implementation Guide

This guide covers platform-specific features, limitations, and implementation details for iOS and Android.

## Table of Contents
- [Overview](#overview)
- [Permission Handling](#permission-handling)
- [Background Execution](#background-execution)
- [Location Tracking](#location-tracking)
- [Activity Recognition](#activity-recognition)
- [Data Storage](#data-storage)
- [Security Features](#security-features)
- [Platform-Exclusive Features](#platform-exclusive-features)
- [Performance Considerations](#performance-considerations)
- [Troubleshooting](#troubleshooting)

## Overview

The DAMS Geo SDK provides a unified API across iOS and Android platforms, but some features have platform-specific implementations or limitations due to OS constraints.

### Platform Detection

```typescript
import { Platform } from 'react-native';

if (Platform.OS === 'ios') {
  // iOS-specific code
} else if (Platform.OS === 'android') {
  // Android-specific code
}
```

## Permission Handling

### iOS Permissions

#### Required Info.plist Entries
```xml
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>This app needs location access to track your activities</string>
<key>NSLocationWhenInUseUsageDescription</key>
<string>This app needs location access to track your activities</string>
<key>NSMotionUsageDescription</key>
<string>This app needs motion access to detect your activity type</string>
```

#### App Tracking Transparency (iOS 14.5+)
```typescript
// iOS-only methods
if (Platform.OS === 'ios') {
  // Request tracking permission
  const status = await DamsGeoModule.requestTrackingPermission();
  // Status: 'not-determined' | 'restricted' | 'denied' | 'authorized'
  
  // Check current status
  const currentStatus = await DamsGeoModule.getTrackingStatus();
}
```

#### Permission Flow
1. SDK automatically requests location permissions when `startTracking` is called
2. Motion permissions are requested when activity recognition is enabled
3. App Tracking Transparency must be handled separately by the app

### Android Permissions

#### Required AndroidManifest.xml Entries
```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
<uses-permission android:name="android.permission.ACTIVITY_RECOGNITION" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
```

#### Runtime Permission Handling
```typescript
import { PermissionsAndroid } from 'react-native';

if (Platform.OS === 'android') {
  const granted = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
    PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION,
  ]);
  
  // Check if all permissions are granted
  const allGranted = Object.values(granted).every(
    result => result === PermissionsAndroid.RESULTS.GRANTED
  );
}
```

#### Battery Optimization
Android devices may restrict background execution. Handle battery optimization:

```typescript
if (Platform.OS === 'android') {
  // Check if battery optimization is enabled
  // You may need to guide users to disable it for your app
  Alert.alert(
    'Battery Optimization',
    'Please disable battery optimization for reliable background tracking',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Open Settings', onPress: openBatterySettings }
    ]
  );
}
```

## Background Execution

### iOS Background Modes

#### Background Location Updates
- Enable "Location updates" background mode in Xcode
- SDK uses significant location changes for efficiency
- Battery impact is minimized through OS optimization

#### Background Sync Events (iOS Only)
```typescript
// Only available on iOS
const subscription = DamsGeo.addListener('onBackgroundSync', (event) => {
  console.log('Background sync requested:', event.reason);
  // Perform sync operations
});
```

Background sync is triggered by:
- App refresh tasks (scheduled by iOS)
- Significant location changes
- Network availability changes

### Android Background Execution

#### Foreground Service
- SDK automatically creates a foreground service for reliable tracking
- Notification is required (customizable via configuration)
- Service persists even when app is terminated

#### Work Manager Integration
- Periodic sync tasks scheduled using WorkManager
- Respects battery optimization and Doze mode
- No equivalent to iOS background sync events

## Location Tracking

### iOS-Specific Features

#### Significant Location Changes
```typescript
if (Platform.OS === 'ios') {
  await DamsGeo.startTracking({
    enableSignificantLocationChanges: true, // iOS only
    desiredAccuracy: 'best',
  });
}
```

Benefits:
- Very low battery consumption
- Works even when app is suspended
- Triggers at ~500m movements

#### Location Authorization Levels
- When In Use: Basic tracking when app is active
- Always: Required for background tracking
- Precise Location: Toggle for accuracy (iOS 14+)

### Android-Specific Features

#### Fused Location Provider
- Automatically selects best location source (GPS, WiFi, Cell)
- Adaptive battery consumption based on requirements
- Configurable location request priorities

#### Location Settings
```typescript
if (Platform.OS === 'android') {
  // Android may prompt user to enable location services
  // This is handled automatically by Google Play Services
}
```

## Activity Recognition

### iOS Implementation

Uses Core Motion framework:
- Real-time activity updates
- Historical activity queries
- Confidence levels for each activity

```typescript
// iOS activities
type iOSActivity = 
  | 'stationary'
  | 'walking'
  | 'running'
  | 'automotive'
  | 'cycling'
  | 'unknown';
```

### Android Implementation

Uses Google Play Services Activity Recognition:
- Periodic activity updates (not real-time)
- Requires explicit permission (API 29+)
- Different activity types available

```typescript
// Android activities
type AndroidActivity = 
  | 'still'
  | 'on_foot'
  | 'walking'
  | 'running'
  | 'in_vehicle'
  | 'on_bicycle'
  | 'tilting'
  | 'unknown';
```

### Unified Activity Types
The SDK normalizes activities across platforms:

```typescript
type ActivityType = 
  | 'stationary'
  | 'walking'
  | 'running'
  | 'driving'
  | 'cycling'
  | 'unknown';
```

## Data Storage

### Database Location

#### iOS
```typescript
// Stored in Documents directory
location: 'Documents'
// Path: /var/mobile/Containers/Data/Application/{UUID}/Documents/
```

#### Android
```typescript
// Stored in default app data directory
location: 'default'
// Path: /data/data/{package.name}/databases/
```

### Encryption

#### iOS Keychain
- Encryption keys stored in iOS Keychain
- Automatic iCloud Keychain sync (if enabled)
- Hardware-backed security on devices with Secure Enclave

```typescript
// Always available on iOS
const available = await DamsGeoModule.isEncryptionAvailable(); // true
```

#### Android Keystore
- Keys stored in Android Keystore
- Hardware-backed on devices with TEE/StrongBox
- Requires API 23+ for full functionality

```typescript
// Check availability on Android
const available = await DamsGeoModule.isEncryptionAvailable();
if (!available) {
  // Fall back to software encryption
}
```

## Security Features

### Digital Signatures

#### iOS Implementation
- Uses Security framework for RSA operations
- Keys stored in Keychain with access control
- Supports biometric authentication for key access

#### Android Implementation
- Uses Android Keystore for RSA operations
- Hardware-backed key generation when available
- Automatic key attestation support

### Audit File Storage

#### iOS
```typescript
// Audit files stored in Documents directory
const auditPath = await DamsGeo.exportAuditToFile(exportData, {
  compress: true, // Uses iOS compression APIs
  sign: true
});
// Path: .../Documents/Audits/audit_user123_2024-01-15.json
```

#### Android
```typescript
// Audit files stored in app-specific directory
const auditPath = await DamsGeo.exportAuditToFile(exportData, {
  compress: true, // Uses Java compression
  sign: true
});
// Path: /storage/emulated/0/Android/data/{package}/files/Audits/...
```

## Platform-Exclusive Features

### iOS-Only Features

1. **App Tracking Transparency**
   ```typescript
   const trackingStatus = await DamsGeoModule.requestTrackingPermission();
   ```

2. **Background Sync Events**
   ```typescript
   DamsGeo.addListener('onBackgroundSync', handler);
   ```

3. **Significant Location Changes**
   ```typescript
   enableSignificantLocationChanges: true
   ```

4. **Live Activities** (Future)
   - Real-time tracking widgets
   - Dynamic Island integration

### Android-Only Features

1. **Foreground Service Customization**
   ```typescript
   // Android-specific notification config
   foregroundServiceNotification: {
     title: 'Tracking Active',
     text: 'Your location is being tracked',
     icon: 'ic_notification'
   }
   ```

2. **Multiple Location Providers**
   - GPS, Network, Passive providers
   - Automatic provider selection

3. **Geofencing Limits**
   - Maximum 100 geofences per app
   - Automatic geofence optimization

## Performance Considerations

### iOS Optimizations

1. **Location Filtering**
   - Automatic filtering of redundant updates
   - Hardware-accelerated distance calculations
   - Efficient Core Location integration

2. **Memory Management**
   - Automatic memory pressure handling
   - Background task assertions

### Android Optimizations

1. **Battery Optimization**
   - Adaptive location request intervals
   - Batched location updates
   - Doze mode compatibility

2. **Service Management**
   - Automatic service lifecycle management
   - Wake lock optimization

## Troubleshooting

### Common iOS Issues

1. **Location Not Updating in Background**
   - Ensure "Always" authorization is granted
   - Check Background Modes are enabled
   - Verify device isn't in Low Power Mode

2. **App Tracking Transparency Rejection**
   - Feature still works without ATT
   - Only affects IDFA access

### Common Android Issues

1. **Service Killed by System**
   - Ensure foreground service is properly configured
   - Check battery optimization settings
   - Consider using high priority notification

2. **Location Accuracy Issues**
   - Verify Google Play Services is updated
   - Check location mode is "High Accuracy"
   - Ensure WiFi/Bluetooth scanning is enabled

### Platform-Specific Debugging

#### iOS
```typescript
// Enable verbose Core Location logging
if (__DEV__ && Platform.OS === 'ios') {
  DamsGeo.configure({
    enableDebugLogs: true,
    logLevel: 'verbose'
  });
}
```

#### Android
```typescript
// Enable detailed FusedLocationProvider logs
if (__DEV__ && Platform.OS === 'android') {
  DamsGeo.configure({
    enableDebugLogs: true,
    androidDebugNotifications: true
  });
}
```

## Best Practices

### Cross-Platform Development

1. **Always check platform before using exclusive features**
   ```typescript
   if (Platform.OS === 'ios' && DamsGeoModule.requestTrackingPermission) {
     await DamsGeoModule.requestTrackingPermission();
   }
   ```

2. **Provide platform-specific UI/UX**
   - iOS: Follow Human Interface Guidelines
   - Android: Follow Material Design

3. **Test on real devices**
   - Simulators/emulators have limitations
   - Background execution behaves differently

### Platform-Specific Configuration

```typescript
const config = {
  enableDebugLogs: true,
  desiredAccuracy: 'best',
  distanceFilter: 10,
  
  // iOS-specific
  ...(Platform.OS === 'ios' && {
    enableSignificantLocationChanges: true,
    showsBackgroundLocationIndicator: true,
  }),
  
  // Android-specific
  ...(Platform.OS === 'android' && {
    foregroundServiceNotification: {
      title: 'Location Tracking',
      text: 'Tracking your location'
    },
    locationPriority: 'high_accuracy'
  })
};

await DamsGeo.startTracking(config);
```

## Migration Guide

### From Native iOS
1. Replace CLLocationManager with DamsGeo
2. Map delegate methods to event listeners
3. Handle permission flow differences

### From Native Android
1. Replace FusedLocationProviderClient with DamsGeo
2. Remove manual service management
3. Adapt to unified permission model

## Conclusion

The DAMS Geo SDK abstracts most platform differences, but understanding these specifics helps in:
- Debugging platform-specific issues
- Optimizing for each platform
- Providing the best user experience
- Meeting platform-specific requirements

For additional platform-specific questions, consult the [API Reference](./API_REFERENCE.md) or raise an issue on GitHub.