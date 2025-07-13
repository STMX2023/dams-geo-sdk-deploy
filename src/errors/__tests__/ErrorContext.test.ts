import {
  ErrorContextManager,
  ErrorDebugger,
  logBreadcrumb,
  logDebug,
  logInfo,
  logWarning,
  logError,
  errorContext
} from '../ErrorContext';
import { DamsGeoError, DamsGeoErrorCode, ErrorSeverity } from '../DamsGeoError';
import { Platform } from 'react-native';

// Mock Platform
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    Version: '14.0',
    isPad: false,
    isTV: false
  }
}));

// Mock __DEV__
(global as any).__DEV__ = false;

describe('ErrorContextManager', () => {
  let manager: ErrorContextManager;

  beforeEach(() => {
    // Clear singleton
    (ErrorContextManager as any).instance = null;
    manager = ErrorContextManager.getInstance();
    manager.clearBreadcrumbs();
  });

  describe('Singleton', () => {
    it('should return the same instance', () => {
      const instance1 = ErrorContextManager.getInstance();
      const instance2 = ErrorContextManager.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should export singleton as default and named export', () => {
      // Test that errorContext is an instance of ErrorContextManager
      expect(errorContext).toBeInstanceOf(ErrorContextManager);
      // Test that it's the same singleton
      expect(errorContext).toStrictEqual(ErrorContextManager.getInstance());
    });
  });

  describe('Breadcrumbs', () => {
    it('should add breadcrumb', () => {
      manager.addBreadcrumb({
        category: 'test',
        message: 'Test message',
        level: 'info'
      });

      const breadcrumbs = manager.getBreadcrumbs();
      expect(breadcrumbs).toHaveLength(1);
      expect(breadcrumbs[0]).toMatchObject({
        category: 'test',
        message: 'Test message',
        level: 'info',
        timestamp: expect.any(Number)
      });
    });

    it('should limit breadcrumbs to maxBreadcrumbs', () => {
      // Add 60 breadcrumbs (max is 50)
      for (let i = 0; i < 60; i++) {
        manager.addBreadcrumb({
          category: 'test',
          message: `Message ${i}`,
          level: 'info'
        });
      }

      const breadcrumbs = manager.getBreadcrumbs();
      expect(breadcrumbs).toHaveLength(50);
      expect(breadcrumbs[0].message).toBe('Message 10');
      expect(breadcrumbs[49].message).toBe('Message 59');
    });

    it('should get limited breadcrumbs', () => {
      for (let i = 0; i < 10; i++) {
        manager.addBreadcrumb({
          category: 'test',
          message: `Message ${i}`,
          level: 'info'
        });
      }

      const limited = manager.getBreadcrumbs(3);
      expect(limited).toHaveLength(3);
      expect(limited[0].message).toBe('Message 7');
      expect(limited[2].message).toBe('Message 9');
    });

    it('should clear breadcrumbs', () => {
      manager.addBreadcrumb({
        category: 'test',
        message: 'Test',
        level: 'info'
      });

      manager.clearBreadcrumbs();
      expect(manager.getBreadcrumbs()).toHaveLength(0);
    });
  });

  describe('Context Updates', () => {
    it('should update system info', () => {
      manager.updateSystemInfo({
        deviceModel: 'iPhone 12',
        isEmulator: false,
        batteryLevel: 75
      });

      const error = new DamsGeoError(DamsGeoErrorCode.LOCATION_ERROR, 'Test');
      const context = manager.captureContext(error);

      expect(context.system).toMatchObject({
        deviceModel: 'iPhone 12',
        isEmulator: false,
        batteryLevel: 75
      });
    });

    it('should update location context and add breadcrumb', () => {
      manager.updateLocationContext({
        lastKnownLocation: {
          lat: 37.7749,
          lon: -122.4194,
          timestamp: Date.now()
        },
        locationPermission: 'granted',
        gpsEnabled: true
      });

      const error = new DamsGeoError(DamsGeoErrorCode.LOCATION_ERROR, 'Test');
      const context = manager.captureContext(error);

      expect(context.location).toMatchObject({
        locationPermission: 'granted',
        gpsEnabled: true
      });

      const breadcrumbs = manager.getBreadcrumbs();
      expect(breadcrumbs).toContainEqual(
        expect.objectContaining({
          category: 'location',
          message: 'Location context updated',
          level: 'info'
        })
      );
    });

    it('should update network context and add breadcrumb', () => {
      manager.updateNetworkContext({
        isConnected: true,
        connectionType: 'wifi',
        effectiveType: '4g'
      });

      const error = new DamsGeoError(DamsGeoErrorCode.NETWORK_ERROR, 'Test');
      const context = manager.captureContext(error);

      expect(context.network).toMatchObject({
        isConnected: true,
        connectionType: 'wifi',
        effectiveType: '4g'
      });

      const breadcrumbs = manager.getBreadcrumbs();
      expect(breadcrumbs).toContainEqual(
        expect.objectContaining({
          category: 'network',
          message: 'Network context updated'
        })
      );
    });

    it('should update database context and add breadcrumb', () => {
      manager.updateDatabaseContext({
        isInitialized: true,
        isEncrypted: true,
        recordCount: 1000
      });

      const error = new DamsGeoError(DamsGeoErrorCode.DATABASE_ERROR, 'Test');
      const context = manager.captureContext(error);

      expect(context.database).toMatchObject({
        isInitialized: true,
        isEncrypted: true,
        recordCount: 1000
      });

      const breadcrumbs = manager.getBreadcrumbs();
      expect(breadcrumbs).toContainEqual(
        expect.objectContaining({
          category: 'database',
          message: 'Database context updated'
        })
      );
    });
  });

  describe('captureContext', () => {
    it('should capture full context', () => {
      const error = new DamsGeoError(
        DamsGeoErrorCode.LOCATION_ERROR,
        'Test error',
        {
          context: {
            operation: 'getCurrentPosition',
            userId: 'user123'
          }
        }
      );

      const context = manager.captureContext(error);

      expect(context).toMatchObject({
        operation: 'getCurrentPosition',
        userId: 'user123',
        system: expect.objectContaining({
          platform: 'ios',
          osVersion: '14.0'
        }),
        stackTrace: expect.any(Array),
        breadcrumbs: expect.any(Array)
      });
    });

    it('should parse stack trace', () => {
      const error = new DamsGeoError(DamsGeoErrorCode.UNKNOWN_ERROR, 'Test');
      const context = manager.captureContext(error);

      expect(context.stackTrace).toBeInstanceOf(Array);
      if (error.stack) {
        expect(context.stackTrace!.length).toBeGreaterThan(0);
        expect(context.stackTrace!.length).toBeLessThanOrEqual(20);
      }
    });
  });
});

