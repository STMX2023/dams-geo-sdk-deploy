/**
 * DAMS Geo SDK Error Classes and Types
 * 
 * Provides comprehensive error handling with context, recovery strategies,
 * and user-friendly messages.
 */

export enum DamsGeoErrorCode {
  // Permission Errors
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  PERMISSION_BACKGROUND_DENIED = 'PERMISSION_BACKGROUND_DENIED',
  PERMISSION_ACTIVITY_DENIED = 'PERMISSION_ACTIVITY_DENIED',
  
  // Location Errors
  LOCATION_ERROR = 'LOCATION_ERROR',
  LOCATION_TIMEOUT = 'LOCATION_TIMEOUT',
  LOCATION_UNAVAILABLE = 'LOCATION_UNAVAILABLE',
  LOCATION_SERVICE_DISABLED = 'LOCATION_SERVICE_DISABLED',
  
  // Activity Recognition Errors
  ACTIVITY_RECOGNITION_ERROR = 'ACTIVITY_RECOGNITION_ERROR',
  
  // Tracking Errors
  TRACKING_ALREADY_ACTIVE = 'TRACKING_ALREADY_ACTIVE',
  TRACKING_NOT_ACTIVE = 'TRACKING_NOT_ACTIVE',
  TRACKING_FAILED_TO_START = 'TRACKING_FAILED_TO_START',
  
  // Geofence Errors
  GEOFENCE_LIMIT_EXCEEDED = 'GEOFENCE_LIMIT_EXCEEDED',
  GEOFENCE_INVALID_POLYGON = 'GEOFENCE_INVALID_POLYGON',
  GEOFENCE_MONITORING_FAILED = 'GEOFENCE_MONITORING_FAILED',
  
  // Database Errors
  DATABASE_ERROR = 'DATABASE_ERROR',
  DATABASE_INIT_FAILED = 'DATABASE_INIT_FAILED',
  DATABASE_QUERY_FAILED = 'DATABASE_QUERY_FAILED',
  DATABASE_CORRUPTION = 'DATABASE_CORRUPTION',
  
  // Encryption Errors
  ENCRYPTION_KEY_ERROR = 'ENCRYPTION_KEY_ERROR',
  ENCRYPTION_KEY_NOT_FOUND = 'ENCRYPTION_KEY_NOT_FOUND',
  ENCRYPTION_FAILED = 'ENCRYPTION_FAILED',
  DECRYPTION_FAILED = 'DECRYPTION_FAILED',
  
  // Export/Audit Errors
  EXPORT_ERROR = 'EXPORT_ERROR',
  EXPORT_NO_DATA = 'EXPORT_NO_DATA',
  SIGNING_ERROR = 'SIGNING_ERROR',
  VERIFICATION_FAILED = 'VERIFICATION_FAILED',
  
  // Platform Errors
  PLATFORM_NOT_SUPPORTED = 'PLATFORM_NOT_SUPPORTED',
  SERVICE_NOT_AVAILABLE = 'SERVICE_NOT_AVAILABLE',
  BACKGROUND_SERVICE_ERROR = 'BACKGROUND_SERVICE_ERROR',
  
  // Network Errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  SYNC_FAILED = 'SYNC_FAILED',
  UPLOAD_FAILED = 'UPLOAD_FAILED',
  
  // Configuration Errors
  INVALID_CONFIG = 'INVALID_CONFIG',
  MISSING_REQUIRED_PARAM = 'MISSING_REQUIRED_PARAM',
  
  // Unknown
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export enum ErrorSeverity {
  LOW = 'low',        // Can be ignored or logged
  MEDIUM = 'medium',  // Should be handled but not critical
  HIGH = 'high',      // Must be handled, affects functionality
  CRITICAL = 'critical' // App-breaking, immediate attention needed
}

export interface ErrorContext {
  operation?: string;
  component?: string;
  userId?: string;
  metadata?: Record<string, any>;
  timestamp?: number;
  platform?: string;
  sdkVersion?: string;
  originalError?: Error;
}

export interface RecoveryStrategy {
  canRetry: boolean;
  maxRetries?: number;
  retryDelay?: number;
  fallbackAction?: () => Promise<void>;
  userAction?: string; // Instructions for user
}

export interface UserFriendlyMessage {
  title: string;
  message: string;
  action?: string; // What the user should do
}

/**
 * Base error class for all DAMS Geo SDK errors
 */
export class DamsGeoError extends Error {
  public readonly code: DamsGeoErrorCode;
  public readonly severity: ErrorSeverity;
  public readonly context: ErrorContext;
  public readonly originalError?: Error;
  public readonly recoveryStrategy?: RecoveryStrategy;
  public readonly userMessage: UserFriendlyMessage;
  public readonly timestamp: number;
  
