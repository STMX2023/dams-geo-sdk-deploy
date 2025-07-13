import { EventEmitter } from 'events';
import type { GeofenceZone, LocationUpdate } from '../DamsGeo.types';
import { featureFlags } from '../config/FeatureFlags';
import { DatabaseManager } from '../database/DatabaseManager';
import { 
  isCircularZone, 
  isPolygonZone, 
  isPointInCircle,
  createHybridZone,
  validateZone,
  getZonesForNativeMonitoring 
} from './GeofenceHelpers';

export interface GeofenceEvent {
  zoneId: string;
  zoneName: string;
  eventType: 'enter' | 'exit';
  location: LocationUpdate;
  timestamp: number;
}

export class GeofenceManager extends EventEmitter {
  private static instance: GeofenceManager | null = null;
  private activeZones: Map<string, GeofenceZone> = new Map();
  private currentZones: Set<string> = new Set();
  private lastLocation: LocationUpdate | null = null;
  private dbManager: DatabaseManager;

  private constructor() {
    super();
    this.dbManager = DatabaseManager.getInstance();
    this.loadZonesFromDatabase();
  }

  static getInstance(): GeofenceManager {
    if (!GeofenceManager.instance) {
      GeofenceManager.instance = new GeofenceManager();
    }
    return GeofenceManager.instance;
  }

  private async loadZonesFromDatabase(): Promise<void> {
    try {
      const zones = await this.dbManager.getGeofences();
      if (zones && zones.length > 0) {
        this.setGeofences(zones, false); // Don't save back to DB
      }
    } catch (error) {
      console.error('[GeofenceManager] Failed to load zones from database:', error);
    }
  }

  setGeofences(zones: GeofenceZone[], saveToDB: boolean = true): void {
    // Clear existing zones
    this.activeZones.clear();
    
    // Clear current zone state when zones are updated
    // This ensures proper re-evaluation of current position
    this.currentZones.clear();
    
    // Validate zone count
    if (zones.length > 10) {
      throw new Error('Maximum 10 geofence zones allowed');
    }

    // Process and store active zones
    zones.forEach(zone => {
      if (zone.isActive) {
        try {
          // Validate zone structure
          validateZone(zone);
          
          // Create hybrid zones during migration period
          // This ensures both representations exist
          const hybridZone = createHybridZone(zone);
          
          this.activeZones.set(zone.id, hybridZone);
        } catch (error) {
          console.error(`[GeofenceManager] Invalid zone ${zone.id}:`, error);
        }
      }
    });

    // Log migration mode
    if (featureFlags.shouldUseNativeGeofencing()) {
      console.log(`[GeofenceManager] Configured ${this.activeZones.size} zones for native monitoring`);
      
      // Prepare zones for native monitoring if needed
      if (this.lastLocation) {
        const platform = (global as any).Platform?.OS || 'ios';
        const limit = platform === 'ios' ? 20 : 100;
        const nativeZones = getZonesForNativeMonitoring(
          Array.from(this.activeZones.values()),
          this.lastLocation,
          limit
        );
        console.log(`[GeofenceManager] Selected ${nativeZones.length} zones for native monitoring`);
      }
    }

    // Save to database if requested
    if (saveToDB) {
      zones.forEach(zone => {
        if (zone.isActive) {
          this.dbManager.saveGeofence(zone).catch(error => {
            console.error(`[GeofenceManager] Failed to save zone ${zone.id} to database:`, error);
          });
        }
      });
    }

    // Re-check current location if available
    if (this.lastLocation) {
      this.checkGeofences(this.lastLocation);
    }
  }

