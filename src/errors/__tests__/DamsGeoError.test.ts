import {
  DamsGeoError,
  DamsGeoErrorCode,
  ErrorSeverity,
  ErrorContext,
  RecoveryStrategy,
  UserFriendlyMessage,
  createError,
  isDamsGeoError,
  toDamsGeoError
} from '../DamsGeoError';

// Mock react-native Platform
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios'
  }
}));

describe('DamsGeoError', () => {
  beforeEach(() => {
    // Ensure react-native mock is properly set up
    jest.resetModules();
    jest.mock('react-native', () => ({
      Platform: {
        OS: 'ios'
      }
    }));
  });

  describe('constructor', () => {
    it('should create error with required parameters', () => {
      const error = new DamsGeoError(
        DamsGeoErrorCode.LOCATION_TIMEOUT,
        'Location timeout occurred'
      );

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(DamsGeoError);
      expect(error.name).toBe('DamsGeoError');
      expect(error.code).toBe(DamsGeoErrorCode.LOCATION_TIMEOUT);
      expect(error.message).toBe('Location timeout occurred');
      expect(error.timestamp).toBeCloseTo(Date.now(), -2);
    });

    it('should set default severity based on error code', () => {
      const criticalError = new DamsGeoError(
        DamsGeoErrorCode.DATABASE_CORRUPTION,
        'Database corrupted'
      );
      expect(criticalError.severity).toBe(ErrorSeverity.CRITICAL);

      const highError = new DamsGeoError(
        DamsGeoErrorCode.PERMISSION_DENIED,
        'Permission denied'
      );
      expect(highError.severity).toBe(ErrorSeverity.HIGH);

      const mediumError = new DamsGeoError(
        DamsGeoErrorCode.LOCATION_TIMEOUT,
        'Timeout'
      );
      expect(mediumError.severity).toBe(ErrorSeverity.MEDIUM);

      const lowError = new DamsGeoError(
        DamsGeoErrorCode.TRACKING_ALREADY_ACTIVE,
        'Already active'
      );
      expect(lowError.severity).toBe(ErrorSeverity.LOW);
    });

    it('should allow custom severity override', () => {
      const error = new DamsGeoError(
        DamsGeoErrorCode.LOCATION_TIMEOUT,
        'Timeout',
        { severity: ErrorSeverity.CRITICAL }
      );

      expect(error.severity).toBe(ErrorSeverity.CRITICAL);
    });

    it('should set context with platform and SDK version', () => {
      const error = new DamsGeoError(
        DamsGeoErrorCode.LOCATION_ERROR,
        'Location error',
        {
          context: {
            operation: 'getCurrentPosition',
            userId: 'user123'
          }
        }
      );

      expect(error.context.operation).toBe('getCurrentPosition');
      expect(error.context.userId).toBe('user123');
      expect(error.context.platform).toBe('ios');
      expect(error.context.sdkVersion).toBe('1.0.0');
      expect(error.context.timestamp).toBeCloseTo(Date.now(), -2);
    });

    it('should store original error', () => {
      const originalError = new Error('Original error');
      const error = new DamsGeoError(
        DamsGeoErrorCode.UNKNOWN_ERROR,
        'Wrapped error',
        { originalError }
      );

      expect(error.originalError).toBe(originalError);
    });

    it('should set default recovery strategy based on error code', () => {
      const timeoutError = new DamsGeoError(
        DamsGeoErrorCode.LOCATION_TIMEOUT,
        'Timeout'
      );
      expect(timeoutError.recoveryStrategy).toEqual({
        canRetry: true,
        maxRetries: 3,
        retryDelay: 5000,
        userAction: 'Please ensure you have a clear view of the sky for GPS signal.'
      });

      const permissionError = new DamsGeoError(
        DamsGeoErrorCode.PERMISSION_DENIED,
        'Permission denied'
      );
      expect(permissionError.recoveryStrategy).toEqual({
        canRetry: false,
        userAction: 'Please grant location permission in your device settings.'
      });
    });

    it('should allow custom recovery strategy', () => {
      const customStrategy: RecoveryStrategy = {
        canRetry: true,
        maxRetries: 5,
        retryDelay: 10000,
        userAction: 'Custom action'
      };

      const error = new DamsGeoError(
        DamsGeoErrorCode.NETWORK_ERROR,
        'Network error',
        { recoveryStrategy: customStrategy }
      );

      expect(error.recoveryStrategy).toEqual(customStrategy);
    });

    it('should set default user message based on error code', () => {
      const error = new DamsGeoError(
        DamsGeoErrorCode.LOCATION_SERVICE_DISABLED,
        'Technical message'
      );

      expect(error.userMessage).toEqual({
        title: 'Location Services Disabled',
        message: 'Location services are turned off on your device.',
        action: 'Please enable location services in your device settings.'
      });
    });

    it('should allow custom user message', () => {
      const customMessage: UserFriendlyMessage = {
        title: 'Custom Title',
        message: 'Custom message',
        action: 'Custom action'
      };

      const error = new DamsGeoError(
        DamsGeoErrorCode.LOCATION_ERROR,
        'Error',
        { userMessage: customMessage }
      );

      expect(error.userMessage).toEqual(customMessage);
    });

    it('should capture stack trace', () => {
      const error = new DamsGeoError(
        DamsGeoErrorCode.UNKNOWN_ERROR,
        'Test error'
      );

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('DamsGeoError');
    });
  });

  describe('getDefaultSeverity', () => {
    it('should return correct severity for all error codes', () => {
      const testCases: [DamsGeoErrorCode, ErrorSeverity][] = [
        // Critical
        [DamsGeoErrorCode.DATABASE_CORRUPTION, ErrorSeverity.CRITICAL],
        [DamsGeoErrorCode.ENCRYPTION_KEY_NOT_FOUND, ErrorSeverity.CRITICAL],
        [DamsGeoErrorCode.DATABASE_INIT_FAILED, ErrorSeverity.CRITICAL],
        
        // High
        [DamsGeoErrorCode.PERMISSION_DENIED, ErrorSeverity.HIGH],
        [DamsGeoErrorCode.TRACKING_FAILED_TO_START, ErrorSeverity.HIGH],
        [DamsGeoErrorCode.LOCATION_UNAVAILABLE, ErrorSeverity.HIGH],
        [DamsGeoErrorCode.LOCATION_SERVICE_DISABLED, ErrorSeverity.HIGH],
        
        // Medium
        [DamsGeoErrorCode.LOCATION_TIMEOUT, ErrorSeverity.MEDIUM],
        [DamsGeoErrorCode.SYNC_FAILED, ErrorSeverity.MEDIUM],
        [DamsGeoErrorCode.EXPORT_NO_DATA, ErrorSeverity.MEDIUM],
        [DamsGeoErrorCode.ACTIVITY_RECOGNITION_ERROR, ErrorSeverity.MEDIUM],
        [DamsGeoErrorCode.UPLOAD_FAILED, ErrorSeverity.MEDIUM],
        
        // Low
        [DamsGeoErrorCode.TRACKING_ALREADY_ACTIVE, ErrorSeverity.LOW],
        [DamsGeoErrorCode.GEOFENCE_LIMIT_EXCEEDED, ErrorSeverity.LOW]
      ];

      testCases.forEach(([code, expectedSeverity]) => {
        const error = new DamsGeoError(code, 'Test');
        expect(error.severity).toBe(expectedSeverity);
      });
    });

    it('should default to MEDIUM for unmapped error codes', () => {
      const error = new DamsGeoError(
        DamsGeoErrorCode.PLATFORM_NOT_SUPPORTED,
        'Not supported'
      );
      expect(error.severity).toBe(ErrorSeverity.MEDIUM);
    });
  });

  describe('getDefaultRecoveryStrategy', () => {
    it('should return correct strategy for retryable errors', () => {
      const locationTimeout = new DamsGeoError(
        DamsGeoErrorCode.LOCATION_TIMEOUT,
        'Timeout'
      );
      expect(locationTimeout.recoveryStrategy?.canRetry).toBe(true);
      expect(locationTimeout.recoveryStrategy?.maxRetries).toBe(3);
      expect(locationTimeout.recoveryStrategy?.retryDelay).toBe(5000);

      const networkError = new DamsGeoError(
        DamsGeoErrorCode.NETWORK_ERROR,
        'Network error'
      );
      expect(networkError.recoveryStrategy?.canRetry).toBe(true);
      expect(networkError.recoveryStrategy?.maxRetries).toBe(3);
      expect(networkError.recoveryStrategy?.retryDelay).toBe(2000);

      const dbError = new DamsGeoError(
        DamsGeoErrorCode.DATABASE_QUERY_FAILED,
        'Query failed'
      );
      expect(dbError.recoveryStrategy?.canRetry).toBe(true);
      expect(dbError.recoveryStrategy?.maxRetries).toBe(2);
      expect(dbError.recoveryStrategy?.retryDelay).toBe(1000);
    });

    it('should return correct strategy for non-retryable errors', () => {
      const permissionError = new DamsGeoError(
        DamsGeoErrorCode.PERMISSION_DENIED,
        'Permission denied'
      );
      expect(permissionError.recoveryStrategy?.canRetry).toBe(false);
      expect(permissionError.recoveryStrategy?.userAction).toBeDefined();

      const corruptionError = new DamsGeoError(
        DamsGeoErrorCode.DATABASE_CORRUPTION,
        'Database corrupted'
      );
      expect(corruptionError.recoveryStrategy?.canRetry).toBe(false);
      expect(corruptionError.recoveryStrategy?.fallbackAction).toBeDefined();
    });

    it('should provide fallback action for database corruption', async () => {
      const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
      
      const error = new DamsGeoError(
        DamsGeoErrorCode.DATABASE_CORRUPTION,
        'Corrupted'
      );

      if (error.recoveryStrategy?.fallbackAction) {
        await error.recoveryStrategy.fallbackAction();
      }

      expect(mockConsoleLog).toHaveBeenCalledWith(
        'Database corruption detected, resetting...'
      );

      mockConsoleLog.mockRestore();
    });

    it('should default to non-retryable for unmapped errors', () => {
      const error = new DamsGeoError(
        DamsGeoErrorCode.PLATFORM_NOT_SUPPORTED,
        'Not supported'
      );
      expect(error.recoveryStrategy).toEqual({ canRetry: false });
    });
  });

  describe('getDefaultUserMessage', () => {
    it('should return appropriate user messages for common errors', () => {
      const testCases: [DamsGeoErrorCode, Partial<UserFriendlyMessage>][] = [
        [DamsGeoErrorCode.PERMISSION_DENIED, {
          title: 'Location Permission Required'
        }],
        [DamsGeoErrorCode.LOCATION_TIMEOUT, {
          title: 'Location Not Available'
        }],
        [DamsGeoErrorCode.LOCATION_SERVICE_DISABLED, {
          title: 'Location Services Disabled'
        }],
        [DamsGeoErrorCode.ACTIVITY_RECOGNITION_ERROR, {
          title: 'Activity Detection Issue'
        }],
        [DamsGeoErrorCode.UPLOAD_FAILED, {
          title: 'Upload Failed'
        }],
        [DamsGeoErrorCode.TRACKING_ALREADY_ACTIVE, {
          title: 'Already Tracking'
        }],
        [DamsGeoErrorCode.GEOFENCE_LIMIT_EXCEEDED, {
          title: 'Too Many Zones'
        }],
        [DamsGeoErrorCode.DATABASE_CORRUPTION, {
          title: 'Data Error'
        }],
        [DamsGeoErrorCode.EXPORT_NO_DATA, {
          title: 'No Data to Export'
        }]
      ];

      testCases.forEach(([code, expectedMessage]) => {
        const error = new DamsGeoError(code, 'Technical message');
        expect(error.userMessage.title).toBe(expectedMessage.title);
        expect(error.userMessage.message).toBeDefined();
        expect(error.userMessage.action).toBeDefined();
      });
    });

    it('should provide default message for unmapped errors', () => {
      const error = new DamsGeoError(
        DamsGeoErrorCode.PLATFORM_NOT_SUPPORTED,
        'Platform error'
      );

      expect(error.userMessage).toEqual({
        title: 'Something Went Wrong',
        message: 'An unexpected error occurred.',
        action: 'Please try again or contact support if the problem persists.'
      });
    });
  });

  describe('getPlatform', () => {
    it('should return platform from react-native', () => {
      const error = new DamsGeoError(
        DamsGeoErrorCode.UNKNOWN_ERROR,
        'Test'
      );
      expect(error.context.platform).toBe('ios');
    });

    it('should return unknown when react-native is not available', () => {
      // Temporarily override the react-native mock
      jest.resetModules();
      jest.doMock('react-native', () => {
        throw new Error('Module not found');
      });

      // Re-import DamsGeoError to use the new mock
      const { DamsGeoError: DamsGeoErrorMocked } = require('../DamsGeoError');
      
      const error = new DamsGeoErrorMocked(
        DamsGeoErrorCode.UNKNOWN_ERROR,
        'Test'
      );
      expect(error.context.platform).toBe('unknown');

      // Restore original mock
      jest.resetModules();
    });
  });

  describe('toJSON', () => {
    it('should serialize error to JSON', () => {
      const error = new DamsGeoError(
        DamsGeoErrorCode.LOCATION_ERROR,
        'Location error',
        {
          severity: ErrorSeverity.HIGH,
          context: {
            operation: 'test',
            userId: 'user123'
          },
          userMessage: {
            title: 'Error',
            message: 'An error occurred',
            action: 'Try again'
          },
          recoveryStrategy: {
            canRetry: true,
            maxRetries: 3
          }
        }
      );

      const json = error.toJSON();

      expect(json).toEqual({
        name: 'DamsGeoError',
        code: DamsGeoErrorCode.LOCATION_ERROR,
        message: 'Location error',
        severity: ErrorSeverity.HIGH,
        context: expect.objectContaining({
          operation: 'test',
          userId: 'user123',
          platform: expect.any(String),
          sdkVersion: '1.0.0',
          timestamp: expect.any(Number)
        }),
        userMessage: {
          title: 'Error',
          message: 'An error occurred',
          action: 'Try again'
        },
        recoveryStrategy: {
          canRetry: true,
          maxRetries: 3
        },
        timestamp: error.timestamp,
        stack: expect.any(String)
      });
    });
  });

  describe('isRetryable', () => {
    it('should return true for retryable errors', () => {
      const error = new DamsGeoError(
        DamsGeoErrorCode.LOCATION_TIMEOUT,
        'Timeout'
      );
      expect(error.isRetryable()).toBe(true);
    });

    it('should return false for non-retryable errors', () => {
      const error = new DamsGeoError(
        DamsGeoErrorCode.PERMISSION_DENIED,
        'Permission denied'
      );
      expect(error.isRetryable()).toBe(false);
    });

    it('should respect custom recovery strategy', () => {
      const error = new DamsGeoError(
        DamsGeoErrorCode.UNKNOWN_ERROR,
        'Error',
        {
          recoveryStrategy: { canRetry: true }
        }
      );
      expect(error.isRetryable()).toBe(true);
    });
  });

  describe('getRetryDelay', () => {
    it('should return configured retry delay', () => {
      const error = new DamsGeoError(
        DamsGeoErrorCode.LOCATION_TIMEOUT,
        'Timeout'
      );
      expect(error.getRetryDelay()).toBe(5000);
    });

    it('should return default delay when not configured', () => {
      const error = new DamsGeoError(
        DamsGeoErrorCode.UNKNOWN_ERROR,
        'Error'
      );
      expect(error.getRetryDelay()).toBe(1000);
    });

    it('should respect custom recovery strategy delay', () => {
      const error = new DamsGeoError(
        DamsGeoErrorCode.UNKNOWN_ERROR,
        'Error',
        {
          recoveryStrategy: {
            canRetry: true,
            retryDelay: 30000
          }
        }
      );
      expect(error.getRetryDelay()).toBe(30000);
    });
  });

  describe('isCritical', () => {
    it('should return true for critical errors', () => {
      const error = new DamsGeoError(
        DamsGeoErrorCode.DATABASE_CORRUPTION,
        'Corruption'
      );
      expect(error.isCritical()).toBe(true);
    });

    it('should return false for non-critical errors', () => {
      const error = new DamsGeoError(
        DamsGeoErrorCode.LOCATION_TIMEOUT,
        'Timeout'
      );
      expect(error.isCritical()).toBe(false);
    });

    it('should respect custom severity', () => {
      const error = new DamsGeoError(
        DamsGeoErrorCode.UNKNOWN_ERROR,
        'Error',
        { severity: ErrorSeverity.CRITICAL }
      );
      expect(error.isCritical()).toBe(true);
    });
  });
});

