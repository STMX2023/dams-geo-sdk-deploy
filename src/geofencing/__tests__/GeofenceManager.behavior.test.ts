/**
 * Behavioral Tests for Geofencing
 * 
 * These tests define the expected behavior of the geofencing system,
 * regardless of implementation (polygon vs circular).
 * They serve as acceptance criteria for the native geofencing migration.
 */

import { GeofenceManager } from '../GeofenceManager';
import { LocationUpdate, GeofenceZone } from '../../DamsGeo.types';
import { GeofenceEvent } from '../GeofenceManager';
import { DatabaseManager } from '../../database/DatabaseManager';

// Mock the database manager
jest.mock('../../database/DatabaseManager');

// Create a mock instance with all required methods
const mockDbInstance = {
  saveGeofence: jest.fn().mockResolvedValue(undefined),
  getGeofences: jest.fn().mockResolvedValue([]),
  initialize: jest.fn().mockResolvedValue(undefined),
  close: jest.fn().mockResolvedValue(undefined)
};

// Mock the static getInstance method to return our mock instance
(DatabaseManager as any).getInstance = jest.fn(() => mockDbInstance);

// Test helpers
const createLocation = (lat: number, lon: number): LocationUpdate => ({
  lat,
  lon,
  accuracy: 10,
  speed: null,
  heading: null,
  altitude: null,
  activityType: 'vehicle',
  timestamp: Date.now()
});

const createZone = (id: string, name: string, centerLat: number, centerLon: number, radiusMeters: number = 100): GeofenceZone => {
  // Create a hybrid zone that works with both polygon and circular checks
  const radiusDegrees = radiusMeters / 111000; // Rough conversion
  return {
    id,
    name,
    coordinates: [
      { lat: centerLat - radiusDegrees, lon: centerLon - radiusDegrees },
      { lat: centerLat + radiusDegrees, lon: centerLon - radiusDegrees },
      { lat: centerLat + radiusDegrees, lon: centerLon + radiusDegrees },
      { lat: centerLat - radiusDegrees, lon: centerLon + radiusDegrees }
    ],
    center: { latitude: centerLat, longitude: centerLon },
    radius: radiusMeters,
    zoneType: 'polygon' as const,
    isActive: true
  };
};

