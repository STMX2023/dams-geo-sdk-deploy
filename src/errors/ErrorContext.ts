/**
 * Error Context and Debugging Utilities for DAMS Geo SDK
 * 
 * Provides rich context capture and debugging tools for error analysis
 */

import { Platform } from 'react-native';
import { DamsGeoError, ErrorContext } from './DamsGeoError';

export interface SystemInfo {
  platform: string;
  osVersion: string;
  appVersion: string;
  sdkVersion: string;
  deviceModel?: string;
  isEmulator?: boolean;
  freeMemory?: number;
  totalMemory?: number;
  batteryLevel?: number;
  isCharging?: boolean;
}

export interface LocationContext {
  lastKnownLocation?: {
    lat: number;
    lon: number;
    timestamp: number;
  };
  locationPermission?: string;
  gpsEnabled?: boolean;
  networkEnabled?: boolean;
  mockLocationsEnabled?: boolean;
}

export interface NetworkContext {
  isConnected: boolean;
  connectionType?: string;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
}

export interface DatabaseContext {
  isInitialized: boolean;
  isEncrypted: boolean;
  recordCount?: number;
  lastOperation?: string;
  lastOperationTime?: number;
}

export interface FullErrorContext extends ErrorContext {
  system?: SystemInfo;
  location?: LocationContext;
  network?: NetworkContext;
  database?: DatabaseContext;
  stackTrace?: string[];
  breadcrumbs?: Breadcrumb[];
}

export interface Breadcrumb {
  timestamp: number;
  category: string;
  message: string;
  level: 'debug' | 'info' | 'warning' | 'error';
  data?: any;
}

/**
 * Captures and manages error context
 */
export class ErrorContextManager {
  private static instance: ErrorContextManager;
  private breadcrumbs: Breadcrumb[] = [];
  private maxBreadcrumbs = 50;
  private systemInfo?: SystemInfo;
  private locationContext?: LocationContext;
  private networkContext?: NetworkContext;
  private databaseContext?: DatabaseContext;
  
  private constructor() {
    // Initialize with default values - will be populated lazily
    this.systemInfo = undefined;
  }
  
  static getInstance(): ErrorContextManager {
    if (!ErrorContextManager.instance) {
      ErrorContextManager.instance = new ErrorContextManager();
    }
    return ErrorContextManager.instance;
  }
  
  /**
   * Capture full context for an error
   */
  captureContext(error: DamsGeoError): FullErrorContext {
    const context: FullErrorContext = {
      ...error.context,
      system: this.getSystemInfo(),
      location: this.getLocationContext(),
      network: this.getNetworkContext(),
      database: this.getDatabaseContext(),
      stackTrace: this.parseStackTrace(error.stack),
      breadcrumbs: this.getBreadcrumbs()
    };
    
    return context;
  }
  
  /**
   * Add breadcrumb for debugging
   */
  addBreadcrumb(breadcrumb: Omit<Breadcrumb, 'timestamp'>): void {
    this.breadcrumbs.push({
      ...breadcrumb,
      timestamp: Date.now()
    });
    
    // Trim if too many
    if (this.breadcrumbs.length > this.maxBreadcrumbs) {
      this.breadcrumbs = this.breadcrumbs.slice(-this.maxBreadcrumbs);
    }
  }
  
  /**
   * Update system info
   */
  updateSystemInfo(info: Partial<SystemInfo>): void {
    this.systemInfo = {
      ...this.systemInfo!,
      ...info
    };
  }
  
  /**
   * Update location context
   */
  updateLocationContext(context: Partial<LocationContext>): void {
    this.locationContext = {
      ...this.locationContext,
      ...context
    };
    
    this.addBreadcrumb({
      category: 'location',
      message: 'Location context updated',
      level: 'info',
      data: context
    });
  }
  
  /**
   * Update network context
   */
  updateNetworkContext(context: Partial<NetworkContext>): void {
    this.networkContext = {
      isConnected: this.networkContext?.isConnected ?? false,
      ...this.networkContext,
      ...context
    } as NetworkContext;
    
    this.addBreadcrumb({
      category: 'network',
      message: 'Network context updated',
      level: 'info',
      data: context
    });
  }
  
  /**
   * Update database context
   */
  updateDatabaseContext(context: Partial<DatabaseContext>): void {
    this.databaseContext = {
      isInitialized: this.databaseContext?.isInitialized ?? false,
      isEncrypted: this.databaseContext?.isEncrypted ?? false,
      ...this.databaseContext,
      ...context
    } as DatabaseContext;
    
    this.addBreadcrumb({
      category: 'database',
      message: 'Database context updated',
      level: 'info',
      data: context
    });
  }
  