describe('createError', () => {
  it('should create error with context and original error', () => {
    const originalError = new Error('Original');
    const context: ErrorContext = {
      operation: 'test',
      userId: 'user123'
    };

    const error = createError(
      DamsGeoErrorCode.LOCATION_ERROR,
      'Location error',
      context,
      originalError
    );

    expect(error).toBeInstanceOf(DamsGeoError);
    expect(error.code).toBe(DamsGeoErrorCode.LOCATION_ERROR);
    expect(error.message).toBe('Location error');
    expect(error.context.operation).toBe('test');
    expect(error.context.userId).toBe('user123');
    expect(error.originalError).toBe(originalError);
  });

  it('should create error without optional parameters', () => {
    const error = createError(
      DamsGeoErrorCode.UNKNOWN_ERROR,
      'Unknown error'
    );

    expect(error).toBeInstanceOf(DamsGeoError);
    expect(error.code).toBe(DamsGeoErrorCode.UNKNOWN_ERROR);
    expect(error.message).toBe('Unknown error');
  });
});

describe('isDamsGeoError', () => {
  it('should return true for DamsGeoError instances', () => {
    const error = new DamsGeoError(
      DamsGeoErrorCode.LOCATION_ERROR,
      'Error'
    );
    expect(isDamsGeoError(error)).toBe(true);
  });

  it('should return false for regular Error instances', () => {
    const error = new Error('Regular error');
    expect(isDamsGeoError(error)).toBe(false);
  });

  it('should return false for non-error objects', () => {
    expect(isDamsGeoError({ code: 'ERROR' })).toBe(false);
    expect(isDamsGeoError('error string')).toBe(false);
    expect(isDamsGeoError(null)).toBe(false);
    expect(isDamsGeoError(undefined)).toBe(false);
  });
});

