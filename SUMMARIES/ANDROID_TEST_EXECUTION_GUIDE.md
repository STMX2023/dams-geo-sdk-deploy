# Android Native Geofencing Test Execution Guide

## Overview

This guide explains how to run the comprehensive test suite for the Android native geofencing implementation. The tests validate functionality, performance, and battery efficiency of the new native geofencing system.

## Test Categories

### 1. Unit Tests (No Device Required)
Located in `android/src/test/java/expo/modules/damsgeo/`

- **DamsGeoModuleTest.kt**: Tests core module functionality
- **GeofenceBroadcastReceiverTest.kt**: Tests broadcast receiver behavior
- **GeofenceManagerTest.kt**: Tests geofence management logic

### 2. Integration Tests (Device/Emulator Required)
Located in `android/src/androidTest/java/expo/modules/damsgeo/`

- **GeofencingIntegrationTest.kt**: Tests real geofencing operations
- **BatteryPerformanceTest.kt**: Measures battery usage improvements

## Running Tests

### Option 1: In Android Studio

1. Open the parent Android project in Android Studio
2. Navigate to the `dams-geo-sdk` module
3. Right-click on test directory and select "Run All Tests"

```
android/src/test/          → Run for unit tests
android/src/androidTest/   → Run for integration tests
```

### Option 2: Command Line (Requires Parent Project)

From the parent Android project directory:

```bash
# Unit tests only
./gradlew :dams-geo-sdk:test

# Integration tests (requires connected device)
./gradlew :dams-geo-sdk:connectedAndroidTest

# All tests with coverage
./gradlew :dams-geo-sdk:testDebugUnitTest :dams-geo-sdk:connectedAndroidTest jacocoTestReport
```

### Option 3: Expo Development Build

1. Create a development build with the module:
```bash
expo prebuild
cd android
./gradlew assembleDebug
```

2. Install on device/emulator:
```bash
adb install app/build/outputs/apk/debug/app-debug.apk
```

3. Run module tests:
```bash
./gradlew :modules:dams-geo-sdk:test
```

## Manual Testing Checklist

### Background Wake Functionality Test

1. **Setup Test App**
   - Install app with native geofencing enabled
   - Grant all location permissions including background
   - Enable battery optimization exemption

2. **Configure Test Geofences**
   ```javascript
   await DamsGeo.setGeofences([
     {
       id: 'test_zone_1',
       coordinates: [
         { latitude: currentLat + 0.001, longitude: currentLon },
         { latitude: currentLat + 0.001, longitude: currentLon + 0.001 },
         { latitude: currentLat, longitude: currentLon + 0.001 },
         { latitude: currentLat, longitude: currentLon }
       ]
     }
   ]);
   ```

3. **Test Scenarios**
   - Move device to trigger enter/exit events
   - Force-stop the app
   - Move device again to test background wake
   - Check logs for received events

4. **Expected Results**
   - Events received within 30 seconds of crossing boundary
   - App wakes from terminated state
   - Battery usage significantly reduced

### Battery Performance Validation

1. **Baseline Test (Polygon Mode)**
   ```javascript
   await DamsGeo.setConfig({
     useNativeGeofencing: false,
     locationUpdateInterval: 5000
   });
   ```
   - Run for 1 hour with 5 active zones
   - Record battery drain percentage

2. **Native Mode Test**
   ```javascript
   await DamsGeo.setConfig({
     useNativeGeofencing: true
   });
   ```
   - Run for 1 hour with same 5 zones
   - Record battery drain percentage

3. **Expected Results**
   - Native mode: 80-90% battery improvement
   - Background drain: <2% per hour
   - No missed events

## Test Output Locations

### Unit Test Results
```
android/build/reports/tests/test/index.html
android/build/test-results/test/
```

### Integration Test Results
```
android/build/reports/androidTests/connected/index.html
android/build/outputs/androidTest-results/connected/
```

### Coverage Reports
```
android/build/reports/jacoco/jacocoTestReport/html/index.html
```

## Troubleshooting

### Common Issues

1. **"Google Play Services not available"**
   - Use physical device or emulator with Play Store
   - Update Google Play Services

2. **Permission Denied Errors**
   - Grant all permissions in device settings
   - Add background location permission for API 29+

3. **Tests Timeout**
   - Increase test timeout in gradle:
   ```gradle
   android {
     testOptions {
       unitTests.all {
         testLogging.showStandardStreams = true
         timeout = 300 // 5 minutes
       }
     }
   }
   ```

## Next Steps

1. Run unit tests to verify logic
2. Deploy to test device for integration tests
3. Conduct battery performance comparison
4. Test background wake scenarios
5. Update Phase 2 completion status

## Success Criteria

- [ ] All unit tests pass
- [ ] Integration tests pass on physical device
- [ ] Battery usage reduced by >80%
- [ ] Background wake functionality verified
- [ ] No regression in existing functionality