  /**
   * Clear breadcrumbs
   */
  clearBreadcrumbs(): void {
    this.breadcrumbs = [];
  }
  
  /**
   * Get breadcrumbs
   */
  getBreadcrumbs(limit?: number): Breadcrumb[] {
    if (limit) {
      return this.breadcrumbs.slice(-limit);
    }
    return [...this.breadcrumbs];
  }
  
  /**
   * Initialize system info
   */
  private async initializeSystemInfo(): Promise<void> {
    try {
      this.systemInfo = {
        platform: Platform.OS || 'unknown',
        osVersion: Platform.Version?.toString() || 'unknown',
        appVersion: '1.0.0', // TODO: Get from app
        sdkVersion: '1.0.0', // TODO: Get from package.json
        isEmulator: await this.checkIfEmulator()
      };
    } catch (error) {
      // Fallback for test environments or when Platform is not available
      this.systemInfo = {
        platform: 'unknown',
        osVersion: 'unknown',
        appVersion: '1.0.0',
        sdkVersion: '1.0.0',
        isEmulator: false
      };
    }
  }
  
  /**
   * Get current system info
   */
  private getSystemInfo(): SystemInfo {
    if (!this.systemInfo) {
      // Lazy initialization with fallbacks for test environments
      try {
        this.systemInfo = {
          platform: Platform?.OS || 'unknown',
          osVersion: Platform?.Version?.toString() || 'unknown',
          appVersion: '1.0.0', // TODO: Get from app
          sdkVersion: '1.0.0', // TODO: Get from package.json
          isEmulator: false // Will be updated later if needed
        };
      } catch (error) {
        // Fallback for test environments
        this.systemInfo = {
          platform: 'unknown',
          osVersion: 'unknown',
          appVersion: '1.0.0',
          sdkVersion: '1.0.0',
          isEmulator: false
        };
      }
    }
    
    return {
      ...this.systemInfo,
      freeMemory: this.getMemoryUsage().free,
      totalMemory: this.getMemoryUsage().total
    };
  }
  
  /**
   * Get current location context
   */
  private getLocationContext(): LocationContext | undefined {
    return this.locationContext;
  }
  
  /**
   * Get current network context
   */
  private getNetworkContext(): NetworkContext | undefined {
    return this.networkContext;
  }
  
  /**
   * Get current database context
   */
  private getDatabaseContext(): DatabaseContext | undefined {
    return this.databaseContext;
  }
  
  /**
   * Parse stack trace
   */
  private parseStackTrace(stack?: string): string[] {
    if (!stack) {return [];}
    
    return stack
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .slice(0, 20); // Limit stack trace length
  }
  
  /**
   * Check if running on emulator
   */
  private async checkIfEmulator(): Promise<boolean> {
    try {
      if (Platform.OS === 'ios') {
        // Check for iOS simulator
        return Platform.isPad || Platform.isTV || 
               (typeof (global as any).navigator !== 'undefined' && (global as any).navigator?.userAgent?.includes('Simulator'));
      } else if (Platform.OS === 'android') {
        // Check for Android emulator
        try {
          const { DeviceInfo } = require('react-native-device-info');
          return await DeviceInfo.isEmulator();
        } catch {
          return false;
        }
      }
      return false;
    } catch {
      return false;
    }
  }
  
  /**
   * Get memory usage
   */
  private getMemoryUsage(): { free: number; total: number } {
    // This would use native modules in a real implementation
    return {
      free: 0,
      total: 0
    };
  }
}

/**
 * Error debugging utilities
 */
