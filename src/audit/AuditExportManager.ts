// Audit Export Manager
import { DatabaseManager } from '../database/DatabaseManager';
import { SigningManager } from './SigningManager';
import type { 
  AuditExport, 
  AuditExportOptions, 
  LocationRecord, 
  GeofenceEvent,
  ActivitySummary
} from './AuditExport.types';

export class AuditExportManager {
  private static instance: AuditExportManager;
  private dbManager: DatabaseManager;
  private signingManager: SigningManager;

  private constructor() {
    this.dbManager = DatabaseManager.getInstance();
    this.signingManager = SigningManager.getInstance();
  }

  static getInstance(): AuditExportManager {
    if (!AuditExportManager.instance) {
      AuditExportManager.instance = new AuditExportManager();
    }
    return AuditExportManager.instance;
  }

  async prepareExport(options: AuditExportOptions): Promise<AuditExport> {
    const { userId, from, to, includeRawData = false } = options;

    // Fetch data from database
    const locations = await this.dbManager.getLocationsByDateRange(userId, from, to);
    const geofenceEvents = await this.dbManager.getGeofenceEventsByDateRange(userId, from, to);

    // Calculate summary statistics
    const summary = this.calculateSummary(locations, geofenceEvents);

    // Create export object
    const auditExport: AuditExport = {
      version: '1.0.0',
      exportDate: Date.now(),
      userId,
      dateRange: {
        from: from.getTime(),
        to: to.getTime()
      },
      summary
    };

    // Include raw data if requested
    if (includeRawData) {
      auditExport.locations = locations;
      auditExport.geofenceEvents = geofenceEvents;
    }

    return auditExport;
  }

  private calculateSummary(
    locations: LocationRecord[], 
    geofenceEvents: GeofenceEvent[]
  ): AuditExport['summary'] {
    // Calculate total distance
    let totalDistance = 0;
    for (let i = 1; i < locations.length; i++) {
      totalDistance += this.calculateDistance(
        locations[i - 1].lat,
        locations[i - 1].lon,
        locations[i].lat,
        locations[i].lon
      );
    }

    // Calculate activity breakdown
    const activities: ActivitySummary = {
      stationary: 0,
      walking: 0,
      vehicle: 0,
      unknown: 0
    };

    locations.forEach(loc => {
      const activity = loc.activityType as keyof ActivitySummary;
      if (activity in activities) {
        activities[activity]++;
      } else {
        activities.unknown++;
      }
    });

    // Calculate average accuracy
    const averageAccuracy = locations.length > 0
      ? locations.reduce((sum, loc) => sum + loc.accuracy, 0) / locations.length
      : 0;

    // Calculate total duration
    const totalDuration = locations.length > 0
      ? locations[locations.length - 1].timestamp - locations[0].timestamp
      : 0;

    return {
      totalPoints: locations.length,
      totalDistance: Math.round(totalDistance),
      totalDuration,
      activities,
      geofenceEvents: geofenceEvents.length,
      averageAccuracy: Math.round(averageAccuracy * 10) / 10
    };
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  async exportToJSON(auditExport: AuditExport, sign: boolean = false): Promise<string> {
    // Create a copy without signature for signing
    const dataToSign = { ...auditExport };
    delete dataToSign.signature;
    
    const jsonString = JSON.stringify(dataToSign, null, 2);
    
    if (sign) {
      try {
        const signature = await this.signingManager.signData(jsonString);
        auditExport.signature = signature;
        return JSON.stringify(auditExport, null, 2);
      } catch (error) {
        console.error('[AuditExportManager] Failed to sign export:', error);
        // Return unsigned version if signing fails
        return jsonString;
      }
    }
    
    return jsonString;
  }

  async verifyExport(exportData: string): Promise<boolean> {
    try {
      const parsed = JSON.parse(exportData) as AuditExport;
      if (!parsed.signature) {
        return false;
      }

      // Create a copy without signature for verification
      const dataToVerify = { ...parsed };
      const signature = dataToVerify.signature!;
      delete dataToVerify.signature;
      
      const jsonString = JSON.stringify(dataToVerify, null, 2);
      return await this.signingManager.verifySignature(jsonString, signature);
    } catch (error) {
      console.error('[AuditExportManager] Failed to verify export:', error);
      return false;
    }
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) {return bytes + ' B';}
    if (bytes < 1024 * 1024) {return (bytes / 1024).toFixed(1) + ' KB';}
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  /**
   * Export audit data to a file
   * @param exportData The audit export data to write to file
   * @param options Export file options
   * @returns The path to the exported file
   */
  async exportToFile(exportData: AuditExport, options: any): Promise<string> {
    // Import file system module dynamically
    const FileSystem = await import('expo-file-system');
    
    const filename = options.filename || `audit_export_${Date.now()}.json`;
    const directory = options.directory || FileSystem.documentDirectory;
    const filePath = `${directory}${filename}`;
    
    // Convert export data to JSON
    const jsonContent = await this.exportToJSON(exportData, options.sign || false);
    
    // Write to file
    await FileSystem.writeAsStringAsync(filePath, jsonContent, {
      encoding: FileSystem.EncodingType.UTF8
    });
    
    return filePath;
  }

  /**
   * Get the signing manager instance
   * @returns The SigningManager instance
   */
  getSigningManager(): SigningManager {
    return this.signingManager;
  }
}