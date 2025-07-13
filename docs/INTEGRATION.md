# DAMS Geo SDK - Integration Guide

Complete guide for integrating the DAMS Geo SDK into your Expo SDK 53 project.

## Prerequisites

- Expo SDK 53.x project
- React Native 0.79.x
- React 19.x
- Node.js 20+
- iOS 13.0+ / Android API 21+
- Expo Dev Build (not compatible with Expo Go)

## Installation

### Step 1: Copy Files

Copy the entire `dams-geo-sdk-deploy` folder into your project:

```bash
# In your project root
cp -r path/to/dams-geo-sdk-deploy ./modules/dams-geo-sdk
```

### Step 2: Install Dependencies

```bash
npm install @op-engineering/op-sqlite@^14.1.2
```

### Step 3: Update Your Project Configuration

#### A. Update `package.json`
Add the SQLCipher configuration:

```json
{
  "op-sqlite": {
    "sqlcipher": true
  }
}
```

#### B. Update `app.json` or `app.config.js`
Add the required permissions and plugins:

```json
{
  "expo": {
    "plugins": [
      [
        "expo-location",
        {
          "locationAlwaysAndWhenInUsePermission": "This app needs location access for safety alerts and geofencing",
          "locationWhenInUsePermission": "This app needs location access for safety alerts"
        }
      ]
    ],
    "ios": {
      "infoPlist": {
        "UIBackgroundModes": ["location", "fetch", "processing"],
        "NSMotionUsageDescription": "This app uses motion detection to optimize battery usage"
      }
    },
    "android": {
      "permissions": [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION", 
        "ACCESS_BACKGROUND_LOCATION",
        "FOREGROUND_SERVICE",
        "FOREGROUND_SERVICE_LOCATION",
        "ACTIVITY_RECOGNITION"
      ]
    }
  }
}
```

#### C. Update Your TypeScript Configuration
Ensure your `tsconfig.json` includes:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "types": ["node"]
  }
}
```

### Step 4: Metro Configuration (if needed)

If you encounter module resolution issues, add to your `metro.config.js`:

```javascript
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Optional: Disable package.json exports if you have compatibility issues
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
```

## Basic Usage

### Initialize the SDK

```typescript
import DamsGeo, { 
  DamsGeoConfig, 
  LocationUpdate, 
  GeofenceZone 
} from './modules/dams-geo-sdk';

// Configure the SDK
const config: DamsGeoConfig = {
  enableHighAccuracy: true,
  enableEncryption: true,
  distanceFilter: 10,
  desiredAccuracy: 'high',
  enableBackgroundTracking: true,
  batteryOptimization: {
    enabled: true,
    mode: 'adaptive'
  }
};

// Initialize
await DamsGeo.initialize(config);
```

### Start Location Tracking

```typescript
// Start tracking for a specific user
await DamsGeo.startTracking({ 
  userId: 'user123',
  enableBackgroundSync: true 
});

// Listen for location updates
const locationSubscription = DamsGeo.addListener('onLocationUpdate', 
  (location: LocationUpdate) => {
    console.log('New location:', {
      lat: location.lat,
      lon: location.lon,
      accuracy: location.accuracy,
      activityType: location.activityType
    });
  }
);
```

### Setup Geofencing

```typescript
// Define geofence zones
const zones: GeofenceZone[] = [
  {
    id: 'home',
    name: 'Home',
    coordinates: {
      latitude: 37.7749,
      longitude: -122.4194,
      radius: 100
    },
    isActive: true
  },
  {
    id: 'office',
    name: 'Office',
    coordinates: {
      latitude: 37.7849,
      longitude: -122.4094,
      radius: 50
    },
    isActive: true
  }
];

// Set geofences
await DamsGeo.setGeofences(zones);

// Listen for geofence events
const geofenceSubscription = DamsGeo.addListener('onGeofenceEnter', 
  (event) => {
    console.log(`Entered geofence: ${event.zoneName}`);
  }
);

