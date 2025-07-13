import { BackgroundWakeTestHarness, BackgroundWakeTest } from '../BackgroundWakeTestHarness';
import { DamsGeo } from '../../DamsGeo';
import * as logging from '../../logging';
import * as FileSystem from 'expo-file-system';

// Mock dependencies
jest.mock('../../DamsGeo');
jest.mock('../../logging');
jest.mock('expo-file-system');

describe('BackgroundWakeTestHarness', () => {
  let mockDamsGeo: any;
  let mockFileSystem: jest.Mocked<typeof FileSystem>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock logging functions
    (logging.logInfo as jest.Mock) = jest.fn();
    (logging.logWarn as jest.Mock) = jest.fn();
    (logging.logError as jest.Mock) = jest.fn();

    // Mock DamsGeo methods
    mockDamsGeo = DamsGeo as any;
    mockDamsGeo.addListener = jest.fn();
    mockDamsGeo.getRecentLocations = jest.fn();
    mockDamsGeo.setGeofences = jest.fn().mockResolvedValue(undefined);
    mockDamsGeo.startTracking = jest.fn().mockResolvedValue(true);

    // Mock FileSystem
    mockFileSystem = FileSystem as jest.Mocked<typeof FileSystem>;
    Object.defineProperty(mockFileSystem, 'documentDirectory', {
      value: '/test/documents/',
      writable: false
    });
    mockFileSystem.deleteAsync = jest.fn().mockResolvedValue(undefined);
    mockFileSystem.writeAsStringAsync = jest.fn().mockResolvedValue(undefined);
    mockFileSystem.readAsStringAsync = jest.fn();
  });

  describe('initialize', () => {
    it('should initialize test harness successfully', async () => {
      await BackgroundWakeTestHarness.initialize();

      expect(logging.logInfo).toHaveBeenCalledWith(
        'BackgroundWakeTestHarness', 
        'Initializing background wake test harness'
      );
      expect(mockFileSystem.deleteAsync).toHaveBeenCalledWith(
        '/test/documents/background_wake_test.log',
        { idempotent: true }
      );
      expect(mockDamsGeo.addListener).toHaveBeenCalledWith('onGeofenceEnter', expect.any(Function));
      expect(mockDamsGeo.addListener).toHaveBeenCalledWith('onGeofenceExit', expect.any(Function));
      expect(logging.logInfo).toHaveBeenCalledWith(
        'BackgroundWakeTestHarness',
        'Background wake test harness initialized'
      );
    });

    it('should handle error when clearing previous logs', async () => {
      mockFileSystem.deleteAsync.mockRejectedValueOnce(new Error('Delete failed'));

      await BackgroundWakeTestHarness.initialize();

      expect(logging.logWarn).toHaveBeenCalledWith(
        'BackgroundWakeTestHarness',
        'Could not clear previous test logs',
        expect.any(Error)
      );
      // Should continue with initialization
      expect(mockDamsGeo.addListener).toHaveBeenCalled();
    });

    it('should set up geofence event listeners', async () => {
      let enterHandler: any;
      let exitHandler: any;
      mockDamsGeo.addListener.mockImplementation((event: string, handler: any) => {
        if (event === 'onGeofenceEnter') enterHandler = handler;
        if (event === 'onGeofenceExit') exitHandler = handler;
      });

      await BackgroundWakeTestHarness.initialize();

      // Test enter event handler
      const testEnterData = { zoneId: 'test_zone', zoneName: 'Test Zone' };
      await enterHandler(testEnterData);

      // Should read existing content (fails), then write
      expect(mockFileSystem.readAsStringAsync).toHaveBeenCalled();
      expect(mockFileSystem.writeAsStringAsync).toHaveBeenCalledWith(
        '/test/documents/background_wake_test.log',
        expect.stringContaining('GEOFENCE_ENTER')
      );
    });
  });

  describe('setupTestGeofences', () => {
    it('should set up test geofences around current location', async () => {
      const mockLocation = {
        lat: 37.7749,
        lon: -122.4194,
        accuracy: 10,
        speed: null,
        heading: null,
        altitude: null,
        activityType: 'stationary',
        timestamp: Date.now()
      };
      mockDamsGeo.getRecentLocations.mockResolvedValueOnce([mockLocation]);

      await BackgroundWakeTestHarness.setupTestGeofences();

      expect(logging.logInfo).toHaveBeenCalledWith(
        'BackgroundWakeTestHarness',
        'Setting up test geofences'
      );
      expect(mockDamsGeo.getRecentLocations).toHaveBeenCalledWith(1);
      
      // Verify test zones were created
      expect(mockDamsGeo.setGeofences).toHaveBeenCalledWith([
        expect.objectContaining({
          id: 'wake_test_near',
          name: 'Near Zone (100m)',
          coordinates: expect.any(Array),
          isActive: true
        }),
        expect.objectContaining({
          id: 'wake_test_medium',
          name: 'Medium Zone (300m)',
          coordinates: expect.any(Array),
          isActive: true
        }),
        expect.objectContaining({
          id: 'wake_test_far',
          name: 'Far Zone (500m)',
          coordinates: expect.any(Array),
          isActive: true
        })
      ]);

      // Verify logging
      expect(mockFileSystem.writeAsStringAsync).toHaveBeenCalledWith(
        '/test/documents/background_wake_test.log',
        expect.stringContaining('TEST_SETUP')
      );
      expect(logging.logInfo).toHaveBeenCalledWith(
        'BackgroundWakeTestHarness',
        'Test geofences configured: 3 zones'
      );
    });

    it('should throw error if location cannot be obtained', async () => {
      mockDamsGeo.getRecentLocations.mockResolvedValueOnce([]);

      await expect(BackgroundWakeTestHarness.setupTestGeofences())
        .rejects.toThrow('Could not get current location');
    });

    it('should create square zones with correct coordinates', async () => {
      const mockLocation = {
        lat: 40.0,
        lon: -74.0,
        accuracy: 10,
        speed: null,
        heading: null,
        altitude: null,
        activityType: 'stationary' as const,
        timestamp: Date.now()
      };
      mockDamsGeo.getRecentLocations.mockResolvedValueOnce([mockLocation]);

      await BackgroundWakeTestHarness.setupTestGeofences();

      const setGeofencesCall = mockDamsGeo.setGeofences.mock.calls[0][0];
      const nearZone = setGeofencesCall[0];
      
      // Verify square zone coordinates
      expect(nearZone.coordinates).toHaveLength(4);
      expect(nearZone.coordinates![0]).toMatchObject({
        lat: expect.any(Number),
        lon: expect.any(Number)
      });
    });
  });

  describe('checkBackgroundWake', () => {
    it('should return true when background events exist', async () => {
      const mockLogs = [
        JSON.stringify({
          type: 'GEOFENCE_ENTER',
          data: { triggeredInBackground: true },
          timestamp: new Date().toISOString()
        }),
        JSON.stringify({
          type: 'GEOFENCE_EXIT',
          data: { triggeredInBackground: false },
          timestamp: new Date().toISOString()
        })
      ].join('\n');

      mockFileSystem.readAsStringAsync.mockResolvedValueOnce(mockLogs);

      const result = await BackgroundWakeTestHarness.checkBackgroundWake();

      expect(result).toBe(true);
      expect(mockFileSystem.readAsStringAsync).toHaveBeenCalledWith(
        '/test/documents/background_wake_test.log'
      );
    });

    it('should return false when no background events exist', async () => {
      const mockLogs = JSON.stringify({
        type: 'GEOFENCE_ENTER',
        data: { triggeredInBackground: false },
        timestamp: new Date().toISOString()
      });

      mockFileSystem.readAsStringAsync.mockResolvedValueOnce(mockLogs);

      const result = await BackgroundWakeTestHarness.checkBackgroundWake();

      expect(result).toBe(false);
    });

    it('should handle read errors gracefully', async () => {
      mockFileSystem.readAsStringAsync.mockRejectedValueOnce(new Error('Read failed'));

      const result = await BackgroundWakeTestHarness.checkBackgroundWake();

      expect(result).toBe(false);
      expect(logging.logError).toHaveBeenCalledWith(
        'BackgroundWakeTestHarness',
        'Error checking background wake',
        expect.any(Error)
      );
    });

    it('should handle invalid JSON in logs', async () => {
      const mockLogs = 'invalid json\n' + JSON.stringify({
        type: 'GEOFENCE_EXIT',
        data: { triggeredInBackground: true },
        timestamp: new Date().toISOString()
      });

      mockFileSystem.readAsStringAsync.mockResolvedValueOnce(mockLogs);

      const result = await BackgroundWakeTestHarness.checkBackgroundWake();

      expect(result).toBe(true); // Should still find valid background event
    });
  });

  describe('getTestResults', () => {
    it('should calculate test results correctly', async () => {
      const mockLogs = [
        JSON.stringify({
          type: 'GEOFENCE_ENTER',
          data: {
            triggeredInBackground: true,
            zoneId: 'wake_test_near',
            transitionDelay: 100
          },
          timestamp: new Date().toISOString()
        }),
        JSON.stringify({
          type: 'GEOFENCE_EXIT',
          data: {
            triggeredInBackground: false,
            zoneId: 'wake_test_near',
            transitionDelay: 200
          },
          timestamp: new Date().toISOString()
        }),
        JSON.stringify({
          type: 'GEOFENCE_ENTER',
          data: {
            triggeredInBackground: true,
            zoneId: 'wake_test_medium',
            transitionDelay: 150
          },
          timestamp: new Date().toISOString()
        })
      ].join('\n');

      mockFileSystem.readAsStringAsync.mockResolvedValueOnce(mockLogs);

      const results = await BackgroundWakeTestHarness.getTestResults();

      expect(results).toEqual({
        totalEvents: 3,
        backgroundEvents: 2,
        averageDelay: 150, // (100 + 200 + 150) / 3
        zones: {
          'wake_test_near': 2,
          'wake_test_medium': 1
        }
      });
    });

    it('should handle empty log file', async () => {
      mockFileSystem.readAsStringAsync.mockResolvedValueOnce('');

      const results = await BackgroundWakeTestHarness.getTestResults();

      expect(results).toEqual({
        totalEvents: 0,
        backgroundEvents: 0,
        averageDelay: 0,
        zones: {}
      });
    });

    it('should handle events without transition delay', async () => {
      const mockLogs = JSON.stringify({
        type: 'GEOFENCE_ENTER',
        data: {
          triggeredInBackground: false,
          zoneId: 'wake_test_near'
          // No transitionDelay
        },
        timestamp: new Date().toISOString()
      });

      mockFileSystem.readAsStringAsync.mockResolvedValueOnce(mockLogs);

      const results = await BackgroundWakeTestHarness.getTestResults();

      expect(results.averageDelay).toBe(0);
    });

    it('should return default results on error', async () => {
      mockFileSystem.readAsStringAsync.mockRejectedValueOnce(new Error('Read failed'));

      const results = await BackgroundWakeTestHarness.getTestResults();

      expect(results).toEqual({
        totalEvents: 0,
        backgroundEvents: 0,
        averageDelay: 0,
        zones: {}
      });
      expect(logging.logError).toHaveBeenCalledWith(
        'BackgroundWakeTestHarness',
        'Error getting test results',
        expect.any(Error)
      );
    });
  });

  describe('clearTestData', () => {
    it('should clear all test data', async () => {
      await BackgroundWakeTestHarness.clearTestData();

      expect(mockDamsGeo.setGeofences).toHaveBeenCalledWith([]);
      expect(mockFileSystem.deleteAsync).toHaveBeenCalledWith(
        '/test/documents/background_wake_test.log',
        { idempotent: true }
      );
      expect(logging.logInfo).toHaveBeenCalledWith(
        'BackgroundWakeTestHarness',
        'Test data cleared'
      );
    });
  });

  describe('BackgroundWakeTest convenience exports', () => {
    it('should provide convenience methods', async () => {
      expect(BackgroundWakeTest.init).toBeDefined();
      expect(BackgroundWakeTest.startTracking).toBeDefined();
      expect(BackgroundWakeTest.setup).toBeDefined();
      expect(BackgroundWakeTest.check).toBeDefined();
      expect(BackgroundWakeTest.results).toBeDefined();
      expect(BackgroundWakeTest.clear).toBeDefined();

      // Test that they call the correct methods
      await BackgroundWakeTest.init();
      expect(mockDamsGeo.addListener).toHaveBeenCalled();

      await BackgroundWakeTest.startTracking();
      expect(mockDamsGeo.startTracking).toHaveBeenCalled();

      mockDamsGeo.getRecentLocations.mockResolvedValueOnce([{
        lat: 0, lon: 0, accuracy: 10, speed: null, heading: null,
        altitude: null, activityType: 'stationary', timestamp: Date.now()
      }]);
      await BackgroundWakeTest.setup();
      expect(mockDamsGeo.setGeofences).toHaveBeenCalled();

      mockFileSystem.readAsStringAsync.mockResolvedValueOnce('');
      await BackgroundWakeTest.check();
      expect(mockFileSystem.readAsStringAsync).toHaveBeenCalled();

      mockFileSystem.readAsStringAsync.mockResolvedValueOnce('');
      await BackgroundWakeTest.results();
      expect(mockFileSystem.readAsStringAsync).toHaveBeenCalled();

      await BackgroundWakeTest.clear();
      expect(mockDamsGeo.setGeofences).toHaveBeenCalledWith([]);
    });
  });
});