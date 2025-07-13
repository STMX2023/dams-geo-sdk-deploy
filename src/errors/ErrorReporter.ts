/**
 * Error Reporting Integration for DAMS Geo SDK
 * 
 * Example implementations for popular error tracking services
 */

import { DamsGeoError, ErrorContext } from './DamsGeoError';
import { ErrorReporter } from './ErrorManager';
import { ErrorDebugger } from './ErrorContext';

/**
 * Base class for error reporters
 */
export abstract class BaseErrorReporter implements ErrorReporter {
  protected isEnabled: boolean = true;
  protected environment: string = __DEV__ ? 'development' : 'production';
  
  constructor(protected config: any = {}) {
    this.isEnabled = config.enabled !== false;
  }
  
  async report(error: DamsGeoError, context?: ErrorContext): Promise<void> {
    if (!this.isEnabled) {
      return;
    }
    
    try {
      await this.sendReport(error, context);
    } catch (reportError) {
      console.error('Failed to report error:', reportError);
    }
  }
  
  protected abstract sendReport(error: DamsGeoError, context?: ErrorContext): Promise<void>;
}

/**
 * Sentry error reporter implementation
 */
export class SentryErrorReporter extends BaseErrorReporter {
  private Sentry: any;
  
  constructor(config: { dsn: string; environment?: string; enabled?: boolean }) {
    super(config);
    
    // Only initialize in production or if explicitly enabled
    if (this.isEnabled && !__DEV__) {
      try {
        this.Sentry = require('@sentry/react-native');
        this.Sentry.init({
          dsn: config.dsn,
          environment: config.environment || this.environment,
          beforeSend: (event: any) => {
            // Filter out low severity errors in production
            if (event.level === 'info' || event.level === 'debug') {
              return null;
            }
            return event;
          }
        });
      } catch (error) {
        console.warn('Sentry not available:', error);
        this.isEnabled = false;
      }
    }
  }
  
  protected async sendReport(error: DamsGeoError, context?: ErrorContext): Promise<void> {
    if (!this.Sentry) {return;}
    
    // Set context
    this.Sentry.setContext('damsGeo', {
      errorCode: error.code,
      severity: error.severity,
      operation: context?.operation,
      component: context?.component,
      ...context?.metadata
    });
    
    // Set user if available
    if (context?.userId) {
      this.Sentry.setUser({ id: context.userId });
    }
    
    // Set tags
    this.Sentry.setTag('error.code', error.code);
    this.Sentry.setTag('error.severity', error.severity);
    
    // Add breadcrumbs from error context
    const errorData = ErrorDebugger.exportError(error);
    if (errorData.context.breadcrumbs) {
      errorData.context.breadcrumbs.forEach((crumb: any) => {
        this.Sentry.addBreadcrumb({
          message: crumb.message,
          category: crumb.category,
          level: crumb.level,
          timestamp: crumb.timestamp / 1000,
          data: crumb.data
        });
      });
    }
    
    // Capture the error
    if (error.isCritical()) {
      this.Sentry.captureException(error, {
        level: 'error',
        extra: errorData
      });
    } else {
      this.Sentry.captureMessage(error.message, {
        level: this.mapSeverityToSentryLevel(error.severity),
        extra: errorData
      });
    }
  }
  
  private mapSeverityToSentryLevel(severity: string): string {
    switch (severity) {
      case 'critical':
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      case 'low':
        return 'info';
      default:
        return 'debug';
    }
  }
}

/**
 * Crashlytics error reporter implementation
 */
export class CrashlyticsErrorReporter extends BaseErrorReporter {
  private crashlytics: any;
  
  constructor(config: { enabled?: boolean } = {}) {
    super(config);
    
    if (this.isEnabled) {
      try {
        this.crashlytics = require('@react-native-firebase/crashlytics').default;
      } catch (error) {
        console.warn('Crashlytics not available:', error);
        this.isEnabled = false;
      }
    }
  }
  
  protected async sendReport(error: DamsGeoError, context?: ErrorContext): Promise<void> {
    if (!this.crashlytics) {return;}
    
    // Set user ID if available
    if (context?.userId) {
      await this.crashlytics().setUserId(context.userId);
    }
    
    // Set custom attributes
    await this.crashlytics().setAttributes({
      errorCode: error.code,
      severity: error.severity,
      operation: context?.operation || 'unknown',
      component: context?.component || 'unknown',
      platform: context?.platform || 'unknown',
      sdkVersion: context?.sdkVersion || 'unknown'
    });
    
    // Log the error
    await this.crashlytics().log(`[${error.code}] ${error.message}`);
    
    // Record error based on severity
    if (error.isCritical()) {
      await this.crashlytics().recordError(error);
    } else {
      // Log as custom event for non-critical errors
      const errorReport = ErrorDebugger.createErrorReport(error);
      await this.crashlytics().log(errorReport);
    }
  }
}

