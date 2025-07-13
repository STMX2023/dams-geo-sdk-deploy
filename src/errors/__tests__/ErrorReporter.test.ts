import {
  BaseErrorReporter,
  SentryErrorReporter,
  CrashlyticsErrorReporter,
  ConsoleErrorReporter,
  AnalyticsErrorReporter,
  CompositeErrorReporter,
  createErrorReporter
} from '../ErrorReporter';
import { DamsGeoError, DamsGeoErrorCode, ErrorSeverity, ErrorContext } from '../DamsGeoError';
import { ErrorDebugger } from '../ErrorContext';

// Mock __DEV__
(global as any).__DEV__ = false;

// Mock console methods
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();
const mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation();
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();

// Cleanup after all tests
afterAll(() => {
  (global as any).require = originalRequire;
});

// Mock require calls for external dependencies
const mockSentryMethods = {
  init: jest.fn(),
  setContext: jest.fn(),
  setUser: jest.fn(),
  setTag: jest.fn(),
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn()
};

const mockCrashlyticsInstance = {
  setUserId: jest.fn().mockResolvedValue(undefined),
  setAttributes: jest.fn().mockResolvedValue(undefined),
  log: jest.fn().mockResolvedValue(undefined),
  recordError: jest.fn().mockResolvedValue(undefined)
};

// Mock the require function
const originalRequire = global.require;
(global as any).require = jest.fn((module: string) => {
  if (module === '@sentry/react-native') {
    return mockSentryMethods;
  }
  if (module === '@react-native-firebase/crashlytics') {
    return { default: jest.fn(() => mockCrashlyticsInstance) };
  }
  return originalRequire(module);
});

// Mock ErrorDebugger
jest.mock('../ErrorContext', () => ({
  ErrorDebugger: {
    exportError: jest.fn((error) => ({
      context: {
        breadcrumbs: [
          {
            message: 'Test breadcrumb',
            category: 'test',
            level: 'info',
            timestamp: Date.now(),
            data: {}
          }
        ]
      }
    })),
    createErrorReport: jest.fn((error) => `Error Report: ${error.code}`)
  }
}));

describe('BaseErrorReporter', () => {
  class TestErrorReporter extends BaseErrorReporter {
    sendReport = jest.fn().mockResolvedValue(undefined);
  }

  let reporter: TestErrorReporter;

  beforeEach(() => {
    jest.clearAllMocks();
    reporter = new TestErrorReporter({ enabled: true });
  });

  it('should call sendReport when enabled', async () => {
    const error = new DamsGeoError(
      DamsGeoErrorCode.LOCATION_TIMEOUT,
      'Test error'
    );

    await reporter.report(error);
    expect(reporter.sendReport).toHaveBeenCalledWith(error, undefined);
  });

  it('should not call sendReport when disabled', async () => {
    reporter = new TestErrorReporter({ enabled: false });
    const error = new DamsGeoError(
      DamsGeoErrorCode.LOCATION_TIMEOUT,
      'Test error'
    );

    await reporter.report(error);
    expect(reporter.sendReport).not.toHaveBeenCalled();
  });

  it('should handle sendReport errors gracefully', async () => {
    reporter.sendReport.mockRejectedValueOnce(new Error('Send failed'));
    const error = new DamsGeoError(
      DamsGeoErrorCode.LOCATION_TIMEOUT,
      'Test error'
    );

    await reporter.report(error);
    expect(mockConsoleError).toHaveBeenCalledWith(
      'Failed to report error:',
      expect.any(Error)
    );
  });
});

describe('SentryErrorReporter', () => {
  let reporter: SentryErrorReporter;

  beforeEach(() => {
    jest.clearAllMocks();
    // Create a reporter and manually set up its internal state for testing
    reporter = new SentryErrorReporter({
      dsn: 'test-dsn',
      environment: 'production',
      enabled: true
    });
    // Force enable and inject mock Sentry
    (reporter as any).isEnabled = true;
    (reporter as any).Sentry = mockSentryMethods;
  });

  it('should report critical errors to Sentry', async () => {
    const error = new DamsGeoError(
      DamsGeoErrorCode.DATABASE_CORRUPTION,
      'Database corrupted',
      { severity: ErrorSeverity.CRITICAL }
    );

    const context: ErrorContext = {
      operation: 'test-operation',
      userId: 'user-123',
      metadata: { test: true }
    };

    await reporter.report(error, context);

    expect(mockSentryMethods.setContext).toHaveBeenCalledWith('damsGeo', {
      errorCode: error.code,
      severity: error.severity,
      operation: 'test-operation',
      component: undefined,
      test: true
    });

    expect(mockSentryMethods.setUser).toHaveBeenCalledWith({ id: 'user-123' });
    expect(mockSentryMethods.setTag).toHaveBeenCalledWith('error.code', error.code);
    expect(mockSentryMethods.setTag).toHaveBeenCalledWith('error.severity', error.severity);
    expect(mockSentryMethods.captureException).toHaveBeenCalled();
  });

  it('should report non-critical errors as messages', async () => {
    const error = new DamsGeoError(
      DamsGeoErrorCode.LOCATION_TIMEOUT,
      'Location timeout',
      { severity: ErrorSeverity.MEDIUM }
    );

    await reporter.report(error);

    expect(mockSentryMethods.captureMessage).toHaveBeenCalledWith(
      error.message,
      expect.objectContaining({
        level: 'warning'
      })
    );
  });

  it('should add breadcrumbs from error context', async () => {
    const error = new DamsGeoError(
      DamsGeoErrorCode.LOCATION_TIMEOUT,
      'Timeout'
    );

    await reporter.report(error);

    expect(mockSentryMethods.addBreadcrumb).toHaveBeenCalledWith({
      message: 'Test breadcrumb',
      category: 'test',
      level: 'info',
      timestamp: expect.any(Number),
      data: {}
    });
  });
});

