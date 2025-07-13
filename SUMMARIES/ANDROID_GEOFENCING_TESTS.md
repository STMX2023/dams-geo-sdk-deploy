# Android Native Geofencing Tests

## Test Coverage Overview

### Unit Tests (`src/test/`)

#### 1. **DamsGeoModuleTest.kt**
Tests the core module functionality:
- ✅ Polygon to circle conversion accuracy
- ✅ Direct circular zone usage
- ✅ Native geofencing setup with multiple zones
- ✅ Android 100 geofence limit enforcement
- ✅ Geofence transition handling (enter/exit)
- ✅ Distance calculation accuracy
- ✅ Manual vs native mode switching

#### 2. **GeofenceBroadcastReceiverTest.kt**
Tests the broadcast receiver:
- ✅ Enter transition handling
- ✅ Exit transition handling
- ✅ Null GeofencingEvent handling
- ✅ Error state handling
- ✅ Empty geofence list handling
- ✅ App terminated scenario
- ✅ Multiple simultaneous geofences

#### 3. **GeofenceManagerTest.kt**
Basic conversion tests:
- ✅ Square polygon conversion
- ✅ Circular zone direct usage
- ✅ Android limit validation

### Integration Tests (`src/androidTest/`)

#### 1. **GeofencingIntegrationTest.kt**
Real device/emulator tests:
- ✅ Add single circular geofence
- ✅ Add multiple geofences
- ✅ Remove geofences
- ✅ Polygon to circle conversion validation
- ✅ Current location geofence creation
- ✅ Transition delay measurement setup

#### 2. **BatteryPerformanceTest.kt**
Performance and battery tests:
- ✅ Polygon mode battery usage
- ✅ Native mode battery usage
- ✅ Battery usage comparison
- ✅ Background battery monitoring

## Running the Tests

### Unit Tests
```bash
# From android directory
./gradlew test

# With coverage
./gradlew testDebugUnitTest jacocoTestReport
```

### Integration Tests
```bash
# Requires device/emulator with Google Play Services
./gradlew connectedAndroidTest

# Run specific test class
./gradlew connectedAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=expo.modules.damsgeo.GeofencingIntegrationTest
```

### Battery Tests
```bash
# Run battery performance tests (takes several minutes)
./gradlew connectedAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=expo.modules.damsgeo.BatteryPerformanceTest
```

## Test Scenarios Covered

### 1. **Conversion Algorithm**
- Square polygon → Circle with correct radius
- Irregular polygon → Bounding circle
- Centroid calculation accuracy
- 10% safety buffer validation

### 2. **Native Geofencing**
- Adding/removing geofences via GeofencingClient
- PendingIntent configuration
- Transition types (ENTER, EXIT, DWELL)
- Multiple zone handling

### 3. **Event Handling**
- Broadcast receiver in foreground
- Broadcast receiver with app terminated
- Event forwarding to main module
- Error state handling

### 4. **Performance**
- Battery drain comparison (polygon vs native)
- Background operation efficiency
- Location update frequency impact

## Expected Test Results

### Unit Tests
- All tests should pass
- Mocked dependencies ensure isolated testing
- No network or GPS required

### Integration Tests
- Require device with Google Play Services
- GPS/Location services must be enabled
- May fail on emulators without Play Services

### Battery Tests
- Native mode should show 80-90% battery improvement
- Background monitoring should have minimal impact
- Results vary by device and GPS conditions

## Key Test Assertions

1. **Polygon Conversion**
   - 100m square → ~156m radius circle
   - Centroid within 0.0001° accuracy

2. **Battery Performance**
   - Native < 20% of polygon battery usage
   - Background drain < 2% per hour

3. **Event Delivery**
   - Enter/exit events within 30 seconds
   - All zones properly identified

## Debugging Failed Tests

### Common Issues

1. **"GoogleApiClient not connected"**
   - Ensure Google Play Services installed
   - Check location permissions granted

2. **"Geofence not available"**
   - Location services must be enabled
   - Device must have network connectivity

3. **Battery tests show no improvement**
   - Ensure sufficient test duration (>60s)
   - Check GPS signal strength
   - Verify polygon checking is actually running

### Mock Verification

For unit tests using Mockito:
```kotlin
// Verify method was called
verify(mockGeofencingClient).addGeofences(any(), any())

// Verify with specific arguments
verify(mockModule).sendEvent(
    eq("onGeofenceEnter"),
    argThat { it["zoneId"] == "zone1" }
)
```

## Coverage Goals

- Unit test coverage: >80%
- Integration test coverage: Core paths
- Performance validation: Battery savings verified

The test suite ensures the Android native geofencing implementation is robust, efficient, and maintains API compatibility with the existing polygon-based system.