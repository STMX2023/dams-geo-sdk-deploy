/**
 * Unit Tests for GeofenceManager
 * Testing the core logic without full module dependencies
 */

// Simplified GeofenceManager for testing
interface GeofenceZone {
  id: string;
  name: string;
  coordinates: Array<{ lat: number; lon: number }>;
  isActive: boolean;
}

interface LocationUpdate {
  lat: number;
  lon: number;
  accuracy: number;
  timestamp: number;
}

interface GeofenceEvent {
  zoneId: string;
  zoneName: string;
  eventType: 'enter' | 'exit';
  location: LocationUpdate;
  timestamp: number;
}

// Simplified implementation for testing
class TestableGeofenceManager {
  private activeZones: Map<string, GeofenceZone> = new Map();
  private currentZones: Set<string> = new Set();

  setGeofences(zones: GeofenceZone[]): void {
    if (zones.length > 10) {
      throw new Error('Maximum 10 geofence zones allowed');
    }
    
    this.activeZones.clear();
    zones.forEach(zone => {
      if (zone.isActive) {
        this.activeZones.set(zone.id, zone);
      }
    });
  }

  checkGeofences(location: LocationUpdate): GeofenceEvent[] {
    const events: GeofenceEvent[] = [];
    const previousZones = new Set(this.currentZones);
    const newZones = new Set<string>();

    this.activeZones.forEach((zone, zoneId) => {
      if (this.isPointInPolygon(location.lat, location.lon, zone.coordinates)) {
        newZones.add(zoneId);
        
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

    this.currentZones = newZones;
    return events;
  }

  private isPointInPolygon(lat: number, lon: number, coordinates: Array<{ lat: number; lon: number }>): boolean {
    if (coordinates.length < 3) return false;
    
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

  getCurrentZones(): GeofenceZone[] {
    const zones: GeofenceZone[] = [];
    this.currentZones.forEach(zoneId => {
      const zone = this.activeZones.get(zoneId);
      if (zone) zones.push(zone);
    });
    return zones;
  }

  clearZones(): void {
    this.activeZones.clear();
    this.currentZones.clear();
  }

  isInOffLimitsZone(): boolean {
    return this.currentZones.size > 0;
  }
}

// Test helpers
const createLocation = (lat: number, lon: number): LocationUpdate => ({
  lat,
  lon,
  accuracy: 10,
  timestamp: Date.now()
});

const createZone = (id: string, name: string, centerLat: number, centerLon: number, radiusMeters: number = 100): GeofenceZone => {
  const radiusDegrees = radiusMeters / 111000;
  return {
    id,
    name,
    coordinates: [
      { lat: centerLat - radiusDegrees, lon: centerLon - radiusDegrees },
      { lat: centerLat + radiusDegrees, lon: centerLon - radiusDegrees },
      { lat: centerLat + radiusDegrees, lon: centerLon + radiusDegrees },
      { lat: centerLat - radiusDegrees, lon: centerLon + radiusDegrees }
    ],
    isActive: true
  };
};

describe('GeofenceManager Unit Tests', () => {
  let geofenceManager: TestableGeofenceManager;

  beforeEach(() => {
    geofenceManager = new TestableGeofenceManager();
  });

  describe('Basic Zone Entry/Exit', () => {
    it('should trigger enter event when moving into a zone', () => {
      const zone = createZone('zone1', 'Test Zone', 37.7749, -122.4194);
      geofenceManager.setGeofences([zone]);

      const outsideLocation = createLocation(37.7700, -122.4100);
      const insideLocation = createLocation(37.7749, -122.4194);
      
      const events1 = geofenceManager.checkGeofences(outsideLocation);
      const events2 = geofenceManager.checkGeofences(insideLocation);

      expect(events1).toHaveLength(0);
      expect(events2).toHaveLength(1);
      expect(events2[0].eventType).toBe('enter');
      expect(events2[0].zoneId).toBe('zone1');
    });

    it('should trigger exit event when leaving a zone', () => {
      const zone = createZone('zone1', 'Test Zone', 37.7749, -122.4194);
      geofenceManager.setGeofences([zone]);
      
      const insideLocation = createLocation(37.7749, -122.4194);
      geofenceManager.checkGeofences(insideLocation);

      const outsideLocation = createLocation(37.7700, -122.4100);
      const events = geofenceManager.checkGeofences(outsideLocation);

      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('exit');
    });

    it('should not trigger duplicate events', () => {
      const zone = createZone('zone1', 'Test Zone', 37.7749, -122.4194);
      geofenceManager.setGeofences([zone]);
      
      const location = createLocation(37.7749, -122.4194);
      
      const events1 = geofenceManager.checkGeofences(location);
      const events2 = geofenceManager.checkGeofences(location);
      const events3 = geofenceManager.checkGeofences(location);

      expect(events1).toHaveLength(1);
      expect(events2).toHaveLength(0);
      expect(events3).toHaveLength(0);
    });
  });

  describe('Multiple Zones', () => {
    it('should handle overlapping zones', () => {
      const zone1 = createZone('zone1', 'Zone 1', 37.7749, -122.4194, 200);
      const zone2 = createZone('zone2', 'Zone 2', 37.7750, -122.4195, 200);
      geofenceManager.setGeofences([zone1, zone2]);

      const overlapLocation = createLocation(37.77495, -122.41945);
      const events = geofenceManager.checkGeofences(overlapLocation);

      expect(events).toHaveLength(2);
      expect(events.map(e => e.zoneId).sort()).toEqual(['zone1', 'zone2']);
    });

    it('should enforce maximum zone limit', () => {
      const zones = Array.from({ length: 11 }, (_, i) => 
        createZone(`zone${i}`, `Zone ${i}`, 37.7749 + i * 0.001, -122.4194)
      );

      expect(() => {
        geofenceManager.setGeofences(zones);
      }).toThrow('Maximum 10 geofence zones allowed');
    });
  });

  describe('State Management', () => {
    it('should track current zones correctly', () => {
      const zone = createZone('zone1', 'Test Zone', 37.7749, -122.4194);
      geofenceManager.setGeofences([zone]);
      
      geofenceManager.checkGeofences(createLocation(37.7749, -122.4194));
      
      const currentZones = geofenceManager.getCurrentZones();
      expect(currentZones).toHaveLength(1);
      expect(currentZones[0].id).toBe('zone1');
    });

    it('should clear zones properly', () => {
      const zone = createZone('zone1', 'Test Zone', 37.7749, -122.4194);
      geofenceManager.setGeofences([zone]);
      geofenceManager.checkGeofences(createLocation(37.7749, -122.4194));
      
      geofenceManager.clearZones();
      
      expect(geofenceManager.getCurrentZones()).toHaveLength(0);
      expect(geofenceManager.isInOffLimitsZone()).toBe(false);
    });

    it('should handle inactive zones', () => {
      const activeZone = createZone('zone1', 'Active', 37.7749, -122.4194);
      const inactiveZone = { 
        ...createZone('zone2', 'Inactive', 37.7749, -122.4194),
        isActive: false 
      };
      
      geofenceManager.setGeofences([activeZone, inactiveZone]);
      const events = geofenceManager.checkGeofences(createLocation(37.7749, -122.4194));

      expect(events).toHaveLength(1);
      expect(events[0].zoneId).toBe('zone1');
    });
  });

  describe('Migration Readiness', () => {
    it('should provide consistent behavior for circular zones', () => {
      // Test with an octagon (approximating a circle)
      const octagonZone: GeofenceZone = {
        id: 'oct1',
        name: 'Octagon',
        coordinates: [
          { lat: 37.7751, lon: -122.4190 },
          { lat: 37.7750, lon: -122.4189 },
          { lat: 37.7749, lon: -122.4189 },
          { lat: 37.7748, lon: -122.4190 },
          { lat: 37.7748, lon: -122.4191 },
          { lat: 37.7749, lon: -122.4192 },
          { lat: 37.7750, lon: -122.4192 },
          { lat: 37.7751, lon: -122.4191 }
        ],
        isActive: true
      };

      geofenceManager.setGeofences([octagonZone]);
      
      // Test center point
      const centerEvents = geofenceManager.checkGeofences(createLocation(37.7750, -122.4190));
      expect(centerEvents).toHaveLength(1);
      expect(centerEvents[0].eventType).toBe('enter');
      
      // Test outside point
      geofenceManager.clearZones();
      geofenceManager.setGeofences([octagonZone]);
      const outsideEvents = geofenceManager.checkGeofences(createLocation(37.7760, -122.4190));
      expect(outsideEvents).toHaveLength(0);
    });

    it('should handle rapid location updates efficiently', () => {
      const zone = createZone('zone1', 'Test Zone', 37.7749, -122.4194);
      geofenceManager.setGeofences([zone]);

      const location = createLocation(37.7749, -122.4194);
      const startTime = Date.now();
      
      // Simulate 100 rapid updates
      for (let i = 0; i < 100; i++) {
        geofenceManager.checkGeofences(location);
      }
      
      const processingTime = Date.now() - startTime;
      expect(processingTime).toBeLessThan(50); // Should be very fast
    });
  });
});