/**
 * Console error reporter for development
 */
export class ConsoleErrorReporter extends BaseErrorReporter {
  constructor(config: { verbose?: boolean; enabled?: boolean } = {}) {
    super(config);
    this.config.verbose = config.verbose ?? __DEV__;
  }
  
  protected async sendReport(error: DamsGeoError, context?: ErrorContext): Promise<void> {
    if (this.config.verbose) {
      // Full error report in development
      const report = ErrorDebugger.createErrorReport(error);
      console.log(report);
    } else {
      // Simplified output in production
      console.error(`[${error.code}] ${error.message}`);
      if (context) {
        console.error('Context:', context);
      }
    }
  }
}

/**
 * Custom analytics error reporter
 */
export class AnalyticsErrorReporter extends BaseErrorReporter {
  private analytics: any;
  
  constructor(config: { 
    analytics: any; // Your analytics instance
    enabled?: boolean;
  }) {
    super(config);
    this.analytics = config.analytics;
  }
  
  protected async sendReport(error: DamsGeoError, context?: ErrorContext): Promise<void> {
    if (!this.analytics) {return;}
    
    // Track error as an event
    await this.analytics.track('sdk_error', {
      error_code: error.code,
      error_message: error.message,
      error_severity: error.severity,
      operation: context?.operation,
      component: context?.component,
      user_id: context?.userId,
      timestamp: error.timestamp,
      metadata: context?.metadata
    });
    
    // Track specific error types
    switch (error.code) {
      case 'PERMISSION_DENIED':
        await this.analytics.track('permission_denied', {
          permission_type: 'location',
          context: context?.metadata
        });
        break;
        
      case 'LOCATION_TIMEOUT':
        await this.analytics.track('location_timeout', {
          timeout_duration: context?.metadata?.timeout,
          accuracy_setting: context?.metadata?.desiredAccuracy
        });
        break;
        
      case 'DATABASE_CORRUPTION':
        await this.analytics.track('database_corruption', {
          recovery_attempted: true,
          data_loss: context?.metadata?.dataLoss
        });
        break;
    }
  }
}

/**
 * Composite error reporter that sends to multiple services
 */
export class CompositeErrorReporter extends BaseErrorReporter {
  private reporters: ErrorReporter[] = [];
  
  constructor(reporters: ErrorReporter[]) {
    super({ enabled: true });
    this.reporters = reporters;
  }
  
  protected async sendReport(error: DamsGeoError, context?: ErrorContext): Promise<void> {
    // Report to all configured reporters
    await Promise.all(
      this.reporters.map(reporter => 
        reporter.report(error, context).catch(err => 
          console.error('Reporter failed:', err)
        )
      )
    );
  }
  
  addReporter(reporter: ErrorReporter): void {
    this.reporters.push(reporter);
  }
  
  removeReporter(reporter: ErrorReporter): void {
    const index = this.reporters.indexOf(reporter);
    if (index > -1) {
      this.reporters.splice(index, 1);
    }
  }
}

/**
 * Factory function to create appropriate error reporter
 */
export function createErrorReporter(config: {
  type: 'sentry' | 'crashlytics' | 'console' | 'analytics' | 'composite';
  options?: any;
}): ErrorReporter {
  switch (config.type) {
    case 'sentry':
      return new SentryErrorReporter(config.options);
      
    case 'crashlytics':
      return new CrashlyticsErrorReporter(config.options);
      
    case 'console':
      return new ConsoleErrorReporter(config.options);
      
    case 'analytics':
      return new AnalyticsErrorReporter(config.options);
      
    case 'composite':
      return new CompositeErrorReporter(config.options?.reporters || []);
      
    default:
      return new ConsoleErrorReporter({ verbose: true });
  }
}

/**
 * Example usage:
 * 
 * // Single reporter
 * const errorReporter = createErrorReporter({
 *   type: 'sentry',
 *   options: {
 *     dsn: 'YOUR_SENTRY_DSN',
 *     environment: 'production'
 *   }
 * });
 * 
 * // Multiple reporters
 * const compositeReporter = createErrorReporter({
 *   type: 'composite',
 *   options: {
 *     reporters: [
 *       new SentryErrorReporter({ dsn: 'YOUR_DSN' }),
 *       new CrashlyticsErrorReporter(),
 *       new AnalyticsErrorReporter({ analytics: myAnalytics })
 *     ]
 *   }
 * });
 * 
 * // Set up with ErrorManager
 * ErrorManager.getInstance().setErrorReporter(errorReporter);
 */