describe('CrashlyticsErrorReporter', () => {
  let reporter: CrashlyticsErrorReporter;

  beforeEach(() => {
    jest.clearAllMocks();
    reporter = new CrashlyticsErrorReporter({ enabled: true });
    // Force enable and inject mock crashlytics
    (reporter as any).isEnabled = true;
    (reporter as any).crashlytics = jest.fn(() => mockCrashlyticsInstance);
  });

  it('should report errors to Crashlytics', async () => {

    const error = new DamsGeoError(
      DamsGeoErrorCode.PERMISSION_DENIED,
      'Permission denied'
    );

    const context: ErrorContext = {
      userId: 'user-456',
      operation: 'getLocation',
      component: 'LocationManager'
    };

    await reporter.report(error, context);

    expect(mockCrashlyticsInstance.setUserId).toHaveBeenCalledWith('user-456');
    expect(mockCrashlyticsInstance.setAttributes).toHaveBeenCalledWith({
      errorCode: error.code,
      severity: error.severity,
      operation: 'getLocation',
      component: 'LocationManager',
      platform: 'unknown',
      sdkVersion: 'unknown'
    });
    expect(mockCrashlyticsInstance.log).toHaveBeenCalledWith(
      `[${error.code}] ${error.message}`
    );
  });

  it('should record critical errors', async () => {
    const error = new DamsGeoError(
      DamsGeoErrorCode.DATABASE_CORRUPTION,
      'Critical error',
      { severity: ErrorSeverity.CRITICAL }
    );

    await reporter.report(error);

    expect(mockCrashlyticsInstance.recordError).toHaveBeenCalledWith(error);
  });

  it('should log non-critical errors', async () => {
    const error = new DamsGeoError(
      DamsGeoErrorCode.LOCATION_TIMEOUT,
      'Non-critical error',
      { severity: ErrorSeverity.MEDIUM }
    );

    await reporter.report(error);

    expect(mockCrashlyticsInstance.log).toHaveBeenCalledWith(
      `Error Report: ${error.code}`
    );
  });
});

describe('ConsoleErrorReporter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should log verbose output in development mode', async () => {
    const reporter = new ConsoleErrorReporter({ verbose: true });

    const error = new DamsGeoError(
      DamsGeoErrorCode.LOCATION_TIMEOUT,
      'Test error'
    );

    await reporter.report(error);

    expect(mockConsoleLog).toHaveBeenCalledWith(
      `Error Report: ${error.code}`
    );
  });

  it('should log simple output in production mode', async () => {
    const reporter = new ConsoleErrorReporter({ verbose: false });

    const error = new DamsGeoError(
      DamsGeoErrorCode.LOCATION_TIMEOUT,
      'Test error'
    );

    const context: ErrorContext = {
      operation: 'test'
    };

    await reporter.report(error, context);

    expect(mockConsoleError).toHaveBeenCalledWith(
      `[${error.code}] ${error.message}`
    );
    expect(mockConsoleError).toHaveBeenCalledWith('Context:', context);
  });
});

