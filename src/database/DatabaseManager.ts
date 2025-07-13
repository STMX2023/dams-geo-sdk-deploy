import { open, type DB } from '@op-engineering/op-sqlite';
import { Platform } from 'react-native';
import type { LocationUpdate, GeofenceZone } from '../DamsGeo.types';
import { EncryptionKeyManager } from '../encryption/EncryptionKeyManager';
import {
  DamsGeoError,
  DamsGeoErrorCode,
  createError,
  toDamsGeoError,
  errorContext,
  logInfo,
  logError as _logError,
  logDebug,
  withRetry as _withRetry,
  withAutoRecovery as _withAutoRecovery
} from '../errors';

export interface LocationRecord extends LocationUpdate {
  id?: number;
}

export interface GeofenceRecord extends GeofenceZone {
  createdAt: number;
  updatedAt: number;
}

export interface ActivityRecord {
  id?: number;
  activityType: string;
  confidence: number;
  timestamp: number;
}

export class DatabaseManager {
  private static instance: DatabaseManager | null = null;
  private db: DB | null = null;
  private readonly dbName = 'dams_geo.db';
  private encryptionKey: string | null = null;
  private isEncrypted: boolean = false;

  private constructor() {}

  static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  async initialize(useEncryption: boolean = true): Promise<void> {
    if (this.db) {
      logDebug('database', 'Database already initialized');
      return;
    }

    try {
      logInfo('database', 'Initializing database', { useEncryption });
      
      // Update database context
      errorContext.updateDatabaseContext({
        isInitialized: false,
        isEncrypted: useEncryption,
        lastOperation: 'initialize',
        lastOperationTime: Date.now()
      });
      
      // Get encryption key if encryption is enabled
      if (useEncryption) {
        const keyManager = EncryptionKeyManager.getInstance();
        const isAvailable = await keyManager.isEncryptionAvailable();
        
        if (isAvailable) {
          try {
            this.encryptionKey = await keyManager.getEncryptionKey();
            this.isEncrypted = true;
          } catch (keyError) {
            throw createError(
              DamsGeoErrorCode.ENCRYPTION_KEY_ERROR,
              'Failed to retrieve encryption key',
              {
                originalError: keyError as Error
              }
            );
          }
        } else {
          logInfo('database', 'Encryption not available, using unencrypted database');
          this.isEncrypted = false;
        }
      }

      // Open database with or without encryption
      if (this.encryptionKey) {
        this.db = open({
          name: this.dbName,
          location: Platform.OS === 'ios' ? 'Documents' : 'default',
          encryptionKey: this.encryptionKey,
        });
      } else {
        this.db = open({
          name: this.dbName,
          location: Platform.OS === 'ios' ? 'Documents' : 'default',
        });
      }

      // Create tables
      await this.createTables();
      
      // Update context on success
      errorContext.updateDatabaseContext({
        isInitialized: true,
        isEncrypted: this.isEncrypted,
        lastOperation: 'initialize',
        lastOperationTime: Date.now()
      });
      
      logInfo('database', 'Database initialized successfully', {
        encrypted: this.isEncrypted,
        location: Platform.OS === 'ios' ? 'Documents' : 'default'
      });
    } catch (error) {
      const damsError = toDamsGeoError(error, {
        operation: 'initializeDatabase',
        component: 'DatabaseManager',
        metadata: { useEncryption, dbName: this.dbName }
      });
      
      // Check if it's a corruption error
      if (error instanceof Error && error.message.includes('corrupt')) {
        throw new DamsGeoError(
          DamsGeoErrorCode.DATABASE_CORRUPTION,
          'Database appears to be corrupted',
          {
            context: {
              originalError: error as Error
            },
            recoveryStrategy: {
              canRetry: false,
              userAction: 'Database reset may be required'
            }
          }
        );
      }
      
      throw createError(
        DamsGeoErrorCode.DATABASE_INIT_FAILED,
        `Failed to initialize database: ${damsError.message}`,
        {
          originalError: error as Error
        }
      );
    }
  }

