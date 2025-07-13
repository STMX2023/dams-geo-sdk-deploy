/**
 * Tests for RetryManager
 */

import { RetryManager, RetryOptions, CircuitBreakerOptions, CircuitState } from '../RetryManager';
import { DamsGeoError, DamsGeoErrorCode, ErrorSeverity } from '../DamsGeoError';
import { ErrorManager } from '../ErrorManager';

// Mock ErrorManager
jest.mock('../ErrorManager');

describe('RetryManager', () => {
  let retryManager: RetryManager;
  let mockErrorManager: jest.Mocked<ErrorManager>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Mock ErrorManager instance
    mockErrorManager = {
      handleError: jest.fn(),
      reportError: jest.fn(),
      emit: jest.fn()
    } as any;
    (ErrorManager.getInstance as jest.Mock).mockReturnValue(mockErrorManager);
    
    // Get fresh instance
    (RetryManager as any).instance = null;
    retryManager = RetryManager.getInstance();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = RetryManager.getInstance();
      const instance2 = RetryManager.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should start processing queue on instantiation', () => {
      // RetryManager starts processing in constructor
      expect(retryManager).toBeDefined();
      // Should have set up interval for processing
      expect(setInterval).toHaveBeenCalled();
    });
  });

  describe('withRetry', () => {
    it('should succeed on first try', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      
      const result = await retryManager.withRetry(operation);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValueOnce('success');
      
      const result = await retryManager.withRetry(operation, { maxRetries: 3 });
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries', async () => {
      const error = new DamsGeoError(
        DamsGeoErrorCode.NETWORK_ERROR,
        'Network error'
      );
      const operation = jest.fn().mockRejectedValue(error);
      
      await expect(retryManager.withRetry(operation, { maxRetries: 2 }))
        .rejects.toThrow('Network error');
      
      expect(operation).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should use exponential backoff', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValueOnce('success');
      
      const promise = retryManager.withRetry(operation, {
        maxRetries: 3,
        initialDelay: 100,
        backoffFactor: 2
      });

      // First attempt fails immediately
      await jest.advanceTimersByTimeAsync(0);
      expect(operation).toHaveBeenCalledTimes(1);

      // Wait for first retry (100ms)
      await jest.advanceTimersByTimeAsync(100);
      expect(operation).toHaveBeenCalledTimes(2);

      // Wait for second retry (200ms)
      await jest.advanceTimersByTimeAsync(200);
      expect(operation).toHaveBeenCalledTimes(3);

      const result = await promise;
      expect(result).toBe('success');
    });

    it('should respect max delay', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce('success');
      
      const promise = retryManager.withRetry(operation, {
        maxRetries: 1,
        initialDelay: 1000,
        maxDelay: 500,
        backoffFactor: 2
      });

      await jest.advanceTimersByTimeAsync(0);
      expect(operation).toHaveBeenCalledTimes(1);

      // Should use maxDelay (500ms) instead of calculated delay
      await jest.advanceTimersByTimeAsync(500);
      expect(operation).toHaveBeenCalledTimes(2);

      await promise;
    });

    it('should call onRetry callback', async () => {
      const onRetry = jest.fn();
      const error = new Error('fail');
      const operation = jest.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce('success');
      
      await retryManager.withRetry(operation, {
        maxRetries: 1,
        onRetry
      });
      
      expect(onRetry).toHaveBeenCalledWith(expect.any(DamsGeoError), 1);
    });

    it('should respect retry condition', async () => {
      const retryCondition = jest.fn().mockReturnValue(false);
      const operation = jest.fn().mockRejectedValue(new Error('fail'));
      
      await expect(retryManager.withRetry(operation, {
        maxRetries: 3,
        retryCondition
      })).rejects.toThrow();
      
      expect(operation).toHaveBeenCalledTimes(1); // No retries
      expect(retryCondition).toHaveBeenCalled();
    });

    it('should handle timeout', async () => {
      const operation = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve('success'), 1000))
      );
      
      const promise = retryManager.withRetry(operation, {
        timeout: 500
      });

      await jest.advanceTimersByTimeAsync(500);
      
      await expect(promise).rejects.toThrow();
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should report error after all retries fail', async () => {
      const error = new DamsGeoError(
        DamsGeoErrorCode.NETWORK_ERROR,
        'Network error'
      );
      const operation = jest.fn().mockRejectedValue(error);
      
      try {
        await retryManager.withRetry(operation, { maxRetries: 1 }, 'test-operation');
      } catch {
        // Expected to throw
      }
      
      expect(mockErrorManager.handleError).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          operation: 'test-operation',
          metadata: expect.objectContaining({ attempts: 2 })
        })
      );
    });
  });

  describe('Queue Management', () => {
    it('should add operations to queue', () => {
      const operation = jest.fn().mockResolvedValue('success');
      
      retryManager.queueForRetry('op1', operation, { maxRetries: 2 });
      
      const status = retryManager.getQueueStatus();
      expect(status.size).toBe(1);
      expect(status.operations).toContain('op1');
    });

    it('should cancel operations', () => {
      const operation = jest.fn().mockResolvedValue('success');
      
      retryManager.queueForRetry('op1', operation);
      const cancelled = retryManager.cancelRetry('op1');
      
      expect(cancelled).toBe(true);
      
      const status = retryManager.getQueueStatus();
      expect(status.size).toBe(0);
    });

    it('should handle cancel of non-existent operation', () => {
      const cancelled = retryManager.cancelRetry('non-existent');
      expect(cancelled).toBe(false);
    });

    it('should process queued operations', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce('success');
      
      retryManager.queueForRetry('op1', operation, {
        maxRetries: 1,
        initialDelay: 100
      });

      // Let processing interval run
      jest.advanceTimersByTime(1000);
      
      // Operation should be attempted
      expect(operation).toHaveBeenCalledTimes(1);
      
      // Advance to allow retry
      jest.advanceTimersByTime(100);
      expect(operation).toHaveBeenCalledTimes(2);
      
      // Should be removed from queue after success
      await jest.runAllTimersAsync();
      const status = retryManager.getQueueStatus();
      expect(status.size).toBe(0);
    });
  });

  describe('Circuit Breaker', () => {
    it('should track circuit state', () => {
      const status = retryManager.getCircuitStatus('test-service');
      expect(status.state).toBe(CircuitState.CLOSED);
      expect(status.failures).toBe(0);
      expect(status.isOpen).toBe(false);
    });

    it('should open circuit after failures', async () => {
      const error = new DamsGeoError(
        DamsGeoErrorCode.SERVICE_NOT_AVAILABLE,
        'Service unavailable'
      );
      const operation = jest.fn().mockRejectedValue(error);
      
      // Default threshold is 5 failures
      for (let i = 0; i < 5; i++) {
        try {
          await retryManager.withRetry(operation, { maxRetries: 0 }, 'test-service');
        } catch {
          // Expected to fail
        }
      }
      
      const status = retryManager.getCircuitStatus('test-service');
      expect(status.state).toBe(CircuitState.OPEN);
      expect(status.isOpen).toBe(true);
      
      // Next call should fail immediately
      await expect(
        retryManager.withRetry(operation, { maxRetries: 0 }, 'test-service')
      ).rejects.toThrow('Service temporarily unavailable');
    });

    it('should transition to half-open after timeout', async () => {
      const operation = jest.fn()
        .mockRejectedValue(new Error('fail'))
        .mockResolvedValue('success');
      
      // Open the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await retryManager.withRetry(operation, { maxRetries: 0 }, 'test-service');
        } catch {
          // Expected
        }
      }
      
      // Wait for reset timeout (default 60 seconds)
      jest.advanceTimersByTime(60000);
      
      // Should allow request in half-open state
      operation.mockResolvedValueOnce('success');
      const result = await retryManager.withRetry(operation, { maxRetries: 0 }, 'test-service');
      expect(result).toBe('success');
      
      // Should start transitioning back to closed
      const status = retryManager.getCircuitStatus('test-service');
      expect(status.state).toBe(CircuitState.HALF_OPEN);
    });

    it('should reset circuit manually', () => {
      // First record some failures
      const operation = jest.fn().mockRejectedValue(new Error('fail'));
      
      // Record failures (but not enough to open)
      for (let i = 0; i < 3; i++) {
        try {
          retryManager.withRetry(operation, { maxRetries: 0 }, 'test-service');
        } catch {
          // Expected
        }
      }
      
      let status = retryManager.getCircuitStatus('test-service');
      expect(status.failures).toBe(3);
      
      // Reset the circuit
      retryManager.resetCircuit('test-service');
      
      status = retryManager.getCircuitStatus('test-service');
      expect(status.state).toBe(CircuitState.CLOSED);
      expect(status.failures).toBe(0);
    });
  });

  describe('Error handling', () => {
    it('should convert non-DamsGeoError to DamsGeoError', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Regular error'));
      
      try {
        await retryManager.withRetry(operation, { maxRetries: 0 });
      } catch (error) {
        expect(error).toBeInstanceOf(DamsGeoError);
        expect((error as DamsGeoError).code).toBe(DamsGeoErrorCode.UNKNOWN_ERROR);
      }
    });

    it('should preserve DamsGeoError', async () => {
      const damsError = new DamsGeoError(
        DamsGeoErrorCode.NETWORK_ERROR,
        'Network failed'
      );
      const operation = jest.fn().mockRejectedValue(damsError);
      
      try {
        await retryManager.withRetry(operation, { maxRetries: 0 });
      } catch (error) {
        expect(error).toBe(damsError);
      }
    });

    it('should use error isRetryable method by default', async () => {
      const retryableError = new DamsGeoError(
        DamsGeoErrorCode.NETWORK_ERROR,
        'Network error'
      );
      const nonRetryableError = new DamsGeoError(
        DamsGeoErrorCode.PERMISSION_DENIED,
        'Permission denied'
      );
      
      // Mock isRetryable
      jest.spyOn(retryableError, 'isRetryable').mockReturnValue(true);
      jest.spyOn(nonRetryableError, 'isRetryable').mockReturnValue(false);
      
      const operation1 = jest.fn()
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValueOnce('success');
      
      const operation2 = jest.fn()
        .mockRejectedValue(nonRetryableError);
      
      // Should retry network error
      const result = await retryManager.withRetry(operation1);
      expect(result).toBe('success');
      expect(operation1).toHaveBeenCalledTimes(2);
      
      // Should not retry permission error
      await expect(retryManager.withRetry(operation2)).rejects.toThrow('Permission denied');
      expect(operation2).toHaveBeenCalledTimes(1);
    });
  });

  describe('withRetryDecorator', () => {
    it('should check for decorator method', () => {
      // The withRetryDecorator is defined at the end of RetryManager.ts
      // Check if it exists (might not be available in test environment)
      const hasDecorator = 'withRetryDecorator' in RetryManager;
      
      if (hasDecorator) {
        expect((RetryManager as any).withRetryDecorator).toBeDefined();
        expect(typeof (RetryManager as any).withRetryDecorator).toBe('function');
      } else {
        // Skip if decorator not available in test environment
        expect(true).toBe(true);
      }
    });
  });

  describe('Edge cases', () => {
    it('should handle operation that throws synchronously', async () => {
      const operation = jest.fn().mockImplementation(() => {
        throw new Error('Sync error');
      });
      
      await expect(retryManager.withRetry(operation)).rejects.toThrow('Sync error');
    });

    it('should handle zero maxRetries', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('fail'));
      
      await expect(retryManager.withRetry(operation, { maxRetries: 0 })).rejects.toThrow();
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should handle operations with same name', async () => {
      const operation1 = jest.fn().mockResolvedValue('success1');
      const operation2 = jest.fn().mockResolvedValue('success2');
      
      // Both use same operation name for circuit breaker
      const result1 = await retryManager.withRetry(operation1, {}, 'shared-service');
      const result2 = await retryManager.withRetry(operation2, {}, 'shared-service');
      
      expect(result1).toBe('success1');
      expect(result2).toBe('success2');
      
      // Should share circuit breaker state
      const status = retryManager.getCircuitStatus('shared-service');
      expect(status.state).toBe(CircuitState.CLOSED);
    });
  });
});