describe('toDamsGeoError', () => {
  it('should return DamsGeoError as is', () => {
    const damsError = new DamsGeoError(
      DamsGeoErrorCode.LOCATION_ERROR,
      'Location error'
    );
    const result = toDamsGeoError(damsError);
    expect(result).toBe(damsError);
  });

  it('should convert Error with permission message to PERMISSION_DENIED', () => {
    const error = new Error('Location permission denied');
    const result = toDamsGeoError(error);

    expect(result).toBeInstanceOf(DamsGeoError);
    expect(result.code).toBe(DamsGeoErrorCode.PERMISSION_DENIED);
    expect(result.message).toBe('Location permission denied');
    expect(result.originalError).toBe(error);
  });

  it('should convert Error with location timeout message to LOCATION_TIMEOUT', () => {
    const error = new Error('Location request timeout');
    const result = toDamsGeoError(error);

    expect(result.code).toBe(DamsGeoErrorCode.LOCATION_TIMEOUT);
  });

  it('should convert Error with database message to DATABASE_ERROR', () => {
    const error = new Error('Database connection failed');
    const result = toDamsGeoError(error);

    expect(result.code).toBe(DamsGeoErrorCode.DATABASE_ERROR);
  });

  it('should convert Error with network message to NETWORK_ERROR', () => {
    const error = new Error('Network request failed');
    const result = toDamsGeoError(error);

    expect(result.code).toBe(DamsGeoErrorCode.NETWORK_ERROR);
  });

  it('should convert unknown Error to UNKNOWN_ERROR', () => {
    const error = new Error('Some other error');
    const result = toDamsGeoError(error);

    expect(result.code).toBe(DamsGeoErrorCode.UNKNOWN_ERROR);
    expect(result.message).toBe('Some other error');
  });

  it('should convert string to UNKNOWN_ERROR', () => {
    const result = toDamsGeoError('String error');

    expect(result).toBeInstanceOf(DamsGeoError);
    expect(result.code).toBe(DamsGeoErrorCode.UNKNOWN_ERROR);
    expect(result.message).toBe('String error');
  });

  it('should convert other types to UNKNOWN_ERROR', () => {
    const result1 = toDamsGeoError(123);
    expect(result1.code).toBe(DamsGeoErrorCode.UNKNOWN_ERROR);
    expect(result1.message).toBe('123');

    const result2 = toDamsGeoError({ error: 'object' });
    expect(result2.code).toBe(DamsGeoErrorCode.UNKNOWN_ERROR);
    expect(result2.message).toBe('[object Object]');

    const result3 = toDamsGeoError(null);
    expect(result3.code).toBe(DamsGeoErrorCode.UNKNOWN_ERROR);
    expect(result3.message).toBe('null');
  });

  it('should preserve context when converting errors', () => {
    const context: ErrorContext = {
      operation: 'test',
      userId: 'user123'
    };

    const error = new Error('Test error');
    const result = toDamsGeoError(error, context);

    expect(result.context.operation).toBe('test');
    expect(result.context.userId).toBe('user123');
  });
});