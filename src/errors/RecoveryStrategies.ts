/**
 * Recovery Strategies for DAMS Geo SDK
 * 
 * Implements specific recovery strategies for different error scenarios
 */

import { Platform } from 'react-native';
import { DamsGeoError, DamsGeoErrorCode } from './DamsGeoError';
import { ErrorManager } from './ErrorManager';
import { RetryManager } from './RetryManager';

export interface RecoveryContext {
  error: DamsGeoError;
  attempts: number;
  lastAttemptTime?: number;
}

export type RecoveryFunction = (context: RecoveryContext) => Promise<boolean>;

/**
 * Collection of recovery strategies for common error scenarios
 */
export class RecoveryStrategies {
  private static strategies: Map<DamsGeoErrorCode, RecoveryFunction[]> = new Map();
  
  static {
    // Initialize default strategies
    this.registerDefaultStrategies();
  }
  
  /**
   * Register a recovery strategy for an error code
   */
  static registerStrategy(code: DamsGeoErrorCode, strategy: RecoveryFunction): void {
    if (!this.strategies.has(code)) {
      this.strategies.set(code, []);
    }
    this.strategies.get(code)!.push(strategy);
  }
  
  /**
   * Execute recovery strategies for an error
   */
  static async executeRecovery(context: RecoveryContext): Promise<boolean> {
    const strategies = this.strategies.get(context.error.code) || [];
    
    for (const strategy of strategies) {
      try {
        const recovered = await strategy(context);
        if (recovered) {
          ErrorManager.getInstance().emit('recoverySuccess', {
            error: context.error,
            strategy: strategy.name
          });
          return true;
        }
      } catch (strategyError) {
        console.error('Recovery strategy failed:', strategyError);
      }
    }
    
    return false;
  }
  
  /**
   * Register default recovery strategies
   */
  private static registerDefaultStrategies(): void {
    // Location timeout recovery
    this.registerStrategy(
      DamsGeoErrorCode.LOCATION_TIMEOUT,
      this.locationTimeoutRecovery
    );
    
    // Permission denied recovery
    this.registerStrategy(
      DamsGeoErrorCode.PERMISSION_DENIED,
      this.permissionDeniedRecovery
    );
    
    // Database corruption recovery
    this.registerStrategy(
      DamsGeoErrorCode.DATABASE_CORRUPTION,
      this.databaseCorruptionRecovery
    );
    
    // Network error recovery
    this.registerStrategy(
      DamsGeoErrorCode.NETWORK_ERROR,
      this.networkErrorRecovery
    );
    
    // Service unavailable recovery
    this.registerStrategy(
      DamsGeoErrorCode.SERVICE_NOT_AVAILABLE,
      this.serviceUnavailableRecovery
    );
    
    // Background service error recovery
    this.registerStrategy(
      DamsGeoErrorCode.BACKGROUND_SERVICE_ERROR,
      this.backgroundServiceRecovery
    );
  }
  
  /**
   * Location timeout recovery strategy
   */
  private static async locationTimeoutRecovery(context: RecoveryContext): Promise<boolean> {
    const { error, attempts } = context;
    
    // Try different location strategies based on attempt
    switch (attempts) {
      case 1:
        // First retry - try with lower accuracy
        ErrorManager.getInstance().emit('adjustLocationSettings', {
          desiredAccuracy: 'balanced'
        });
        return true;
        
      case 2:
        // Second retry - try with even lower accuracy
        ErrorManager.getInstance().emit('adjustLocationSettings', {
          desiredAccuracy: 'low'
        });
        return true;
        
      case 3:
        // Third retry - try last known location
        ErrorManager.getInstance().emit('useLastKnownLocation');
        return true;
        
      default:
        // Give up and notify user
        ErrorManager.getInstance().emit('locationUnavailable', {
          error,
          userMessage: 'Unable to determine location. Please check GPS settings.'
        });
        return false;
    }
  }
  
  /**
   * Permission denied recovery strategy
   */
  private static async permissionDeniedRecovery(context: RecoveryContext): Promise<boolean> {
    const { error } = context;
    
    // Emit event for UI to handle
    ErrorManager.getInstance().emit('permissionRequired', {
      permission: 'location',
      rationale: 'Location permission is required for tracking functionality.',
      error
    });
    
    // Check if permission was granted after UI prompt
    return new Promise((resolve) => {
      let resolved = false;
      
      const checkPermission = () => {
        if (!resolved) {
          resolved = true;
          // Platform-specific permission check would go here
          resolve(false); // For now, assume not granted
        }
      };
      
      // Wait up to 30 seconds for user to grant permission
      setTimeout(checkPermission, 30000);
      
      // Listen for permission granted event
      ErrorManager.getInstance().once('permissionGranted', () => {
        if (!resolved) {
          resolved = true;
          resolve(true);
        }
      });
    });
  }
  
