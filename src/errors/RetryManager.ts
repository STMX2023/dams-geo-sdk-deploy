/**
 * Retry Manager for DAMS Geo SDK
 * 
 * Handles automatic retry logic with exponential backoff and circuit breaker pattern
 */

import { DamsGeoError, DamsGeoErrorCode, ErrorSeverity } from './DamsGeoError';
import { ErrorManager } from './ErrorManager';

export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  timeout?: number;
  retryCondition?: (error: DamsGeoError, attempt: number) => boolean;
  onRetry?: (error: DamsGeoError, attempt: number) => void;
}

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  resetTimeout?: number;
  halfOpenRequests?: number;
}

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

interface RetryOperation<T> {
  id: string;
  operation: () => Promise<T>;
  options: RetryOptions;
  attempts: number;
  lastError?: DamsGeoError;
  nextRetryTime?: number;
}

interface CircuitBreaker {
  state: CircuitState;
  failures: number;
  lastFailureTime: number;
  successCount: number;
  halfOpenAttempts: number;
}

/**
 * Manages retry logic and circuit breakers
 */
export class RetryManager {
  private static instance: RetryManager;
  private retryQueue: Map<string, RetryOperation<any>> = new Map();
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private isProcessing = false;
  private errorManager: ErrorManager;
  
  private defaultOptions: Required<RetryOptions> = {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffFactor: 2,
    timeout: 60000,
    retryCondition: (error) => error.isRetryable(),
    onRetry: () => {}
  };
  
  private defaultCircuitOptions: Required<CircuitBreakerOptions> = {
    failureThreshold: 5,
    resetTimeout: 60000,
    halfOpenRequests: 3
  };
  
  private constructor() {
    this.errorManager = ErrorManager.getInstance();
    // Start processing retry queue
    this.startProcessing();
  }
  
  static getInstance(): RetryManager {
    if (!RetryManager.instance) {
      RetryManager.instance = new RetryManager();
    }
    return RetryManager.instance;
  }
  
  /**
   * Execute operation with retry logic
   */
  async withRetry<T>(
    operation: () => Promise<T>,
    options?: RetryOptions,
    operationName?: string
  ): Promise<T> {
    const opts = { ...this.defaultOptions, ...options };
    const circuitKey = operationName || 'default';
    
    // Check circuit breaker
    if (!this.isCircuitClosed(circuitKey)) {
      throw new DamsGeoError(
        DamsGeoErrorCode.SERVICE_NOT_AVAILABLE,
        `Service temporarily unavailable: ${circuitKey}`,
        {
          severity: ErrorSeverity.HIGH,
          context: { operation: operationName }
        }
      );
    }
    
    let lastError: DamsGeoError | undefined;
    
    for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
      try {
        // Set timeout for operation
        const result = await this.withTimeout(operation(), opts.timeout);
        
        // Reset circuit breaker on success
        this.recordSuccess(circuitKey);
        
        return result;
      } catch (error) {
        lastError = error instanceof DamsGeoError ? error : new DamsGeoError(
          DamsGeoErrorCode.UNKNOWN_ERROR,
          error instanceof Error ? error.message : String(error)
        );
        
        // Record failure
        this.recordFailure(circuitKey);
        
        // Check if should retry
        if (attempt < opts.maxRetries && opts.retryCondition(lastError, attempt)) {
          // Calculate delay with exponential backoff
          const delay = Math.min(
            opts.initialDelay * Math.pow(opts.backoffFactor, attempt),
            opts.maxDelay
          );
          
          // Call retry callback
          opts.onRetry(lastError, attempt + 1);
          
          // Wait before retry
          await this.delay(delay);
        } else {
          // No more retries
          break;
        }
      }
    }
    
    // All retries exhausted
    this.errorManager.emit('retryExhausted', {
      error: lastError!,
      operation: operationName,
      attempts: opts.maxRetries + 1
    });
    
