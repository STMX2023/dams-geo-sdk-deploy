/**
 * DAMS Geo SDK Error Handling Module
 * 
 * Exports all error handling utilities and types
 */

// Core error types and utilities
export {
  DamsGeoError,
  DamsGeoErrorCode,
  ErrorSeverity,
  ErrorContext,
  RecoveryStrategy,
  UserFriendlyMessage,
  createError,
  isDamsGeoError,
  toDamsGeoError
} from './DamsGeoError';

// Error management
export {
  ErrorManager,
  ErrorReport,
  ErrorStatistics,
  ErrorHandler,
  ErrorReporter,
  DefaultErrorHandlers
} from './ErrorManager';

// Retry and circuit breaker
export {
  RetryManager,
  RetryOptions,
  CircuitBreakerOptions,
  CircuitState,
  withRetry
} from './RetryManager';

// Recovery strategies
export {
  RecoveryStrategies,
  RecoveryContext,
  RecoveryFunction,
  withAutoRecovery
} from './RecoveryStrategies';

// Error context and debugging
export {
  ErrorContextManager,
  ErrorDebugger,
  SystemInfo,
  LocationContext,
  NetworkContext,
  DatabaseContext,
  FullErrorContext,
  Breadcrumb,
  logBreadcrumb,
  logDebug,
  logInfo,
  logWarning,
  logError
} from './ErrorContext';

// React Native components (only in non-test environments)
let DamsGeoErrorBoundary: any = null;
let useDamsGeoError: any = null;
let withDamsGeoErrorBoundary: any = null;

if (typeof jest === 'undefined') {
  try {
    const ErrorBoundaryModule = require('./ErrorBoundary');
    DamsGeoErrorBoundary = ErrorBoundaryModule.DamsGeoErrorBoundary;
    useDamsGeoError = ErrorBoundaryModule.useDamsGeoError;
    withDamsGeoErrorBoundary = ErrorBoundaryModule.withDamsGeoErrorBoundary;
  } catch (error) {
    // Fallback for environments where React Native components aren't available
    console.warn('React Native components not available:', error);
  }
} else {
  // Mock components for testing
  DamsGeoErrorBoundary = ({ children }: { children: React.ReactNode }) => children;
  useDamsGeoError = () => ({ reportError: jest.fn() });
  withDamsGeoErrorBoundary = (Component: any) => Component;
}

export {
  DamsGeoErrorBoundary,
  useDamsGeoError,
  withDamsGeoErrorBoundary
};

// Default instances
import { ErrorManager, ErrorReporter, DefaultErrorHandlers } from './ErrorManager';
import { RetryManager } from './RetryManager';
import { errorContext as ErrorContextManagerDefault } from './ErrorContext';
import { DamsGeoErrorCode } from './DamsGeoError';

export const errorManager = ErrorManager.getInstance();
export const retryManager = RetryManager.getInstance();
export const errorContext = ErrorContextManagerDefault;

/**
 * Initialize error handling system
 */
export function initializeErrorHandling(options?: {
  reporter?: ErrorReporter;
  enableDebugMode?: boolean;
  maxErrorHistory?: number;
}): void {
  const manager = ErrorManager.getInstance();
  
  if (options?.reporter) {
    manager.setErrorReporter(options.reporter);
  }
  
  // Register default error handlers
  manager.registerHandler(
    DamsGeoErrorCode.PERMISSION_DENIED,
    DefaultErrorHandlers.handlePermissionError
  );
  
  manager.registerHandler(
    DamsGeoErrorCode.DATABASE_CORRUPTION,
    DefaultErrorHandlers.handleDatabaseError
  );
  
  manager.registerHandler(
    DamsGeoErrorCode.NETWORK_ERROR,
    DefaultErrorHandlers.handleNetworkError
  );
  
  // Set up global error handling
  if (typeof global !== 'undefined' && (global as any).ErrorUtils) {
    const ErrorUtils = (global as any).ErrorUtils;
    const originalHandler = ErrorUtils.getGlobalHandler();
    
    ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
      // Handle with our error manager
      errorManager.handleError(error, {
        component: 'GlobalErrorHandler',
        metadata: { isFatal }
      });
      
      // Call original handler
      if (originalHandler) {
        originalHandler(error, isFatal);
      }
    });
  }
  
  // Log initialization
  errorContext.addBreadcrumb({
    category: 'system', 
    message: 'Error handling initialized', 
    level: 'info',
    data: options
  });
}