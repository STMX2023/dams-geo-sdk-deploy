import { NativeModulesProxy, EventEmitter } from 'expo-modules-core';
import { AppState, AppStateStatus, Platform } from 'react-native';
import DamsGeoModule from './DamsGeoModule';
import type * as Types from './DamsGeo.types';
import { DatabaseManager } from './database/DatabaseManager';
import { ActivityManager } from './activity/ActivityManager';
import { GeofenceManager } from './geofencing/GeofenceManager';
import { BatteryOptimizationManager } from './battery/BatteryOptimizationManager';
import { BackgroundReliabilityManager } from './background/BackgroundReliabilityManager';
import { EncryptionKeyManager } from './encryption/EncryptionKeyManager';
import { AuditExportManager } from './audit/AuditExportManager';
import type { AuditExportOptions, ExportResult } from './audit/AuditExport.types';
import {
  DamsGeoError,
  DamsGeoErrorCode,
  createError,
  toDamsGeoError,
  errorManager,
  retryManager,
  errorContext,
  initializeErrorHandling,
  withRetry as _withRetry
} from './errors';
import { 
  logger, 
  LogLevel,
  logInfo,
  logError,
  logDebug,
  logWarn as _logWarn
} from './logging';

// Create interface for the EventEmitter to properly type events
interface DamsGeoEvents {
  onLocationUpdate: (location: Types.LocationUpdate) => void;
  onGeofenceEnter: (data: { zoneId: string; zoneName: string }) => void;
  onGeofenceExit: (data: { zoneId: string; zoneName: string }) => void;
  onActivityChange: (data: { activity: string; confidence: number }) => void;
  onError: (error: Types.DamsGeoError) => void;
  onBackgroundSync: (data: { timestamp: number }) => void;
}

// Type-safe event emitter wrapper
interface TypedEventEmitter<T> {
  addListener<K extends keyof T>(eventName: K, listener: T[K]): { remove: () => void };
  removeAllListeners(eventName?: keyof T): void;
}

// Create event emitter with proper native module reference
const nativeModule = DamsGeoModule ?? NativeModulesProxy.DamsGeo;
const emitter = new EventEmitter(nativeModule as any) as TypedEventEmitter<DamsGeoEvents>;

class DamsGeoSdk {
  private dbManager: DatabaseManager | null = null;
  private activityManager: ActivityManager | null = null;
  private geofenceManager: GeofenceManager | null = null;
  private batteryManager: BatteryOptimizationManager | null = null;
  private backgroundManager: BackgroundReliabilityManager | null = null;
  private appStateSubscription: any = null; // Simplified type to avoid conflicts
  private batteryPollTimer: ReturnType<typeof global.setInterval> | null = null;
  private isInitialized = false;
  private encryptionEnabled = true;
  private auditExportManager: AuditExportManager | null = null;
  private encryptionKeyManager: EncryptionKeyManager | null = null;

  constructor() {
    // Initialize error handling system
    this.initializeErrorSystem();
  }

  private initializeErrorSystem(): void {
    initializeErrorHandling({
      enableDebugMode: __DEV__,
      maxErrorHistory: 100
    });

    // Set up error event listener
    errorManager.on('error', (error: DamsGeoError) => {
      // Emit to SDK consumers
      emitter.addListener('onError' as keyof DamsGeoEvents, error as any);
    });

    // Set up permission required handler
    errorManager.on('permissionRequired', (data) => {
      logInfo('permissions', 'Permission required', data);
    });

    logInfo('system', 'DamsGeo SDK initialized');
  }

