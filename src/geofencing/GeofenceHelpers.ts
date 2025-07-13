/**
 * Helper functions for geofence operations
 * Supports both polygon and circular zones during migration
 */

import { GeofenceZone } from '../DamsGeo.types';

/**
 * Check if a zone is circular (has center and radius)
 */
export function isCircularZone(zone: GeofenceZone): boolean {
  return !!(zone.center && zone.radius !== undefined && zone.radius !== null);
}

/**
 * Check if a zone is polygon-based (has coordinates)
 */
export function isPolygonZone(zone: GeofenceZone): boolean {
  return !!(zone.coordinates && zone.coordinates.length >= 3);
}

/**
 * Get zone type with fallback detection
 */
export function getZoneType(zone: GeofenceZone): 'polygon' | 'circle' {
  // Explicit type takes precedence
  if (zone.zoneType) {
    return zone.zoneType;
  }
  
  // Auto-detect based on available data
  if (isCircularZone(zone)) {
    return 'circle';
  }
  
  if (isPolygonZone(zone)) {
    return 'polygon';
  }
  
  throw new Error(`Invalid zone ${zone.id}: must have either coordinates or center+radius`);
}

/**
 * Validate a geofence zone has required fields
 */
export function validateZone(zone: GeofenceZone): void {
  if (!zone.id) {
    throw new Error('Zone must have an id');
  }
  
  if (!zone.name) {
    throw new Error('Zone must have a name');
  }
  
  const hasCircular = isCircularZone(zone);
  const hasPolygon = isPolygonZone(zone);
  
  if (!hasCircular && !hasPolygon) {
    throw new Error(`Zone ${zone.id} must have either coordinates or center+radius`);
  }
  
  if (hasCircular) {
    if (zone.radius! <= 0) {
      throw new Error(`Zone ${zone.id} radius must be positive`);
    }
    
    if (Math.abs(zone.center!.latitude) > 90) {
      throw new Error(`Zone ${zone.id} latitude must be between -90 and 90`);
    }
    
    if (Math.abs(zone.center!.longitude) > 180) {
      throw new Error(`Zone ${zone.id} longitude must be between -180 and 180`);
    }
  }
}

/**
 * Convert polygon zone to circular representation
 * Uses minimum bounding circle algorithm
 */
export function polygonToCircle(zone: GeofenceZone): {
  center: { latitude: number; longitude: number };
  radius: number;
} {
  if (!zone.coordinates || zone.coordinates.length < 3) {
    throw new Error(`Zone ${zone.id} has insufficient coordinates for conversion`);
  }

  // Calculate centroid
  let sumLat = 0;
  let sumLon = 0;
  
  zone.coordinates.forEach(coord => {
    sumLat += coord.lat;
    sumLon += coord.lon;
  });
  
  const centerLat = sumLat / zone.coordinates.length;
  const centerLon = sumLon / zone.coordinates.length;
  
  // Find maximum distance from centroid to any vertex
  let maxDistance = 0;
  
  zone.coordinates.forEach(coord => {
    const distance = haversineDistance(
      centerLat, 
      centerLon, 
      coord.lat, 
      coord.lon
    );
    maxDistance = Math.max(maxDistance, distance);
  });
  
  // Add 10% buffer for safety (accounts for GPS accuracy)
  const radiusWithBuffer = Math.ceil(maxDistance * 1.1);
  
  return {
    center: {
      latitude: centerLat,
      longitude: centerLon
    },
    radius: radiusWithBuffer
  };
}

/**
 * Create a hybrid zone that has both representations
 * Used during migration period
 */
export function createHybridZone(zone: GeofenceZone): GeofenceZone {
  const validatedZone = { ...zone };
  
  // If it's already hybrid, return as-is
  if (isCircularZone(zone) && isPolygonZone(zone)) {
    return validatedZone;
  }
  
  // If circular, generate polygon approximation
  if (isCircularZone(zone) && !isPolygonZone(zone)) {
    validatedZone.coordinates = generatePolygonFromCircle(
      zone.center!,
      zone.radius!,
      16 // 16-sided polygon for good approximation
    );
    validatedZone.zoneType = 'circle';
  }
  
  // If polygon, generate circular approximation
  if (isPolygonZone(zone) && !isCircularZone(zone)) {
    const circle = polygonToCircle(zone);
    validatedZone.center = circle.center;
    validatedZone.radius = circle.radius;
    validatedZone.zoneType = 'polygon';
  }
  
  return validatedZone;
}

/**
 * Generate polygon coordinates from a circle
 * Used for backward compatibility
 */
export function generatePolygonFromCircle(
  center: { latitude: number; longitude: number },
  radius: number,
  sides: number = 16
): Array<{ lat: number; lon: number }> {
  const coordinates: Array<{ lat: number; lon: number }> = [];
  const radiusInDegrees = radius / 111000; // Rough conversion
  
  for (let i = 0; i < sides; i++) {
    const angle = (2 * Math.PI * i) / sides;
    const lat = center.latitude + radiusInDegrees * Math.sin(angle);
    const lon = center.longitude + radiusInDegrees * Math.cos(angle) / Math.cos(center.latitude * Math.PI / 180);
    
    coordinates.push({ lat, lon });
  }
  
  return coordinates;
}

/**
 * Calculate distance between two points using Haversine formula
 */
export function haversineDistance(
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

/**
 * Check if a point is inside a circle
 * More efficient than polygon checking
 */
export function isPointInCircle(
  lat: number,
  lon: number,
  center: { latitude: number; longitude: number },
  radius: number
): boolean {
  const distance = haversineDistance(lat, lon, center.latitude, center.longitude);
  return distance <= radius;
}

/**
 * Get all zones that need native monitoring
 * Filters and prioritizes zones for platform limits
 */
export function getZonesForNativeMonitoring(
  zones: GeofenceZone[],
  currentLocation: { lat: number; lon: number },
  platformLimit: number
): GeofenceZone[] {
  // Filter active zones
  const activeZones = zones.filter(z => z.isActive);
  
  // If within limit, return all
  if (activeZones.length <= platformLimit) {
    return activeZones;
  }
  
  // Sort by distance from current location
  const zonesWithDistance = activeZones.map(zone => {
    let distance: number;
    
    if (isCircularZone(zone)) {
      distance = haversineDistance(
        currentLocation.lat,
        currentLocation.lon,
        zone.center!.latitude,
        zone.center!.longitude
      );
    } else {
      // For polygons, use the converted circle center
      const circle = polygonToCircle(zone);
      distance = haversineDistance(
        currentLocation.lat,
        currentLocation.lon,
        circle.center.latitude,
        circle.center.longitude
      );
    }
    
    return { zone, distance };
  });
  
  // Sort by distance and take closest zones
  zonesWithDistance.sort((a, b) => a.distance - b.distance);
  
  return zonesWithDistance
    .slice(0, platformLimit)
    .map(item => item.zone);
}