describe('GeofenceManager Behavioral Tests', () => {
  let geofenceManager: GeofenceManager;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Reset mock implementation
    mockDbInstance.saveGeofence.mockResolvedValue(undefined);
    mockDbInstance.getGeofences.mockResolvedValue([]);
    
    // Reset singleton instance
    (GeofenceManager as any).instance = null;
    geofenceManager = GeofenceManager.getInstance();
  });

  describe('Basic Zone Entry/Exit Behavior', () => {
    it('should trigger enter event when moving from outside to inside a zone', () => {
      // Given: A single active zone
      const zone = createZone('zone1', 'Test Zone', 37.7749, -122.4194);
      geofenceManager.setGeofences([zone]);

      // When: Device moves from outside to inside
      const outsideLocation = createLocation(37.7700, -122.4100);
      const insideLocation = createLocation(37.7749, -122.4194);
      
      const events1 = geofenceManager.checkGeofences(outsideLocation);
      const events2 = geofenceManager.checkGeofences(insideLocation);

      // Then: Only one enter event should be triggered
      expect(events1).toHaveLength(0);
      expect(events2).toHaveLength(1);
      expect(events2[0]).toMatchObject({
        zoneId: 'zone1',
        zoneName: 'Test Zone',
        eventType: 'enter'
      });
    });

    it('should trigger exit event when moving from inside to outside a zone', () => {
      // Given: Device starts inside a zone
      const zone = createZone('zone1', 'Test Zone', 37.7749, -122.4194);
      geofenceManager.setGeofences([zone]);
      
      const insideLocation = createLocation(37.7749, -122.4194);
      geofenceManager.checkGeofences(insideLocation);

      // When: Device moves outside
      const outsideLocation = createLocation(37.7700, -122.4100);
      const events = geofenceManager.checkGeofences(outsideLocation);

      // Then: Exit event should be triggered
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        zoneId: 'zone1',
        zoneName: 'Test Zone',
        eventType: 'exit'
      });
    });

    it('should not trigger duplicate enter events when staying inside a zone', () => {
      // Given: A zone and device inside it
      const zone = createZone('zone1', 'Test Zone', 37.7749, -122.4194);
      geofenceManager.setGeofences([zone]);
      
      const location1 = createLocation(37.7749, -122.4194);
      const location2 = createLocation(37.7748, -122.4193);
      const location3 = createLocation(37.7750, -122.4195);

      // When: Device moves around inside the zone
      const events1 = geofenceManager.checkGeofences(location1);
      const events2 = geofenceManager.checkGeofences(location2);
      const events3 = geofenceManager.checkGeofences(location3);

      // Then: Only the first check should trigger enter event
      expect(events1).toHaveLength(1);
      expect(events1[0].eventType).toBe('enter');
      expect(events2).toHaveLength(0);
      expect(events3).toHaveLength(0);
    });
  });

  describe('Multiple Zone Handling', () => {
    it('should handle overlapping zones independently', () => {
      // Given: Two overlapping zones
      const zone1 = createZone('zone1', 'Zone 1', 37.7749, -122.4194, 200);
      const zone2 = createZone('zone2', 'Zone 2', 37.7750, -122.4195, 200);
      geofenceManager.setGeofences([zone1, zone2]);

      // When: Device enters the overlap area
      const overlapLocation = createLocation(37.77495, -122.41945);
      const events = geofenceManager.checkGeofences(overlapLocation);

      // Then: Should trigger enter events for both zones
      expect(events).toHaveLength(2);
      expect(events.map(e => e.zoneId).sort()).toEqual(['zone1', 'zone2']);
      expect(events.every(e => e.eventType === 'enter')).toBe(true);
    });

    it('should track zone states independently', () => {
      // Given: Two adjacent zones
      const zone1 = createZone('zone1', 'Zone 1', 37.7749, -122.4194);
      const zone2 = createZone('zone2', 'Zone 2', 37.7760, -122.4194);
      geofenceManager.setGeofences([zone1, zone2]);

      // When: Device moves from zone1 to zone2
      const location1 = createLocation(37.7749, -122.4194); // In zone1
      const location2 = createLocation(37.7760, -122.4194); // In zone2
      
      geofenceManager.checkGeofences(location1);
      const events = geofenceManager.checkGeofences(location2);

      // Then: Should exit zone1 and enter zone2
      expect(events).toHaveLength(2);
      expect(events.find(e => e.zoneId === 'zone1')).toMatchObject({
        eventType: 'exit'
      });
      expect(events.find(e => e.zoneId === 'zone2')).toMatchObject({
        eventType: 'enter'
      });
    });

    it('should respect the maximum zone limit', () => {
      // Given: Attempt to set more than 10 zones
      const zones = Array.from({ length: 11 }, (_, i) => 
        createZone(`zone${i}`, `Zone ${i}`, 37.7749 + i * 0.001, -122.4194)
      );

      // When/Then: Should throw error
      expect(() => {
        geofenceManager.setGeofences(zones);
      }).toThrow('Maximum 10 geofence zones allowed');
    });
  });

  describe('Zone State Management', () => {
    it('should maintain zone state across location updates', () => {
      // Given: Device inside a zone
      const zone = createZone('zone1', 'Test Zone', 37.7749, -122.4194);
      geofenceManager.setGeofences([zone]);
      
      const insideLocation = createLocation(37.7749, -122.4194);
      geofenceManager.checkGeofences(insideLocation);

      // When: Checking current zones
      const currentZones = geofenceManager.getCurrentZones();

      // Then: Should report the occupied zone
      expect(currentZones).toHaveLength(1);
      expect(currentZones[0].id).toBe('zone1');
    });

    it('should clear zone states when zones are updated', () => {
      // Given: Device inside zone1
      const zone1 = createZone('zone1', 'Zone 1', 37.7749, -122.4194);
      geofenceManager.setGeofences([zone1]);
      geofenceManager.checkGeofences(createLocation(37.7749, -122.4194));
      
      // When: Zones are replaced with zone2
      const zone2 = createZone('zone2', 'Zone 2', 37.7760, -122.4194);
      geofenceManager.setGeofences([zone2]);
      
      // Then: Should not be in any zone
      expect(geofenceManager.getCurrentZones()).toHaveLength(0);
      expect(geofenceManager.isInOffLimitsZone()).toBe(false);
    });

    it('should handle inactive zones correctly', () => {
      // Given: One active and one inactive zone
      const activeZone = createZone('zone1', 'Active Zone', 37.7749, -122.4194);
      const inactiveZone = { 
        ...createZone('zone2', 'Inactive Zone', 37.7749, -122.4194),
        isActive: false 
      };
      geofenceManager.setGeofences([activeZone, inactiveZone]);

      // When: Device is at location inside both zones
      const location = createLocation(37.7749, -122.4194);
      const events = geofenceManager.checkGeofences(location);

      // Then: Should only enter the active zone
      expect(events).toHaveLength(1);
      expect(events[0].zoneId).toBe('zone1');
    });
  });

  describe('Edge Cases and Boundaries', () => {
    it('should handle rapid location updates gracefully', () => {
      // Given: A zone and rapid location updates
      const zone = createZone('zone1', 'Test Zone', 37.7749, -122.4194);
      geofenceManager.setGeofences([zone]);

      // When: Many rapid updates at the same location
      const location = createLocation(37.7749, -122.4194);
      const events: GeofenceEvent[] = [];
      
      for (let i = 0; i < 100; i++) {
        events.push(...geofenceManager.checkGeofences(location));
      }

      // Then: Should only trigger one enter event
      expect(events.filter(e => e.eventType === 'enter')).toHaveLength(1);
    });

    it('should handle zone boundary transitions correctly', () => {
      // Given: A zone and locations right at the boundary
      const zone = createZone('zone1', 'Test Zone', 37.7749, -122.4194, 100);
      geofenceManager.setGeofences([zone]);

      // When: Device moves along the boundary
      const boundaryLocation1 = createLocation(37.7749, -122.4203); // ~100m west
      const boundaryLocation2 = createLocation(37.7758, -122.4194); // ~100m north
      
      const events1 = geofenceManager.checkGeofences(boundaryLocation1);
      const events2 = geofenceManager.checkGeofences(boundaryLocation2);

      // Then: Behavior should be consistent (both in or both out)
      // This test documents current behavior for migration comparison
      expect(events1.length).toBe(events2.length);
    });

    it('should handle empty zone list', () => {
      // Given: No zones configured
      geofenceManager.setGeofences([]);

      // When: Checking any location
      const events = geofenceManager.checkGeofences(createLocation(37.7749, -122.4194));

      // Then: Should return no events
      expect(events).toHaveLength(0);
      expect(geofenceManager.getCurrentZones()).toHaveLength(0);
    });
  });

  describe('Performance and Efficiency Requirements', () => {
    it('should process location updates within acceptable time', () => {
      // Given: Maximum allowed zones
      const zones = Array.from({ length: 10 }, (_, i) => 
        createZone(`zone${i}`, `Zone ${i}`, 37.7749 + i * 0.01, -122.4194 + i * 0.01)
      );
      geofenceManager.setGeofences(zones);

      // When: Processing a location update
      const location = createLocation(37.7749, -122.4194);
      const startTime = Date.now();
      geofenceManager.checkGeofences(location);
      const processingTime = Date.now() - startTime;

      // Then: Should complete within 50ms (generous for CI environments)
      expect(processingTime).toBeLessThan(50);
    });
  });

  describe('Integration Requirements', () => {
    it('should provide complete event information', () => {
      // Given: A zone
      const zone = createZone('zone1', 'Test Zone', 37.7749, -122.4194);
      geofenceManager.setGeofences([zone]);

      // When: Entering the zone
      const location = createLocation(37.7749, -122.4194);
      const events = geofenceManager.checkGeofences(location);

      // Then: Event should contain all required fields
      expect(events[0]).toHaveProperty('zoneId');
      expect(events[0]).toHaveProperty('zoneName');
      expect(events[0]).toHaveProperty('eventType');
      expect(events[0]).toHaveProperty('location');
      expect(events[0]).toHaveProperty('timestamp');
      expect(events[0].location).toEqual(location);
      expect(events[0].timestamp).toBeCloseTo(Date.now(), -2);
    });

    it('should maintain singleton instance', () => {
      // Given: Multiple getInstance calls
      const instance1 = GeofenceManager.getInstance();
      const instance2 = GeofenceManager.getInstance();

      // Then: Should return the same instance
      expect(instance1).toBe(instance2);
    });
  });
});