    throw lastError;
  }
  
  /**
   * Queue operation for retry
   */
  queueForRetry<T>(
    id: string,
    operation: () => Promise<T>,
    options?: RetryOptions
  ): void {
    const retryOp: RetryOperation<T> = {
      id,
      operation,
      options: { ...this.defaultOptions, ...options },
      attempts: 0,
      nextRetryTime: Date.now()
    };
    
    this.retryQueue.set(id, retryOp);
  }
  
  /**
   * Cancel queued retry
   */
  cancelRetry(id: string): boolean {
    return this.retryQueue.delete(id);
  }
  
  /**
   * Get retry queue status
   */
  getQueueStatus(): { size: number; operations: string[] } {
    return {
      size: this.retryQueue.size,
      operations: Array.from(this.retryQueue.keys())
    };
  }
  
  /**
   * Start processing retry queue
   */
  private startProcessing(): void {
    if (this.isProcessing) {return;}
    
    this.isProcessing = true;
    
    setInterval(async () => {
      await this.processRetryQueue();
    }, 1000); // Check every second
  }
  
  /**
   * Process pending retries
   */
  private async processRetryQueue(): Promise<void> {
    const now = Date.now();
    const pendingRetries: RetryOperation<any>[] = [];
    
    // Find operations ready for retry
    for (const [_id, operation] of this.retryQueue) {
      if (operation.nextRetryTime && operation.nextRetryTime <= now) {
        pendingRetries.push(operation);
      }
    }
    
    // Process each pending retry
    for (const operation of pendingRetries) {
      try {
        const result = await operation.operation();
        
        // Success - remove from queue
        this.retryQueue.delete(operation.id);
        
        // Emit success event
        ErrorManager.getInstance().emit('retrySuccess', {
          id: operation.id,
          attempts: operation.attempts + 1,
          result
        });
      } catch (error) {
        operation.attempts++;
        operation.lastError = error instanceof DamsGeoError ? error : new DamsGeoError(
          DamsGeoErrorCode.UNKNOWN_ERROR,
          error instanceof Error ? error.message : String(error)
        );
        
        // Check if should continue retrying
        if (
          operation.attempts < (operation.options.maxRetries ?? this.defaultOptions.maxRetries) &&
          (operation.options.retryCondition ?? this.defaultOptions.retryCondition)(operation.lastError, operation.attempts)
        ) {
          // Calculate next retry time
          const delay = Math.min(
            (operation.options.initialDelay ?? this.defaultOptions.initialDelay) * Math.pow(
              (operation.options.backoffFactor ?? this.defaultOptions.backoffFactor),
              operation.attempts - 1
            ),
            (operation.options.maxDelay ?? this.defaultOptions.maxDelay)
          );
          
          operation.nextRetryTime = Date.now() + delay;
          
          // Call retry callback
          (operation.options.onRetry ?? this.defaultOptions.onRetry)(operation.lastError, operation.attempts);
        } else {
          // Max retries reached - remove from queue
          this.retryQueue.delete(operation.id);
          
          // Emit failure event
          ErrorManager.getInstance().emit('retryFailed', {
            id: operation.id,
            attempts: operation.attempts,
            error: operation.lastError
          });
          
          // Handle final error
          await this.errorManager.handleError(operation.lastError, {
            operation: operation.id,
            metadata: { finalAttempt: true, attempts: operation.attempts }
          });
        }
      }
    }
  }
  
  /**
   * Circuit breaker management
   */
  private getCircuitBreaker(key: string): CircuitBreaker {
    if (!this.circuitBreakers.has(key)) {
      this.circuitBreakers.set(key, {
        state: CircuitState.CLOSED,
        failures: 0,
        lastFailureTime: 0,
        successCount: 0,
        halfOpenAttempts: 0
      });
    }
    return this.circuitBreakers.get(key)!;
  }
  
  private isCircuitClosed(key: string): boolean {
    const breaker = this.getCircuitBreaker(key);
    
    switch (breaker.state) {
      case CircuitState.CLOSED:
        return true;
        
      case CircuitState.OPEN:
        // Check if should transition to half-open
        if (Date.now() - breaker.lastFailureTime > this.defaultCircuitOptions.resetTimeout) {
          breaker.state = CircuitState.HALF_OPEN;
          breaker.halfOpenAttempts = 0;
          return true;
        }
        return false;
        
      case CircuitState.HALF_OPEN:
        // Allow limited requests in half-open state
        return breaker.halfOpenAttempts < this.defaultCircuitOptions.halfOpenRequests;
    }
  }
  
  private recordSuccess(key: string): void {
    const breaker = this.getCircuitBreaker(key);
    
    switch (breaker.state) {
      case CircuitState.HALF_OPEN:
        breaker.successCount++;
        if (breaker.successCount >= this.defaultCircuitOptions.halfOpenRequests) {
          // Close circuit after successful half-open requests
          breaker.state = CircuitState.CLOSED;
          breaker.failures = 0;
          breaker.successCount = 0;
        }
        break;
        
      case CircuitState.CLOSED:
        // Reset failure count on success
        breaker.failures = 0;
        break;
    }
  }
  
  private recordFailure(key: string): void {
    const breaker = this.getCircuitBreaker(key);
    
    breaker.failures++;
    breaker.lastFailureTime = Date.now();
    
    switch (breaker.state) {
      case CircuitState.CLOSED:
        if (breaker.failures >= this.defaultCircuitOptions.failureThreshold) {
          // Open circuit
          breaker.state = CircuitState.OPEN;
          
          ErrorManager.getInstance().emit('circuitOpen', {
            service: key,
            failures: breaker.failures
          });
        }
        break;
        
      case CircuitState.HALF_OPEN:
        // Failure in half-open state - reopen circuit
        breaker.state = CircuitState.OPEN;
        breaker.halfOpenAttempts = 0;
        breaker.successCount = 0;
        break;
    }
  }
  
  /**
   * Get circuit breaker status
   */
  getCircuitStatus(key: string): {
    state: CircuitState;
    failures: number;
    isOpen: boolean;
  } {
    const breaker = this.getCircuitBreaker(key);
    return {
      state: breaker.state,
      failures: breaker.failures,
      isOpen: breaker.state === CircuitState.OPEN
    };
  }
  
  /**
   * Reset circuit breaker
   */
  resetCircuit(key: string): void {
    const breaker = this.getCircuitBreaker(key);
    breaker.state = CircuitState.CLOSED;
    breaker.failures = 0;
    breaker.successCount = 0;
    breaker.halfOpenAttempts = 0;
  }
  
  /**
   * Helper methods
   */
  private async withTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new DamsGeoError(
            DamsGeoErrorCode.LOCATION_TIMEOUT,
            `Operation timed out after ${timeout}ms`
          )),
          timeout
        )
      )
    ]);
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Decorator for adding retry logic to methods
 */
export function withRetry(options?: RetryOptions) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const retryManager = RetryManager.getInstance();
      return retryManager.withRetry(
        () => originalMethod.apply(this, args),
        options,
        `${target.constructor.name}.${propertyKey}`
      );
    };
    
    return descriptor;
  };
}

// Export singleton instance
export default RetryManager.getInstance();