export class ErrorDebugger {
  /**
   * Create detailed error report
   */
  static createErrorReport(error: DamsGeoError): string {
    const context = ErrorContextManager.getInstance().captureContext(error);
    
    const report = [
      '=== DAMS Geo SDK Error Report ===',
      `Date: ${new Date().toISOString()}`,
      '',
      '--- Error Details ---',
      `Code: ${error.code}`,
      `Message: ${error.message}`,
      `Severity: ${error.severity}`,
      `Timestamp: ${new Date(error.timestamp).toISOString()}`,
      '',
      '--- User Message ---',
      `Title: ${error.userMessage.title}`,
      `Message: ${error.userMessage.message}`,
      `Action: ${error.userMessage.action || 'None'}`,
      '',
      '--- System Info ---',
      `Platform: ${context.system?.platform} ${context.system?.osVersion}`,
      `App Version: ${context.system?.appVersion}`,
      `SDK Version: ${context.system?.sdkVersion}`,
      `Device Model: ${context.system?.deviceModel || 'Unknown'}`,
      `Is Emulator: ${context.system?.isEmulator ? 'Yes' : 'No'}`,
      `Battery: ${context.system?.batteryLevel || 'Unknown'}% ${context.system?.isCharging ? '(Charging)' : ''}`,
      '',
      '--- Error Context ---',
      `Operation: ${context.operation || 'Unknown'}`,
      `Component: ${context.component || 'Unknown'}`,
      `User ID: ${context.userId || 'Unknown'}`,
    ];
    
    if (context.location) {
      report.push(
        '',
        '--- Location Context ---',
        `Permission: ${context.location.locationPermission || 'Unknown'}`,
        `GPS Enabled: ${context.location.gpsEnabled ? 'Yes' : 'No'}`,
        `Network Enabled: ${context.location.networkEnabled ? 'Yes' : 'No'}`,
        `Mock Locations: ${context.location.mockLocationsEnabled ? 'Yes' : 'No'}`
      );
      
      if (context.location.lastKnownLocation) {
        const loc = context.location.lastKnownLocation;
        report.push(
          `Last Location: ${loc.lat.toFixed(6)}, ${loc.lon.toFixed(6)}`,
          `Last Update: ${new Date(loc.timestamp).toISOString()}`
        );
      }
    }
    
    if (context.network) {
      report.push(
        '',
        '--- Network Context ---',
        `Connected: ${context.network.isConnected ? 'Yes' : 'No'}`,
        `Type: ${context.network.connectionType || 'Unknown'}`,
        `Effective Type: ${context.network.effectiveType || 'Unknown'}`,
        `Downlink: ${context.network.downlink || 'Unknown'} Mbps`,
        `RTT: ${context.network.rtt || 'Unknown'} ms`
      );
    }
    
    if (context.database) {
      report.push(
        '',
        '--- Database Context ---',
        `Initialized: ${context.database.isInitialized ? 'Yes' : 'No'}`,
        `Encrypted: ${context.database.isEncrypted ? 'Yes' : 'No'}`,
        `Records: ${context.database.recordCount || 'Unknown'}`,
        `Last Operation: ${context.database.lastOperation || 'None'}`
      );
    }
    
    if (context.metadata) {
      report.push(
        '',
        '--- Additional Metadata ---',
        JSON.stringify(context.metadata, null, 2)
      );
    }
    
    if (context.breadcrumbs && context.breadcrumbs.length > 0) {
      report.push(
        '',
        '--- Breadcrumbs ---'
      );
      
      context.breadcrumbs.slice(-10).forEach(crumb => {
        const time = new Date(crumb.timestamp).toISOString();
        report.push(`[${time}] [${crumb.level}] ${crumb.category}: ${crumb.message}`);
        if (crumb.data) {
          report.push(`  Data: ${JSON.stringify(crumb.data)}`);
        }
      });
    }
    
    if (context.stackTrace && context.stackTrace.length > 0) {
      report.push(
        '',
        '--- Stack Trace ---',
        ...context.stackTrace
      );
    }
    
    report.push(
      '',
      '=== End of Report ==='
    );
    
    return report.join('\n');
  }
  
  /**
   * Log error with full context
   */
  static logError(error: DamsGeoError, verbose: boolean = false): void {
    if (verbose || __DEV__) {
      console.log(this.createErrorReport(error));
    } else {
      console.error(`[${error.code}] ${error.message}`);
    }
  }
  
  /**
   * Export error for external reporting
   */
  static exportError(error: DamsGeoError): any {
    const context = ErrorContextManager.getInstance().captureContext(error);
    
    return {
      error: {
        code: error.code,
        message: error.message,
        severity: error.severity,
        timestamp: error.timestamp,
        userMessage: error.userMessage
      },
      context,
      report: this.createErrorReport(error)
    };
  }
}

/**
 * Breadcrumb helper functions
 */
export function logBreadcrumb(
  category: string,
  message: string,
  level: Breadcrumb['level'] = 'info',
  data?: any
): void {
  ErrorContextManager.getInstance().addBreadcrumb({
    category,
    message,
    level,
    data
  });
}

export function logDebug(category: string, message: string, data?: any): void {
  logBreadcrumb(category, message, 'debug', data);
}

export function logInfo(category: string, message: string, data?: any): void {
  logBreadcrumb(category, message, 'info', data);
}

export function logWarning(category: string, message: string, data?: any): void {
  logBreadcrumb(category, message, 'warning', data);
}

export function logError(category: string, message: string, data?: any): void {
  logBreadcrumb(category, message, 'error', data);
}

// Export singleton instance
export default ErrorContextManager.getInstance();
export const errorContext = ErrorContextManager.getInstance();