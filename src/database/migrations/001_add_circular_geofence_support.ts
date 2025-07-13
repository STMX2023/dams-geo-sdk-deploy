/**
 * Database Migration: Add Circular Geofence Support
 * 
 * This migration adds support for circular geofences while maintaining
 * backward compatibility with existing polygon data.
 */

export interface Migration {
  version: number;
  name: string;
  up: (db: any) => Promise<void>;
  down: (db: any) => Promise<void>;
}

export const addCircularGeofenceSupport: Migration = {
  version: 1,
  name: 'add_circular_geofence_support',
  
  async up(db: any): Promise<void> {
    // Add new columns for circular geofence data
    await db.exec(`
      ALTER TABLE geofences ADD COLUMN latitude REAL;
      ALTER TABLE geofences ADD COLUMN longitude REAL;
      ALTER TABLE geofences ADD COLUMN radius REAL;
      ALTER TABLE geofences ADD COLUMN zone_type TEXT DEFAULT 'polygon';
    `);

    // Create index for efficient spatial queries
    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_geofences_location 
      ON geofences(latitude, longitude) 
      WHERE zone_type = 'circle';
    `);

    // Migrate existing polygon data to include computed circle data
    // This allows both representations to coexist during migration
    const polygonZones = await db.all(`
      SELECT id, coordinates FROM geofences WHERE zone_type = 'polygon'
    `);

    for (const zone of polygonZones) {
      try {
        const coordinates = JSON.parse(zone.coordinates);
        const circle = computeBoundingCircle(coordinates);
        
        await db.run(`
          UPDATE geofences 
          SET latitude = ?, longitude = ?, radius = ?
          WHERE id = ?
        `, [circle.latitude, circle.longitude, circle.radius, zone.id]);
      } catch (error) {
        console.warn(`Failed to compute circle for zone ${zone.id}:`, error);
      }
    }

    // Add migration version tracking
    await db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at INTEGER NOT NULL
      );
    `);

    await db.run(`
      INSERT INTO schema_migrations (version, name, applied_at)
      VALUES (?, ?, ?)
    `, [this.version, this.name, Date.now()]);
  },

  async down(db: any): Promise<void> {
    // Remove the added columns
    // Note: SQLite doesn't support DROP COLUMN directly, 
    // so we need to recreate the table
    await db.exec(`
      CREATE TABLE geofences_backup AS 
      SELECT id, name, coordinates, isActive, created_at, updated_at 
      FROM geofences;
    `);

    await db.exec(`DROP TABLE geofences;`);
    
    await db.exec(`
      CREATE TABLE geofences (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        coordinates TEXT NOT NULL,
        isActive INTEGER DEFAULT 1,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      );
    `);

    await db.exec(`
      INSERT INTO geofences 
      SELECT * FROM geofences_backup;
    `);

    await db.exec(`DROP TABLE geofences_backup;`);
    
    // Remove migration record
    await db.run(`
      DELETE FROM schema_migrations WHERE version = ?
    `, [this.version]);
  }
};

/**
 * Compute the minimum bounding circle for a polygon
 * Uses the simple approach of finding center and max radius
 */
function computeBoundingCircle(coordinates: Array<{ lat: number; lon: number }>): {
  latitude: number;
  longitude: number;
  radius: number;
} {
  if (coordinates.length === 0) {
    throw new Error('No coordinates provided');
  }

  // Calculate centroid
  let sumLat = 0;
  let sumLon = 0;
  
  coordinates.forEach(coord => {
    sumLat += coord.lat;
    sumLon += coord.lon;
  });
  
  const centerLat = sumLat / coordinates.length;
  const centerLon = sumLon / coordinates.length;
  
  // Find maximum distance from center to any vertex
  let maxDistance = 0;
  
  coordinates.forEach(coord => {
    const distance = haversineDistance(
      centerLat, 
      centerLon, 
      coord.lat, 
      coord.lon
    );
    maxDistance = Math.max(maxDistance, distance);
  });
  
  // Add 10% buffer for safety
  const radiusWithBuffer = Math.ceil(maxDistance * 1.1);
  
  return {
    latitude: centerLat,
    longitude: centerLon,
    radius: radiusWithBuffer
  };
}

/**
 * Calculate distance between two points using Haversine formula
 */
function haversineDistance(
  lat1: number, 
  lon1: number, 
  lat2: number, 
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
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