  checkGeofences(location: LocationUpdate): GeofenceEvent[] {
    const events: GeofenceEvent[] = [];
    const previousZones = new Set(this.currentZones);
    const newZones = new Set<string>();

    // Check if we should use native geofencing
    const useNative = featureFlags.shouldUseNativeGeofencing();
    
    if (useNative) {
      // Native geofencing would be handled by platform-specific code
      // This is a placeholder - actual implementation would be in native modules
      console.log('[GeofenceManager] Using native geofencing mode');
    }

    // Check each active zone
    this.activeZones.forEach((zone, zoneId) => {
      let isInside = false;
      
      // Check based on zone type
      if (isCircularZone(zone)) {
        // Use efficient circular check
        isInside = isPointInCircle(
          location.lat, 
          location.lon, 
          zone.center!, 
          zone.radius!
        );
      } else if (isPolygonZone(zone)) {
        // Fall back to polygon check
        isInside = this.isPointInPolygon(
          location.lat, 
          location.lon, 
          zone.coordinates!
        );
        
      }
      
      if (isInside) {
        newZones.add(zoneId);
        
        // Check if this is a new entry
        if (!previousZones.has(zoneId)) {
          events.push({
            zoneId,
            zoneName: zone.name,
            eventType: 'enter',
            location,
            timestamp: Date.now()
          });
        }
      }
    });

    // Check for exits
    previousZones.forEach(zoneId => {
      if (!newZones.has(zoneId)) {
        const zone = this.activeZones.get(zoneId);
        if (zone) {
          events.push({
            zoneId,
            zoneName: zone.name,
            eventType: 'exit',
            location,
            timestamp: Date.now()
          });
        }
      }
    });

    // Update current zones
    this.currentZones = newZones;
    this.lastLocation = location;

    // Emit events
    events.forEach(event => {
      this.emit('geofenceEvent', event);
    });

    return events;
  }

  // Ray-casting algorithm for point-in-polygon detection
  private isPointInPolygon(lat: number, lon: number, coordinates: Array<{ lat: number; lon: number }>): boolean {
    if (coordinates.length < 3) {
      return false; // Need at least 3 points for a polygon
    }

    let inside = false;
    const n = coordinates.length;

    let p1 = coordinates[0];
    for (let i = 1; i <= n; i++) {
      const p2 = coordinates[i % n];
      
      if (lon > Math.min(p1.lon, p2.lon)) {
        if (lon <= Math.max(p1.lon, p2.lon)) {
          if (lat <= Math.max(p1.lat, p2.lat)) {
            if (p1.lon !== p2.lon) {
              const xinters = (lon - p1.lon) * (p2.lat - p1.lat) / (p2.lon - p1.lon) + p1.lat;
              if (p1.lat === p2.lat || lat <= xinters) {
                inside = !inside;
              }
            }
          }
        }
      }
      p1 = p2;
    }

    return inside;
  }

  // Get currently occupied zones
  getCurrentZones(): GeofenceZone[] {
    const zones: GeofenceZone[] = [];
    this.currentZones.forEach(zoneId => {
      const zone = this.activeZones.get(zoneId);
      if (zone) {
        zones.push(zone);
      }
    });
    return zones;
  }

  // Check if currently in any off-limits zone
  isInOffLimitsZone(): boolean {
    return this.currentZones.size > 0;
  }

  // Get all active zones
  getActiveZones(): GeofenceZone[] {
    return Array.from(this.activeZones.values());
  }

  // Clear all zones
  clearZones(): void {
    this.activeZones.clear();
    this.currentZones.clear();
  }

  // Calculate distance from point to nearest zone edge (for warnings)
  getDistanceToNearestZone(lat: number, lon: number): { zone: GeofenceZone; distance: number } | null {
    let nearestZone: GeofenceZone | null = null;
    let minDistance = Infinity;

    this.activeZones.forEach(zone => {
      const distance = this.calculateDistanceToPolygon(lat, lon, zone.coordinates || []);
      if (distance < minDistance) {
        minDistance = distance;
        nearestZone = zone;
      }
    });

    return nearestZone ? { zone: nearestZone, distance: minDistance } : null;
  }

  // Calculate minimum distance from point to polygon edge
  private calculateDistanceToPolygon(lat: number, lon: number, coordinates: Array<{ lat: number; lon: number }>): number {
    let minDistance = Infinity;

    for (let i = 0; i < coordinates.length; i++) {
      const p1 = coordinates[i];
      const p2 = coordinates[(i + 1) % coordinates.length];
      
      const distance = this.pointToSegmentDistance(lat, lon, p1.lat, p1.lon, p2.lat, p2.lon);
      minDistance = Math.min(minDistance, distance);
    }

    return minDistance;
  }

  // Calculate distance from point to line segment
  private pointToSegmentDistance(
    px: number, py: number,
    x1: number, y1: number,
    x2: number, y2: number
  ): number {
    const dx = x2 - x1;
    const dy = y2 - y1;

    if (dx === 0 && dy === 0) {
      // Segment is a point
      return this.haversineDistance(px, py, x1, y1);
    }

    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
    const nearestX = x1 + t * dx;
    const nearestY = y1 + t * dy;

    return this.haversineDistance(px, py, nearestX, nearestY);
  }

  // Haversine distance calculation (returns meters)
  private haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
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
}