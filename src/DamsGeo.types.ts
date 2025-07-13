/**
 * Core Types for DAMS Geo SDK
 */

export interface LocationUpdate {
  lat: number;
  lon: number;
  accuracy: number;
  speed: number | null;
  heading: number | null;
  altitude: number | null;
  activityType: ActivityType;
  timestamp: number;
}

export type ActivityType = 
  | 'stationary'
  | 'walking'
  | 'running'
  | 'bicycle'
  | 'vehicle'
  | 'unknown';

export interface GeofenceZone {
  id: string;
  name: string;
  coordinates?: Array<{ lat: number; lon: number }>;
  center?: { latitude: number; longitude: number };
  radius?: number;
  zoneType?: 'polygon' | 'circle';
  isActive: boolean;
}

export interface DamsGeoConfig {
  enableGeofencing?: boolean;
  enableActivityRecognition?: boolean;
  enableBatteryOptimization?: boolean;
  enableBackgroundLocation?: boolean;
  enableLocationSmoothing?: boolean;
  enableAdaptiveSampling?: boolean;
  enableEncryption?: boolean;
  enableDebugLogging?: boolean;
  minimumLocationAccuracy?: number;
  locationUpdateInterval?: number;
  geofencingPollingInterval?: number;
  batchLocationUpdates?: boolean;
  batchSize?: number;
  persistLocationHistory?: boolean;
  maxLocationHistoryDays?: number;
  enableMetricsCollection?: boolean;
}

export interface DatabaseStats {
  totalLocations: number;
  totalGeofences: number;
  totalActivities: number;
  databaseSizeMB: number;
  oldestRecordDate?: Date;
  newestRecordDate?: Date;
}

export interface EncryptionStatus {
  isEncrypted: boolean;
  algorithm?: string;
  keyDerivation?: string;
}

export interface ExportFileOptions {
  filename?: string;
  directory?: string;
  format?: 'json' | 'csv';
}

// Re-export types from audit module
export type { AuditExport } from './audit/AuditExport.types';

// Re-export error types
export type { DamsGeoError } from './errors/DamsGeoError';