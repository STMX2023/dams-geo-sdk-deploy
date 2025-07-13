/**
 * Test Utilities for Geofencing Migration
 * 
 * Shared helpers for testing both polygon and circular implementations
 */

import { LocationUpdate, GeofenceZone } from '../../DamsGeo.types';

/**
 * Location Creation Utilities
 */
export const createLocation = (
  lat: number, 
  lon: number, 
  options: Partial<LocationUpdate> = {}
): LocationUpdate => ({
  lat,
  lon,
  accuracy: 10,
  speed: null,
  heading: null,
  altitude: null,
  activityType: 'vehicle',
  timestamp: Date.now(),
  ...options
});

/**
 * Zone Creation Utilities
 */
export const createPolygonZone = (
  id: string,
  name: string,
  centerLat: number,
  centerLon: number,
  radiusMeters: number = 100,
  sides: number = 4
): GeofenceZone => {
  const radiusDegrees = radiusMeters / 111000; // Rough conversion
  const coordinates = [];
  
  for (let i = 0; i < sides; i++) {
    const angle = (2 * Math.PI * i) / sides;
    coordinates.push({
      lat: centerLat + radiusDegrees * Math.sin(angle),
      lon: centerLon + radiusDegrees * Math.cos(angle)
    });
  }
  
  return {
    id,
    name,
    coordinates,
    isActive: true
  };
};

export const createCircularZone = (
  id: string,
  name: string,
  latitude: number,
  longitude: number,
  radius: number
): any => {
  // Future circular format for native implementation
  return {
    id,
    name,
    center: { latitude, longitude },
    radius,
    // Include polygon approximation for compatibility
    coordinates: createPolygonZone(id, name, latitude, longitude, radius, 16).coordinates,
    isActive: true
  };
};

/**
 * Polygon to Circle Conversion
 * This simulates the conversion that will happen during migration
 */
export const convertPolygonToCircle = (polygonZone: GeofenceZone): {
  center: { latitude: number; longitude: number };
  radius: number;
} => {
  const { coordinates } = polygonZone;
  
  if (!coordinates || coordinates.length === 0) {
    throw new Error('Polygon zone must have coordinates');
  }
  
  // Calculate centroid
  let sumLat = 0;
  let sumLon = 0;
  coordinates.forEach(coord => {
    sumLat += coord.lat;
    sumLon += coord.lon;
  });
  
  const center = {
    latitude: sumLat / coordinates.length,
    longitude: sumLon / coordinates.length
  };
  
  // Find maximum distance from centroid (conservative approach)
  let maxDistance = 0;
  coordinates.forEach(coord => {
    const distance = haversineDistance(
      center.latitude,
      center.longitude,
      coord.lat,
      coord.lon
    );
    maxDistance = Math.max(maxDistance, distance);
  });
  
  return {
    center,
    radius: Math.ceil(maxDistance) // Round up for safety
  };
};

/**
 * Distance Calculations
 */
export const haversineDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
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
};

/**
 * Location Path Simulation
 * Generates a series of locations simulating movement
 */
export const createLocationPath = (
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number,
  steps: number = 10
): LocationUpdate[] => {
  const locations: LocationUpdate[] = [];
  
  for (let i = 0; i <= steps; i++) {
    const ratio = i / steps;
    const lat = startLat + (endLat - startLat) * ratio;
    const lon = startLon + (endLon - startLon) * ratio;
    
    locations.push(createLocation(lat, lon, {
      timestamp: Date.now() + i * 1000,
      speed: haversineDistance(startLat, startLon, endLat, endLon) / steps
    }));
  }
  
  return locations;
};

/**
 * Performance Testing Utilities
 */
export class PerformanceMeasure {
  private startTime: number = 0;
  private measurements: number[] = [];

  start(): void {
    this.startTime = performance.now();
  }

  end(): number {
    const duration = performance.now() - this.startTime;
    this.measurements.push(duration);
    return duration;
  }

