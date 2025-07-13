# DAMS Geo SDK - Comprehensive API Reference

## Table of Contents
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Core API](#core-api)
  - [Initialization & Configuration](#initialization--configuration)
  - [Location Tracking](#location-tracking)
  - [Geofencing](#geofencing)
  - [Data Management](#data-management)
  - [Audit & Compliance](#audit--compliance)
- [Event System](#event-system)
- [Lifecycle Management](#lifecycle-management)
- [Type Definitions](#type-definitions)
- [Error Handling](#error-handling)
- [Platform-Specific Notes](#platform-specific-notes)
- [Best Practices](#best-practices)
- [Complete Examples](#complete-examples)

> **📱 Platform Guide**: For detailed platform-specific implementation information, see the [Platform-Specific Guide](./PLATFORM_SPECIFIC_GUIDE.md)

## Installation

```bash
npm install dams-geo-sdk
# or
yarn add dams-geo-sdk
```

### iOS Setup
```bash
cd ios && pod install
```

Add to `Info.plist`:
```xml
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>This app needs location access to track your activities</string>
<key>NSLocationWhenInUseUsageDescription</key>
<string>This app needs location access to track your activities</string>
<key>NSMotionUsageDescription</key>
<string>This app needs motion access to detect your activity type</string>
```

### Android Setup
Add to `AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
<uses-permission android:name="android.permission.ACTIVITY_RECOGNITION" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
```

## Quick Start

```typescript
import DamsGeo from 'dams-geo-sdk';
import type { LocationUpdate, GeofenceZone, ActivityType } from 'dams-geo-sdk';

// Start tracking
async function startLocationTracking() {
  try {
    // Configure and start tracking
    await DamsGeo.startTracking({
      enableDebugLogs: true,
      desiredAccuracy: 'best',
      distanceFilter: 10,
      enableAdaptiveTracking: true
    });
    
    // Set up event listeners
    const locationSub = DamsGeo.addListener('onLocationUpdate', (location: LocationUpdate) => {
      console.log('New location:', location);
    });
    
    const activitySub = DamsGeo.addListener('onActivityChange', (event) => {
      console.log('Activity changed to:', event.activity);
    });
    
    // Clean up when done
    return () => {
      locationSub.remove();
      activitySub.remove();
    };
  } catch (error) {
    console.error('Failed to start tracking:', error);
  }
}
```

## Core API

### Initialization & Configuration

#### `configure(options?: DamsGeoConfigureOptions): Promise<void>`

Configures the SDK with custom options for logging, error reporting, and encryption.

**Parameters:**
```typescript
interface DamsGeoConfigureOptions {
  encryptionEnabled?: boolean; // Enable/disable database encryption (default: true)
  debugMode?: boolean;         // Enable debug mode (default: __DEV__)
  errorReporting?: {
    enabled: boolean;          // Enable error reporting
    endpoint?: string;         // Remote endpoint for error reports
    apiKey?: string;           // API key for authentication
    includeStackTrace?: boolean; // Include stack trace in reports
  };
  logging?: {
    level?: LogLevel;          // Minimum log level to capture
    enableConsole?: boolean;   // Enable console logging
    enableFile?: boolean;      // Enable logging to file
    enableRemote?: boolean;    // Enable remote logging
    remoteEndpoint?: string;   // Remote endpoint for logs
    remoteApiKey?: string;     // API key for remote logging
    maxFileSize?: number;      // Max log file size in bytes
    maxFiles?: number;         // Max number of log files to keep
  };
  locationBatching?: {
    batchSize?: number;        // Number of locations to batch before saving (default: 50)
    flushInterval?: number;    // Interval to flush batch in ms (default: 30000)
    maxBatchAge?: number;      // Max age of batch before force flush in ms (default: 60000)
    enableCompression?: boolean; // Compress similar locations (default: true)
  };
  batteryPolling?: {
    enableDynamicPolling?: boolean;      // Enable dynamic intervals based on battery level (default: true)
    minPollingInterval?: number;         // Minimum polling interval in ms (default: 60000)
    maxPollingInterval?: number;         // Maximum polling interval in ms (default: 600000)
    chargingPollingInterval?: number;    // Interval when charging in ms (default: 300000)
    criticalBatteryPollingInterval?: number; // Interval when battery critical in ms (default: 30000)
  };
}
```

**Example:**
```typescript
await DamsGeo.configure({
  encryptionEnabled: true,
  debugMode: __DEV__,
  errorReporting: {
    enabled: true,
    endpoint: 'https://your-error-reporting-service.com/report',
    apiKey: 'YOUR_API_KEY',
    includeStackTrace: true
  },
  logging: {
    level: 'debug',
    enableConsole: true,
    enableFile: true,
    enableRemote: false
  },
  locationBatching: {
    batchSize: 100,           // Batch 100 locations before saving
    flushInterval: 60000,     // Flush every minute
    maxBatchAge: 120000,      // Force flush after 2 minutes
    enableCompression: true   // Compress similar locations
  },
  batteryPolling: {
    enableDynamicPolling: true,     // Adjust intervals based on battery
    minPollingInterval: 30000,      // 30 seconds minimum
    maxPollingInterval: 900000,     // 15 minutes maximum
    chargingPollingInterval: 600000 // 10 minutes when charging
  }
});
```

#### `startTracking(config?: DamsGeoConfig): Promise<boolean>`

Initializes and starts location tracking with optional configuration.

**Example - Basic Start:**
```typescript
// Simple start with defaults
await DamsGeo.startTracking();
```

**Example - Custom Configuration:**
```typescript
await DamsGeo.startTracking({
  enableDebugLogs: __DEV__, // Only in development
  desiredAccuracy: 'balanced',
  distanceFilter: 15,
  enableAdaptiveTracking: true
});
```

**Example - With Permission Handling:**
```typescript
import { PermissionsAndroid, Platform } from 'react-native';

async function requestAndStartTracking() {
  // Request permissions first
  if (Platform.OS === 'android') {
    const granted = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
      PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION,
    ]);
    
    if (Object.values(granted).some(status => status !== 'granted')) {
      throw new Error('Permissions not granted');
    }
  }
  
  // Now start tracking
  await DamsGeo.startTracking({
    enableDebugLogs: true,
    desiredAccuracy: 'best'
  });
}
```

### Location Tracking

#### `isTracking: boolean`

Indicates whether location tracking is currently active.

**Example:**
```typescript
if (DamsGeo.isTracking) {
  console.log('Location tracking is active.');
} else {
  console.log('Location tracking is inactive.');
}
```

#### `stopTracking(reason?: string): Promise<boolean>`

Stops all location tracking and cleans up resources.

**Example:**
```typescript
// Stop with reason for logging
await DamsGeo.stopTracking('user-logout');

// Common stop scenarios
async function handleAppStateChange(nextState: string) {
  if (nextState === 'background') {
    // Continue tracking in background
  } else if (nextState === 'inactive') {
    await DamsGeo.stopTracking('app-inactive');
  }
}
```

#### `updateTrackingWithBatteryOptimization(): Promise<void>`

Dynamically updates tracking parameters based on current battery status and activity type. This method is called automatically by the SDK but can also be invoked manually for immediate optimization.

**Behavior:**
- Adjusts `distanceFilter` and `desiredAccuracy` based on battery level
- Considers current activity type (walking, driving, stationary)
- Only applies changes if tracking is currently active

**Example:**
```typescript
// Manually trigger battery optimization
await DamsGeo.updateTrackingWithBatteryOptimization();

// The SDK automatically calls this method:
// - Every 5 minutes while tracking
// - When battery level changes significantly
// - When activity type changes
```

**Optimization Strategy:**
- **Critical Battery (<10%)**: Maximum power saving mode
- **Low Battery (<30%)**: Balanced power saving
- **Normal Battery (>30%)**: Standard tracking
- **Charging**: High accuracy mode

#### `getRecentLocations(limit?: number): Promise<LocationUpdate[]>`

Gets the most recent location updates from the database.

**Parameters:**
- `limit`: The maximum number of locations to retrieve. Defaults to 100.

**Example:**
```typescript
const recentLocations = await DamsGeo.getRecentLocations(10);
console.log('Recent locations:', recentLocations);
```

#### `getLocationsPaginated(options: PaginationOptions): Promise<PaginatedResults<LocationUpdate>>`

Gets location updates with advanced pagination support, including metadata about the results.

**Parameters:**
```typescript
interface PaginationOptions {
  page: number;        // Page number (1-based)
  pageSize: number;    // Number of items per page
  userId?: string;     // Filter by user ID (optional)
  from?: Date;         // Start date filter (optional)
  to?: Date;           // End date filter (optional)
}
```

**Returns:**
```typescript
interface PaginatedResults<T> {
  data: T[];           // Array of location updates
  page: number;        // Current page number
  pageSize: number;    // Items per page
  hasMore: boolean;    // Whether more pages exist
  total?: number;      // Total count (if available)
}
```

**Example:**
```typescript
// Get first page of locations
const page1 = await DamsGeo.getLocationsPaginated({
  page: 1,
  pageSize: 50
});

console.log(`Page ${page1.page} of locations:`, page1.data);
console.log(`Has more pages: ${page1.hasMore}`);

// Get filtered locations for a specific user and date range
const filtered = await DamsGeo.getLocationsPaginated({
  page: 1,
  pageSize: 100,
  userId: 'user123',
  from: new Date('2024-01-01'),
  to: new Date('2024-01-31')
});
```

### Geofencing

#### `setGeofences(zones: GeofenceZone[]): Promise<void>`

Sets the active geofence zones. This will replace any previously set geofences.

**Parameters:**
- `zones`: An array of geofence zones to monitor.

**Example:**
```typescript
const myGeofences = [
  {
    id: 'home',
    name: 'My Home',
    coordinates: [
      { lat: 34.052235, lon: -118.243683 },
      { lat: 34.052235, lon: -118.243683 },
      { lat: 34.052235, lon: -118.243683 },
      { lat: 34.052235, lon: -118.243683 }
    ],
    isActive: true
  }
];
await DamsGeo.setGeofences(myGeofences);
```

#### `getStoredGeofences(): Promise<GeofenceZone[]>`

Retrieves all stored geofence zones from the database.

**Example:**
```typescript
const storedGeofences = await DamsGeo.getStoredGeofences();
console.log('Stored geofences:', storedGeofences);
```

### Data Management

#### `getDatabaseStats(): Promise<DatabaseStats>`

Returns statistics about the internal database, including counts of locations, geofences, activities, and events.

**Example:**
```typescript
const stats = await DamsGeo.getDatabaseStats();
console.log('Database Stats:', stats);
```

#### `getLocationBatchStats(): Promise<LocationBatchStats>`

Returns statistics about the location batching system, including pending locations, configuration, and processing status.

**Returns:**
```typescript
interface LocationBatchStats {
  batchSize: number;        // Configured batch size
  pendingCount: number;     // Number of locations waiting to be saved
  lastFlushTime: number;    // Timestamp of last batch flush
  isProcessing: boolean;    // Whether batch is currently being processed
  config: {
    batchSize: number;
    flushInterval: number;
    maxBatchAge: number;
    enableCompression: boolean;
  };
}
```

**Example:**
```typescript
const batchStats = await DamsGeo.getLocationBatchStats();
console.log(`Pending locations: ${batchStats.pendingCount}`);
console.log(`Last flush: ${new Date(batchStats.lastFlushTime).toLocaleString()}`);
```

#### `getBatteryPollingStats(): Promise<BatteryPollingStats>`

Returns statistics about the battery polling system, including current battery status and polling configuration.

**Returns:**
```typescript
interface BatteryPollingStats {
  isPolling: boolean;              // Whether battery polling is active
  lastPollTime: number;            // Timestamp of last battery poll
  currentBatteryStatus: {
    level: number;                 // Battery percentage (0-100)
    isCharging: boolean;           // Whether device is charging
    isLow: boolean;                // Battery below low threshold
    isCritical: boolean;           // Battery below critical threshold
  };
  config: {
    enableDynamicPolling: boolean;
    minPollingInterval: number;
    maxPollingInterval: number;
    chargingPollingInterval: number;
    criticalBatteryPollingInterval: number;
  };
}
```

**Example:**
```typescript
const batteryStats = await DamsGeo.getBatteryPollingStats();
console.log(`Battery level: ${batteryStats.currentBatteryStatus.level}%`);
console.log(`Charging: ${batteryStats.currentBatteryStatus.isCharging}`);
console.log(`Dynamic polling: ${batteryStats.config.enableDynamicPolling}`);

// Dynamic polling intervals based on battery:
// - 100-50%: Maximum interval (10 minutes default)
// - 50-20%: Linear interpolation between min and max
// - 20-10%: Minimum interval (1 minute default)
// - 10-5%: Half minimum interval
// - <5%: Critical interval (30 seconds default)
// - Charging: Fixed charging interval (5 minutes default)
```

#### `getEventListenerStats(): EventListenerStats`

Returns statistics about event listeners, including total count, duplicates prevented, and active listeners.

**Returns:**
```typescript
interface EventListenerStats {
  totalListeners: number;
  listenersByEvent: Record<string, number>;
  duplicatePrevented: number;
  autoCleanupEnabled: boolean;
  activeListeners: Array<{ id: string; eventName: string }>;
}
```

**Example:**
```typescript
const listenerStats = DamsGeo.getEventListenerStats();
console.log(`Total listeners: ${listenerStats.totalListeners}`);
console.log(`Duplicates prevented: ${listenerStats.duplicatePrevented}`);
console.log('Listeners by event:', listenerStats.listenersByEvent);

// Check for potential memory leaks
if (listenerStats.totalListeners > 100) {
  console.warn('High number of event listeners detected');
  console.log('Active listeners:', listenerStats.activeListeners);
}
```

#### `getGeofencePerformanceStats(): GeofencePerformanceStats | null`

Returns performance statistics for geofence checking if spatial optimization is enabled.

**Returns:**
```typescript
interface GeofencePerformanceStats {
  optimizationEnabled: boolean;
  totalChecks: number;         // Total geofence checks performed
  optimizedChecks: number;     // Checks using spatial index
  linearChecks: number;        // Checks using linear search
  avgCandidateRatio: number;   // Average ratio of zones checked
  avgReduction: number;        // Average % reduction in checks
  indexStats: {
    size: number;              // Number of indexed zones
    height: number;            // R-tree height
    nodes: number;             // Total R-tree nodes
  };
}
```

**Example:**
```typescript
const perfStats = DamsGeo.getGeofencePerformanceStats();
if (perfStats && perfStats.optimizationEnabled) {
  console.log(`Geofence optimization: ${perfStats.avgReduction.toFixed(1)}% reduction`);
  console.log(`Checked ${perfStats.totalChecks} locations`);
  console.log(`R-tree height: ${perfStats.indexStats.height}`);
  
  // Monitor performance
  if (perfStats.avgReduction < 50) {
    console.warn('Geofence optimization less effective than expected');
  }
}
```

#### `clearOldData(daysToKeep: number): Promise<void>`

Removes data older than the specified number of days from the database.

**Parameters:**
- `daysToKeep`: The number of days of data to keep. Data older than this will be deleted.

**Example:**
```typescript
// Clear data older than 30 days
await DamsGeo.clearOldData(30);
```

#### `getEncryptionStatus(): Promise<EncryptionStatus>`

Gets the current encryption status of the internal database.

**Example:**
```typescript
const encryptionStatus = await DamsGeo.getEncryptionStatus();
console.log('Encryption Status:', encryptionStatus);
```

### Audit & Compliance

#### `exportAudit(options: AuditExportOptions): Promise<AuditExport>`

Prepares audit data for a given user and date range. This method returns the audit data object, which can then be used for further processing or exported to a file.

**Parameters:**
- `options`: An object containing `userId`, `from` (start date), `to` (end date), and optional flags like `includeRawData`, `compress`, and `sign`.

**Example:**
```typescript
const auditData = await DamsGeo.exportAudit({
  userId: 'user123',
  from: new Date('2024-01-01'),
  to: new Date('2024-01-31'),
  includeRawData: true
});
console.log('Audit Data Summary:', auditData.summary);
```

#### `exportAuditToFile(exportData: AuditExport, options: ExportFileOptions): Promise<string>`

Writes the prepared audit data to a file.

**Parameters:**
- `exportData`: The `AuditExport` object obtained from `exportAudit`.
- `options`: An object containing `compress` and `sign` flags.

**Returns:**
- A promise that resolves with the absolute path to the exported file.

**Example:**
```typescript
// Assuming auditData was obtained from DamsGeo.exportAudit
const filePath = await DamsGeo.exportAuditToFile(auditData, {
  compress: true,
  sign: true
});
console.log('Audit data exported to:', filePath);
```

#### `getPublicKey(): Promise<string>`

Retrieves the public key used for verifying audit export signatures. This key should be shared with auditors to verify the integrity and authenticity of exported data.

**Returns:**
- A promise that resolves with the public key as a string.

**Example:**
```typescript
const publicKey = await DamsGeo.getPublicKey();
console.log('Public Key:', publicKey);
```

### Event System

#### `addListener<K extends keyof DamsGeoEvents>(eventName: K, listener: DamsGeoEvents[K]): { remove: () => void }`

Registers a listener for a specific SDK event.

**Parameters:**
- `eventName`: The name of the event to listen for (e.g., `'onLocationUpdate'`, `'onGeofenceEnter'`).
- `listener`: The callback function to be executed when the event is emitted.

**Returns:**
- An object with a `remove()` method that can be called to unsubscribe the listener.

**Example:**
```typescript
const locationSubscription = DamsGeo.addListener('onLocationUpdate', (location) => {
  console.log('New location:', location);
});

// To remove the listener later:
locationSubscription.remove();
```

#### `removeAllListeners(eventName?: keyof DamsGeoEvents): void`

Removes all listeners for a specific event name, or all listeners if no event name is provided.

**Parameters:**
- `eventName`: The name of the event for which to remove listeners. Optional.

**Example:**
```typescript
// Remove all listeners for 'onLocationUpdate'
DamsGeo.removeAllListeners('onLocationUpdate');

// Remove all listeners for all events
DamsGeo.removeAllListeners();
```

### Lifecycle Management

#### `destroy(): Promise<void>`

Completely cleans up the SDK instance, releasing all resources and removing all event listeners. Call this method when your app is terminating or when you need to completely reset the SDK.

**What it does:**
- Stops tracking if active
- Removes all event listeners
- Closes database connections
- Clears all manager instances
- Stops battery monitoring
- Removes app state subscriptions

**Example:**
```typescript
// Clean up before app termination
async function cleanup() {
  await DamsGeo.destroy();
  console.log('DamsGeo SDK cleaned up');
}

// In React Native component
useEffect(() => {
  // Initialize SDK
  DamsGeo.startTracking();
  
  // Cleanup on unmount
  return () => {
    DamsGeo.destroy();
  };
}, []);

// Reset SDK completely
async function resetSDK() {
  await DamsGeo.destroy();
  // SDK is now in pristine state, can be reinitialized
  await DamsGeo.configure({ /* new config */ });
  await DamsGeo.startTracking();
}
```

**Note:** After calling `destroy()`, you must reconfigure and restart the SDK if you want to use it again.


## Event System

### Setting Up Event Listeners

**Example - Comprehensive Event Handling:**
```typescript
class LocationTracker {
  private subscriptions: Array<{ remove: () => void }> = [];
  
  startListening() {
    // Location updates
    this.subscriptions.push(
      DamsGeo.addListener('onLocationUpdate', this.handleLocationUpdate)
    );
    
    // Geofence events
    this.subscriptions.push(
      DamsGeo.addListener('onGeofenceEnter', this.handleGeofenceEnter)
    );
    
    this.subscriptions.push(
      DamsGeo.addListener('onGeofenceExit', this.handleGeofenceExit)
    );
    
    // Activity changes
    this.subscriptions.push(
      DamsGeo.addListener('onActivityChange', this.handleActivityChange)
    );
    
    // Error handling
    this.subscriptions.push(
      DamsGeo.addListener('onError', this.handleError)
    );
    
    // Background sync (iOS)
    if (Platform.OS === 'ios') {
      this.subscriptions.push(
        DamsGeo.addListener('onBackgroundSync', this.handleBackgroundSync)
      );
    }
  }
  
  stopListening() {
    // Remove all listeners
    this.subscriptions.forEach(sub => sub.remove());
    this.subscriptions = [];
  }
  
  private handleLocationUpdate = (location: LocationUpdate) => {
    console.log('Location:', location);
    // Update UI, save to server, etc.
  };
  
  private handleGeofenceEnter = (event: GeofenceEvent) => {
    console.log(`Entered ${event.zoneName}`);
    // Send notification, log event, etc.
  };
  
  private handleGeofenceExit = (event: GeofenceEvent) => {
    console.log(`Exited ${event.zoneName}`);
  };
  
  private handleActivityChange = (event: ActivityEvent) => {
    console.log(`Activity: ${event.activity} (${event.confidence}% confidence)`);
  };
  
  private handleError = (error: DamsGeoError) => {
    console.error(`Error ${error.code}: ${error.message}`);
    
    switch (error.code) {
      case 'PERMISSION_DENIED':
        // Handle permission error
        break;
      case 'LOCATION_ERROR':
        // Handle location error
        break;
      default:
        // Handle other errors
    }
  };
  
  private handleBackgroundSync = (event: BackgroundSyncEvent) => {
    console.log('Background sync requested:', event.reason);
    // Perform background tasks
  };
}
```

### Event Filtering and Throttling

**Example - Smart Event Handling:**
```typescript
class OptimizedLocationHandler {
  private lastLocation: LocationUpdate | null = null;
  private lastUpdateTime: number = 0;
  private updateThrottle: number = 5000; // 5 seconds
  
  handleLocationUpdate = (location: LocationUpdate) => {
    const now = Date.now();
    
    // Throttle updates
    if (now - this.lastUpdateTime < this.updateThrottle) {
      return;
    }
    
    // Check if significant change
    if (this.lastLocation) {
      const distance = this.calculateDistance(
        this.lastLocation.lat, this.lastLocation.lon,
        location.lat, location.lon
      );
      
      // Ignore small movements when stationary
      if (location.activityType === 'stationary' && distance < 5) {
        return;
      }
    }
    
    // Process update
    this.lastLocation = location;
    this.lastUpdateTime = now;
    
    // Update UI or send to server
    this.processLocation(location);
  };
  
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    // Haversine formula
    const R = 6371e3;
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;
    
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    return R * c;
  }
  
  private processLocation(location: LocationUpdate) {
    // Your processing logic here
    console.log('Processing location:', location);
  }
}
```

## Type Definitions

### Core Types

```typescript
// Activity types detected by the SDK
type ActivityType = 'stationary' | 'walking' | 'vehicle' | 'unknown';

// Location update data
interface LocationUpdate {
  lat: number;              // Latitude in degrees
  lon: number;              // Longitude in degrees
  accuracy: number;         // Horizontal accuracy in meters
  speed: number | null;     // Speed in meters/second
  heading: number | null;   // Heading in degrees (0-360)
  altitude: number | null;  // Altitude in meters
  activityType: ActivityType; // Detected activity
  timestamp: number;        // Unix timestamp in milliseconds
  isSignificantChange?: boolean; // iOS: significant location change
}

// Geofence zone definition
interface GeofenceZone {
  id: string;               // Unique identifier
  name: string;             // Display name
  coordinates: Array<{      // Polygon vertices (3-10 points)
    lat: number;
    lon: number;
  }>;
  isActive: boolean;        // Whether zone is monitored
  metadata?: any;           // Optional custom data
}

// Event types
type DamsGeoEventType = 
  | 'onLocationUpdate'      // New location available
  | 'onGeofenceEnter'       // Entered geofence
  | 'onGeofenceExit'        // Exited geofence
  | 'onActivityChange'      // Activity type changed
  | 'onError'               // Error occurred
  | 'onBackgroundSync';     // iOS background sync

// Event payloads
interface GeofenceEvent {
  zoneId: string;
  zoneName: string;
  location: {
    lat: number;
    lon: number;
    timestamp: number;
  };
}

interface ActivityEvent {
  activity: ActivityType;
  confidence: number;       // 0-100 percentage
}

interface DamsGeoError {
  code: string;
  message: string;
  details?: any;
}

interface BackgroundSyncEvent {
  timestamp: number;
  reason: string;
}

// Configuration
interface DamsGeoConfig {
  enableDebugLogs?: boolean;
  desiredAccuracy?: 'best' | 'balanced' | 'low';
  distanceFilter?: number;  // Meters
  enableAdaptiveTracking?: boolean;
}

// Database types
interface DatabaseStats {
  locationCount: number;
  geofenceCount: number;
  activityCount: number;
  eventCount: number;
}

interface EncryptionStatus {
  isEncrypted: boolean;
  hasKey: boolean;
  keyAlias: string;
}

// Audit export types
interface AuditExportOptions {
  userId: string;
  from: Date;
  to: Date;
  includeRawData?: boolean;
  compress?: boolean;       // Future feature
  sign?: boolean;
}

interface ExportResult {
  success: boolean;
  filePath?: string;
  error?: string;
  fileSize?: number;
  compressed?: boolean;
  signed?: boolean;
}

interface AuditExport {
  version: string;
  exportDate: number;
  userId: string;
  dateRange: {
    from: number;
    to: number;
  };
  summary: {
    totalPoints: number;
    totalDistance: number;    // Meters
    totalDuration: number;    // Milliseconds
    activities: {
      stationary: number;
      walking: number;
      vehicle: number;
      unknown: number;
    };
    geofenceEvents: number;
    averageAccuracy: number;  // Meters
  };
  locations?: LocationRecord[];
  geofenceEvents?: GeofenceEventRecord[];
  signature?: string;
}
```

## Error Handling

### Error Codes and Recovery

```typescript
enum DamsGeoErrorCode {
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  LOCATION_ERROR = 'LOCATION_ERROR',
  GEOFENCE_LIMIT = 'GEOFENCE_LIMIT',
  DATABASE_ERROR = 'DATABASE_ERROR',
  TRACKING_ALREADY_ACTIVE = 'TRACKING_ALREADY_ACTIVE',
  TRACKING_NOT_ACTIVE = 'TRACKING_NOT_ACTIVE',
  ENCRYPTION_KEY_ERROR = 'ENCRYPTION_KEY_ERROR',
  EXPORT_ERROR = 'EXPORT_ERROR',
  SIGNING_ERROR = 'SIGNING_ERROR',
}

// Comprehensive error handling
class ErrorHandler {
  static async handleError(error: DamsGeoError) {
    console.error(`DamsGeo Error: ${error.code}`, error);
    
    switch (error.code) {
      case DamsGeoErrorCode.PERMISSION_DENIED:
        await this.handlePermissionError();
        break;
        
      case DamsGeoErrorCode.LOCATION_ERROR:
        await this.handleLocationError(error);
        break;
        
      case DamsGeoErrorCode.DATABASE_ERROR:
        await this.handleDatabaseError(error);
        break;
        
      case DamsGeoErrorCode.ENCRYPTION_KEY_ERROR:
        await this.handleEncryptionError(error);
        break;
        
      default:
        await this.handleGenericError(error);
    }
  }
  
  private static async handlePermissionError() {
    Alert.alert(
      'Permission Required',
      'Location permission is required for this app to function.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Settings', onPress: () => Linking.openSettings() }
      ]
    );
  }
  
  private static async handleLocationError(error: DamsGeoError) {
    // Retry logic
    console.log('Location error, retrying in 5 seconds...');
    setTimeout(async () => {
      try {
        await DamsGeo.startTracking();
      } catch (retryError) {
        console.error('Retry failed:', retryError);
      }
    }, 5000);
  }
  
  private static async handleDatabaseError(error: DamsGeoError) {
    // Check if corruption
    if (error.details?.includes('corrupt')) {
      Alert.alert(
        'Database Error',
        'The location database appears corrupted. Reset?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Reset', 
            style: 'destructive',
            onPress: async () => {
              // Reset database
              await DamsGeo.clearOldData(0);
            }
          }
        ]
      );
    }
  }
  
  private static async handleEncryptionError(error: DamsGeoError) {
    console.error('Encryption error:', error);
    // Attempt to recover or notify user
  }
  
  private static async handleGenericError(error: DamsGeoError) {
    console.error('Unhandled error:', error);
  }
}

// Usage
DamsGeo.addListener('onError', ErrorHandler.handleError);
```

## Platform-Specific Notes

### iOS Implementation Details

#### Unique iOS Features
- **App Tracking Transparency**: Required for IDFA access (iOS 14.5+)
- **Background Sync Events**: iOS-only event for background refresh
- **Significant Location Changes**: Low-power location monitoring
- **Keychain Storage**: Always available for secure key storage
- **Documents Directory**: Database stored in Documents folder

```typescript
// iOS-specific configuration
if (Platform.OS === 'ios') {
  // Request App Tracking Transparency (iOS 14.5+)
  const trackingStatus = await DamsGeoModule.requestTrackingPermission?.();
  console.log('Tracking status:', trackingStatus);
  // Status: 'not-determined' | 'restricted' | 'denied' | 'authorized'
  
  // Enable significant location changes for low battery impact
  await DamsGeo.startTracking({
    enableDebugLogs: true,
    desiredAccuracy: 'balanced',
    enableAdaptiveTracking: true,
    enableSignificantLocationChanges: true // iOS only
  });
  
  // Handle background sync events (iOS only)
  DamsGeo.addListener('onBackgroundSync', async (event) => {
    console.log('iOS Background sync triggered:', event.reason);
    
    // Perform background tasks
    const locations = await DamsGeo.getRecentLocations(10);
    
    // Upload to server
    await uploadLocations(locations);
    
    // Must complete within ~30 seconds
  });
}
```

### Android Implementation Details

#### Unique Android Features
- **Foreground Service**: Mandatory notification for background tracking
- **Multiple Permission Levels**: Fine, Background, Activity Recognition
- **Battery Optimization**: May restrict background execution
- **Fused Location Provider**: Automatic provider selection
- **WorkManager**: For scheduled background tasks

```typescript
// Android-specific handling
if (Platform.OS === 'android') {
  // Request all necessary permissions
  const permissions = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
    PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION,
  ]);
  
  // Check for battery optimization
  const batteryOptEnabled = await checkBatteryOptimization();
  if (batteryOptEnabled) {
    Alert.alert(
      'Battery Optimization',
      'Disable battery optimization for reliable background tracking?',
      [
        { text: 'No', style: 'cancel' },
        { text: 'Yes', onPress: () => requestDisableBatteryOpt() }
      ]
    );
  }
  
  // Configure with Android-specific options
  await DamsGeo.startTracking({
    enableDebugLogs: true,
    desiredAccuracy: 'high',
    // Android-specific notification config
    foregroundServiceNotification: {
      title: 'Location Tracking Active',
      text: 'Your location is being tracked',
      icon: 'ic_notification' // Must exist in drawable resources
    }
  });
}
```

### Platform Differences Summary

| Feature | iOS | Android |
|---------|-----|---------|
| Background Sync Events | ✅ Supported | ❌ Not available |
| App Tracking Transparency | ✅ Required for IDFA | ❌ N/A |
| Foreground Service | ❌ Not needed | ✅ Required |
| Significant Location Changes | ✅ Native support | ❌ Emulated |
| Database Location | Documents directory | App data directory |
| Encryption Key Storage | Keychain (always available) | Keystore (API 23+) |
| Activity Recognition | Real-time updates | Periodic updates |
| Maximum Geofences | No limit | 100 per app |
| Battery Optimization | System managed | User configurable |

### Platform-Specific Methods

#### iOS Only
```typescript
// App Tracking Transparency
if (DamsGeoModule.requestTrackingPermission) {
  const status = await DamsGeoModule.requestTrackingPermission();
  const currentStatus = await DamsGeoModule.getTrackingStatus();
}

// Background sync listener
const subscription = DamsGeo.addListener('onBackgroundSync', handler);
```

#### Android Only
```typescript
// No exclusive JavaScript methods
// Platform differences handled internally by SDK
```

For comprehensive platform-specific implementation details, see the [Platform-Specific Guide](./PLATFORM_SPECIFIC_GUIDE.md).

## Best Practices

### 1. Permission Management

```typescript
class PermissionManager {
  static async ensurePermissions(): Promise<boolean> {
    if (Platform.OS === 'ios') {
      // iOS permissions are requested by the SDK
      return true;
    }
    
    // Android requires explicit permission requests
    const permissions = [
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
      PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION,
    ];
    
    const results = await PermissionsAndroid.requestMultiple(permissions);
    
    const allGranted = Object.values(results).every(
      result => result === PermissionsAndroid.RESULTS.GRANTED
    );
    
    if (!allGranted) {
      // Show explanation
      Alert.alert(
        'Permissions Required',
        'This app needs location and activity permissions to function properly.',
        [{ text: 'OK' }]
      );
    }
    
    return allGranted;
  }
}
```

### 2. Battery Optimization

```typescript
class BatteryOptimizer {
  static setupAdaptiveTracking() {
    // Listen for battery level changes
    DeviceEventEmitter.addListener('batteryLevelChanged', (level) => {
      if (level < 20) {
        // Switch to low power mode
        DamsGeo.stopTracking('low-battery');
        DamsGeo.startTracking({
          desiredAccuracy: 'low',
          distanceFilter: 100,
          enableAdaptiveTracking: true
        });
      }
    });
    
    // Adjust based on charging state
    DeviceEventEmitter.addListener('batteryChargingChanged', (isCharging) => {
      if (isCharging) {
        // Can use more aggressive tracking
        DamsGeo.stopTracking('charging-state-change');
        DamsGeo.startTracking({
          desiredAccuracy: 'best',
          distanceFilter: 5,
          enableAdaptiveTracking: false
        });
      }
    });
  }
}
```

### 3. Data Management

```typescript
class DataManager {
  static async setupAutomaticCleanup() {
    // Daily cleanup at 2 AM
    const scheduleDailyCleanup = () => {
      const now = new Date();
      const tomorrow2AM = new Date(now);
      tomorrow2AM.setDate(tomorrow2AM.getDate() + 1);
      tomorrow2AM.setHours(2, 0, 0, 0);
      
      const msUntilCleanup = tomorrow2AM.getTime() - now.getTime();
      
      setTimeout(async () => {
        await this.performCleanup();
        scheduleDailyCleanup(); // Reschedule
      }, msUntilCleanup);
    };
    
    scheduleDailyCleanup();
  }
  
  static async performCleanup() {
    try {
      const stats = await DamsGeo.getDatabaseStats();
      
      // Keep 7 days by default, less if too much data
      let daysToKeep = 7;
      if (stats.locationCount > 100000) {
        daysToKeep = 3;
      } else if (stats.locationCount > 50000) {
        daysToKeep = 5;
      }
      
      await DamsGeo.clearOldData(daysToKeep);
      console.log(`Cleaned up data older than ${daysToKeep} days`);
      
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  }
}
```

### 4. Server Synchronization

```typescript
class SyncManager {
  private syncQueue: LocationUpdate[] = [];
  private isSyncing = false;
  
  constructor() {
    // Listen for new locations
    DamsGeo.addListener('onLocationUpdate', this.queueLocation);
    
    // Periodic sync
    setInterval(() => this.syncToServer(), 60000); // Every minute
  }
  
  private queueLocation = (location: LocationUpdate) => {
    this.syncQueue.push(location);
    
    // Sync immediately if queue is large
    if (this.syncQueue.length >= 50) {
      this.syncToServer();
    }
  };
  
  private async syncToServer() {
    if (this.isSyncing || this.syncQueue.length === 0) {
      return;
    }
    
    this.isSyncing = true;
    const locationsToSync = [...this.syncQueue];
    this.syncQueue = [];
    
    try {
      const response = await fetch('https://api.example.com/locations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuthToken()}`
        },
        body: JSON.stringify({
          locations: locationsToSync,
          deviceId: await getDeviceId(),
          timestamp: Date.now()
        })
      });
      
      if (!response.ok) {
        // Re-queue on failure
        this.syncQueue.unshift(...locationsToSync);
      }
      
    } catch (error) {
      console.error('Sync failed:', error);
      // Re-queue on error
      this.syncQueue.unshift(...locationsToSync);
      
    } finally {
      this.isSyncing = false;
    }
  }
}
```

## Complete Examples

### Example 1: Fitness Tracking App

```typescript
import React, { useState, useEffect } from 'react';
import { View, Text, Button, ScrollView } from 'react-native';
import DamsGeo from 'dams-geo-sdk';
import MapView, { Polyline } from 'react-native-maps';

function FitnessTracker() {
  const [isTracking, setIsTracking] = useState(false);
  const [distance, setDistance] = useState(0);
  const [duration, setDuration] = useState(0);
  const [route, setRoute] = useState<LocationUpdate[]>([]);
  const [activity, setActivity] = useState<ActivityType>('unknown');
  
  useEffect(() => {
    let interval: NodeJS.Timeout;
    let startTime: number;
    
    if (isTracking) {
      startTime = Date.now();
      interval = setInterval(() => {
        setDuration(Date.now() - startTime);
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTracking]);
  
  const startWorkout = async () => {
    try {
      await DamsGeo.startTracking({
        enableDebugLogs: true,
        desiredAccuracy: 'best',
        distanceFilter: 5,
        enableAdaptiveTracking: false // Want consistent updates
      });
      
      setIsTracking(true);
      setRoute([]);
      setDistance(0);
      
      // Listen for updates
      DamsGeo.addListener('onLocationUpdate', handleLocationUpdate);
      DamsGeo.addListener('onActivityChange', handleActivityChange);
      
    } catch (error) {
      console.error('Failed to start workout:', error);
    }
  };
  
  const stopWorkout = async () => {
    await DamsGeo.stopTracking('workout-ended');
    setIsTracking(false);
    
    // Save workout
    await saveWorkout();
    
    // Clean up listeners
    DamsGeo.removeAllListeners('onLocationUpdate');
    DamsGeo.removeAllListeners('onActivityChange');
  };
  
  const handleLocationUpdate = (location: LocationUpdate) => {
    setRoute(prev => {
      const newRoute = [...prev, location];
      
      // Calculate distance
      if (prev.length > 0) {
        const lastLocation = prev[prev.length - 1];
        const dist = calculateDistance(
          lastLocation.lat, lastLocation.lon,
          location.lat, location.lon
        );
        setDistance(d => d + dist);
      }
      
      return newRoute;
    });
  };
  
  const handleActivityChange = (event: ActivityEvent) => {
    setActivity(event.activity);
  };
  
  const saveWorkout = async () => {
    const workout = {
      date: new Date(),
      distance,
      duration,
      route: route.map(loc => ({
        lat: loc.lat,
        lon: loc.lon,
        timestamp: loc.timestamp
      })),
      activities: calculateActivityBreakdown()
    };
    
    // Save to AsyncStorage or server
    console.log('Workout saved:', workout);
  };
  
  const calculateActivityBreakdown = () => {
    const breakdown = {
      stationary: 0,
      walking: 0,
      running: 0,
      cycling: 0
    };
    
    route.forEach(location => {
      const activity = location.activityType;
      if (activity === 'walking' && location.speed && location.speed > 2.5) {
        breakdown.running++;
      } else if (activity === 'vehicle' && location.speed && location.speed < 10) {
        breakdown.cycling++;
      } else if (activity in breakdown) {
        breakdown[activity as keyof typeof breakdown]++;
      }
    });
    
    return breakdown;
  };
  
  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    return `${hours}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  };
  
  return (
    <View style={{ flex: 1 }}>
      <MapView
        style={{ flex: 1 }}
        showsUserLocation={true}
        followsUserLocation={isTracking}
      >
        {route.length > 1 && (
          <Polyline
            coordinates={route.map(loc => ({
              latitude: loc.lat,
              longitude: loc.lon
            }))}
            strokeColor="#FF0000"
            strokeWidth={3}
          />
        )}
      </MapView>
      
      <View style={{ padding: 20, backgroundColor: 'white' }}>
        <Text>Distance: {(distance / 1000).toFixed(2)} km</Text>
        <Text>Duration: {formatDuration(duration)}</Text>
        <Text>Activity: {activity}</Text>
        <Text>Speed: {route[route.length - 1]?.speed?.toFixed(1) || '0'} m/s</Text>
        
        <Button
          title={isTracking ? 'Stop Workout' : 'Start Workout'}
          onPress={isTracking ? stopWorkout : startWorkout}
        />
      </View>
    </View>
  );
}
```

### Example 2: Fleet Management System

```typescript
import DamsGeo from 'dams-geo-sdk';

class FleetManager {
  private vehicles: Map<string, VehicleTracker> = new Map();
  
  async addVehicle(vehicleId: string, driverId: string) {
    const tracker = new VehicleTracker(vehicleId, driverId);
    await tracker.start();
    this.vehicles.set(vehicleId, tracker);
  }
  
  async removeVehicle(vehicleId: string) {
    const tracker = this.vehicles.get(vehicleId);
    if (tracker) {
      await tracker.stop();
      this.vehicles.delete(vehicleId);
    }
  }
  
  getVehicleLocation(vehicleId: string): LocationUpdate | null {
    return this.vehicles.get(vehicleId)?.getCurrentLocation() || null;
  }
  
  async generateDailyReport(vehicleId: string): Promise<VehicleReport> {
    const tracker = this.vehicles.get(vehicleId);
    if (!tracker) throw new Error('Vehicle not found');
    
    return tracker.generateDailyReport();
  }
}

class VehicleTracker {
  private currentLocation: LocationUpdate | null = null;
  private dailyDistance = 0;
  private idleTime = 0;
  private drivingTime = 0;
  private lastUpdateTime = 0;
  private geofenceViolations: GeofenceViolation[] = [];
  
  constructor(
    private vehicleId: string,
    private driverId: string
  ) {}
  
  async start() {
    // Set up delivery zone geofences
    await this.setupDeliveryZones();
    
    // Start tracking
    await DamsGeo.startTracking({
      enableDebugLogs: false,
      desiredAccuracy: 'balanced',
      distanceFilter: 20,
      enableAdaptiveTracking: true
    });
    
    // Listen for events
    DamsGeo.addListener('onLocationUpdate', this.handleLocationUpdate);
    DamsGeo.addListener('onGeofenceExit', this.handleGeofenceExit);
    DamsGeo.addListener('onActivityChange', this.handleActivityChange);
  }
  
  async stop() {
    await DamsGeo.stopTracking('vehicle-offline');
    DamsGeo.removeAllListeners();
  }
  
  private async setupDeliveryZones() {
    const zones: GeofenceZone[] = [
      {
        id: 'warehouse',
        name: 'Main Warehouse',
        coordinates: [
          { lat: 37.7749, lon: -122.4194 },
          { lat: 37.7751, lon: -122.4194 },
          { lat: 37.7751, lon: -122.4192 },
          { lat: 37.7749, lon: -122.4192 }
        ],
        isActive: true
      },
      // Add delivery zones...
    ];
    
    await DamsGeo.setGeofences(zones);
  }
  
  private handleLocationUpdate = (location: LocationUpdate) => {
    // Update distance
    if (this.currentLocation) {
      const distance = this.calculateDistance(
        this.currentLocation.lat, this.currentLocation.lon,
        location.lat, location.lon
      );
      this.dailyDistance += distance;
    }
    
    // Update time tracking
    const now = Date.now();
    if (this.lastUpdateTime) {
      const timeDelta = now - this.lastUpdateTime;
      
      if (location.speed && location.speed > 1) {
        this.drivingTime += timeDelta;
      } else {
        this.idleTime += timeDelta;
      }
    }
    
    this.currentLocation = location;
    this.lastUpdateTime = now;
    
    // Send to server
    this.sendLocationToServer(location);
  };
  
  private handleGeofenceExit = (event: GeofenceEvent) => {
    if (event.zoneId !== 'warehouse') {
      // Log unauthorized zone exit
      this.geofenceViolations.push({
        zoneId: event.zoneId,
        zoneName: event.zoneName,
        timestamp: event.location.timestamp,
        location: event.location
      });
      
      // Alert dispatcher
      this.alertDispatcher(`Vehicle ${this.vehicleId} left ${event.zoneName}`);
    }
  };
  
  private handleActivityChange = (event: ActivityEvent) => {
    console.log(`Vehicle ${this.vehicleId} activity: ${event.activity}`);
  };
  
  private async sendLocationToServer(location: LocationUpdate) {
    try {
      await fetch('https://fleet-api.example.com/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleId: this.vehicleId,
          driverId: this.driverId,
          location,
          timestamp: Date.now()
        })
      });
    } catch (error) {
      console.error('Failed to send location:', error);
    }
  }
  
  getCurrentLocation(): LocationUpdate | null {
    return this.currentLocation;
  }
  
  async generateDailyReport(): Promise<VehicleReport> {
    const locations = await DamsGeo.getRecentLocations(1000);
    
    return {
      vehicleId: this.vehicleId,
      driverId: this.driverId,
      date: new Date(),
      totalDistance: this.dailyDistance,
      drivingTime: this.drivingTime,
      idleTime: this.idleTime,
      averageSpeed: this.calculateAverageSpeed(locations),
      maxSpeed: Math.max(...locations.map(l => l.speed || 0)),
      geofenceViolations: this.geofenceViolations,
      stops: this.identifyStops(locations)
    };
  }
  
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    // Haversine formula implementation
    const R = 6371e3;
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;
    
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    return R * c;
  }
  
  private calculateAverageSpeed(locations: LocationUpdate[]): number {
    const speeds = locations
      .map(l => l.speed)
      .filter((s): s is number => s !== null);
    
    if (speeds.length === 0) return 0;
    
    return speeds.reduce((a, b) => a + b, 0) / speeds.length;
  }
  
  private identifyStops(locations: LocationUpdate[]): Stop[] {
    const stops: Stop[] = [];
    let currentStop: Stop | null = null;
    
    locations.forEach((location, index) => {
      if (location.speed === null || location.speed < 0.5) {
        if (!currentStop) {
          currentStop = {
            startTime: location.timestamp,
            endTime: location.timestamp,
            location: { lat: location.lat, lon: location.lon },
            duration: 0
          };
        } else {
          currentStop.endTime = location.timestamp;
          currentStop.duration = currentStop.endTime - currentStop.startTime;
        }
      } else if (currentStop && currentStop.duration > 60000) { // 1 minute minimum
        stops.push(currentStop);
        currentStop = null;
      }
    });
    
    return stops;
  }
  
  private alertDispatcher(message: string) {
    console.error(`ALERT: ${message}`);
    // Send push notification, SMS, etc.
  }
}

// Type definitions
interface VehicleReport {
  vehicleId: string;
  driverId: string;
  date: Date;
  totalDistance: number;
  drivingTime: number;
  idleTime: number;
  averageSpeed: number;
  maxSpeed: number;
  geofenceViolations: GeofenceViolation[];
  stops: Stop[];
}

interface GeofenceViolation {
  zoneId: string;
  zoneName: string;
  timestamp: number;
  location: {
    lat: number;
    lon: number;
  };
}

interface Stop {
  startTime: number;
  endTime: number;
  location: {
    lat: number;
    lon: number;
  };
  duration: number;
}
```

## Troubleshooting

### Common Issues and Solutions

1. **Location Updates Not Received**
   ```typescript
   // Check permissions
   const status = await check(PERMISSIONS.IOS.LOCATION_ALWAYS);
   if (status !== 'granted') {
     // Request permission
   }
   
   // Verify tracking is started
   if (!DamsGeo.isTracking) {
     await DamsGeo.startTracking();
   }
   ```

2. **Database Encryption Issues**
   ```typescript
   // Check encryption status
   const status = await DamsGeo.getEncryptionStatus();
   if (!status.hasKey) {
     // Key might be lost, may need to reset
   }
   ```

3. **High Battery Usage**
   ```typescript
   // Enable adaptive tracking
   await DamsGeo.startTracking({
     desiredAccuracy: 'balanced',
     enableAdaptiveTracking: true
   });
   ```

4. **Geofence Not Triggering**
   ```typescript
   // Verify geofence is active
   const zones = await DamsGeo.getStoredGeofences();
   const targetZone = zones.find(z => z.id === 'target-zone');
   if (!targetZone?.isActive) {
     // Re-activate zone
   }
   ```

## Migration Guide

### From Version 0.x to 1.0

1. **Event Names Changed**
   ```typescript
   // Old
   DamsGeo.addListener('locationUpdate', handler);
   
   // New
   DamsGeo.addListener('onLocationUpdate', handler);
   ```

2. **Method Name Changes**
   ```typescript
   // Old
   DamsGeo.saveGeofences(zones);
   
   // New
   DamsGeo.setGeofences(zones);
   ```

3. **Configuration Changes**
   ```typescript
   // Old
   DamsGeo.configure({ userId: 'user123' });
   
   // New - userId now passed to export methods
   DamsGeo.exportAudit({ userId: 'user123', ... });
   ```

---

For additional support, please refer to:
- [GitHub Issues](https://github.com/dams/dams-geo-sdk/issues)
- [Example App](./example/)
- [Testing Guide](./DOCS/TESTING_GUIDE.md)