describe('ErrorDebugger', () => {
  let manager: ErrorContextManager;

  beforeEach(() => {
    (ErrorContextManager as any).instance = null;
    manager = ErrorContextManager.getInstance();
    manager.clearBreadcrumbs();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createErrorReport', () => {
    it('should create detailed error report', () => {
      const error = new DamsGeoError(
        DamsGeoErrorCode.LOCATION_TIMEOUT,
        'Location timeout',
        {
          context: {
            operation: 'getCurrentPosition',
            userId: 'user123'
          }
        }
      );

      const report = ErrorDebugger.createErrorReport(error);

      expect(report).toContain('=== DAMS Geo SDK Error Report ===');
      expect(report).toContain('Code: LOCATION_TIMEOUT');
      expect(report).toContain('Message: Location timeout');
      expect(report).toContain('Operation: getCurrentPosition');
      expect(report).toContain('User ID: user123');
      expect(report).toContain('Platform: ios 14.0');
    });

    it('should include location context in report', () => {
      manager.updateLocationContext({
        lastKnownLocation: {
          lat: 37.7749,
          lon: -122.4194,
          timestamp: Date.now()
        },
        gpsEnabled: true
      });

      const error = new DamsGeoError(DamsGeoErrorCode.LOCATION_ERROR, 'Test');
      const report = ErrorDebugger.createErrorReport(error);

      expect(report).toContain('--- Location Context ---');
      expect(report).toContain('GPS Enabled: Yes');
      expect(report).toContain('Last Location: 37.774900, -122.419400');
    });

    it('should include breadcrumbs in report', () => {
      manager.addBreadcrumb({
        category: 'test',
        message: 'Test breadcrumb',
        level: 'info',
        data: { key: 'value' }
      });

      const error = new DamsGeoError(DamsGeoErrorCode.UNKNOWN_ERROR, 'Test');
      const report = ErrorDebugger.createErrorReport(error);

      expect(report).toContain('--- Breadcrumbs ---');
      expect(report).toContain('[info] test: Test breadcrumb');
      expect(report).toContain('Data: {"key":"value"}');
    });
  });

  describe('logError', () => {
    it('should log simple error in production', () => {
      (global as any).__DEV__ = false;
      const error = new DamsGeoError(DamsGeoErrorCode.LOCATION_ERROR, 'Test error');

      ErrorDebugger.logError(error);

      expect(console.error).toHaveBeenCalledWith('[LOCATION_ERROR] Test error');
      expect(console.log).not.toHaveBeenCalled();
    });

    it('should log detailed error in dev mode', () => {
      (global as any).__DEV__ = true;
      const error = new DamsGeoError(DamsGeoErrorCode.LOCATION_ERROR, 'Test error');

      ErrorDebugger.logError(error);

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('=== DAMS Geo SDK Error Report ==='));
    });

    it('should log detailed error when verbose is true', () => {
      (global as any).__DEV__ = false;
      const error = new DamsGeoError(DamsGeoErrorCode.LOCATION_ERROR, 'Test error');

      ErrorDebugger.logError(error, true);

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('=== DAMS Geo SDK Error Report ==='));
    });
  });

  describe('exportError', () => {
    it('should export error with full context', () => {
      const error = new DamsGeoError(
        DamsGeoErrorCode.DATABASE_ERROR,
        'Database error',
        {
          severity: ErrorSeverity.HIGH,
          context: { operation: 'insert' }
        }
      );

      const exported = ErrorDebugger.exportError(error);

      expect(exported).toMatchObject({
        error: {
          code: DamsGeoErrorCode.DATABASE_ERROR,
          message: 'Database error',
          severity: ErrorSeverity.HIGH,
          timestamp: error.timestamp,
          userMessage: expect.any(Object)
        },
        context: expect.objectContaining({
          operation: 'insert',
          system: expect.any(Object)
        }),
        report: expect.stringContaining('=== DAMS Geo SDK Error Report ===')
      });
    });
  });
});

