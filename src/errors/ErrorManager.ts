/**
 * Error Manager for DAMS Geo SDK
 * 
 * Centralized error handling, reporting, and recovery management.
 */

import { EventEmitter } from 'events';
import {
  DamsGeoError,
  DamsGeoErrorCode,
  ErrorSeverity,
  ErrorContext,
  isDamsGeoError,
  toDamsGeoError
} from './DamsGeoError';

export interface ErrorReport {
  error: DamsGeoError;
  handled: boolean;
  recovered: boolean;
  retryCount: number;
  timestamp: number;
}

export interface ErrorStatistics {
  totalErrors: number;
  errorsByCode: Record<string, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  recoveryRate: number;
  criticalErrors: number;
  recentErrors: ErrorReport[];
}

export interface ErrorHandler {
  (error: DamsGeoError): Promise<boolean>; // Returns true if handled
}

export interface ErrorReporter {
  report(error: DamsGeoError, context?: ErrorContext): Promise<void>;
}

/**
 * Manages all error handling for the SDK
 */
export class ErrorManager extends EventEmitter {
  private static instance: ErrorManager;
  private errorHistory: ErrorReport[] = [];
  private errorHandlers: Map<DamsGeoErrorCode, ErrorHandler[]> = new Map();
  private globalHandlers: ErrorHandler[] = [];
  private errorReporter?: ErrorReporter;
  private retryAttempts: Map<string, number> = new Map();
  private maxHistorySize = 100;
  private isProduction = process.env.NODE_ENV === 'production';
  
  private constructor() {
    super();
    this.setupGlobalErrorHandlers();
  }
  
  static getInstance(): ErrorManager {
    if (!ErrorManager.instance) {
      ErrorManager.instance = new ErrorManager();
    }
    return ErrorManager.instance;
  }
  