  constructor(
    code: DamsGeoErrorCode,
    message: string,
    options?: {
      severity?: ErrorSeverity;
      context?: ErrorContext;
      originalError?: Error;
      recoveryStrategy?: RecoveryStrategy;
      userMessage?: UserFriendlyMessage;
    }
  ) {
    super(message);
    this.name = 'DamsGeoError';
    this.code = code;
    this.severity = options?.severity || this.getDefaultSeverity(code);
    this.context = {
      ...options?.context,
      timestamp: Date.now(),
      platform: this.getPlatform(),
      sdkVersion: '1.0.0' // TODO: Get from package.json
    };
    this.originalError = options?.originalError;
    this.recoveryStrategy = options?.recoveryStrategy || this.getDefaultRecoveryStrategy(code);
    this.userMessage = options?.userMessage || this.getDefaultUserMessage(code, message);
    this.timestamp = Date.now();
    
    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, DamsGeoError);
    }
  }
  
  /**
   * Get default severity based on error code
   */
  private getDefaultSeverity(code: DamsGeoErrorCode): ErrorSeverity {
    const severityMap: Partial<Record<DamsGeoErrorCode, ErrorSeverity>> = {
      // Critical errors
      [DamsGeoErrorCode.DATABASE_CORRUPTION]: ErrorSeverity.CRITICAL,
      [DamsGeoErrorCode.ENCRYPTION_KEY_NOT_FOUND]: ErrorSeverity.CRITICAL,
      [DamsGeoErrorCode.DATABASE_INIT_FAILED]: ErrorSeverity.CRITICAL,
      
      // High severity
      [DamsGeoErrorCode.PERMISSION_DENIED]: ErrorSeverity.HIGH,
      [DamsGeoErrorCode.TRACKING_FAILED_TO_START]: ErrorSeverity.HIGH,
      [DamsGeoErrorCode.LOCATION_UNAVAILABLE]: ErrorSeverity.HIGH,
      [DamsGeoErrorCode.LOCATION_SERVICE_DISABLED]: ErrorSeverity.HIGH,
      
      // Medium severity
      [DamsGeoErrorCode.LOCATION_TIMEOUT]: ErrorSeverity.MEDIUM,
      [DamsGeoErrorCode.SYNC_FAILED]: ErrorSeverity.MEDIUM,
      [DamsGeoErrorCode.EXPORT_NO_DATA]: ErrorSeverity.MEDIUM,
      [DamsGeoErrorCode.ACTIVITY_RECOGNITION_ERROR]: ErrorSeverity.MEDIUM,
      [DamsGeoErrorCode.UPLOAD_FAILED]: ErrorSeverity.MEDIUM,
      
      // Low severity
      [DamsGeoErrorCode.TRACKING_ALREADY_ACTIVE]: ErrorSeverity.LOW,
      [DamsGeoErrorCode.GEOFENCE_LIMIT_EXCEEDED]: ErrorSeverity.LOW,
      
      // Default
      [DamsGeoErrorCode.UNKNOWN_ERROR]: ErrorSeverity.MEDIUM,
    };
    
    return severityMap[code] || ErrorSeverity.MEDIUM;
  }
  
  /**
   * Get default recovery strategy based on error code
   */
  private getDefaultRecoveryStrategy(code: DamsGeoErrorCode): RecoveryStrategy {
    const strategyMap: Partial<Record<DamsGeoErrorCode, RecoveryStrategy>> = {
      [DamsGeoErrorCode.LOCATION_TIMEOUT]: {
        canRetry: true,
        maxRetries: 3,
        retryDelay: 5000,
        userAction: 'Please ensure you have a clear view of the sky for GPS signal.'
      },
      [DamsGeoErrorCode.DATABASE_QUERY_FAILED]: {
        canRetry: true,
        maxRetries: 2,
        retryDelay: 1000
      },
      [DamsGeoErrorCode.NETWORK_ERROR]: {
        canRetry: true,
        maxRetries: 3,
        retryDelay: 2000,
        userAction: 'Please check your internet connection.'
      },
      [DamsGeoErrorCode.PERMISSION_DENIED]: {
        canRetry: false,
        userAction: 'Please grant location permission in your device settings.'
      },
      [DamsGeoErrorCode.DATABASE_CORRUPTION]: {
        canRetry: false,
        fallbackAction: async () => {
          // Reset database
          console.log('Database corruption detected, resetting...');
        },
        userAction: 'Database corruption detected. The app will reset your local data.'
      }
    };
    
    return strategyMap[code] || { canRetry: false };
  }
  
  /**
   * Get default user-friendly message
   */
  private getDefaultUserMessage(code: DamsGeoErrorCode, _technicalMessage: string): UserFriendlyMessage {
    const messageMap: Partial<Record<DamsGeoErrorCode, UserFriendlyMessage>> = {
      [DamsGeoErrorCode.PERMISSION_DENIED]: {
        title: 'Location Permission Required',
        message: 'This app needs location access to track your activities.',
        action: 'Please enable location permission in Settings.'
      },
      [DamsGeoErrorCode.LOCATION_TIMEOUT]: {
        title: 'Location Not Available',
        message: 'Unable to get your current location.',
        action: 'Please ensure GPS is enabled and you have a clear view of the sky.'
      },
      [DamsGeoErrorCode.LOCATION_SERVICE_DISABLED]: {
        title: 'Location Services Disabled',
        message: 'Location services are turned off on your device.',
        action: 'Please enable location services in your device settings.'
      },
      [DamsGeoErrorCode.ACTIVITY_RECOGNITION_ERROR]: {
        title: 'Activity Detection Issue',
        message: 'Unable to detect your current activity.',
        action: 'Activity tracking will resume automatically.'
      },
      [DamsGeoErrorCode.UPLOAD_FAILED]: {
        title: 'Upload Failed',
        message: 'Failed to upload your data to the server.',
        action: 'Your data is saved locally and will be uploaded when connection is restored.'
      },
      [DamsGeoErrorCode.TRACKING_ALREADY_ACTIVE]: {
        title: 'Already Tracking',
        message: 'Location tracking is already active.',
        action: 'No action needed.'
      },
      [DamsGeoErrorCode.GEOFENCE_LIMIT_EXCEEDED]: {
        title: 'Too Many Zones',
        message: 'You can only monitor up to 10 zones at a time.',
        action: 'Please remove some zones before adding new ones.'
      },
      [DamsGeoErrorCode.DATABASE_CORRUPTION]: {
        title: 'Data Error',
        message: 'There was a problem with your saved data.',
        action: 'The app will reset your local data to fix this issue.'
      },
      [DamsGeoErrorCode.EXPORT_NO_DATA]: {
        title: 'No Data to Export',
        message: 'There is no location data for the selected time period.',
        action: 'Please select a different date range.'
      }
    };
    
    return messageMap[code] || {
      title: 'Something Went Wrong',
      message: 'An unexpected error occurred.',
      action: 'Please try again or contact support if the problem persists.'
    };
  }
  
  /**
   * Get platform information
   */
  private getPlatform(): string {
    // In React Native, use Platform from react-native
    try {
      const { Platform } = require('react-native');
      return Platform.OS || 'unknown';
    } catch {
      return 'unknown';
    }
  }
  
  /**
   * Convert error to JSON for logging/reporting
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      severity: this.severity,
      context: this.context,
      userMessage: this.userMessage,
      recoveryStrategy: this.recoveryStrategy,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
  
  /**
   * Check if error is retryable
   */
  isRetryable(): boolean {
    return this.recoveryStrategy?.canRetry || false;
  }
  
  /**
   * Get retry delay in milliseconds
   */
  getRetryDelay(): number {
    return this.recoveryStrategy?.retryDelay || 1000;
  }
  
  /**
   * Check if error is critical
   */
  isCritical(): boolean {
    return this.severity === ErrorSeverity.CRITICAL;
  }
}