describe('Breadcrumb Helper Functions', () => {
  let manager: ErrorContextManager;

  beforeEach(() => {
    (ErrorContextManager as any).instance = null;
    manager = ErrorContextManager.getInstance();
    manager.clearBreadcrumbs();
  });

  it('should log breadcrumb with logBreadcrumb', () => {
    logBreadcrumb('test', 'Test message', 'info', { data: 'value' });

    const breadcrumbs = manager.getBreadcrumbs();
    expect(breadcrumbs).toHaveLength(1);
    expect(breadcrumbs[0]).toMatchObject({
      category: 'test',
      message: 'Test message',
      level: 'info',
      data: { data: 'value' }
    });
  });

  it('should log debug breadcrumb', () => {
    logDebug('test', 'Debug message', { debug: true });

    const breadcrumbs = manager.getBreadcrumbs();
    expect(breadcrumbs[0].level).toBe('debug');
  });

  it('should log info breadcrumb', () => {
    logInfo('test', 'Info message');

    const breadcrumbs = manager.getBreadcrumbs();
    expect(breadcrumbs[0].level).toBe('info');
  });

  it('should log warning breadcrumb', () => {
    logWarning('test', 'Warning message');

    const breadcrumbs = manager.getBreadcrumbs();
    expect(breadcrumbs[0].level).toBe('warning');
  });

  it('should log error breadcrumb', () => {
    logError('test', 'Error message');

    const breadcrumbs = manager.getBreadcrumbs();
    expect(breadcrumbs[0].level).toBe('error');
  });
});