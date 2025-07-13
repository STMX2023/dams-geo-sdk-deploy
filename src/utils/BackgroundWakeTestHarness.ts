import { DamsGeo } from '../DamsGeo';
import { logger, logInfo, logWarn, logError } from '../logging';
import * as FileSystem from 'expo-file-system';
import type { GeofenceZone, DamsGeoConfig } from '../DamsGeo.types';

/**
 * Test harness for validating background wake functionality of native geofencing
 */
export class BackgroundWakeTestHarness {
  private static readonly LOG_CATEGORY = 'BackgroundWakeTestHarness';
  private static testLogFile = `${FileSystem.documentDirectory}background_wake_test.log`;

  /**
   * Initialize test environment for background wake testing
   */
  static async initialize(): Promise<void> {
    logInfo(this.LOG_CATEGORY, 'Initializing background wake test harness');

    // Clear previous test logs
    try {
      await FileSystem.deleteAsync(this.testLogFile, { idempotent: true });
    } catch (error) {
      logWarn(this.LOG_CATEGORY, 'Could not clear previous test logs', error as Error);
    }

    // Set up event listeners for geofence events
    DamsGeo.addListener('onGeofenceEnter', (data) => {
      this.logBackgroundEvent('GEOFENCE_ENTER', data);
    });
    
    DamsGeo.addListener('onGeofenceExit', (data) => {
      this.logBackgroundEvent('GEOFENCE_EXIT', data);
    });

    // Note: Configuration is now passed to startTracking, not set separately
    // The actual config will be applied when tracking starts
    logInfo(this.LOG_CATEGORY, 'Background wake test harness initialized');
  }

  /**
   * Start tracking with background wake test configuration
   * Must be called after initialize() to apply the desired config
   */
  static async startTrackingWithTestConfig(): Promise<void> {
    const config: DamsGeoConfig = {
      enableGeofencing: true,
      enableBackgroundLocation: true,
      geofencingPollingInterval: 15 * 60 * 1000, // 15 minutes in ms
      enableBatteryOptimization: true,
      enableActivityRecognition: true,
      persistLocationHistory: true,
      enableMetricsCollection: true,
      enableDebugLogging: __DEV__
    };
    
    await DamsGeo.startTracking(config);
    logInfo(this.LOG_CATEGORY, 'Started tracking with background wake test configuration');
  }

  /**
   * Set up test geofences around current location
   */
  static async setupTestGeofences(): Promise<void> {
    logInfo(this.LOG_CATEGORY, 'Setting up test geofences');

    // Get the most recent location
    const locations = await DamsGeo.getRecentLocations(1);
    if (!locations || locations.length === 0) {
      throw new Error('Could not get current location');
    }
    const location = locations[0];

    const { lat: latitude, lon: longitude } = location;

    // Create test zones at different distances
    const testZones: GeofenceZone[] = [
      {
        id: 'wake_test_near',
        name: 'Near Zone (100m)',
        coordinates: this.createSquareZone(latitude + 0.001, longitude, 0.0009), // ~100m
        isActive: true
      },
      {
        id: 'wake_test_medium',
        name: 'Medium Zone (300m)',
        coordinates: this.createSquareZone(latitude + 0.003, longitude, 0.0027), // ~300m
        isActive: true
      },
      {
        id: 'wake_test_far',
        name: 'Far Zone (500m)',
        coordinates: this.createSquareZone(latitude + 0.005, longitude, 0.0045), // ~500m
        isActive: true
      }
    ];

    await DamsGeo.setGeofences(testZones);
    
    // Log test setup
    await this.logBackgroundEvent('TEST_SETUP', {
      currentLocation: { latitude, longitude },
      testZones: testZones.map(z => ({ id: z.id, name: z.name })),
      timestamp: new Date().toISOString()
    });

    logInfo(this.LOG_CATEGORY, `Test geofences configured: ${testZones.length} zones`);
  }

  /**
   * Check if app was woken from background
   */
  static async checkBackgroundWake(): Promise<boolean> {
    try {
      const logContent = await FileSystem.readAsStringAsync(this.testLogFile);
      const logs = logContent.split('\n').filter(line => line.trim());
      
      // Check if there are events logged after app was terminated
      const events = logs.map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      }).filter(Boolean);