/**
 * Helper function to create errors with proper context
 */
export function createError(
  code: DamsGeoErrorCode,
  message: string,
  context?: ErrorContext,
  originalError?: Error
): DamsGeoError {
  return new DamsGeoError(code, message, {
    context,
    originalError
  });
}

/**
 * Type guard to check if an error is a DamsGeoError
 */
export function isDamsGeoError(error: any): error is DamsGeoError {
  return error instanceof DamsGeoError;
}

/**
 * Convert unknown errors to DamsGeoError
 */
export function toDamsGeoError(error: unknown, context?: ErrorContext): DamsGeoError {
  if (isDamsGeoError(error)) {
    return error;
  }
  
  if (error instanceof Error) {
    // Try to map known error patterns
    const message = error.message.toLowerCase();
    
    if (message.includes('permission')) {
      return createError(DamsGeoErrorCode.PERMISSION_DENIED, error.message, context, error);
    }
    if (message.includes('location') && message.includes('timeout')) {
      return createError(DamsGeoErrorCode.LOCATION_TIMEOUT, error.message, context, error);
    }
    if (message.includes('database')) {
      return createError(DamsGeoErrorCode.DATABASE_ERROR, error.message, context, error);
    }
    if (message.includes('network')) {
      return createError(DamsGeoErrorCode.NETWORK_ERROR, error.message, context, error);
    }
    
    return createError(DamsGeoErrorCode.UNKNOWN_ERROR, error.message, context, error);
  }
  
  return createError(
    DamsGeoErrorCode.UNKNOWN_ERROR,
    String(error),
    context
  );
}