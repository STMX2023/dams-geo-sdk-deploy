import { EventEmitter } from 'events';
import { ErrorManager, DefaultErrorHandlers, ErrorReport, ErrorStatistics } from '../ErrorManager';
import {
  DamsGeoError,
  DamsGeoErrorCode,
  ErrorSeverity,
  ErrorContext,
  createError
} from '../DamsGeoError';

// Mock console methods
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();
const mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation();
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();

// Set NODE_ENV to production to avoid verbose logging
const originalNodeEnv = process.env.NODE_ENV;

// Mock global.ErrorUtils to prevent setupGlobalErrorHandlers from interfering
(global as any).ErrorUtils = undefined;

describe('ErrorManager', () => {
  let errorManager: ErrorManager;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'production';
    // Reset singleton instance
    (ErrorManager as any).instance = null;
    errorManager = ErrorManager.getInstance();
    errorManager.clearHistory();
    // Remove all listeners to prevent unhandled error warnings
    errorManager.removeAllListeners();
    // Add default listeners to prevent Jest warnings
    errorManager.on('error', () => {});
    errorManager.on('unhandledError', () => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe('getInstance', () => {
    it('should return the same instance (singleton)', () => {
      const instance1 = ErrorManager.getInstance();
      const instance2 = ErrorManager.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should be an instance of EventEmitter', () => {
      expect(errorManager).toBeInstanceOf(EventEmitter);
    });
  });

  describe('handleError', () => {
    it('should handle DamsGeoError correctly', async () => {
      const error = new DamsGeoError(
        DamsGeoErrorCode.TRACKING_ALREADY_ACTIVE,
        'Already tracking',
        { severity: ErrorSeverity.LOW }
      );

      const errorEventListener = jest.fn();
      errorManager.on('error', errorEventListener);

      await errorManager.handleError(error);

      expect(errorEventListener).toHaveBeenCalledWith(error);
      
      const stats = errorManager.getStatistics();
      expect(stats.totalErrors).toBe(1);
      expect(stats.errorsByCode[DamsGeoErrorCode.TRACKING_ALREADY_ACTIVE]).toBe(1);
    });

    it('should convert non-DamsGeoError to DamsGeoError', async () => {
      const normalError = new Error('Test error');
      
      const errorEventListener = jest.fn();
      errorManager.on('error', errorEventListener);

      await errorManager.handleError(normalError);

      expect(errorEventListener).toHaveBeenCalled();
      const calledError = errorEventListener.mock.calls[0][0];
      expect(calledError).toBeInstanceOf(DamsGeoError);
      expect(calledError.code).toBe(DamsGeoErrorCode.UNKNOWN_ERROR);
    });

    it('should log errors based on severity', async () => {
      const criticalError = new DamsGeoError(
        DamsGeoErrorCode.DATABASE_CORRUPTION,
        'Database is corrupted',
        { severity: ErrorSeverity.CRITICAL }
      );

      await errorManager.handleError(criticalError);
      
      expect(mockConsoleError).toHaveBeenCalled();
    });

    it('should emit unhandledError event when error is not handled', async () => {
      const error = createError(
        DamsGeoErrorCode.UNKNOWN_ERROR,
        'Unhandled error'
      );

      const unhandledListener = jest.fn();
      errorManager.on('unhandledError', unhandledListener);

      await errorManager.handleError(error);

      expect(unhandledListener).toHaveBeenCalledWith(error);
    });

    it('should call error reporter for non-low severity errors', async () => {
      const mockReporter = {
        report: jest.fn().mockResolvedValue(undefined)
      };
      
      errorManager.setErrorReporter(mockReporter);

      const highSeverityError = new DamsGeoError(
        DamsGeoErrorCode.PERMISSION_DENIED,
        'Permission denied',
        { severity: ErrorSeverity.HIGH }
      );

      await errorManager.handleError(highSeverityError);
      
      expect(mockReporter.report).toHaveBeenCalledWith(
        highSeverityError,
        highSeverityError.context
      );
    });

    it('should not report low severity errors', async () => {
      const mockReporter = {
        report: jest.fn().mockResolvedValue(undefined)
      };
      
      errorManager.setErrorReporter(mockReporter);

      const lowSeverityError = new DamsGeoError(
        DamsGeoErrorCode.TRACKING_ALREADY_ACTIVE,
        'Already tracking',
        { severity: ErrorSeverity.LOW }
      );

      await errorManager.handleError(lowSeverityError);
      
      expect(mockReporter.report).not.toHaveBeenCalled();
    });
  });

  describe('registerHandler', () => {
    it('should register and call specific error handlers', async () => {
      const handler = jest.fn().mockResolvedValue(true);
      
      errorManager.registerHandler(DamsGeoErrorCode.LOCATION_TIMEOUT, handler);

      const error = createError(
        DamsGeoErrorCode.LOCATION_TIMEOUT,
        'Timeout error'
      );

      await errorManager.handleError(error);

      expect(handler).toHaveBeenCalledWith(error);
    });

    it('should stop at first handler that returns true', async () => {
      const handler1 = jest.fn().mockResolvedValue(false);
      const handler2 = jest.fn().mockResolvedValue(true);
      const handler3 = jest.fn().mockResolvedValue(true);
      
      errorManager.registerHandler(DamsGeoErrorCode.LOCATION_TIMEOUT, handler1);
      errorManager.registerHandler(DamsGeoErrorCode.LOCATION_TIMEOUT, handler2);
      errorManager.registerHandler(DamsGeoErrorCode.LOCATION_TIMEOUT, handler3);

      const error = createError(
        DamsGeoErrorCode.LOCATION_TIMEOUT,
        'Timeout error'
      );

      await errorManager.handleError(error);

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
      expect(handler3).not.toHaveBeenCalled();
    });
  });

  describe('registerGlobalHandler', () => {
    it('should register and call global handlers', async () => {
      const globalHandler = jest.fn().mockResolvedValue(true);
      
      errorManager.registerGlobalHandler(globalHandler);

      const error = createError(
        DamsGeoErrorCode.UNKNOWN_ERROR,
        'Unknown error'
      );

      await errorManager.handleError(error);

      expect(globalHandler).toHaveBeenCalledWith(error);
    });

    it('should call global handlers when specific handlers dont handle error', async () => {
      const specificHandler = jest.fn().mockResolvedValue(false);
      const globalHandler = jest.fn().mockResolvedValue(true);
      
      errorManager.registerHandler(DamsGeoErrorCode.LOCATION_TIMEOUT, specificHandler);
      errorManager.registerGlobalHandler(globalHandler);

      const error = createError(
        DamsGeoErrorCode.LOCATION_TIMEOUT,
        'Timeout error'
      );

      await errorManager.handleError(error);

      expect(specificHandler).toHaveBeenCalled();
      expect(globalHandler).toHaveBeenCalled();
    });
  });

  describe('recovery attempts', () => {
    it('should attempt recovery for retryable errors', async () => {
      const fallbackAction = jest.fn().mockResolvedValue(undefined);
      
      const error = new DamsGeoError(
        DamsGeoErrorCode.DATABASE_QUERY_FAILED,
        'Query failed',
        {
          recoveryStrategy: {
            canRetry: true,
            maxRetries: 3,
            retryDelay: 10,
            fallbackAction
          }
        }
      );

      await errorManager.handleError(error);

      expect(fallbackAction).toHaveBeenCalled();
      
      const stats = errorManager.getStatistics();
      expect(stats.recentErrors[0].recovered).toBe(true);
    });

    it('should respect max retries limit', async () => {
      // Clear the retry attempts map
      errorManager.clearHistory();
      (errorManager as any).retryAttempts.clear();
      
      const fallbackAction = jest.fn()
        .mockRejectedValueOnce(new Error('Retry 1'))
        .mockRejectedValueOnce(new Error('Retry 2'))
        .mockRejectedValueOnce(new Error('Retry 3'));
      
      const error = new DamsGeoError(
        DamsGeoErrorCode.DATABASE_QUERY_FAILED,
        'Query failed',
        {
          context: { operation: 'test-retry-limit' },
          recoveryStrategy: {
            canRetry: true,
            maxRetries: 2,
            retryDelay: 10,
            fallbackAction
          }
        }
      );

      // First two attempts should retry
      await errorManager.handleError(error);
      expect(fallbackAction).toHaveBeenCalledTimes(1);
      
      await errorManager.handleError(error);
      expect(fallbackAction).toHaveBeenCalledTimes(2);
      
      // Third attempt should not retry (exceeds maxRetries)
      await errorManager.handleError(error);
      expect(fallbackAction).toHaveBeenCalledTimes(2);
    });

    it('should handle fallback action failures gracefully', async () => {
      const fallbackAction = jest.fn().mockRejectedValue(new Error('Fallback failed'));
      
      const error = new DamsGeoError(
        DamsGeoErrorCode.DATABASE_QUERY_FAILED,
        'Query failed',
        {
          recoveryStrategy: {
            canRetry: true,
            fallbackAction
          }
        }
      );

      await errorManager.handleError(error);

      expect(fallbackAction).toHaveBeenCalled();
      expect(mockConsoleError).toHaveBeenCalledWith(
        'Fallback action failed:',
        expect.any(Error)
      );
    });
  });

  describe('getStatistics', () => {
    it('should return correct error statistics', async () => {
      // Add various errors
      await errorManager.handleError(
        createError(DamsGeoErrorCode.UNKNOWN_ERROR, 'Error 1')
      );
      await errorManager.handleError(
        createError(DamsGeoErrorCode.UNKNOWN_ERROR, 'Error 2')
      );
      await errorManager.handleError(
        new DamsGeoError(DamsGeoErrorCode.ENCRYPTION_KEY_NOT_FOUND, 'Critical error', {
          severity: ErrorSeverity.CRITICAL
        })
      );

      const stats = errorManager.getStatistics();

      expect(stats.totalErrors).toBe(3);
      expect(stats.errorsByCode[DamsGeoErrorCode.UNKNOWN_ERROR]).toBe(2);
      expect(stats.errorsByCode[DamsGeoErrorCode.ENCRYPTION_KEY_NOT_FOUND]).toBe(1);
      expect(stats.criticalErrors).toBe(1);
      expect(stats.errorsBySeverity[ErrorSeverity.CRITICAL]).toBe(1);
      expect(stats.errorsBySeverity[ErrorSeverity.MEDIUM]).toBe(2);
    });

    it('should calculate recovery rate correctly', async () => {
      // Clear history to ensure clean state
      errorManager.clearHistory();
      
      const successfulRecovery = new DamsGeoError(
        DamsGeoErrorCode.DATABASE_QUERY_FAILED,
        'Query failed',
        {
          recoveryStrategy: {
            canRetry: true,
            retryDelay: 10,
            fallbackAction: jest.fn().mockResolvedValue(undefined)
          }
        }
      );

      const failedRecovery = new DamsGeoError(
        DamsGeoErrorCode.NETWORK_ERROR,
        'Network error',
        {
          recoveryStrategy: {
            canRetry: true,
            retryDelay: 10,
            fallbackAction: jest.fn().mockRejectedValue(new Error('Failed'))
          }
        }
      );

      await errorManager.handleError(successfulRecovery);
      await errorManager.handleError(failedRecovery);

      const stats = errorManager.getStatistics();
      expect(stats.totalErrors).toBe(2);
      expect(stats.recoveryRate).toBe(50); // 1 of 2 recovered
    });
  });

  describe('error history management', () => {
    it('should limit error history size', async () => {
      // Set max history size
      (errorManager as any).maxHistorySize = 5;

      // Add more errors than the limit
      for (let i = 0; i < 10; i++) {
        await errorManager.handleError(
          createError(DamsGeoErrorCode.UNKNOWN_ERROR, `Error ${i}`)
        );
      }

      const stats = errorManager.getStatistics();
      expect(stats.totalErrors).toBe(5);
      expect(stats.recentErrors).toHaveLength(5);
    });

    it('should clear history when clearHistory is called', async () => {
      await errorManager.handleError(
        createError(DamsGeoErrorCode.UNKNOWN_ERROR, 'Error 1')
      );
      await errorManager.handleError(
        createError(DamsGeoErrorCode.UNKNOWN_ERROR, 'Error 2')
      );

      errorManager.clearHistory();

      const stats = errorManager.getStatistics();
      expect(stats.totalErrors).toBe(0);
    });
  });

  describe('getErrorsByCode', () => {
    it('should return errors filtered by code', async () => {
      await errorManager.handleError(
        createError(DamsGeoErrorCode.UNKNOWN_ERROR, 'Error 1')
      );
      await errorManager.handleError(
        createError(DamsGeoErrorCode.PERMISSION_DENIED, 'Permission')
      );
      await errorManager.handleError(
        createError(DamsGeoErrorCode.UNKNOWN_ERROR, 'Error 2')
      );

      const unknownErrors = errorManager.getErrorsByCode(DamsGeoErrorCode.UNKNOWN_ERROR);
      expect(unknownErrors).toHaveLength(2);
      expect(unknownErrors[0].error.code).toBe(DamsGeoErrorCode.UNKNOWN_ERROR);
    });
  });

  describe('getCriticalErrors', () => {
    it('should return only critical errors', async () => {
      // Use a custom critical error without fallback action to avoid timeout
      await errorManager.handleError(
        new DamsGeoError(DamsGeoErrorCode.ENCRYPTION_KEY_NOT_FOUND, 'Critical error', {
          severity: ErrorSeverity.CRITICAL
        })
      );
      await errorManager.handleError(
        new DamsGeoError(DamsGeoErrorCode.UNKNOWN_ERROR, 'Medium error', {
          severity: ErrorSeverity.MEDIUM
        })
      );

      const criticalErrors = errorManager.getCriticalErrors();
      expect(criticalErrors).toHaveLength(1);
      expect(criticalErrors[0].error.severity).toBe(ErrorSeverity.CRITICAL);
    });
  });

  describe('hasCriticalErrors', () => {
    it('should detect recent critical errors', async () => {
      await errorManager.handleError(
        new DamsGeoError(DamsGeoErrorCode.ENCRYPTION_KEY_NOT_FOUND, 'Critical', {
          severity: ErrorSeverity.CRITICAL
        })
      );

      expect(errorManager.hasCriticalErrors(5)).toBe(true);
      expect(errorManager.hasCriticalErrors(0)).toBe(false);
    });

    it('should return false when no critical errors exist', async () => {
      await errorManager.handleError(
        new DamsGeoError(DamsGeoErrorCode.UNKNOWN_ERROR, 'Medium', {
          severity: ErrorSeverity.MEDIUM
        })
      );

      expect(errorManager.hasCriticalErrors()).toBe(false);
    });
  });
});

describe('DefaultErrorHandlers', () => {
  let errorManager: ErrorManager;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'production';
    (ErrorManager as any).instance = null;
    errorManager = ErrorManager.getInstance();
    errorManager.removeAllListeners();
    errorManager.on('error', () => {});
    errorManager.on('unhandledError', () => {});
  });

  describe('handlePermissionError', () => {
    it('should handle permission errors and emit event', async () => {
      const permissionListener = jest.fn();
      errorManager.on('permissionRequired', permissionListener);

      const error = createError(
        DamsGeoErrorCode.PERMISSION_DENIED,
        'Permission denied'
      );

      const handled = await DefaultErrorHandlers.handlePermissionError(error);

      expect(handled).toBe(true);
      expect(permissionListener).toHaveBeenCalledWith({
        type: 'location',
        message: error.userMessage
      });
    });

    it('should not handle non-permission errors', async () => {
      const error = createError(
        DamsGeoErrorCode.LOCATION_TIMEOUT,
        'Timeout'
      );

      const handled = await DefaultErrorHandlers.handlePermissionError(error);
      expect(handled).toBe(false);
    });
  });

  describe('handleDatabaseError', () => {
    it('should handle database corruption and emit reset event', async () => {
      const resetListener = jest.fn();
      errorManager.on('databaseReset', resetListener);

      const error = createError(
        DamsGeoErrorCode.DATABASE_CORRUPTION,
        'Database corrupted'
      );

      const handled = await DefaultErrorHandlers.handleDatabaseError(error);

      expect(handled).toBe(true);
      expect(resetListener).toHaveBeenCalledWith({
        reason: 'corruption',
        error
      });
    });

    it('should not handle non-corruption database errors', async () => {
      const error = createError(
        DamsGeoErrorCode.DATABASE_QUERY_FAILED,
        'Query failed'
      );

      const handled = await DefaultErrorHandlers.handleDatabaseError(error);
      expect(handled).toBe(false);
    });
  });

  describe('handleNetworkError', () => {
    it('should handle network errors and emit retry queue event', async () => {
      const queueListener = jest.fn();
      errorManager.on('queueForRetry', queueListener);

      const error = createError(
        DamsGeoErrorCode.NETWORK_ERROR,
        'Network unavailable',
        { operation: 'upload' }
      );

      const handled = await DefaultErrorHandlers.handleNetworkError(error);

      expect(handled).toBe(true);
      expect(queueListener).toHaveBeenCalledWith({
        operation: 'upload',
        error
      });
    });

    it('should not handle non-network errors', async () => {
      const error = createError(
        DamsGeoErrorCode.LOCATION_TIMEOUT,
        'Timeout'
      );

      const handled = await DefaultErrorHandlers.handleNetworkError(error);
      expect(handled).toBe(false);
    });
  });
});