  /**
   * Database corruption recovery strategy
   */
  private static async databaseCorruptionRecovery(context: RecoveryContext): Promise<boolean> {
    const { error } = context;
    
    try {
      // Attempt to export any recoverable data
      ErrorManager.getInstance().emit('exportRecoverableData');
      
      // Wait for export to complete
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Reset database
      ErrorManager.getInstance().emit('resetDatabase', {
        reason: 'corruption',
        error
      });
      
      // Reinitialize
      ErrorManager.getInstance().emit('reinitializeDatabase');
      
      return true;
    } catch (recoveryError) {
      console.error('Database recovery failed:', recoveryError);
      
      // Last resort - complete reset
      ErrorManager.getInstance().emit('factoryReset', {
        reason: 'database_corruption_unrecoverable'
      });
      
      return false;
    }
  }
  
  /**
   * Network error recovery strategy
   */
  private static async networkErrorRecovery(context: RecoveryContext): Promise<boolean> {
    const { error, attempts } = context;
    
    // Check network connectivity
    const isConnected = await this.checkNetworkConnectivity();
    
    if (!isConnected) {
      // Queue for retry when network available
      RetryManager.getInstance().queueForRetry(
        `network-${error.context?.operation || 'unknown'}`,
        async () => {
          // Retry the original operation
          ErrorManager.getInstance().emit('retryOperation', {
            operation: error.context?.operation,
            context: error.context
          });
        },
        {
          maxRetries: 10,
          initialDelay: 5000,
          retryCondition: () => {
            // For network operations, always retry unless circuit is open
            return true;
          }
        }
      );
      
      return true;
    }
    
    // Network is available but request failed
    if (attempts < 3) {
      // Try with exponential backoff
      const delay = Math.pow(2, attempts) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
      return true;
    }
    
    return false;
  }
  
  /**
   * Service unavailable recovery strategy
   */
  private static async serviceUnavailableRecovery(context: RecoveryContext): Promise<boolean> {
    const { error, attempts } = context;
    
    // Check if service is in maintenance mode
    const serviceStatus = await this.checkServiceStatus();
    
    if (serviceStatus.inMaintenance) {
      // Notify user and stop retrying
      ErrorManager.getInstance().emit('serviceMaintenance', {
        estimatedTime: serviceStatus.estimatedDowntime,
        message: 'Service is under maintenance. Please try again later.'
      });
      return false;
    }
    
    // Circuit breaker opened - wait before retry
    if (attempts < 3) {
      const waitTime = Math.min(attempts * 10000, 60000); // Max 1 minute
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      // Reset circuit breaker if enough time has passed
      if (attempts === 3) {
        RetryManager.getInstance().resetCircuit(error.context?.operation || 'default');
      }
      
      return true;
    }
    
    return false;
  }
  
  /**
   * Background service recovery strategy
   */
  private static async backgroundServiceRecovery(context: RecoveryContext): Promise<boolean> {
    const { error: _error, attempts } = context;
    
    if (Platform.OS === 'android') {
      // Android-specific recovery
      switch (attempts) {
        case 1:
          // Try to restart foreground service
          ErrorManager.getInstance().emit('restartForegroundService');
          return true;
          
        case 2:
          // Check battery optimization
          ErrorManager.getInstance().emit('checkBatteryOptimization');
          return true;
          
        case 3:
          // Request battery optimization exemption
          ErrorManager.getInstance().emit('requestBatteryOptimizationExemption');
          return true;
          
        default:
          return false;
      }
    } else if (Platform.OS === 'ios') {
      // iOS-specific recovery
      switch (attempts) {
        case 1:
          // Re-register background tasks
          ErrorManager.getInstance().emit('reregisterBackgroundTasks');
          return true;
          
        case 2:
          // Enable significant location changes
          ErrorManager.getInstance().emit('enableSignificantLocationChanges');
          return true;
          
        default:
          return false;
      }
    }
    
    return false;
  }
  
  /**
   * Helper methods
   */
  private static async checkNetworkConnectivity(): Promise<boolean> {
    try {
      // Simple connectivity check
      const response = await fetch('https://www.google.com/generate_204', {
        method: 'HEAD',
        mode: 'no-cors'
      });
      return response.ok || response.status === 204;
    } catch {
      return false;
    }
  }
  
  private static async checkServiceStatus(): Promise<{
    available: boolean;
    inMaintenance: boolean;
    estimatedDowntime?: number;
  }> {
    // This would check actual service status
    // For now, return mock data
    return {
      available: true,
      inMaintenance: false
    };
  }
}

/**
 * Automatic recovery decorator
 */
export function withAutoRecovery(
  errorCodes?: DamsGeoErrorCode[],
  maxAttempts: number = 3
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      let lastError: DamsGeoError | undefined;
      
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          return await originalMethod.apply(this, args);
        } catch (error) {
          lastError = error instanceof DamsGeoError ? error : new DamsGeoError(
            DamsGeoErrorCode.UNKNOWN_ERROR,
            error instanceof Error ? error.message : String(error)
          );
          
          // Check if should attempt recovery
          if (
            (!errorCodes || errorCodes.includes(lastError.code)) &&
            attempt < maxAttempts - 1
          ) {
            const recovered = await RecoveryStrategies.executeRecovery({
              error: lastError,
              attempts: attempt + 1,
              lastAttemptTime: Date.now()
            });
            
            if (!recovered) {
              throw lastError;
            }
          } else {
            throw lastError;
          }
        }
      }
      
      throw lastError;
    };
    
    return descriptor;
  };
}

export default RecoveryStrategies;