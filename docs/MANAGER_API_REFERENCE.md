# DAMS Geo SDK - Manager Classes API Reference

This document provides detailed API documentation for the internal manager classes used by the DAMS Geo SDK.

## Table of Contents
- [DatabaseManager](#databasemanager)
- [GeofenceManager](#geofencemanager)
- [OptimizedGeofenceManager](#optimizedgeofencemanager)
- [ActivityManager](#activitymanager)
- [BatteryOptimizationManager](#batteryoptimizationmanager)
- [BatteryPollingManager](#batterypollingmanager)
- [EncryptionKeyManager](#encryptionkeymanager)
- [BackgroundReliabilityManager](#backgroundreliabilitymanager)
- [EventListenerManager](#eventlistenermanager)
- [LocationBatchManager](#locationbatchmanager)
- [AuditExportManager](#auditexportmanager)
- [SigningManager](#signingmanager)
- [PerformanceMonitor](#performancemonitor)

## DatabaseManager

Handles all database operations including location storage, retrieval, and encryption.

### Usage Example

```typescript
import { DatabaseManager } from 'dams-geo-sdk/src/database/DatabaseManager';

const dbManager = DatabaseManager.getInstance();
```

### Methods

#### `getInstance(): DatabaseManager`
Returns the singleton instance of DatabaseManager.

```typescript
const db = DatabaseManager.getInstance();
```

#### `initialize(useEncryption: boolean = true): Promise<void>`
Initializes the database with optional encryption support.

**Parameters:**
- `useEncryption`: Whether to enable encryption (default: true)

```typescript
// Initialize with encryption (default)
await db.initialize();

// Initialize without encryption
await db.initialize(false);
```

#### `saveLocation(location: LocationUpdate & { userId?: string }): Promise<void>`
Saves a location update to the database with optional user ID.

**Parameters:**
- `location`: Location update with optional userId property

```typescript
const location: LocationUpdate & { userId?: string } = {
  lat: 37.7749,
  lon: -122.4194,
  accuracy: 10,
  speed: 5,
  heading: 180,
  altitude: 50,
  activityType: 'walking',
  timestamp: Date.now(),
  userId: 'user123' // optional
};

await db.saveLocation(location);
```

#### `saveGeofence(geofence: GeofenceZone): Promise<void>`
Stores a single geofence configuration.

```typescript
const zone: GeofenceZone = {
  id: 'zone1',
  name: 'Work Zone',
  coordinates: [
    { lat: 37.7749, lon: -122.4194 },
    { lat: 37.7751, lon: -122.4194 },
    { lat: 37.7751, lon: -122.4192 },
    { lat: 37.7749, lon: -122.4192 }
  ],
  isActive: true
};

await db.saveGeofence(zone);
```

#### `saveActivity(activity: { activityType: string; confidence: number }): Promise<void>`
Saves an activity recognition event to the database.

```typescript
await db.saveActivity({ activityType: 'walking', confidence: 90 });
```

#### `logEvent(eventType: string, eventData?: any): Promise<void>`
Logs a generic event or audit trail entry to the database.

```typescript
await db.logEvent('app_start', { version: '1.0.0', platform: 'ios' });
```

#### `isEncryptionEnabled(): boolean`
Checks if the database is currently encrypted.

```typescript
const encrypted = db.isEncryptionEnabled();
console.log(`Database encrypted: ${encrypted}`);
```

#### `getEncryptionStatus(): Promise<{ isEncrypted: boolean; hasKey: boolean; keyAlias: string; }>`
Retrieves the detailed encryption status of the database.

```typescript
const status = await db.getEncryptionStatus();
console.log('Encryption Status:', status);
```

#### `migrateToEncrypted(): Promise<void>`
Migrates an existing unencrypted database to an encrypted one. This involves re-initializing the database with encryption and re-importing existing data.

```typescript
await db.migrateToEncrypted();
```

#### `exportAllData(): Promise<{ locations: LocationRecord[]; geofences: GeofenceRecord[]; activities: ActivityRecord[]; exportDate: number; }>`
Exports all stored data (locations, geofences, activities) from the database. Useful for backup or migration purposes.

```typescript
const allData = await db.exportAllData();
console.log(`Exported ${allData.locations.length} locations.`);
```

#### `rotateEncryptionKey(newKey: string): Promise<void>`
Re-encrypts the database with a new encryption key. This method is currently not fully implemented and will throw an error.

**Parameters:**
- `newKey`: The new encryption key to use

**Note:** This feature is planned for future implementation.

```typescript
// Currently throws 'Not implemented' error
const newKey = 'your_new_strong_encryption_key';
await db.rotateEncryptionKey(newKey);
```

#### `deleteUserData(userId: string): Promise<void>`
Deletes all data associated with a specific user ID from the database.

```typescript
await db.deleteUserData('user123');
```

#### `getLocationsByDateRange(userId: string, from: Date, to: Date): Promise<any[]>`
Retrieves locations for a specific user within a date range.

**Parameters:**
- `userId`: The user ID to filter locations
- `from`: Start date
- `to`: End date

```typescript
const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
const today = new Date();
const locations = await db.getLocationsByDateRange('user123', yesterday, today);
```

#### `getRecentLocations(limit: number = 100): Promise<LocationRecord[]>`
Gets the most recent locations from the database.

**Parameters:**
- `limit`: Maximum number of locations to retrieve (default: 100)

**Returns:**
- Array of LocationRecord objects

```typescript
// Get 100 most recent locations (default)
const recentLocations = await db.getRecentLocations();

// Get 50 most recent locations
const recentLocations = await db.getRecentLocations(50);
```

#### `getGeofences(): Promise<GeofenceRecord[]>`
Retrieves all stored geofence configurations from the database.

**Returns:**
- Array of GeofenceRecord objects

```typescript
const geofences = await db.getGeofences();
console.log(`Found ${geofences.length} geofences`);
```

#### `getGeofenceEventsByDateRange(userId: string, from: Date, to: Date): Promise<any[]>`
Retrieves geofence events for a specific user within a date range.

**Parameters:**
- `userId`: The user ID to filter events
- `from`: Start date
- `to`: End date

```typescript
const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
const today = new Date();
const events = await db.getGeofenceEventsByDateRange('user123', yesterday, today);
```

#### `getStats(): Promise<DatabaseStats>`
Returns database statistics including counts for locations, geofences, activities, and events.

**Returns:**
```typescript
{
    locationCount: number;
    geofenceCount: number;
    activityCount: number;
    eventCount: number;
}
```

**Example:**
```typescript
const stats = await db.getStats();
console.log(`Total locations: ${stats.locationCount}`);
console.log(`Total geofences: ${stats.geofenceCount}`);
console.log(`Total activities: ${stats.activityCount}`);
console.log(`Total events: ${stats.eventCount}`);
```

#### `clearOldData(daysToKeep: number = 7): Promise<void>`
Removes data older than specified days from all tables.

**Parameters:**
- `daysToKeep`: Number of days of data to retain (default: 7)

```typescript
// Keep only last 7 days (default)
await db.clearOldData();

// Keep only last 30 days
await db.clearOldData(30);
```

#### `close(): Promise<void>`
Closes the database connection.

```typescript
await db.close();
```

## GeofenceManager

Manages geofence zones and monitors location for enter/exit events.

### Usage Example

```typescript
import { GeofenceManager } from 'dams-geo-sdk/src/geofencing/GeofenceManager';

const geofenceManager = GeofenceManager.getInstance();
```

### Methods

#### `getInstance(): GeofenceManager`
Returns the singleton instance of GeofenceManager.

```typescript
const geofenceManager = GeofenceManager.getInstance();
```

#### `setGeofences(zones: GeofenceZone[]): void`
Sets the active geofence zones (max 10).

```typescript
geofenceManager.setGeofences([
  {
    id: 'home',
    name: 'Home',
    coordinates: [
      { lat: 37.7749, lon: -122.4194 },
      { lat: 37.7751, lon: -122.4194 },
      { lat: 37.7751, lon: -122.4192 },
      { lat: 37.7749, lon: -122.4192 }
    ],
    isActive: true
  }
]);
```

#### `checkGeofences(location: LocationUpdate): GeofenceEvent[]`
Checks if location triggers any geofence events.

```typescript
const events = geofenceManager.checkGeofences({
  lat: 37.7750,
  lon: -122.4193,
  accuracy: 10,
  speed: null,
  heading: null,
  altitude: null,
  activityType: 'walking',
  timestamp: Date.now()
});

events.forEach(event => {
  console.log(`${event.eventType} zone: ${event.zoneName}`);
});
```

**GeofenceEvent structure:**
```typescript
interface GeofenceEvent {
  zoneId: string;
  zoneName: string;
  eventType: 'enter' | 'exit';
  location: {
    lat: number;
    lon: number;
    timestamp: number;
  };
}
```

#### `getActiveZones(): GeofenceZone[]`
Returns all currently active geofence zones.

```typescript
const activeZones = geofenceManager.getActiveZones();
console.log(`${activeZones.length} zones are active`);
```

#### `getCurrentZones(): GeofenceZone[]`
Returns an array of zones that the user is currently inside.

```typescript
const currentZones = geofenceManager.getCurrentZones();
if (currentZones.length > 0) {
  console.log('Currently inside zones:', currentZones.map(z => z.name));
}
```

#### `isInOffLimitsZone(): boolean`
Checks if the user is currently in any zone marked as off-limits.

```typescript
if (geofenceManager.isInOffLimitsZone()) {
  console.log('User is in an off-limits zone!');
}
```

#### `clearZones(): void`
Clears all active and current zones.

```typescript
// Clear all zones
geofenceManager.clearZones();
```

#### `getDistanceToNearestZone(lat: number, lon: number): { zone: GeofenceZone; distance: number } | null`
Calculates the distance from a given point to the nearest geofence zone edge.

**Parameters:**
- `lat`: Latitude of the point
- `lon`: Longitude of the point

**Returns:**
- Object containing the nearest zone and distance in meters, or null if no zones are active

```typescript
const result = geofenceManager.getDistanceToNearestZone(37.7750, -122.4193);
if (result) {
  console.log(`Nearest zone: ${result.zone.name}, Distance: ${result.distance.toFixed(2)}m`);
}
```

## OptimizedGeofenceManager

An enhanced version of GeofenceManager that uses R-tree spatial indexing for O(log n) performance instead of O(n) linear searching. Automatically used by the SDK for better performance with many geofences.

### Usage Example

```typescript
import { OptimizedGeofenceManager } from 'dams-geo-sdk/src/geofencing/OptimizedGeofenceManager';

const geofenceManager = OptimizedGeofenceManager.getInstance();

// Enable/disable optimization
geofenceManager.setOptimizationEnabled(true);

// Set multiple geofences
const zones: GeofenceZone[] = generateManyZones(); // 100+ zones
geofenceManager.setGeofences(zones);

// Check location - uses spatial index for efficiency
const events = geofenceManager.checkGeofences(location);

// Get performance statistics
const stats = geofenceManager.getPerformanceStats();
console.log(`Optimization reduced checks by ${stats.avgReduction.toFixed(1)}%`);
```

### Methods

All methods from GeofenceManager plus:

#### `setOptimizationEnabled(enabled: boolean): void`
Enable or disable spatial optimization. Useful for testing or when dealing with very few zones.

```typescript
geofenceManager.setOptimizationEnabled(false); // Force linear search
```

#### `getPerformanceStats(): PerformanceStats`
Returns detailed performance statistics about geofence checking efficiency.

**Returns:**
```typescript
interface PerformanceStats {
  totalChecks: number;         // Total location checks performed
  optimizedChecks: number;     // Checks using spatial index
  linearChecks: number;        // Checks using linear search
  avgCandidateRatio: number;   // Average ratio of zones checked (0-1)
  avgReduction: number;        // Average % reduction in checks
  indexStats: {
    size: number;              // Number of indexed zones
    height: number;            // R-tree height
    nodes: number;             // Total R-tree nodes
  };
}
```

#### `resetPerformanceStats(): void`
Reset all performance statistics to zero.

```typescript
geofenceManager.resetPerformanceStats();
```

### Spatial Indexing

The OptimizedGeofenceManager uses an R-tree data structure to spatially index geofences:

1. **Bounding Boxes**: Each polygon geofence is indexed by its minimum bounding rectangle (MBR)
2. **Tree Structure**: Zones are organized in a balanced tree based on spatial proximity
3. **Efficient Search**: Only zones whose MBRs intersect the search area are checked
4. **Automatic Optimization**: Falls back to linear search for small datasets (≤3 zones)

### Performance Characteristics

- **Search Complexity**: O(log n) average case vs O(n) for linear search
- **Memory Overhead**: ~200-500 bytes per zone for index structures
- **Typical Reduction**: 80-95% fewer polygon checks with 100+ zones
- **Best Case**: Sparse, non-overlapping zones
- **Worst Case**: Many overlapping zones in same area (degrades to O(n))

### Example: Large-Scale Geofencing

```typescript
class FleetGeofenceMonitor {
  private geofenceManager: OptimizedGeofenceManager;
  
  constructor() {
    this.geofenceManager = OptimizedGeofenceManager.getInstance();
  }
  
  async loadCompanyGeofences() {
    // Load 500+ delivery zones, restricted areas, etc.
    const zones = await fetchCompanyZones();
    
    console.log(`Loading ${zones.length} geofence zones...`);
    this.geofenceManager.setGeofences(zones);
    
    // Check index efficiency
    const stats = this.geofenceManager.getPerformanceStats();
    console.log(`R-tree built with height ${stats.indexStats.height}`);
  }
  
  trackVehicle(vehicleId: string, location: LocationUpdate) {
    const events = this.geofenceManager.checkGeofences(location);
    
    events.forEach(event => {
      if (event.eventType === 'enter') {
        this.notifyZoneEntry(vehicleId, event.zoneName);
      } else {
        this.notifyZoneExit(vehicleId, event.zoneName);
      }
    });
    
    // Monitor performance periodically
    if (Math.random() < 0.01) { // 1% sample rate
      const stats = this.geofenceManager.getPerformanceStats();
      console.log(`Geofence performance: ${stats.avgReduction.toFixed(1)}% reduction`);
    }
  }
}
```

### Optimization Tips

1. **Zone Distribution**: Spatial indexing works best with geographically distributed zones
2. **Zone Size**: Mix of zone sizes is handled well by the R-tree
3. **Monitoring**: Use performance stats to verify optimization effectiveness
4. **Batch Updates**: When updating many zones, set them all at once for efficient index rebuild

## ActivityManager

Detects and manages user activity types (walking, vehicle, stationary, unknown) with confidence tracking and optimization.

### Usage Example

```typescript
import { ActivityManager } from 'dams-geo-sdk/src/activity/ActivityManager';

const activityManager = ActivityManager.getInstance();
```

### Methods

#### `getInstance(): ActivityManager`
Returns the singleton instance of ActivityManager.

```typescript
const activityManager = ActivityManager.getInstance();
```

#### `configure(config: Partial<ActivityConfig>): void`
Configures the activity detection parameters.

**Parameters:**
- `config`: Partial configuration object with the following options:
  - `minConfidenceThreshold`: Minimum confidence level to accept activity (0-100)
  - `activityHistorySize`: Number of historical activities to keep
  - `confidenceDecayMs`: Time in ms for confidence to decay
  - `speedThresholds`: Speed thresholds for activity detection

```typescript
activityManager.configure({
  minConfidenceThreshold: 70,
  activityHistorySize: 50,
  confidenceDecayMs: 300000, // 5 minutes
  speedThresholds: {
    stationary: 0.5,  // m/s
    walking: 3.0,     // m/s
    vehicle: 10.0     // m/s
  }
});
```

#### `updateActivity(activity: ActivityType, confidence: number): ActivityDetectionResult`
Updates the current activity with the given type and confidence level.

**Parameters:**
- `activity`: The detected activity type ('stationary', 'walking', 'vehicle', 'unknown')
- `confidence`: Confidence level (0-100)

**Returns:**
- `ActivityDetectionResult` object containing:
  - `changed`: Whether the activity changed
  - `previousActivity`: Previous activity type
  - `newActivity`: New activity type
  - `confidence`: Current confidence level

```typescript
const result = activityManager.updateActivity('walking', 85);
if (result.changed) {
  console.log(`Activity changed from ${result.previousActivity} to ${result.newActivity}`);
}
```

#### `getCurrentActivity(): { type: ActivityType; confidence: number }`
Gets the current detected activity and confidence level.

```typescript
const activity = activityManager.getCurrentActivity();
console.log(`Activity: ${activity.type} (${activity.confidence}% confidence)`);
```

#### `getActivityHistory(): ActivityRecord[]`
Returns the history of recent activity detections.

**Returns:**
- Array of `ActivityRecord` objects, each containing:
  - `activityType`: The activity type
  - `confidence`: Confidence level
  - `timestamp`: Detection timestamp

```typescript
const history = activityManager.getActivityHistory();
history.forEach(record => {
  console.log(`${new Date(record.timestamp).toISOString()}: ${record.activityType} (${record.confidence}%)`);
});
```

#### `getConfidence(activityType: ActivityType, timeWindowMs: number = 60000): number`
Calculates the confidence level for a specific activity type over a time window.

**Parameters:**
- `activityType`: The activity type to check
- `timeWindowMs`: Time window in milliseconds (default: 60000 - 1 minute)

**Returns:**
- Confidence level (0-100) for the specified activity

```typescript
// Check confidence for 'walking' over the last 5 minutes
const walkingConfidence = activityManager.getConfidence('walking', 300000);
```

#### `shouldUpdateTracking(newActivity: ActivityType): boolean`
Determines if tracking parameters should be updated based on activity change.

**Parameters:**
- `newActivity`: The new activity type

**Returns:**
- Boolean indicating if tracking should be updated

```typescript
if (activityManager.shouldUpdateTracking('vehicle')) {
  // Update tracking parameters for vehicle movement
}
```

#### `reset(): void`
Resets the activity manager to its initial state, clearing history and current activity.

```typescript
activityManager.reset();
```

#### `getTrackingParameters(activity: ActivityType): { distanceFilter: number; desiredAccuracy: string; updateInterval: number; }`
Returns optimized tracking parameters for the given activity type.

**Parameters:**
- `activity`: The activity type

**Returns:**
- Object containing:
  - `distanceFilter`: Minimum distance in meters for location updates
  - `desiredAccuracy`: Accuracy level ('best', 'balanced', 'low')
  - `updateInterval`: Update interval in milliseconds

```typescript
const params = activityManager.getTrackingParameters('walking');
console.log(`Walking params: ${params.distanceFilter}m filter, ${params.desiredAccuracy} accuracy`);
```

#### `inferActivityFromSpeed(speedMps: number | null): ActivityType`
Infers activity type based on speed.

**Parameters:**
- `speedMps`: Speed in meters per second (null if unknown)

**Returns:**
- Inferred activity type

```typescript
const activity = activityManager.inferActivityFromSpeed(15); // 15 m/s = ~54 km/h
console.log(`Inferred activity: ${activity}`); // 'vehicle'
```

#### `calculateConfidence(nativeConfidence?: number, speedBasedActivity?: ActivityType, declaredActivity?: ActivityType): number`
Calculates a weighted confidence score based on multiple inputs.

**Parameters:**
- `nativeConfidence`: Native platform confidence (optional)
- `speedBasedActivity`: Activity inferred from speed (optional)
- `declaredActivity`: User-declared activity (optional)

**Returns:**
- Calculated confidence level (0-100)

```typescript
const confidence = activityManager.calculateConfidence(
  80,        // Native confidence
  'walking', // Speed-based inference
  'walking'  // User declaration
);
```

## BatteryOptimizationManager

Manages battery-saving strategies based on device state and user activity, optimizing tracking parameters for battery efficiency.

### Usage Example

```typescript
import { BatteryOptimizationManager } from 'dams-geo-sdk/src/battery/BatteryOptimizationManager';

const batteryManager = BatteryOptimizationManager.getInstance();
```

### Methods

#### `getInstance(): BatteryOptimizationManager`
Returns the singleton instance of BatteryOptimizationManager.

```typescript
const batteryManager = BatteryOptimizationManager.getInstance();
```

#### `updateBatteryStatus(level: number, charging: boolean): void`
Updates the battery status with level and charging state.

**Parameters:**
- `level`: Battery level (0-100)
- `charging`: Whether the device is charging

```typescript
// Update battery to 25% and not charging
batteryManager.updateBatteryStatus(25, false);

// Update battery to 80% and charging
batteryManager.updateBatteryStatus(80, true);
```

#### `getOptimizedTrackingParameters(activityType: ActivityType): TrackingParameters`
Returns optimized tracking parameters based on battery status and activity type.

**Parameters:**
- `activityType`: The current activity type ('stationary', 'walking', 'vehicle', 'unknown')

**Returns:**
- `TrackingParameters` object containing:
  - `distanceFilter`: Minimum distance for updates (meters)
  - `desiredAccuracy`: Accuracy level ('best', 'balanced', 'low')
  - `updateInterval`: Update interval (milliseconds)
  - `enableBackgroundUpdates`: Whether background updates are enabled

```typescript
const params = batteryManager.getOptimizedTrackingParameters('walking');
console.log(`Distance filter: ${params.distanceFilter}m`);
console.log(`Accuracy: ${params.desiredAccuracy}`);
console.log(`Update interval: ${params.updateInterval}ms`);
```

#### `shouldPauseTracking(): boolean`
Determines if tracking should be paused due to critical battery level.

**Returns:**
- Boolean indicating if tracking should be paused

```typescript
if (batteryManager.shouldPauseTracking()) {
  console.log('Battery critically low, pausing tracking');
  // Pause location tracking
}
```

#### `getRecommendedUpdateInterval(): number`
Gets the recommended update interval based on current battery status.

**Returns:**
- Update interval in milliseconds

```typescript
const interval = batteryManager.getRecommendedUpdateInterval();
console.log(`Recommended update interval: ${interval}ms`);
```

#### `getBatteryStatus(): { level: number; isCharging: boolean; isLow: boolean; isCritical: boolean }`
Returns the current battery status information.

**Returns:**
- Object containing:
  - `level`: Current battery level (0-100)
  - `isCharging`: Whether device is charging
  - `isLow`: Whether battery is low (<30%)
  - `isCritical`: Whether battery is critical (<10%)

```typescript
const status = batteryManager.getBatteryStatus();
console.log(`Battery: ${status.level}%`);
console.log(`Charging: ${status.isCharging}`);
console.log(`Low battery: ${status.isLow}`);
console.log(`Critical battery: ${status.isCritical}`);
```

#### `updateConfig(config: Partial<BatteryOptimizationConfig>): void`
Updates the battery optimization configuration.

**Parameters:**
- `config`: Partial configuration object with optional properties:
  - `lowBatteryThreshold`: Battery level considered low (default: 30)
  - `criticalBatteryThreshold`: Battery level considered critical (default: 10)
  - `enableAggressiveOptimization`: Enable aggressive optimization when battery is low
  - `pauseTrackingOnCritical`: Pause tracking when battery is critical

```typescript
batteryManager.updateConfig({
  lowBatteryThreshold: 25,
  criticalBatteryThreshold: 5,
  enableAggressiveOptimization: true,
  pauseTrackingOnCritical: true
});
```

## EncryptionKeyManager

Manages encryption keys for database security.

### Usage Example

```typescript
import { EncryptionKeyManager } from 'dams-geo-sdk/src/encryption/EncryptionKeyManager';

const encryptionManager = EncryptionKeyManager.getInstance();
```

### Methods

#### `getInstance(): EncryptionKeyManager`
Returns the singleton instance of EncryptionKeyManager.

```typescript
const encryptionManager = EncryptionKeyManager.getInstance();
```

#### `configure(config: EncryptionKeyConfig): void`
Configures the encryption key manager.

**Parameters:**
- `config`: Configuration object with properties:
  - `keyAlias`: Alias for the encryption key
  - `keySize`: Size of the key (default: 256)
  - `algorithm`: Encryption algorithm

```typescript
encryptionManager.configure({
  keyAlias: 'dams-geo-db-key',
  keySize: 256,
  algorithm: 'AES'
});
```

#### `getEncryptionKey(): Promise<string>`
Retrieves or generates the database encryption key.

```typescript
try {
  const key = await encryptionManager.getEncryptionKey();
  // Use key for database encryption
} catch (error) {
  console.error('Failed to get encryption key');
}
```

#### `clearCache(): void`
Clears the cached encryption key from memory.

```typescript
encryptionManager.clearCache();
```

#### `isEncryptionAvailable(): Promise<boolean>`
Checks if encryption is available on the current platform.

```typescript
const available = await encryptionManager.isEncryptionAvailable();
if (!available) {
  console.warn('Encryption not available on this device');
}
```

#### `deleteEncryptionKey(): Promise<void>`
Deletes the stored encryption key (WARNING: makes database inaccessible).

```typescript
await encryptionManager.deleteEncryptionKey();
```

#### `hasEncryptionKey(): Promise<boolean>`
Checks if an encryption key exists.

```typescript
const hasKey = await encryptionManager.hasEncryptionKey();
if (!hasKey) {
  // First time setup
}
```

#### `rotateKey(): Promise<string>`
Rotates the encryption key (requires database migration).

```typescript
const newKey = await encryptionManager.rotateKey();
// Migrate database with new key
```

## BackgroundReliabilityManager

Ensures reliable background location tracking across app states.

### Usage Example

```typescript
import { BackgroundReliabilityManager } from 'dams-geo-sdk/src/background/BackgroundReliabilityManager';

const backgroundManager = BackgroundReliabilityManager.getInstance();
```

### Methods

#### `getInstance(): BackgroundReliabilityManager`
Returns the singleton instance of BackgroundReliabilityManager.

```typescript
const backgroundManager = BackgroundReliabilityManager.getInstance();
```

#### `startMonitoring(): void`
Starts monitoring for background reliability.

```typescript
backgroundManager.startMonitoring();
```

#### `stopMonitoring(): void`
Stops background monitoring.

```typescript
backgroundManager.stopMonitoring();
```

#### `handleLocationUpdate(location: LocationUpdate): void`
Handles location updates in the background.

**Parameters:**
- `location`: The location update to handle

```typescript
backgroundManager.handleLocationUpdate({
  lat: 37.7749,
  lon: -122.4194,
  accuracy: 10,
  speed: null,
  heading: null,
  altitude: null,
  activityType: 'walking',
  timestamp: Date.now()
});
```

#### `handleAppStateChange(isBackground: boolean): void`
Handles app state transitions.

**Parameters:**
- `isBackground`: Whether the app is in background

```typescript
// In your app state change handler
AppState.addEventListener('change', (nextAppState) => {
  const isBackground = nextAppState === 'background' || nextAppState === 'inactive';
  backgroundManager.handleAppStateChange(isBackground);
});
```

#### `getBackgroundState(): BackgroundState`
Gets the current background tracking state.

**Returns:**
- `BackgroundState` object containing:
  - `isBackground`: Whether app is in background
  - `isTracking`: Whether tracking is active
  - `lastUpdateTime`: Timestamp of last update
  - `updateCount`: Number of background updates

```typescript
const state = backgroundManager.getBackgroundState();
console.log(`Background: ${state.isBackground}`);
console.log(`Updates: ${state.updateCount}`);
```

#### `updateConfig(config: Partial<ReliabilityConfig>): void`
Updates the background reliability configuration.

**Parameters:**
- `config`: Partial configuration with optional properties:
  - `minUpdateInterval`: Minimum interval between updates (ms)
  - `maxBackgroundTime`: Maximum background execution time (ms)
  - `enableHeartbeat`: Enable periodic heartbeat checks
  - `heartbeatInterval`: Interval for heartbeat checks (ms)

```typescript
backgroundManager.updateConfig({
  minUpdateInterval: 30000, // 30 seconds
  maxBackgroundTime: 180000, // 3 minutes
  enableHeartbeat: true,
  heartbeatInterval: 60000 // 1 minute
});
```

#### `setTrackingActive(active: boolean): void`
Sets whether location tracking is active.

**Parameters:**
- `active`: Whether tracking is active

```typescript
backgroundManager.setTrackingActive(true);
```

## EventListenerManager

Provides centralized management of event listeners with duplicate prevention, automatic cleanup, and monitoring capabilities.

### Usage Example

```typescript
import { EventListenerManager } from 'dams-geo-sdk/src/events/EventListenerManager';
import { EventEmitter } from 'expo-modules-core';

// Initialize with your event emitter
const eventManager = EventListenerManager.getInstance(emitter);

// Add listeners with automatic duplicate prevention
const subscription = eventManager.addListener('onLocationUpdate', (location) => {
  console.log('New location:', location);
});

// Remove listener when done
subscription.remove();

// Get statistics for monitoring
const stats = eventManager.getStats();
console.log(`Total listeners: ${stats.totalListeners}`);
console.log(`Duplicates prevented: ${stats.duplicatePrevented}`);
```

### Methods

#### `getInstance(emitter: EventEmitter): EventListenerManager`
Returns the singleton instance of EventListenerManager.

**Parameters:**
- `emitter`: The EventEmitter instance to manage

```typescript
const eventManager = EventListenerManager.getInstance(emitter);
```

#### `addListener<T extends Function>(eventName: string, listener: T, options?: ListenerOptions): { remove: () => void }`
Adds an event listener with duplicate prevention and tracking.

**Parameters:**
- `eventName`: The name of the event to listen for
- `listener`: The callback function to execute when the event fires
- `options`: Optional configuration
  - `allowDuplicates`: Whether to allow duplicate listeners (default: false)
  - `id`: Custom ID for the listener

**Returns:** An object with a `remove()` method to unsubscribe

```typescript
// Basic usage with duplicate prevention
const sub = eventManager.addListener('onError', (error) => {
  console.error('Error:', error);
});

// Allow duplicates if needed
const sub2 = eventManager.addListener('onError', errorHandler, { 
  allowDuplicates: true 
});

// Use custom ID for easier tracking
const sub3 = eventManager.addListener('onLocationUpdate', locationHandler, { 
  id: 'main_location_handler' 
});
```

#### `removeAllListeners(eventName?: string): void`
Removes all listeners for a specific event or all events.

**Parameters:**
- `eventName`: Optional event name. If not provided, removes all listeners

```typescript
// Remove all listeners for a specific event
eventManager.removeAllListeners('onLocationUpdate');

// Remove all listeners for all events
eventManager.removeAllListeners();
```

#### `getStats(): ListenerStats`
Returns statistics about event listeners for monitoring and debugging.

**Returns:**
```typescript
interface ListenerStats {
  totalListeners: number;
  listenersByEvent: Record<string, number>;
  duplicatePrevented: number;
  autoCleanupEnabled: boolean;
}
```

**Example:**
```typescript
const stats = eventManager.getStats();
console.log('Listener Statistics:', {
  total: stats.totalListeners,
  byEvent: stats.listenersByEvent,
  duplicatesPrevented: stats.duplicatePrevented
});

// Monitor for potential memory leaks
if (stats.totalListeners > 100) {
  console.warn('High number of listeners detected');
}
```

#### `getActiveListeners(): Array<{ id: string; eventName: string }>`
Returns a list of all active listeners for debugging purposes.

```typescript
const activeListeners = eventManager.getActiveListeners();
activeListeners.forEach(({ id, eventName }) => {
  console.log(`Listener ${id} listening to ${eventName}`);
});
```

#### `cleanup(): void`
Removes all listeners and cleans up resources. Called automatically when the SDK is destroyed.

```typescript
// Manual cleanup if needed
eventManager.cleanup();
```

### Features

1. **Duplicate Prevention**: Automatically prevents duplicate listeners from being added
2. **Memory Leak Prevention**: Tracks all listeners to ensure proper cleanup
3. **Statistics & Monitoring**: Provides detailed statistics for debugging
4. **Automatic Cleanup**: Listeners are cleaned up when SDK is destroyed
5. **Custom IDs**: Support for custom listener IDs for easier tracking

### Best Practices

1. **Use the singleton instance**: Always get the manager via `getInstance()`
2. **Remove listeners when done**: Always call `remove()` on subscriptions
3. **Monitor statistics**: Periodically check stats in development
4. **Avoid duplicates**: Let the manager handle duplicate prevention

### Example: Complete Integration

```typescript
class LocationTracker {
  private eventManager: EventListenerManager;
  private subscriptions: Array<{ remove: () => void }> = [];

  constructor(emitter: EventEmitter) {
    this.eventManager = EventListenerManager.getInstance(emitter);
    this.setupListeners();
  }

  private setupListeners() {
    // Location updates
    this.subscriptions.push(
      this.eventManager.addListener('onLocationUpdate', 
        this.handleLocation.bind(this),
        { id: 'tracker_location' }
      )
    );

    // Error handling
    this.subscriptions.push(
      this.eventManager.addListener('onError', 
        this.handleError.bind(this),
        { id: 'tracker_error' }
      )
    );

    // Monitor listener count
    const stats = this.eventManager.getStats();
    console.log(`Set up ${stats.totalListeners} listeners`);
  }

  private handleLocation(location: LocationUpdate) {
    // Process location
  }

  private handleError(error: Error) {
    // Handle error
  }

  cleanup() {
    // Remove all our listeners
    this.subscriptions.forEach(sub => sub.remove());
    this.subscriptions = [];

    // Verify cleanup
    const stats = this.eventManager.getStats();
    console.log(`Remaining listeners: ${stats.totalListeners}`);
  }
}
```

## AuditExportManager

Handles data export for compliance and audit purposes.

### Usage Example

```typescript
import { AuditExportManager } from 'dams-geo-sdk/src/audit/AuditExportManager';

const auditManager = AuditExportManager.getInstance();
```

### Methods

#### `getInstance(): AuditExportManager`
Returns the singleton instance of AuditExportManager.

```typescript
const auditManager = AuditExportManager.getInstance();
```

#### `prepareExport(options: AuditExportOptions): Promise<AuditExport>`
Prepares data for export.

**Parameters:**
- `options`: Export options containing:
  - `userId`: User ID to export data for
  - `from`: Start date
  - `to`: End date
  - `includeRawData`: Whether to include raw location data
  - `compress`: Whether to compress (future feature)
  - `sign`: Whether to sign the export

```typescript
const exportData = await auditManager.prepareExport({
  userId: 'user123',
  from: new Date('2024-01-01'),
  to: new Date('2024-01-31'),
  includeRawData: true
});

console.log(`Export contains ${exportData.summary.totalPoints} locations`);
```

#### `exportToJSON(auditExport: AuditExport, sign: boolean = false): Promise<string>`
Exports audit data to JSON string.

**Parameters:**
- `auditExport`: The prepared audit export data
- `sign`: Whether to sign the export

**Returns:**
- JSON string of the export data

```typescript
const jsonExport = await auditManager.exportToJSON(exportData, true);
console.log(`Export size: ${jsonExport.length} characters`);
```

#### `verifyExport(exportData: string): Promise<boolean>`
Verifies the integrity of an exported audit file.

**Parameters:**
- `exportData`: The JSON string of exported data

**Returns:**
- Boolean indicating if the export is valid and unmodified

```typescript
const isValid = await auditManager.verifyExport(jsonExport);
if (isValid) {
  console.log('Export verified successfully');
}
```

#### `formatFileSize(bytes: number): string`
Formats a byte size into human-readable format.

**Parameters:**
- `bytes`: Size in bytes

**Returns:**
- Formatted string (e.g., "1.5 MB")

```typescript
const size = auditManager.formatFileSize(1536000);
console.log(`File size: ${size}`); // "1.5 MB"
```

## SigningManager

Manages digital signatures for audit exports.

### Usage Example

```typescript
import { SigningManager } from 'dams-geo-sdk/src/audit/SigningManager';

const signingManager = SigningManager.getInstance();
```

### Methods

#### `getInstance(): SigningManager`
Returns the singleton instance of SigningManager.

```typescript
const signingManager = SigningManager.getInstance();
```

#### `ensureKeyPair(): Promise<void>`
Ensures a key pair exists, generating one if necessary.

```typescript
await signingManager.ensureKeyPair();
```

#### `signData(data: string): Promise<string>`
Signs data with the private key.

**Parameters:**
- `data`: The data to sign

**Returns:**
- Base64 encoded signature

```typescript
const signature = await signingManager.signData(JSON.stringify(exportData));
```

#### `verifySignature(data: string, signature: string): Promise<boolean>`
Verifies a signature using the stored public key.

**Parameters:**
- `data`: The original data
- `signature`: The signature to verify

**Returns:**
- Boolean indicating if the signature is valid

```typescript
const isValid = await signingManager.verifySignature(
  exportDataString,
  signature
);
```

#### `getPublicKey(): Promise<string>`
Gets the public key for signature verification.

**Returns:**
- Base64 encoded public key

```typescript
const publicKey = await signingManager.getPublicKey();
// Share this key with auditors for verification
```

#### `deleteKeyPair(): Promise<void>`
Deletes the stored key pair.

```typescript
await signingManager.deleteKeyPair();
```

## LocationBatchManager

Manages batching of location updates to optimize database writes and reduce battery consumption.

### Usage Example

```typescript
import { LocationBatchManager } from 'dams-geo-sdk/src/location/LocationBatchManager';

const batchManager = LocationBatchManager.getInstance();

// Configure batching parameters
batchManager.configure({
  batchSize: 100,
  flushInterval: 60000, // 1 minute
  maxBatchAge: 120000, // 2 minutes
  enableCompression: true
});

// Add location to batch
await batchManager.addLocation({
  lat: 37.7749,
  lon: -122.4194,
  accuracy: 10,
  speed: 5.5,
  bearing: 180,
  timestamp: Date.now()
});

// Force flush if needed
await batchManager.forceFlush();
```

### Methods

#### `getInstance(): LocationBatchManager`
Returns the singleton instance of LocationBatchManager.

```typescript
const batchManager = LocationBatchManager.getInstance();
```

#### `configure(config: Partial<LocationBatchConfig>): void`
Configures the batch manager settings.

**Parameters:**
```typescript
interface LocationBatchConfig {
  batchSize: number;           // Maximum locations per batch (default: 50)
  flushInterval: number;       // Auto-flush interval in ms (default: 30000)
  maxBatchAge: number;        // Maximum age before flush in ms (default: 60000)
  enableCompression: boolean;  // Enable location compression (default: true)
}
```

#### `setDatabase(database: DatabaseManager): void`
Sets the database manager instance for saving batches.

```typescript
batchManager.setDatabase(databaseManager);
```

#### `addLocation(location: LocationUpdate & { userId?: string }): Promise<void>`
Adds a location to the batch. Automatically flushes if batch is full or too old.

**Parameters:**
- `location`: Location update with optional userId

**Features:**
- Automatic compression of similar locations
- Auto-flush on batch size or age limits
- Transaction-based saves for data integrity

```typescript
await batchManager.addLocation({
  lat: 37.7749,
  lon: -122.4194,
  accuracy: 10,
  speed: 5.5,
  bearing: 180,
  timestamp: Date.now(),
  userId: 'user123'
});
```

#### `forceFlush(): Promise<void>`
Forces immediate flush of all pending locations.

```typescript
// Useful when app goes to background
await batchManager.forceFlush();
```

#### `getStats(): BatchStats`
Returns current batch statistics.

**Returns:**
```typescript
interface BatchStats {
  batchSize: number;      // Current batch size
  pendingCount: number;   // Number of pending locations
  lastFlushTime: number;  // Timestamp of last flush
  isProcessing: boolean;  // Whether currently flushing
  config: LocationBatchConfig;
}
```

#### `destroy(): void`
Cleans up resources and flushes pending locations.

```typescript
batchManager.destroy();
```

### Features

1. **Intelligent Batching**: Groups locations to reduce database writes
2. **Compression**: Filters out redundant similar locations
3. **Auto-flush**: Based on size, time, or app state
4. **Transaction Support**: Atomic batch saves
5. **Performance**: Reduces database writes by up to 98%

### Example: Complete Integration

```typescript
class LocationService {
  private batchManager: LocationBatchManager;
  
  constructor(database: DatabaseManager) {
    this.batchManager = LocationBatchManager.getInstance();
    this.batchManager.setDatabase(database);
    
    // Configure for optimal performance
    this.batchManager.configure({
      batchSize: 100,
      flushInterval: 30000,
      maxBatchAge: 60000,
      enableCompression: true
    });
    
    // Handle app state changes
    AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        this.batchManager.forceFlush();
      }
    });
  }
  
  async trackLocation(location: LocationUpdate) {
    await this.batchManager.addLocation(location);
    
    // Monitor performance
    const stats = this.batchManager.getStats();
    if (stats.pendingCount > 200) {
      console.warn('Large batch pending:', stats);
    }
  }
}
```

## BatteryPollingManager

Manages dynamic battery status polling with adaptive intervals based on battery level and charging state.

### Usage Example

```typescript
import { BatteryPollingManager } from 'dams-geo-sdk/src/battery/BatteryPollingManager';

const pollingManager = BatteryPollingManager.getInstance();

// Configure dynamic polling
pollingManager.configure({
  enableDynamicPolling: true,
  minPollingInterval: 60000,      // 1 minute
  maxPollingInterval: 600000,     // 10 minutes
  chargingPollingInterval: 300000, // 5 minutes
  criticalBatteryPollingInterval: 30000 // 30 seconds
});

// Start polling with update callback
await pollingManager.startPolling(async () => {
  // Update tracking parameters based on battery
  await updateTrackingConfig();
});

// Get current stats
const stats = pollingManager.getStats();
console.log(`Battery: ${stats.currentBatteryStatus.level}%`);
```

### Methods

#### `getInstance(): BatteryPollingManager`
Returns the singleton instance of BatteryPollingManager.

```typescript
const pollingManager = BatteryPollingManager.getInstance();
```

#### `configure(config: Partial<BatteryPollingConfig>): void`
Configures the polling manager settings.

**Parameters:**
```typescript
interface BatteryPollingConfig {
  enableDynamicPolling: boolean;        // Enable adaptive intervals (default: true)
  minPollingInterval: number;           // Minimum interval in ms (default: 60000)
  maxPollingInterval: number;           // Maximum interval in ms (default: 600000)
  chargingPollingInterval: number;      // Interval when charging (default: 300000)
  criticalBatteryPollingInterval: number; // Critical battery interval (default: 30000)
}
```

#### `startPolling(updateCallback: () => Promise<void>): Promise<void>`
Starts battery polling with the provided update callback.

**Parameters:**
- `updateCallback`: Async function called after each battery status update

```typescript
await pollingManager.startPolling(async () => {
  console.log('Battery status updated');
  await updateLocationTracking();
});
```

#### `stopPolling(): void`
Stops battery polling.

```typescript
pollingManager.stopPolling();
```

#### `forcePoll(): Promise<void>`
Forces an immediate battery status poll.

```typescript
// Useful for manual refresh
await pollingManager.forcePoll();
```

#### `getStats(): PollingStats`
Returns current polling statistics.

**Returns:**
```typescript
interface PollingStats {
  isPolling: boolean;
  lastPollTime: number;
  currentBatteryStatus: {
    level: number;
    isCharging: boolean;
    isLow: boolean;
    isCritical: boolean;
  };
  config: BatteryPollingConfig;
}
```

#### `destroy(): void`
Stops polling and cleans up resources.

```typescript
pollingManager.destroy();
```

### Dynamic Polling Intervals

The manager automatically adjusts polling intervals based on battery level:

- **100-50%**: Maximum interval (10 minutes default)
- **50-20%**: Linear interpolation between min and max
- **20-10%**: Minimum interval (1 minute default)
- **10-5%**: Half minimum interval
- **<5%**: Critical interval (30 seconds default)
- **Charging**: Fixed charging interval (5 minutes default)

### Features

1. **Adaptive Intervals**: Reduces battery drain by 50-80%
2. **Jitter**: ±10% randomization prevents synchronized polling
3. **State-based**: Different intervals for charging vs battery
4. **Configurable**: All intervals can be customized
5. **Force Poll**: Manual refresh when needed

### Example: Complete Integration

```typescript
class BatteryAwareTracker {
  private pollingManager: BatteryPollingManager;
  private batteryOptimizer: BatteryOptimizationManager;
  
  constructor() {
    this.pollingManager = BatteryPollingManager.getInstance();
    this.batteryOptimizer = BatteryOptimizationManager.getInstance();
    
    // Configure for optimal battery life
    this.pollingManager.configure({
      enableDynamicPolling: true,
      minPollingInterval: 60000,
      maxPollingInterval: 900000, // 15 minutes max
      criticalBatteryPollingInterval: 15000 // 15 seconds when critical
    });
  }
  
  async start() {
    await this.pollingManager.startPolling(async () => {
      const stats = this.pollingManager.getStats();
      const { level, isCharging } = stats.currentBatteryStatus;
      
      // Update tracking based on battery
      if (level < 20 && !isCharging) {
        await this.enableLowPowerMode();
      } else if (level > 80 || isCharging) {
        await this.enableHighAccuracyMode();
      }
      
      console.log(`Battery: ${level}%, Next poll in ${this.getNextInterval()} minutes`);
    });
  }
  
  private getNextInterval(): number {
    // Calculate next interval based on current battery
    const stats = this.pollingManager.getStats();
    // Implementation would calculate based on battery level
    return 5; // Example
  }
}
```

## PerformanceMonitor

Monitors and reports on SDK performance metrics.

### Usage Example

```typescript
import { PerformanceMonitor } from 'dams-geo-sdk/src/monitoring/PerformanceMonitor';

const perfMonitor = PerformanceMonitor.getInstance();
```

### Methods

#### `getInstance(): PerformanceMonitor`
Returns the singleton instance of PerformanceMonitor.

```typescript
const perfMonitor = PerformanceMonitor.getInstance();
```

#### `enable(): void`
Enables performance monitoring.

```typescript
perfMonitor.enable();
```

#### `disable(): void`
Disables performance monitoring.

```typescript
perfMonitor.disable();
```

#### `isEnabled(): boolean`
Checks if performance monitoring is enabled.

```typescript
if (perfMonitor.isEnabled()) {
  console.log('Performance monitoring is active');
}
```

#### `startOperation(operationId: string, operation: string): void`
Starts timing an operation.

**Parameters:**
- `operationId`: Unique ID for this operation instance
- `operation`: Operation type/name

```typescript
perfMonitor.startOperation('save-123', 'database-save');
```

#### `endOperation(operationId: string, operation: string, metadata?: Record<string, any>): void`
Ends timing an operation.

**Parameters:**
- `operationId`: The operation instance ID
- `operation`: Operation type/name
- `metadata`: Optional metadata about the operation

```typescript
perfMonitor.endOperation('save-123', 'database-save', {
  recordCount: 100
});
```

#### `measureAsync<T>(operation: string, fn: () => Promise<T>, metadata?: Record<string, any>): Promise<T>`
Measures an async operation.

**Parameters:**
- `operation`: Operation name
- `fn`: Async function to measure
- `metadata`: Optional metadata

**Returns:**
- The result of the async function

```typescript
const result = await perfMonitor.measureAsync(
  'fetch-locations',
  async () => {
    return await db.getRecentLocations(100);
  },
  { limit: 100 }
);
```

#### `measureSync<T>(operation: string, fn: () => T, metadata?: Record<string, any>): T`
Measures a synchronous operation.

**Parameters:**
- `operation`: Operation name
- `fn`: Synchronous function to measure
- `metadata`: Optional metadata

**Returns:**
- The result of the function

```typescript
const distance = perfMonitor.measureSync(
  'calculate-distance',
  () => calculateDistance(lat1, lon1, lat2, lon2),
  { points: 2 }
);
```

#### `getMetrics(operation?: string, since?: number): PerformanceMetric[]`
Gets performance metrics.

**Parameters:**
- `operation`: Filter by operation name (optional)
- `since`: Filter by timestamp (optional)

**Returns:**
- Array of performance metrics

```typescript
// Get all metrics
const allMetrics = perfMonitor.getMetrics();

// Get metrics for specific operation
const saveMetrics = perfMonitor.getMetrics('database-save');

// Get metrics from last hour
const recentMetrics = perfMonitor.getMetrics(undefined, Date.now() - 3600000);
```

#### `generateReport(since?: number): PerformanceReport`
Generates a comprehensive performance report.

**Parameters:**
- `since`: Generate report for metrics since this timestamp

**Returns:**
- Performance report with statistics

```typescript
const report = perfMonitor.generateReport();
console.log(`Average operation time: ${report.averageDuration}ms`);
console.log(`95th percentile: ${report.p95Duration}ms`);

// Breakdown by operation
Object.entries(report.operationBreakdown).forEach(([op, stats]) => {
  console.log(`${op}: ${stats.avgDuration}ms average (${stats.count} operations)`);
});
```

#### `logSlowOperations(threshold: number = 100): void`
Logs operations slower than threshold.

**Parameters:**
- `threshold`: Duration threshold in milliseconds (default: 100)

```typescript
// Log operations taking more than 100ms (default)
perfMonitor.logSlowOperations();

// Log operations taking more than 500ms
perfMonitor.logSlowOperations(500);
```

#### `clear(): void`
Clears all collected metrics.

```typescript
perfMonitor.clear();
```

#### `exportMetrics(): string`
Exports metrics as a JSON string.

**Returns:**
- JSON string of all metrics

```typescript
const metricsJson = perfMonitor.exportMetrics();
// Save to file or send to server
```

#### `importMetrics(data: string): void`
Imports metrics from a JSON string.

**Parameters:**
- `data`: JSON string of metrics to import

```typescript
// Import previously exported metrics
perfMonitor.importMetrics(metricsJson);
```

## Complete Integration Example

Here's how these managers work together in the SDK:

```typescript
import {
  DatabaseManager,
  GeofenceManager,
  ActivityManager,
  BatteryOptimizationManager,
  EncryptionKeyManager,
  BackgroundReliabilityManager,
  AuditExportManager,
  SigningManager,
  PerformanceMonitor
} from 'dams-geo-sdk';

class LocationTrackingService {
  private db = DatabaseManager.getInstance();
  private geofences = GeofenceManager.getInstance();
  private activity = ActivityManager.getInstance();
  private battery = BatteryOptimizationManager.getInstance();
  private encryption = EncryptionKeyManager.getInstance();
  private background = BackgroundReliabilityManager.getInstance();
  private audit = AuditExportManager.getInstance();
  private signing = SigningManager.getInstance();
  private perf = PerformanceMonitor.getInstance();
  
  async initialize() {
    // Enable performance monitoring
    this.perf.enable();
    
    // Initialize database with encryption
    await this.perf.measureAsync('db-init', async () => {
      await this.db.initialize();
    });
    
    // Set up activity monitoring
    this.activity.onActivityChange((event) => {
      this.battery.updateActivity(event.type);
    });
    
    // Handle app state changes
    AppState.addEventListener('change', (state) => {
      this.background.handleAppStateChange(state);
    });
  }
  
  async processLocationUpdate(location: LocationUpdate) {
    await this.perf.measureAsync('process-location', async () => {
      // Update activity detection
      this.activity.updateFromLocation(location);
      
      // Check battery optimization
      if (this.battery.shouldReduceFrequency()) {
        // Skip some updates to save battery
        if (Math.random() > 0.5) return;
      }
      
      // Save to database
      await this.db.saveLocation(location);
      
      // Check geofences
      const events = this.geofences.checkGeofences(location);
      for (const event of events) {
        await this.db.saveGeofenceEvent(event);
      }
    });
  }
  
  async exportAuditData(userId: string, from: Date, to: Date) {
    return await this.perf.measureAsync('export-audit', async () => {
      // Prepare export
      const exportData = await this.audit.prepareExport({
        userId,
        from,
        to,
        includeRawData: true
      });
      
      // Sign the export
      const signature = await this.signing.signData(
        JSON.stringify(exportData)
      );
      exportData.signature = signature;
      
      // Save to file
      const filePath = await this.audit.exportToFile(exportData, {
        sign: true,
        compress: false
      });
      
      return filePath;
    });
  }
  
  async getPerformanceReport() {
    return this.perf.generateReport();
  }
}
```

## Testing Manager Classes

Example of testing manager functionality:

```typescript
import { DatabaseManager } from 'dams-geo-sdk/src/database/DatabaseManager';

describe('DatabaseManager', () => {
  let db: DatabaseManager;
  
  beforeEach(async () => {
    db = DatabaseManager.getInstance();
    await db.initialize();
  });
  
  afterEach(async () => {
    await db.close();
  });
  
  test('should save and retrieve locations', async () => {
    const location: LocationUpdate = {
      lat: 37.7749,
      lon: -122.4194,
      accuracy: 10,
      speed: 5,
      heading: 180,
      altitude: 50,
      activityType: 'walking',
      timestamp: Date.now()
    };
    
    await db.saveLocation(location);
    
    const recent = await db.getRecentLocations(1);
    expect(recent).toHaveLength(1);
    expect(recent[0].lat).toBe(location.lat);
    expect(recent[0].lon).toBe(location.lon);
  });
});
```