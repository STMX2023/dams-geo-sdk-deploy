# Geofencing Migration Test Suite

This test suite provides comprehensive behavioral testing for the geofencing system migration from polygon-based to native circular geofencing.

## Test Philosophy

These tests focus on **what** the system should do, not **how** it does it. This allows the same tests to validate both the current polygon implementation and the future native circular implementation.

## Test Structure

### 1. Behavioral Tests (`GeofenceManager.behavior.test.ts`)
- Core functionality: enter/exit events
- Multiple zone handling
- State management
- Edge cases and boundaries
- Performance requirements

### 2. Persistence Tests (`GeofenceManager.persistence.test.ts`)
- Database integration
- State persistence across app lifecycle
- Background behavior
- Data migration scenarios
- Error recovery

### 3. Migration Tests (`GeofenceManager.migration.test.ts`)
- Native implementation acceptance criteria
- Platform-specific requirements (iOS/Android)
- Circular zone compatibility
- Feature flag support
- Performance expectations

### 4. Integration Tests (`GeofenceManager.integration.test.ts`)
- Real-world scenarios
- Polygon to circle conversion validation
- Performance comparison
- Migration readiness checklist

### 5. Test Utilities (`test-utils.ts`)
- Shared helpers for all tests
- Zone creation utilities
- Location simulation
- Performance measurement
- Battery impact estimation

## Running the Tests

```bash
# Run all tests
npm test

# Run only geofencing tests
npm test -- src/geofencing

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- GeofenceManager.behavior.test.ts

# Run in watch mode
npm test -- --watch
```

## Coverage Requirements

The migration requires **80%+ test coverage** before proceeding. Focus areas:
- GeofenceManager class methods
- Zone entry/exit logic
- State persistence
- Error handling

## Migration Acceptance Criteria

All tests in this suite must pass with both implementations:
1. Current polygon-based checking
2. Future native circular geofencing

The tests serve as a contract ensuring the migration maintains expected behavior while improving performance.

## Key Test Scenarios

### 1. Basic Functionality
- Device enters a zone → `onGeofenceEnter` event
- Device exits a zone → `onGeofenceExit` event
- No duplicate events when staying in zone
- Correct handling of multiple zones

### 2. Edge Cases
- Overlapping zones
- Boundary conditions
- Rapid location updates
- Low accuracy GPS
- Background operation

### 3. Performance
- <50ms processing time for 10 zones
- Battery efficiency improvements
- Memory usage optimization

### 4. Data Migration
- Polygon → Circle conversion
- Zone ID preservation
- Database schema evolution
- Backward compatibility

## Platform Differences

### iOS
- Maximum 20 monitored regions
- Automatic region prioritization needed
- Background location permissions required

### Android
- Maximum 100 geofences
- Google Play Services dependency
- Foreground service for reliability

## Success Metrics

The migration is successful when:
1. All behavioral tests pass with native implementation
2. Battery usage reduced by >80%
3. Background reliability improved
4. Event delivery <30 seconds
5. No breaking changes for API consumers