  /**
   * Configure the SDK with custom options
   */
  async configure(options: {
    encryptionEnabled?: boolean;
    debugMode?: boolean;
    errorReporting?: {
      enabled: boolean;
      endpoint?: string;
      apiKey?: string;
      includeStackTrace?: boolean;
    };
    logging?: {
      level?: LogLevel;
      enableConsole?: boolean;
      enableFile?: boolean;
      enableRemote?: boolean;
      remoteEndpoint?: string;
      remoteApiKey?: string;
      maxFileSize?: number;
      maxFiles?: number;
    };
  }): Promise<void> {
    logInfo('system', 'Configuring DamsGeo SDK', options);
    
    // Configure logging
    if (options.logging) {
      logger.configure({
        level: options.logging.level ?? (__DEV__ ? LogLevel.DEBUG : LogLevel.INFO),
        enableConsole: options.logging.enableConsole ?? __DEV__,
        enableFile: options.logging.enableFile ?? true,
        enableRemote: options.logging.enableRemote ?? false,
        remoteEndpoint: options.logging.remoteEndpoint,
        remoteApiKey: options.logging.remoteApiKey,
        maxFileSize: options.logging.maxFileSize,
        maxFiles: options.logging.maxFiles
      });
    }
    
    // Configure encryption
    if (options.encryptionEnabled !== undefined) {
      this.encryptionEnabled = options.encryptionEnabled;
    }
    
    // Configure error reporting
    if (options.errorReporting?.enabled) {
      // Set up remote error reporter if endpoint provided
      if (options.errorReporting.endpoint) {
        errorManager.setErrorReporter({
          report: async (error, context) => {
            try {
              await fetch(options.errorReporting!.endpoint!, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(options.errorReporting!.apiKey ? {
                    'Authorization': `Bearer ${options.errorReporting!.apiKey}`
                  } : {})
                },
                body: JSON.stringify({
                  error: {
                    code: error.code,
                    message: error.message,
                    severity: error.severity,
                    timestamp: error.timestamp,
                    stack: options.errorReporting!.includeStackTrace ? error.stack : undefined
                  },
                  context,
                  platform: Platform?.OS || 'unknown',
                  version: Platform?.Version || 'unknown'
                })
              });
            } catch (reportError) {
              logError('error-reporting', 'Failed to report error', reportError as Error);
            }
          }
        });
      }
    }
    
    // Set debug mode
    if (options.debugMode !== undefined) {
      (global as any).__DEV__ = options.debugMode;
    }
    
    logInfo('system', 'DamsGeo SDK configured successfully');
  }

  // Initialize database on first use
  private async ensureDatabase(): Promise<DatabaseManager> {
    if (!this.dbManager) {
      this.dbManager = DatabaseManager.getInstance();
      await this.dbManager.initialize(this.encryptionEnabled);
    }
    return this.dbManager;
  }

  // Initialize activity manager
  private ensureActivityManager(): ActivityManager {
    if (!this.activityManager) {
      this.activityManager = ActivityManager.getInstance();
    }
    return this.activityManager;
  }

  // Initialize geofence manager
  private ensureGeofenceManager(): GeofenceManager {
    if (!this.geofenceManager) {
      this.geofenceManager = GeofenceManager.getInstance();
    }
    return this.geofenceManager;
  }

  // Initialize battery optimization manager
  private ensureBatteryManager(): BatteryOptimizationManager {
    if (!this.batteryManager) {
      this.batteryManager = BatteryOptimizationManager.getInstance();
    }
    return this.batteryManager;
  }

  // Initialize background reliability manager
  private ensureBackgroundManager(): BackgroundReliabilityManager {
    if (!this.backgroundManager) {
      this.backgroundManager = BackgroundReliabilityManager.getInstance();
      this.setupAppStateMonitoring();
    }
    return this.backgroundManager;
  }

  // Initialize encryption key manager
  private ensureEncryptionKeyManager(): EncryptionKeyManager {
    if (!this.encryptionKeyManager) {
      this.encryptionKeyManager = EncryptionKeyManager.getInstance();
    }
    return this.encryptionKeyManager;
  }

  // Initialize audit export manager
  private ensureAuditExportManager(): AuditExportManager {
    if (!this.auditExportManager) {
      this.auditExportManager = AuditExportManager.getInstance();
    }
    return this.auditExportManager;
  }

  // Setup app state monitoring for background reliability
  private setupAppStateMonitoring(): void {
    this.appStateSubscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      const isBackground = nextAppState === 'background' || nextAppState === 'inactive';
      this.backgroundManager?.handleAppStateChange(isBackground);
    });
  }

  async startTracking(config?: Types.DamsGeoConfig): Promise<boolean> {
    try {
      await this.ensureDatabase();
      await DamsGeoModule.startTracking(config);
      this.isInitialized = true;
      this.ensureBackgroundManager().setTrackingActive(true);
      logInfo('system', 'Tracking started', config);
      return true;
    } catch (error) {
      logError('system', 'Failed to start tracking', error as Error);
      throw toDamsGeoError(error, { operation: 'startTracking' });
    }
  }

  async stopTracking(reason?: string): Promise<boolean> {
    try {
      await DamsGeoModule.stopTracking(reason);
      this.isInitialized = false;
      this.ensureBackgroundManager().setTrackingActive(false);
      logInfo('system', 'Tracking stopped', { reason });
      return true;
    } catch (error) {
      logError('system', 'Failed to stop tracking', error as Error);
      throw toDamsGeoError(error, { operation: 'stopTracking' });
    }
  }

  get isTracking(): boolean {
    return DamsGeoModule.isTracking;
  }

  addListener<K extends keyof DamsGeoEvents>(eventName: K, listener: DamsGeoEvents[K]): { remove: () => void } {
    return emitter.addListener(eventName, listener);
  }

  /**
   * Returns database statistics.
   */
  async getDatabaseStats(): Promise<Types.DatabaseStats> {
    try {
      const db = await this.ensureDatabase();
      return await db.getStats();
    } catch (error) {
      throw toDamsGeoError(error, { operation: 'getDatabaseStats' });
    }
  }

  /**
   * Clears old data from the database.
   * @param daysToKeep Number of days of data to keep. Data older than this will be deleted.
   */
  async clearOldData(daysToKeep: number): Promise<void> {
    try {
      const db = await this.ensureDatabase();
      await db.clearOldData(daysToKeep);
    } catch (error) {
      throw toDamsGeoError(error, { operation: 'clearOldData' });
    }
  }

  /**
   * Gets the current encryption status of the database.
   */
  async getEncryptionStatus(): Promise<Types.EncryptionStatus> {
    try {
      const db = await this.ensureDatabase();
      return await db.getEncryptionStatus();
    } catch (error) {
      throw toDamsGeoError(error, { operation: 'getEncryptionStatus' });
    }
  }

  /**
   * Sets the active geofence zones.
   * @param zones An array of geofence zones to monitor.
   */
  async setGeofences(zones: Types.GeofenceZone[]): Promise<void> {
    try {
      const geofenceManager = this.ensureGeofenceManager();
      geofenceManager.setGeofences(zones);
      const db = await this.ensureDatabase();
      for (const zone of zones) {
        await db.saveGeofence(zone);
      }
    } catch (error) {
      throw toDamsGeoError(error, { operation: 'setGeofences' });
    }
  }

  /**
   * Retrieves all stored geofence zones.
   */
  async getStoredGeofences(): Promise<Types.GeofenceZone[]> {
    try {
      const db = await this.ensureDatabase();
      return await db.getGeofences();
    } catch (error) {
      throw toDamsGeoError(error, { operation: 'getStoredGeofences' });
    }
  }

  /**
   * Gets the most recent location updates from the database.
   * @param limit The maximum number of locations to retrieve. Defaults to 100.
   */
  async getRecentLocations(limit: number = 100): Promise<Types.LocationUpdate[]> {
    try {
      const db = await this.ensureDatabase();
      return await db.getRecentLocations(limit);
    } catch (error) {
      throw toDamsGeoError(error, { operation: 'getRecentLocations' });
    }
  }

  /**
   * Removes all listeners for a specific event name, or all listeners if no event name is provided.
   * @param eventName The name of the event for which to remove listeners. Optional.
   */
  removeAllListeners(eventName?: keyof DamsGeoEvents): void {
    emitter.removeAllListeners(eventName);
  }

  /**
   * Prepares and exports audit data for a given user and date range.
   * @param options Audit export options.
   */
  async exportAudit(options: AuditExportOptions): Promise<Types.AuditExport> {
    try {
      const auditManager = this.ensureAuditExportManager();
      return await auditManager.prepareExport(options);
    } catch (error) {
      throw toDamsGeoError(error, { operation: 'exportAudit' });
    }
  }

  /**
   * Exports audit data to a file.
   * @param exportData The audit export data to write to file.
   * @param options Export file options (e.g., compress, sign).
   * @returns The path to the exported file.
   */
  async exportAuditToFile(exportData: Types.AuditExport, options: Types.ExportFileOptions): Promise<string> {
    try {
      const auditManager = this.ensureAuditExportManager();
      return await auditManager.exportToFile(exportData, options);
    } catch (error) {
      throw toDamsGeoError(error, { operation: 'exportAuditToFile' });
    }
  }

  /**
   * Retrieves the public key for verifying audit export signatures.
   */
  async getPublicKey(): Promise<string> {
    try {
      const signingManager = this.ensureAuditExportManager().getSigningManager();
      return await signingManager.getPublicKey();
    } catch (error) {
      throw toDamsGeoError(error, { operation: 'getPublicKey' });
    }
  }

}

export const DamsGeo = new DamsGeoSdk();
export default DamsGeo;
export * from './DamsGeo.types';
export type { AuditExportOptions, ExportResult } from './audit/AuditExport.types';
