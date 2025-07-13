// Audit Export Types

export interface AuditExportOptions {
  userId: string;
  from: Date;
  to: Date;
  includeRawData?: boolean;
  compress?: boolean;
  sign?: boolean;
}

export interface LocationRecord {
  lat: number;
  lon: number;
  accuracy: number;
  speed: number | null;
  heading: number | null;
  altitude: number | null;
  activityType: string;
  timestamp: number;
}

export interface GeofenceEvent {
  zoneId: string;
  zoneName: string;
  eventType: 'enter' | 'exit';
  timestamp: number;
  location: {
    lat: number;
    lon: number;
  };
}

export interface ActivitySummary {
  stationary: number;
  walking: number;
  vehicle: number;
  unknown: number;
}

export interface AuditExport {
  version: string;
  exportDate: number;
  userId: string;
  dateRange: {
    from: number;
    to: number;
  };
  summary: {
    totalPoints: number;
    totalDistance: number;
    totalDuration: number;
    activities: ActivitySummary;
    geofenceEvents: number;
    averageAccuracy: number;
  };
  locations?: LocationRecord[];
  geofenceEvents?: GeofenceEvent[];
  signature?: string;
}

export interface ExportResult {
  success: boolean;
  filePath?: string;
  error?: string;
  fileSize?: number;
  compressed?: boolean;
  signed?: boolean;
}