  private async createTables(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    // Location tracking table (multi-profile – user_id required)
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS locations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL DEFAULT '',
        lat REAL NOT NULL,
        lon REAL NOT NULL,
        accuracy REAL NOT NULL,
        speed REAL,
        heading REAL,
        altitude REAL,
        activityType TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      )
    `);

    // Create index for timestamp queries
    await this.db.execute(`
      CREATE INDEX IF NOT EXISTS idx_locations_timestamp 
      ON locations(timestamp DESC)
    `);

    // Geofences table
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS geofences (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        coordinates TEXT NOT NULL,
        isActive INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      )
    `);

    // Activity recognition table
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        activityType TEXT NOT NULL,
        confidence REAL NOT NULL,
        timestamp INTEGER NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      )
    `);

    // Events/audit log table
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT NOT NULL,
        event_data TEXT,
        timestamp INTEGER NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      )
    `);
  }

  async saveLocation(location: LocationUpdate & { userId?: string }): Promise<void> {
    if (!this.db) {
      throw createError(
        DamsGeoErrorCode.DATABASE_ERROR,
        'Database not initialized'
      );
    }

    try {
      const userId = location.userId ?? '';

      logDebug('database', 'Saving location', {
        userId,
        lat: location.lat,
        lon: location.lon,
        accuracy: location.accuracy
      });

      await this.db.execute(
        `INSERT INTO locations (user_id, lat, lon, accuracy, speed, heading, altitude, activityType, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          location.lat,
          location.lon,
          location.accuracy,
          location.speed,
          location.heading,
          location.altitude,
          location.activityType,
          location.timestamp
        ]
      );
      
      // Update database context
      errorContext.updateDatabaseContext({
        lastOperation: 'saveLocation',
        lastOperationTime: Date.now()
      });
    } catch (error) {
      throw createError(
        DamsGeoErrorCode.DATABASE_QUERY_FAILED,
        'Failed to save location to database',
        {
          operation: 'saveLocation',
          component: 'DatabaseManager',
          metadata: { 
            lat: location.lat,
            lon: location.lon,
            timestamp: location.timestamp
          }
        },
        error as Error
      );
    }
  }

  async getRecentLocations(limit: number = 100): Promise<LocationRecord[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const result = await this.db.execute(
        `SELECT * FROM locations ORDER BY timestamp DESC LIMIT ?`,
        [limit]
      );

      const rows = result.rows || [];
      return rows.map((row: any) => ({
        id: row.id,
        lat: row.lat,
        lon: row.lon,
        accuracy: row.accuracy,
        speed: row.speed,
        heading: row.heading,
        altitude: row.altitude,
        activityType: row.activityType,
        timestamp: row.timestamp
      }));
    } catch (error) {
      console.error('[DatabaseManager] Failed to get recent locations:', error);
      throw error;
    }
  }

  async saveGeofence(geofence: GeofenceZone): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      // Support both old and new schema
      const coordinatesJson = geofence.coordinates ? JSON.stringify(geofence.coordinates) : null;
      
      // Check if new columns exist (migration has run)
      const hasNewColumns = await this.checkColumnExists('geofences', 'latitude');
      
      if (hasNewColumns) {
        // Use new schema with circular support
        await this.db.execute(
          `INSERT OR REPLACE INTO geofences 
           (id, name, coordinates, latitude, longitude, radius, zone_type, isActive, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            geofence.id,
            geofence.name,
            coordinatesJson,
            geofence.center?.latitude || null,
            geofence.center?.longitude || null,
            geofence.radius || null,
            geofence.zoneType || (geofence.center ? 'circle' : 'polygon'),
            geofence.isActive ? 1 : 0,
            Date.now()
          ]
        );
      } else {
        // Use old schema (backward compatibility)
        if (!coordinatesJson) {
          throw new Error('Coordinates required for legacy schema');
        }
        
        await this.db.execute(
          `INSERT OR REPLACE INTO geofences (id, name, coordinates, isActive, updated_at)
           VALUES (?, ?, ?, ?, ?)`,
          [
            geofence.id,
            geofence.name,
            coordinatesJson,
            geofence.isActive ? 1 : 0,
            Date.now()
          ]
        );
      }
    } catch (error) {
      console.error('[DatabaseManager] Failed to save geofence:', error);
      throw error;
    }
  }

  async getGeofences(): Promise<GeofenceRecord[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const result = await this.db.execute(
        `SELECT * FROM geofences WHERE isActive = 1`
      );

      const rows = result.rows || [];
      return rows.map((row: any) => {
        const record: GeofenceRecord = {
          id: row.id,
          name: row.name,
          isActive: row.isActive === 1,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        // Add coordinates if present
        if (row.coordinates) {
          try {
            record.coordinates = JSON.parse(row.coordinates);
          } catch (e) {
            console.warn(`Failed to parse coordinates for zone ${row.id}`);
          }
        }
        
        // Add circular data if present (new schema)
        if (row.latitude !== null && row.longitude !== null && row.radius !== null) {
          record.center = {
            latitude: row.latitude,
            longitude: row.longitude
          };
          record.radius = row.radius;
        }
        
        // Add zone type if present
        if (row.zone_type) {
          record.zoneType = row.zone_type as 'polygon' | 'circle';
        }
        
        return record;
      });
    } catch (error) {
      console.error('[DatabaseManager] Failed to get geofences:', error);
      throw error;
    }
  }

  async saveActivity(activity: { activityType: string; confidence: number }): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      await this.db.execute(
        `INSERT INTO activities (activityType, confidence, timestamp)
         VALUES (?, ?, ?)`,
        [activity.activityType, activity.confidence, Date.now()]
      );
    } catch (error) {
      console.error('[DatabaseManager] Failed to save activity:', error);
      throw error;
    }
  }

  async logEvent(eventType: string, eventData?: any): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      await this.db.execute(
        `INSERT INTO events (event_type, event_data, timestamp)
         VALUES (?, ?, ?)`,
        [eventType, eventData ? JSON.stringify(eventData) : null, Date.now()]
      );
    } catch (error) {
      console.error('[DatabaseManager] Failed to log event:', error);
      throw error;
    }
  }

  async clearOldData(daysToKeep: number = 7): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);

    try {
      await this.db.execute(
        `DELETE FROM locations WHERE timestamp < ?`,
        [cutoffTime]
      );
      await this.db.execute(
        `DELETE FROM activities WHERE timestamp < ?`,
        [cutoffTime]
      );
      await this.db.execute(
        `DELETE FROM events WHERE timestamp < ?`,
        [cutoffTime]
      );
    } catch (error) {
      console.error('[DatabaseManager] Failed to clear old data:', error);
      throw error;
    }
  }

  async getLocationsByDateRange(userId: string, from: Date, to: Date): Promise<any[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const result = await this.db.execute(
        `SELECT lat, lon, accuracy, speed, heading, altitude, activityType, timestamp
         FROM locations 
         WHERE user_id = ? AND timestamp >= ? AND timestamp <= ?
         ORDER BY timestamp ASC`,
        [userId, from.getTime(), to.getTime()]
      );
      
      return result.rows || [];
    } catch (error) {
      console.error('[DatabaseManager] Failed to get locations by date range:', error);
      throw error;
    }
  }

  async getGeofenceEventsByDateRange(userId: string, from: Date, to: Date): Promise<any[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const result = await this.db.execute(
        `SELECT e.event_data, e.timestamp
         FROM events e
         WHERE e.event_type IN ('geofence_enter', 'geofence_exit')
         AND e.timestamp >= ? AND e.timestamp <= ?
         ORDER BY e.timestamp ASC`,
        [from.getTime(), to.getTime()]
      );
      
      const events = result.rows || [];
      return events.map(event => {
        const eventData = JSON.parse(String(event.event_data) || '{}');
        return {
          zoneId: eventData.zoneId,
          zoneName: eventData.zoneName,
          eventType: eventData.eventType || (event.event_type === 'geofence_enter' ? 'enter' : 'exit'),
          timestamp: event.timestamp,
          location: eventData.location
        };
      }).filter(event => event.zoneId); // Filter out invalid events
    } catch (error) {
      console.error('[DatabaseManager] Failed to get geofence events by date range:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }

  // Helper method to check if column exists
  private async checkColumnExists(table: string, column: string): Promise<boolean> {
    if (!this.db) {
      return false;
    }
    
    try {
      const result = await this.db.execute(
        `SELECT COUNT(*) as count FROM pragma_table_info('${table}') WHERE name = '${column}'`
      );
      
      const row = result.rows?.[0];
      return row && Number(row.count) > 0;
    } catch (error) {
      console.warn(`Failed to check column existence: ${error}`);
      return false;
    }
  }

  // Get database statistics for debugging
  async getStats(): Promise<{
    totalLocations: number;
    totalGeofences: number;
    totalActivities: number;
    databaseSizeMB: number;
    oldestRecordDate?: Date;
    newestRecordDate?: Date;
  }> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const locationCount = await this.db.execute('SELECT COUNT(*) as count FROM locations');
      const geofenceCount = await this.db.execute('SELECT COUNT(*) as count FROM geofences');
      const activityCount = await this.db.execute('SELECT COUNT(*) as count FROM activities');
      
      // Get oldest and newest record dates
      const oldestLocation = await this.db.execute('SELECT MIN(timestamp) as oldest FROM locations');
      const newestLocation = await this.db.execute('SELECT MAX(timestamp) as newest FROM locations');
      
      // Estimate database size (simplified - actual implementation would vary by platform)
      const tableCount = await this.db.execute(`
        SELECT COUNT(*) as count FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `);
      const estimatedSizeMB = ((Number((locationCount.rows || [])[0]?.count) || 0) * 0.001) + 1; // Rough estimate

      return {
        totalLocations: Number((locationCount.rows || [])[0]?.count) || 0,
        totalGeofences: Number((geofenceCount.rows || [])[0]?.count) || 0,
        totalActivities: Number((activityCount.rows || [])[0]?.count) || 0,
        databaseSizeMB: estimatedSizeMB,
        oldestRecordDate: (oldestLocation.rows || [])[0]?.oldest ? new Date((oldestLocation.rows || [])[0].oldest as string | number) : undefined,
        newestRecordDate: (newestLocation.rows || [])[0]?.newest ? new Date((newestLocation.rows || [])[0].newest as string | number) : undefined
      };
    } catch (error) {
      console.error('[DatabaseManager] Failed to get stats:', error);
      throw error;
    }
  }

  // Check if database is encrypted
  isEncryptionEnabled(): boolean {
    return this.isEncrypted;
  }

  // Get encryption status
  async getEncryptionStatus(): Promise<{
    isEncrypted: boolean;
    hasKey: boolean;
    keyAlias: string;
  }> {
    const keyManager = EncryptionKeyManager.getInstance();
    const hasKey = await keyManager.hasEncryptionKey();
    
    return {
      isEncrypted: this.isEncrypted,
      hasKey,
      keyAlias: 'dams-geo-encryption-key'
    };
  }

  // Migrate existing unencrypted database to encrypted
  async migrateToEncrypted(): Promise<void> {
    if (this.isEncrypted) {
      console.warn('[DatabaseManager] Database is already encrypted');
      return;
    }

    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      console.warn('[DatabaseManager] Starting migration to encrypted database...');
      
      // Get all data from unencrypted database
      const locations = await this.getRecentLocations(10000); // Get more locations for migration
      const geofences = await this.getGeofences();
      
      // Close current database
      await this.close();
      
      // Rename old database
      const _oldDbName = this.dbName;
      const _backupDbName = `${this.dbName}.backup`;
      
      // Re-initialize with encryption
      await this.initialize(true);
      
      // Restore data
      for (const location of locations) {
        await this.saveLocation(location);
      }
      
      for (const geofence of geofences) {
        await this.saveGeofence(geofence);
      }
      
      console.warn('[DatabaseManager] Migration completed successfully');
      await this.logEvent('database_migrated', { 
        locationsCount: locations.length,
        geofencesCount: geofences.length 
      });
    } catch (error) {
      console.error('[DatabaseManager] Migration failed:', error);
      throw new Error('Database migration failed');
    }
  }

  // Export all data (for backup before encryption)
  async exportAllData(): Promise<{
    locations: LocationRecord[];
    geofences: GeofenceRecord[];
    activities: ActivityRecord[];
    exportDate: number;
  }> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const locations = await this.getRecentLocations(100000); // Get all
      const geofences = await this.getGeofences();
      
      const activitiesResult = await this.db.execute(
        'SELECT * FROM activities ORDER BY timestamp DESC'
      );
      const activities = (activitiesResult.rows || []).map((row: any) => ({
        id: row.id,
        activityType: row.activityType,
        confidence: row.confidence,
        timestamp: row.timestamp
      }));

      return {
        locations,
        geofences,
        activities,
        exportDate: Date.now()
      };
    } catch (error) {
      console.error('[DatabaseManager] Failed to export data:', error);
      throw error;
    }
  }

  /**
   * Re-encrypt database with a new key (key rotation).
   */
  async rotateEncryptionKey(newKey: string): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    if (!this.isEncrypted) {
      throw new Error('Database is not encrypted – cannot rotate key');
    }

    try {
      await this.db.execute('PRAGMA rekey = ?;', [newKey]);
      this.encryptionKey = newKey;
      console.warn('[DatabaseManager] Encryption key rotated successfully');
      await this.logEvent('encryption_key_rotated');
    } catch (error) {
      console.error('[DatabaseManager] Failed to rotate encryption key:', error);
      throw error;
    }
  }

  /**
   * Delete all data for a specific user (Secure Logout).
   */
  async deleteUserData(userId: string): Promise<void> {
    if (!this.db) {throw new Error('Database not initialized');}

    try {
      await this.db.execute('DELETE FROM locations WHERE user_id = ?', [userId]);
      await this.db.execute('DELETE FROM geofences WHERE user_id = ?', [userId]);
      await this.db.execute('DELETE FROM activities WHERE user_id = ?', [userId]);
      await this.db.execute('DELETE FROM events WHERE event_data LIKE ?', [`%"userId":"${userId}"%`]);
    } catch (error) {
      console.error('[DatabaseManager] Failed to delete user data:', error);
      throw error;
    }
  }
}