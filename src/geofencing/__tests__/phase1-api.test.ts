/**
 * Phase 1 API Evolution Tests
 * 
 * Validates that the TypeScript API correctly supports
 * both polygon and circular zones during migration.
 */

import { 
  isCircularZone,
  isPolygonZone,
  getZoneType,
  validateZone,
  polygonToCircle,
  createHybridZone,
  isPointInCircle,
  generatePolygonFromCircle
} from '../GeofenceHelpers';
import { GeofenceZone } from '../../DamsGeo.types';

describe('Phase 1: TypeScript API Evolution', () => {
  
  describe('Zone Type Detection', () => {
    it('should correctly identify circular zones', () => {
      const circularZone: GeofenceZone = {
        id: 'circle1',
        name: 'Circular Zone',
        center: { latitude: 37.7749, longitude: -122.4194 },
        radius: 100,
        isActive: true
      };
      
      expect(isCircularZone(circularZone)).toBe(true);
      expect(isPolygonZone(circularZone)).toBe(false);
      expect(getZoneType(circularZone)).toBe('circle');
    });

    it('should correctly identify polygon zones', () => {
      const polygonZone: GeofenceZone = {
        id: 'poly1',
        name: 'Polygon Zone',
        coordinates: [
          { lat: 37.7740, lon: -122.4200 },
          { lat: 37.7760, lon: -122.4200 },
          { lat: 37.7760, lon: -122.4180 },
          { lat: 37.7740, lon: -122.4180 }
        ],
        isActive: true
      };
      
      expect(isPolygonZone(polygonZone)).toBe(true);
      expect(isCircularZone(polygonZone)).toBe(false);
      expect(getZoneType(polygonZone)).toBe('polygon');
    });

    it('should handle hybrid zones with both representations', () => {
      const hybridZone: GeofenceZone = {
        id: 'hybrid1',
        name: 'Hybrid Zone',
        coordinates: [
          { lat: 37.7740, lon: -122.4200 },
          { lat: 37.7760, lon: -122.4200 },
          { lat: 37.7760, lon: -122.4180 },
          { lat: 37.7740, lon: -122.4180 }
        ],
        center: { latitude: 37.7750, longitude: -122.4190 },
        radius: 150,
        zoneType: 'polygon',
        isActive: true
      };
      
      expect(isPolygonZone(hybridZone)).toBe(true);
      expect(isCircularZone(hybridZone)).toBe(true);
      expect(getZoneType(hybridZone)).toBe('polygon'); // Explicit type takes precedence
    });
  });

  describe('Zone Validation', () => {
    it('should validate valid circular zones', () => {
      const validZone: GeofenceZone = {
        id: 'valid1',
        name: 'Valid Circle',
        center: { latitude: 37.7749, longitude: -122.4194 },
        radius: 100,
        isActive: true
      };
      
      expect(() => validateZone(validZone)).not.toThrow();
    });

    it('should reject zones without required fields', () => {
      const invalidZone: GeofenceZone = {
        id: 'invalid1',
        name: 'Invalid Zone',
        isActive: true
        // Missing both coordinates and center+radius
      };
      
      expect(() => validateZone(invalidZone)).toThrow();
    });

    it('should reject circular zones with invalid radius', () => {
      const invalidRadius: GeofenceZone = {
        id: 'invalid2',
        name: 'Invalid Radius',
        center: { latitude: 37.7749, longitude: -122.4194 },
        radius: -50, // Invalid negative radius
        isActive: true
      };
      
      expect(() => validateZone(invalidRadius)).toThrow(/radius must be positive/);
    });

    it('should reject zones with invalid coordinates', () => {
      const invalidCoords: GeofenceZone = {
        id: 'invalid3',
        name: 'Invalid Coords',
        center: { latitude: 100, longitude: -200 }, // Invalid lat/lon
        radius: 100,
        isActive: true
      };
      
      expect(() => validateZone(invalidCoords)).toThrow(/latitude must be between/);
    });
  });

  describe('Polygon to Circle Conversion', () => {
    it('should convert square polygon to bounding circle', () => {
      const squareZone: GeofenceZone = {
        id: 'square1',
        name: 'Square',
        coordinates: [
          { lat: 37.7740, lon: -122.4200 },
          { lat: 37.7760, lon: -122.4200 },
          { lat: 37.7760, lon: -122.4180 },
          { lat: 37.7740, lon: -122.4180 }
        ],
        isActive: true
      };
      
      const circle = polygonToCircle(squareZone);
      
      expect(circle.center.latitude).toBeCloseTo(37.7750, 4);
      expect(circle.center.longitude).toBeCloseTo(-122.4190, 4);
      expect(circle.radius).toBeGreaterThan(140); // Diagonal with buffer
      expect(circle.radius).toBeLessThan(160);
    });

    it('should handle irregular polygons', () => {
      const irregularZone: GeofenceZone = {
        id: 'irregular1',
        name: 'Irregular',
        coordinates: [
          { lat: 37.7740, lon: -122.4200 },
          { lat: 37.7765, lon: -122.4195 },
          { lat: 37.7755, lon: -122.4175 },
          { lat: 37.7735, lon: -122.4185 }
        ],
        isActive: true
      };
      
      const circle = polygonToCircle(irregularZone);
      
      expect(circle.center.latitude).toBeDefined();
      expect(circle.center.longitude).toBeDefined();
      expect(circle.radius).toBeGreaterThan(0);
    });
  });

  describe('Hybrid Zone Creation', () => {
    it('should create polygon approximation from circle', () => {
      const circularZone: GeofenceZone = {
        id: 'circle2',
        name: 'Circle',
        center: { latitude: 37.7749, longitude: -122.4194 },
        radius: 100,
        isActive: true
      };
      
      const hybrid = createHybridZone(circularZone);
      
      expect(hybrid.coordinates).toBeDefined();
      expect(hybrid.coordinates!.length).toBe(16); // 16-sided polygon
      expect(hybrid.center).toEqual(circularZone.center);
      expect(hybrid.radius).toEqual(circularZone.radius);
      expect(hybrid.zoneType).toBe('circle');
    });

    it('should create circle approximation from polygon', () => {
      const polygonZone: GeofenceZone = {
        id: 'poly2',
        name: 'Polygon',
        coordinates: [
          { lat: 37.7740, lon: -122.4200 },
          { lat: 37.7760, lon: -122.4200 },
          { lat: 37.7760, lon: -122.4180 },
          { lat: 37.7740, lon: -122.4180 }
        ],
        isActive: true
      };
      
      const hybrid = createHybridZone(polygonZone);
      
      expect(hybrid.center).toBeDefined();
      expect(hybrid.radius).toBeDefined();
      expect(hybrid.coordinates).toEqual(polygonZone.coordinates);
      expect(hybrid.zoneType).toBe('polygon');
    });

    it('should not modify already hybrid zones', () => {
      const alreadyHybrid: GeofenceZone = {
        id: 'hybrid2',
        name: 'Already Hybrid',
        coordinates: [{ lat: 0, lon: 0 }, { lat: 1, lon: 0 }, { lat: 1, lon: 1 }],
        center: { latitude: 0.5, longitude: 0.5 },
        radius: 50,
        isActive: true
      };
      
      const result = createHybridZone(alreadyHybrid);
      
      expect(result).toEqual(alreadyHybrid);
    });
  });

  describe('Circular Zone Operations', () => {
    it('should correctly check point in circle', () => {
      const center = { latitude: 37.7749, longitude: -122.4194 };
      const radius = 100; // meters
      
      // Point at center
      expect(isPointInCircle(37.7749, -122.4194, center, radius)).toBe(true);
      
      // Point 50m away (inside)
      expect(isPointInCircle(37.7753, -122.4194, center, radius)).toBe(true);
      
      // Point 150m away (outside)
      expect(isPointInCircle(37.7763, -122.4194, center, radius)).toBe(false);
    });

    it('should generate correct polygon from circle', () => {
      const center = { latitude: 37.7749, longitude: -122.4194 };
      const radius = 100;
      
      const polygon = generatePolygonFromCircle(center, radius, 8);
      
      expect(polygon.length).toBe(8);
      
      // All points should be approximately radius distance from center
      polygon.forEach(point => {
        const distance = Math.sqrt(
          Math.pow((point.lat - center.latitude) * 111000, 2) +
          Math.pow((point.lon - center.longitude) * 111000 * Math.cos(center.latitude * Math.PI / 180), 2)
        );
        expect(distance).toBeCloseTo(radius, -1);
      });
    });
  });

  describe('Database Schema Compatibility', () => {
    it('should prepare zones for new database schema', () => {
      const mixedZones: GeofenceZone[] = [
        {
          id: 'old1',
          name: 'Legacy Polygon',
          coordinates: [
            { lat: 37.7740, lon: -122.4200 },
            { lat: 37.7760, lon: -122.4200 },
            { lat: 37.7760, lon: -122.4180 }
          ],
          isActive: true
        },
        {
          id: 'new1',
          name: 'New Circle',
          center: { latitude: 37.7749, longitude: -122.4194 },
          radius: 100,
          isActive: true
        }
      ];
      
      // Process zones for storage
      const processedZones = mixedZones.map(zone => createHybridZone(zone));
      
      // Both should now have all fields needed for migration
      processedZones.forEach(zone => {
        if (zone.zoneType === 'polygon') {
          expect(zone.coordinates).toBeDefined();
          expect(zone.center).toBeDefined(); // Added by hybrid creation
          expect(zone.radius).toBeDefined(); // Added by hybrid creation
        } else {
          expect(zone.center).toBeDefined();
          expect(zone.radius).toBeDefined();
          expect(zone.coordinates).toBeDefined(); // Added by hybrid creation
        }
      });
    });
  });
});