      const backgroundEvents = events.filter(e => 
        (e.type === 'GEOFENCE_ENTER' || e.type === 'GEOFENCE_EXIT') && 
        e.data.triggeredInBackground
      );

      return backgroundEvents.length > 0;
    } catch (error) {
      logError(this.LOG_CATEGORY, 'Error checking background wake', error as Error);
      return false;
    }
  }

  /**
   * Get test results summary
   */
  static async getTestResults(): Promise<{
    totalEvents: number;
    backgroundEvents: number;
    averageDelay: number;
    zones: Record<string, number>;
  }> {
    try {
      const logContent = await FileSystem.readAsStringAsync(this.testLogFile);
      const logs = logContent.split('\n').filter(line => line.trim());
      
      const events = logs.map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      }).filter(Boolean);

      const geofenceEvents = events.filter(e => 
        e.type === 'GEOFENCE_ENTER' || e.type === 'GEOFENCE_EXIT'
      );
      const backgroundEvents = geofenceEvents.filter(e => e.data.triggeredInBackground);

      // Calculate average delay
      let totalDelay = 0;
      let delayCount = 0;
      
      geofenceEvents.forEach(event => {
        if (event.data.transitionDelay) {
          totalDelay += event.data.transitionDelay;
          delayCount++;
        }
      });

      // Count events per zone
      const zoneCount: Record<string, number> = {};
      geofenceEvents.forEach(event => {
        const zoneId = event.data.zoneId;
        zoneCount[zoneId] = (zoneCount[zoneId] || 0) + 1;
      });

      return {
        totalEvents: geofenceEvents.length,
        backgroundEvents: backgroundEvents.length,
        averageDelay: delayCount > 0 ? totalDelay / delayCount : 0,
        zones: zoneCount
      };
    } catch (error) {
      logError(this.LOG_CATEGORY, 'Error getting test results', error as Error);
      return {
        totalEvents: 0,
        backgroundEvents: 0,
        averageDelay: 0,
        zones: {}
      };
    }
  }

  /**
   * Clear test data
   */
  static async clearTestData(): Promise<void> {
    // Clear all geofences by setting empty array
    await DamsGeo.setGeofences([]);
    await FileSystem.deleteAsync(this.testLogFile, { idempotent: true });
    logInfo(this.LOG_CATEGORY, 'Test data cleared');
  }

  /**
   * Log event to persistent storage
   */
  private static async logBackgroundEvent(type: string, data: any): Promise<void> {
    const logEntry = {
      type,
      data,
      timestamp: new Date().toISOString(),
      appState: 'active' // Would be 'background' or 'terminated' in real scenario
    };

    try {
      const logLine = JSON.stringify(logEntry) + '\n';
      
      // FileSystem doesn't support append, so read existing content first
      let existingContent = '';
      try {
        existingContent = await FileSystem.readAsStringAsync(this.testLogFile);
      } catch {
        // File doesn't exist yet, that's ok
      }
      
      await FileSystem.writeAsStringAsync(
        this.testLogFile,
        existingContent + logLine
      );
    } catch (error) {
      logError(this.LOG_CATEGORY, 'Failed to log background event', error as Error);
    }
  }

  /**
   * Create a square zone around a center point
   */
  private static createSquareZone(
    centerLat: number,
    centerLon: number,
    halfSide: number
  ): Array<{ lat: number; lon: number }> {
    return [
      { lat: centerLat - halfSide, lon: centerLon - halfSide },
      { lat: centerLat + halfSide, lon: centerLon - halfSide },
      { lat: centerLat + halfSide, lon: centerLon + halfSide },
      { lat: centerLat - halfSide, lon: centerLon + halfSide }
    ];
  }
}

// Export test commands for easy access
export const BackgroundWakeTest = {
  init: () => BackgroundWakeTestHarness.initialize(),
  startTracking: () => BackgroundWakeTestHarness.startTrackingWithTestConfig(),
  setup: () => BackgroundWakeTestHarness.setupTestGeofences(),
  check: () => BackgroundWakeTestHarness.checkBackgroundWake(),
  results: () => BackgroundWakeTestHarness.getTestResults(),
  clear: () => BackgroundWakeTestHarness.clearTestData()
};