  /**
   * Set up global error handlers for uncaught errors
   */
  private setupGlobalErrorHandlers(): void {
    // In React Native, use global error handler
    if (typeof global !== 'undefined' && (global as any).ErrorUtils) {
      const ErrorUtils = (global as any).ErrorUtils;
      const originalHandler = ErrorUtils.getGlobalHandler();
      
      ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
        const damsError = toDamsGeoError(error, {
          operation: 'globalError',
          metadata: { isFatal }
        });
        this.handleError(damsError);
        
        // Call original handler
        if (originalHandler) {
          originalHandler(error, isFatal);
        }
      });
    }
  }
  
  /**
   * Set error reporter for external logging/analytics
   */
  setErrorReporter(reporter: ErrorReporter): void {
    this.errorReporter = reporter;
  }
  
  /**
   * Register error handler for specific error code
   */
  registerHandler(code: DamsGeoErrorCode, handler: ErrorHandler): void {
    if (!this.errorHandlers.has(code)) {
      this.errorHandlers.set(code, []);
    }
    this.errorHandlers.get(code)!.push(handler);
  }
  
  /**
   * Register global error handler
   */
  registerGlobalHandler(handler: ErrorHandler): void {
    this.globalHandlers.push(handler);
  }
  
  /**
   * Main error handling method
   */
  async handleError(error: unknown, context?: ErrorContext): Promise<void> {
    const damsError = isDamsGeoError(error) ? error : toDamsGeoError(error, context);
    
    // Add to history
    const report: ErrorReport = {
      error: damsError,
      handled: false,
      recovered: false,
      retryCount: 0,
      timestamp: Date.now()
    };
    
    this.addToHistory(report);
    
    // Emit error event
    this.emit('error', damsError);
    
    // Log based on severity
    this.logError(damsError);
    
    // Report to external service
    if (this.errorReporter && damsError.severity !== ErrorSeverity.LOW) {
      try {
        await this.errorReporter.report(damsError, damsError.context);
      } catch (reportError) {
        console.error('Failed to report error:', reportError);
      }
    }
    
    // Try specific handlers first
    const specificHandlers = this.errorHandlers.get(damsError.code) || [];
    for (const handler of specificHandlers) {
      try {
        const handled = await handler(damsError);
        if (handled) {
          report.handled = true;
          break;
        }
      } catch (handlerError) {
        console.error('Error handler failed:', handlerError);
      }
    }
    
    // Try global handlers if not handled
    if (!report.handled) {
      for (const handler of this.globalHandlers) {
        try {
          const handled = await handler(damsError);
          if (handled) {
            report.handled = true;
            break;
          }
        } catch (handlerError) {
          console.error('Global error handler failed:', handlerError);
        }
      }
    }
    
    // Try recovery if available and not handled
    if (!report.handled && damsError.isRetryable()) {
      report.recovered = await this.attemptRecovery(damsError, report);
    }
    
    // Emit unhandled error if still not handled
    if (!report.handled && !report.recovered) {
      this.emit('unhandledError', damsError);
    }
  }
  
  /**
   * Attempt to recover from error using retry strategy
   */
  private async attemptRecovery(error: DamsGeoError, report: ErrorReport): Promise<boolean> {
    const strategy = error.recoveryStrategy;
    if (!strategy || !strategy.canRetry) {
      return false;
    }
    
    const errorKey = `${error.code}-${error.context?.operation || 'unknown'}`;
    const currentRetries = this.retryAttempts.get(errorKey) || 0;
    
    if (currentRetries >= (strategy.maxRetries || 3)) {
      this.retryAttempts.delete(errorKey);
      return false;
    }
    
    this.retryAttempts.set(errorKey, currentRetries + 1);
    report.retryCount = currentRetries + 1;
    
    // Wait before retry
    if (strategy.retryDelay) {
      await new Promise(resolve => setTimeout(resolve, strategy.retryDelay));
    }
    
    // Try fallback action if available
    if (strategy.fallbackAction) {
      try {
        await strategy.fallbackAction();
        this.retryAttempts.delete(errorKey);
        return true;
      } catch (fallbackError) {
        console.error('Fallback action failed:', fallbackError);
      }
    }
    
    return false;
  }
  
  /**
   * Log error based on severity
   */
  private logError(error: DamsGeoError): void {
    const logData = {
      code: error.code,
      message: error.message,
      severity: error.severity,
      context: error.context,
      stack: error.stack
    };
    
    if (this.isProduction) {
      // In production, log less verbose
      switch (error.severity) {
        case ErrorSeverity.CRITICAL:
          console.error('[CRITICAL]', error.code, error.message);
          break;
        case ErrorSeverity.HIGH:
          console.error('[ERROR]', error.code, error.message);
          break;
        case ErrorSeverity.MEDIUM:
          console.warn('[WARNING]', error.code, error.message);
          break;
        case ErrorSeverity.LOW:
          // Don't log low severity in production
          break;
      }
    } else {
      // In development, log everything
      switch (error.severity) {
        case ErrorSeverity.CRITICAL:
          console.error('[CRITICAL]', logData);
          break;
        case ErrorSeverity.HIGH:
          console.error('[ERROR]', logData);
          break;
        case ErrorSeverity.MEDIUM:
          console.warn('[WARNING]', logData);
          break;
        case ErrorSeverity.LOW:
          console.log('[INFO]', logData);
          break;
      }
    }
  }
  
  /**
   * Add error to history
   */
  private addToHistory(report: ErrorReport): void {
    this.errorHistory.unshift(report);
    
    // Trim history if too large
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory = this.errorHistory.slice(0, this.maxHistorySize);
    }
  }
  
  /**
   * Get error statistics
   */
  getStatistics(): ErrorStatistics {
    const stats: ErrorStatistics = {
      totalErrors: this.errorHistory.length,
      errorsByCode: {},
      errorsBySeverity: {
        [ErrorSeverity.LOW]: 0,
        [ErrorSeverity.MEDIUM]: 0,
        [ErrorSeverity.HIGH]: 0,
        [ErrorSeverity.CRITICAL]: 0
      },
      recoveryRate: 0,
      criticalErrors: 0,
      recentErrors: this.errorHistory.slice(0, 10)
    };
    
    let recoveredCount = 0;
    
    for (const report of this.errorHistory) {
      const error = report.error;
      
      // Count by code
      stats.errorsByCode[error.code] = (stats.errorsByCode[error.code] || 0) + 1;
      
      // Count by severity
      stats.errorsBySeverity[error.severity]++;
      
      // Count critical
      if (error.severity === ErrorSeverity.CRITICAL) {
        stats.criticalErrors++;
      }
      
      // Count recovered
      if (report.recovered) {
        recoveredCount++;
      }
    }
    
    // Calculate recovery rate
    if (this.errorHistory.length > 0) {
      stats.recoveryRate = (recoveredCount / this.errorHistory.length) * 100;
    }
    
    return stats;
  }
  
  /**
   * Clear error history
   */
  clearHistory(): void {
    this.errorHistory = [];
    this.retryAttempts.clear();
  }
  
  /**
   * Get errors by code
   */
  getErrorsByCode(code: DamsGeoErrorCode): ErrorReport[] {
    return this.errorHistory.filter(report => report.error.code === code);
  }
  
  /**
   * Get critical errors
   */
  getCriticalErrors(): ErrorReport[] {
    return this.errorHistory.filter(
      report => report.error.severity === ErrorSeverity.CRITICAL
    );
  }
  
  /**
   * Check if any critical errors occurred recently
   */
  hasCriticalErrors(withinMinutes: number = 5): boolean {
    const threshold = Date.now() - (withinMinutes * 60 * 1000);
    return this.errorHistory.some(
      report => report.error.severity === ErrorSeverity.CRITICAL && 
                report.timestamp > threshold
    );
  }
}

/**
 * Default error handlers for common scenarios
 */
export class DefaultErrorHandlers {
  /**
   * Handle permission errors
   */
  static async handlePermissionError(error: DamsGeoError): Promise<boolean> {
    if (error.code === DamsGeoErrorCode.PERMISSION_DENIED) {
      // Emit event for UI to handle
      ErrorManager.getInstance().emit('permissionRequired', {
        type: 'location',
        message: error.userMessage
      });
      return true;
    }
    return false;
  }
  
  /**
   * Handle database errors
   */
  static async handleDatabaseError(error: DamsGeoError): Promise<boolean> {
    if (error.code === DamsGeoErrorCode.DATABASE_CORRUPTION) {
      // Trigger database reset
      ErrorManager.getInstance().emit('databaseReset', {
        reason: 'corruption',
        error
      });
      return true;
    }
    return false;
  }
  
  /**
   * Handle network errors
   */
  static async handleNetworkError(error: DamsGeoError): Promise<boolean> {
    if (error.code === DamsGeoErrorCode.NETWORK_ERROR) {
      // Queue for retry when network available
      ErrorManager.getInstance().emit('queueForRetry', {
        operation: error.context?.operation,
        error
      });
      return true;
    }
    return false;
  }
}

// Export singleton instance
export default ErrorManager.getInstance();