describe('AnalyticsErrorReporter', () => {
  let mockAnalytics: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAnalytics = {
      track: jest.fn().mockResolvedValue(undefined)
    };
  });

  it('should track errors as analytics events', async () => {
    const reporter = new AnalyticsErrorReporter({
      analytics: mockAnalytics,
      enabled: true
    });

    const error = new DamsGeoError(
      DamsGeoErrorCode.LOCATION_TIMEOUT,
      'Timeout error'
    );

    const context: ErrorContext = {
      operation: 'getCurrentPosition',
      userId: 'user-789',
      metadata: { timeout: 5000 }
    };

    await reporter.report(error, context);

    expect(mockAnalytics.track).toHaveBeenCalledWith('sdk_error', {
      error_code: error.code,
      error_message: error.message,
      error_severity: error.severity,
      operation: 'getCurrentPosition',
      component: undefined,
      user_id: 'user-789',
      timestamp: error.timestamp,
      metadata: { timeout: 5000 }
    });
  });

  it('should track specific error types', async () => {
    const reporter = new AnalyticsErrorReporter({
      analytics: mockAnalytics,
      enabled: true
    });

    const error = new DamsGeoError(
      DamsGeoErrorCode.PERMISSION_DENIED,
      'Permission denied'
    );

    await reporter.report(error);

    expect(mockAnalytics.track).toHaveBeenCalledWith('permission_denied', {
      permission_type: 'location',
      context: undefined
    });
  });

  it('should track location timeout errors', async () => {
    const reporter = new AnalyticsErrorReporter({
      analytics: mockAnalytics,
      enabled: true
    });

    const error = new DamsGeoError(
      DamsGeoErrorCode.LOCATION_TIMEOUT,
      'Location timeout'
    );

    const context: ErrorContext = {
      metadata: {
        timeout: 10000,
        desiredAccuracy: 'high'
      }
    };

    await reporter.report(error, context);

    expect(mockAnalytics.track).toHaveBeenCalledWith('location_timeout', {
      timeout_duration: 10000,
      accuracy_setting: 'high'
    });
  });
});

describe('CompositeErrorReporter', () => {
  let mockReporter1: any;
  let mockReporter2: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReporter1 = {
      report: jest.fn().mockResolvedValue(undefined)
    };
    mockReporter2 = {
      report: jest.fn().mockResolvedValue(undefined)
    };
  });

  it('should report to all configured reporters', async () => {
    const reporter = new CompositeErrorReporter([mockReporter1, mockReporter2]);

    const error = new DamsGeoError(
      DamsGeoErrorCode.LOCATION_TIMEOUT,
      'Test error'
    );

    await reporter.report(error);

    expect(mockReporter1.report).toHaveBeenCalledWith(error, undefined);
    expect(mockReporter2.report).toHaveBeenCalledWith(error, undefined);
  });

  it('should handle reporter failures gracefully', async () => {
    mockReporter1.report.mockRejectedValueOnce(new Error('Reporter 1 failed'));

    const reporter = new CompositeErrorReporter([mockReporter1, mockReporter2]);

    const error = new DamsGeoError(
      DamsGeoErrorCode.LOCATION_TIMEOUT,
      'Test error'
    );

    await reporter.report(error);

    expect(mockConsoleError).toHaveBeenCalledWith(
      'Reporter failed:',
      expect.any(Error)
    );
    expect(mockReporter2.report).toHaveBeenCalled();
  });

  it('should add and remove reporters dynamically', () => {
    const reporter = new CompositeErrorReporter([mockReporter1]);

    reporter.addReporter(mockReporter2);
    expect((reporter as any).reporters).toHaveLength(2);

    reporter.removeReporter(mockReporter1);
    expect((reporter as any).reporters).toHaveLength(1);
    expect((reporter as any).reporters[0]).toBe(mockReporter2);
  });
});

describe('createErrorReporter', () => {
  it('should create SentryErrorReporter', () => {
    const reporter = createErrorReporter({
      type: 'sentry',
      options: { dsn: 'test-dsn' }
    });

    expect(reporter).toBeInstanceOf(SentryErrorReporter);
  });

  it('should create CrashlyticsErrorReporter', () => {
    const reporter = createErrorReporter({
      type: 'crashlytics',
      options: { enabled: true }
    });

    expect(reporter).toBeInstanceOf(CrashlyticsErrorReporter);
  });

  it('should create ConsoleErrorReporter', () => {
    const reporter = createErrorReporter({
      type: 'console',
      options: { verbose: true }
    });

    expect(reporter).toBeInstanceOf(ConsoleErrorReporter);
  });

  it('should create AnalyticsErrorReporter', () => {
    const reporter = createErrorReporter({
      type: 'analytics',
      options: { analytics: {} }
    });

    expect(reporter).toBeInstanceOf(AnalyticsErrorReporter);
  });

  it('should create CompositeErrorReporter', () => {
    const reporter = createErrorReporter({
      type: 'composite',
      options: { reporters: [] }
    });

    expect(reporter).toBeInstanceOf(CompositeErrorReporter);
  });

  it('should default to ConsoleErrorReporter for unknown types', () => {
    const reporter = createErrorReporter({
      type: 'unknown' as any
    });

    expect(reporter).toBeInstanceOf(ConsoleErrorReporter);
  });
});