DamsGeo.addListener('onGeofenceExit', (event) => {
  console.log(`Exited geofence: ${event.zoneName}`);
});
```

### Activity Recognition

```typescript
// Listen for activity changes
const activitySubscription = DamsGeo.addListener('onActivityChange', 
  (activity) => {
    console.log('Activity changed:', activity.type, activity.confidence);
  }
);
```

### Error Handling

```typescript
import { DamsGeoError, DamsGeoErrorCode } from './modules/dams-geo-sdk';

// Listen for errors
const errorSubscription = DamsGeo.addListener('onError', 
  (error: DamsGeoError) => {
    console.error('DamsGeo Error:', {
      code: error.code,
      message: error.message,
      severity: error.severity
    });
    
    // Handle specific error types
    switch (error.code) {
      case DamsGeoErrorCode.PERMISSION_DENIED:
        // Handle permission issues
        break;
      case DamsGeoErrorCode.LOCATION_UNAVAILABLE:
        // Handle location service issues
        break;
    }
  }
);
```

## Advanced Configuration

### Battery Optimization

```typescript
const config: DamsGeoConfig = {
  batteryOptimization: {
    enabled: true,
    mode: 'adaptive', // 'conservative' | 'balanced' | 'adaptive' | 'performance'
    lowBatteryThreshold: 20,
    backgroundSyncInterval: 300000 // 5 minutes
  }
};
```

### Data Export and Audit

```typescript
// Export location data
const exportData = await DamsGeo.exportLocationData({
  userId: 'user123',
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-01-31'),
  format: 'json',
  includeActivityData: true,
  includeGeofenceEvents: true
});

console.log('Exported data:', exportData);
```

### Performance Monitoring

```typescript
// Get performance statistics
const stats = await DamsGeo.getPerformanceStats();
console.log('Performance stats:', {
  batteryUsage: stats.batteryUsage,
  memoryUsage: stats.memoryUsage,
  locationAccuracy: stats.averageAccuracy
});
```

## Cleanup

```typescript
// Stop tracking
await DamsGeo.stopTracking('user_logout');

// Remove listeners
locationSubscription.remove();
geofenceSubscription.remove();
activitySubscription.remove();
errorSubscription.remove();
```

## Build Configuration

### iOS (Xcode)

The iOS module will be automatically linked through the CocoaPods integration. Ensure your iOS deployment target is set to 13.0 or higher.

### Android

The Android module will be automatically configured. Ensure your `android/app/build.gradle` has:

```gradle
android {
  compileSdkVersion 35
  targetSdkVersion 35
  minSdkVersion 21
}
```

## Troubleshooting

### Common Issues

1. **Module Resolution Issues**
   - Ensure you're using Expo Dev Build, not Expo Go
   - Check Metro configuration for package.json exports

2. **Permission Errors**
   - Verify all required permissions are in app.json
   - Request permissions at runtime for Android

3. **Background Tracking Not Working**
   - Ensure UIBackgroundModes are configured for iOS
   - Check Android battery optimization settings

4. **SQLCipher Issues**
   - Verify `"op-sqlite": { "sqlcipher": true }` in package.json
   - Ensure @op-engineering/op-sqlite is installed

### Debug Mode

Enable debug logging:

```typescript
import { logger } from './modules/dams-geo-sdk';

// Enable debug logging
logger.setLevel('debug');
```

## Performance Best Practices

1. **Use appropriate distance filters** - Higher values save battery
2. **Configure activity-based tracking** - Reduces updates when stationary
3. **Implement proper cleanup** - Remove listeners when not needed
4. **Monitor battery usage** - Use built-in optimization features
5. **Test on device** - Location services don't work in simulators

## Support

For integration issues:
1. Check this documentation
2. Verify your Expo SDK version (53.x required)
3. Ensure React Native 0.79 compatibility
4. Test with a simple implementation first