  getStats() {
    const sorted = [...this.measurements].sort((a, b) => a - b);
    return {
      count: sorted.length,
      min: sorted[0] || 0,
      max: sorted[sorted.length - 1] || 0,
      avg: sorted.reduce((a, b) => a + b, 0) / sorted.length || 0,
      p50: sorted[Math.floor(sorted.length * 0.5)] || 0,
      p95: sorted[Math.floor(sorted.length * 0.95)] || 0,
      p99: sorted[Math.floor(sorted.length * 0.99)] || 0
    };
  }
}

/**
 * Battery Simulation Helper
 * Estimates battery impact based on operation count
 */
export class BatterySimulator {
  private operations = {
    polygonCheck: 0,
    nativeCheck: 0,
    locationUpdate: 0
  };

  recordPolygonCheck() {
    this.operations.polygonCheck++;
  }

  recordNativeCheck() {
    this.operations.nativeCheck++;
  }

  recordLocationUpdate() {
    this.operations.locationUpdate++;
  }

  estimateBatteryDrain(durationHours: number): {
    polygon: number;
    native: number;
    savings: string;
  } {
    // Rough estimates based on typical consumption
    const polygonDrainPerOp = 0.001; // 0.1% per 100 ops
    const nativeDrainPerOp = 0.0001;  // 10x more efficient
    
    const polygonTotal = this.operations.polygonCheck * polygonDrainPerOp;
    const nativeTotal = this.operations.nativeCheck * nativeDrainPerOp;
    
    return {
      polygon: polygonTotal,
      native: nativeTotal,
      savings: `${Math.round((1 - nativeTotal/polygonTotal) * 100)}%`
    };
  }

  reset() {
    this.operations = {
      polygonCheck: 0,
      nativeCheck: 0,
      locationUpdate: 0
    };
  }
}

/**
 * Zone Comparison Utilities
 * For validating migration accuracy
 */
export const compareZoneBehavior = (
  location: LocationUpdate,
  polygonResult: boolean,
  circleResult: boolean,
  tolerance: number = 50 // meters
): {
  match: boolean;
  reason?: string;
} => {
  if (polygonResult === circleResult) {
    return { match: true };
  }

  // Check if location is near boundary (expected differences)
  // In real implementation, would check distance to zone boundary
  if (location.accuracy > tolerance) {
    return {
      match: true,
      reason: 'Location accuracy exceeds tolerance'
    };
  }

  return {
    match: false,
    reason: 'Polygon and circle results differ beyond tolerance'
  };
};

/**
 * Test Data Generators
 */
export const generateTestZones = (count: number, area: {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}): GeofenceZone[] => {
  const zones: GeofenceZone[] = [];
  
  for (let i = 0; i < count; i++) {
    const lat = area.minLat + Math.random() * (area.maxLat - area.minLat);
    const lon = area.minLon + Math.random() * (area.maxLon - area.minLon);
    const radius = 50 + Math.random() * 200; // 50-250 meters
    
    zones.push(createPolygonZone(
      `test-zone-${i}`,
      `Test Zone ${i}`,
      lat,
      lon,
      radius,
      Math.random() > 0.5 ? 4 : 8 // Mix of squares and octagons
    ));
  }
  
  return zones;
};

/**
 * Event Validation Helpers
 */
export const expectGeofenceEvent = (
  event: any,
  expectedType: 'enter' | 'exit',
  expectedZoneId: string
): void => {
  expect(event).toBeDefined();
  expect(event.eventType).toBe(expectedType);
  expect(event.zoneId).toBe(expectedZoneId);
  expect(event.timestamp).toBeCloseTo(Date.now(), -2);
  expect(event.location).toBeDefined();
  expect(event.zoneName).toBeDefined();
};

/**
 * Mock Native Module Response
 * Simulates what native geofencing would return
 */
export const mockNativeGeofenceEvent = (
  type: 'enter' | 'exit',
  zoneId: string,
  location: LocationUpdate
) => ({
  type: 'geofence',
  event: type,
  region: {
    identifier: zoneId,
    latitude: location.lat,
    longitude: location.lon,
    radius: 100
  },
  location: {
    coords: {
      latitude: location.lat,
      longitude: location.lon,
      accuracy: location.accuracy,
      speed: location.speed,
      heading: location.heading,
      altitude: location.altitude
    },
    timestamp: location.timestamp
  }
});