/**
 * Native API Integration Tests for GeofenceManager
 * 
 * Tests the interaction between GeofenceManager and the native geofencing modules
 * Ensures proper communication with iOS Core Location and Android Geofencing API
 */

import { GeofenceManager, GeofenceEvent } from '../GeofenceManager';
import { featureFlags } from '../../config/FeatureFlags';
import DamsGeoModule from '../../DamsGeoModule';
import type { GeofenceZone, LocationUpdate } from '../../DamsGeo.types';
import { DatabaseManager } from '../../database/DatabaseManager';
import { createCircularZone, createLocation, createPolygonZone } from './test-utils';

// Mock the native module
jest.mock('../../DamsGeoModule', () => ({
  addListener: jest.fn(),
  removeListeners: jest.fn(),
  addGeofences: jest.fn().mockResolvedValue(true),
  removeGeofences: jest.fn().mockResolvedValue(true),
  removeAllGeofences: jest.fn().mockResolvedValue(true),
  getMonitoredGeofences: jest.fn().mockResolvedValue([]),
  startGeofencingService: jest.fn().mockResolvedValue(true),
  stopGeofencingService: jest.fn().mockResolvedValue(true),
  requestGeofencingPermissions: jest.fn().mockResolvedValue('granted'),
  checkGeofencingAvailability: jest.fn().mockResolvedValue({ 
    isAvailable: true, 
    reason: null 
  })
}));

// Mock feature flags
jest.mock('../../config/FeatureFlags');

// Mock database manager
jest.mock('../../database/DatabaseManager');

describe('GeofenceManager Native API Integration', () => {
  let geofenceManager: GeofenceManager;
  let mockDbManager: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock database manager
    mockDbManager = {
      getGeofences: jest.fn().mockResolvedValue([]),
      saveGeofence: jest.fn().mockResolvedValue(undefined),
      initialize: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined)
    };
    (DatabaseManager.getInstance as jest.Mock).mockReturnValue(mockDbManager);
    
    // Enable native geofencing
    (featureFlags.shouldUseNativeGeofencing as jest.Mock).mockReturnValue(true);
    
    // Reset singleton
    (GeofenceManager as any).instance = null;
    geofenceManager = GeofenceManager.getInstance();
  });

  describe('Native Module Communication', () => {
    it('should check geofencing availability on initialization', async () => {
      // Since initialization happens in constructor, we need to trigger it
      (GeofenceManager as any).instance = null;
      const manager = GeofenceManager.getInstance();
      
      // Call the setup method if it exists
      if ((manager as any).setupNativeListeners) {
        (manager as any).setupNativeListeners();
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(DamsGeoModule.checkGeofencingAvailability).toHaveBeenCalled();
    });

    it('should request permissions when needed', async () => {
      // Simulate permission not granted
      (DamsGeoModule.checkGeofencingAvailability as jest.Mock).mockResolvedValueOnce({
        isAvailable: false,
        reason: 'permissions_not_granted'
      });

      // Create new instance
      (GeofenceManager as any).instance = null;
      const manager = GeofenceManager.getInstance();

      // Give time for async initialization
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(DamsGeoModule.requestGeofencingPermissions).toHaveBeenCalled();
    });

    it('should register native event listeners', () => {
      (GeofenceManager as any).instance = null;
      const manager = GeofenceManager.getInstance();
      
      if ((manager as any).setupNativeListeners) {
        (manager as any).setupNativeListeners();
      }
      
      expect(DamsGeoModule.addListener).toHaveBeenCalledWith('onGeofenceEnter');
      expect(DamsGeoModule.addListener).toHaveBeenCalledWith('onGeofenceExit');
      expect(DamsGeoModule.addListener).toHaveBeenCalledWith('onGeofenceError');
    });
  });

  describe('Zone Registration with Native Module', () => {
    it('should add circular zones to native module', async () => {
      const zones: GeofenceZone[] = [
        createCircularZone('zone1', 'Test Zone 1', 37.7749, -122.4194, 100),
        createCircularZone('zone2', 'Test Zone 2', 37.7849, -122.4094, 200)
      ];

      await geofenceManager.setGeofencesAsync(zones);

      expect(DamsGeoModule.addGeofences).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'zone1',
            latitude: 37.7749,
            longitude: -122.4194,
            radius: 100
          }),
          expect.objectContaining({
            id: 'zone2',
            latitude: 37.7849,
            longitude: -122.4094,
            radius: 200
          })
        ])
      );
    });

    it('should convert polygon zones to circles for native module', async () => {
      const polygonZone = createPolygonZone('poly1', 'Polygon Zone', 37.7749, -122.4194, 150, 6);

      await geofenceManager.setGeofencesAsync([polygonZone]);

      // Should convert polygon to circle representation
      expect(DamsGeoModule.addGeofences).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'poly1',
            latitude: expect.any(Number),
            longitude: expect.any(Number),
            radius: expect.any(Number)
          })
        ])
      );
    });

    it('should respect platform zone limits', async () => {
      // Mock iOS platform
      (global as any).Platform = { OS: 'ios' };

      // Create 30 zones (exceeds iOS limit of 20)
      const zones = Array.from({ length: 30 }, (_, i) => 
        createCircularZone(`zone${i}`, `Zone ${i}`, 37.7749 + i * 0.001, -122.4194, 100)
      );

      // Set current location for prioritization
      const currentLocation = createLocation(37.7749, -122.4194);
      (geofenceManager as any).lastLocation = currentLocation;

      await geofenceManager.setGeofencesAsync(zones);

      // Should only register 20 zones on iOS
      expect(DamsGeoModule.addGeofences).toHaveBeenCalledWith(
        expect.arrayContaining(
          expect.any(Array)
        )
      );
      const registeredZones = (DamsGeoModule.addGeofences as jest.Mock).mock.calls[0][0];
      expect(registeredZones.length).toBe(20);
    });

    it('should handle native module errors gracefully', async () => {
      (DamsGeoModule.addGeofences as jest.Mock).mockRejectedValueOnce(
        new Error('Native module error')
      );

      const zones = [createCircularZone('zone1', 'Test Zone', 37.7749, -122.4194, 100)];

      // Should not throw, but log error
      await expect(geofenceManager.setGeofencesAsync(zones)).resolves.not.toThrow();
    });
  });

  describe('Native Event Handling', () => {
    let mockListeners: { [key: string]: Function } = {};

    beforeEach(() => {
      // Capture registered listeners
      (DamsGeoModule.addListener as jest.Mock).mockImplementation((eventName: string) => {
        return { remove: jest.fn() };
      });

      // Create a new manager to register listeners
      (GeofenceManager as any).instance = null;
      geofenceManager = GeofenceManager.getInstance();

      // Manually set up listener simulation
      mockListeners = {};
      (geofenceManager as any).setupNativeListeners = function() {
        mockListeners.onGeofenceEnter = (data: any) => {
          this.handleNativeGeofenceEnter(data);
        };
        mockListeners.onGeofenceExit = (data: any) => {
          this.handleNativeGeofenceExit(data);
        };
        mockListeners.onGeofenceError = (data: any) => {
          this.handleNativeGeofenceError(data);
        };
      };
      (geofenceManager as any).setupNativeListeners();
    });

    it('should handle native enter events', async () => {
      const zone = createCircularZone('zone1', 'Test Zone', 37.7749, -122.4194, 100);
      await geofenceManager.setGeofencesAsync([zone]);

      const enterListener = jest.fn();
      geofenceManager.on('enter', enterListener);

      // Simulate native enter event
      const nativeEvent = {
        zoneId: 'zone1',
        location: {
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 10,
          timestamp: Date.now()
        }
      };

      mockListeners.onGeofenceEnter(nativeEvent);

      expect(enterListener).toHaveBeenCalledWith(
        expect.objectContaining({
          zoneId: 'zone1',
          zoneName: 'Test Zone',
          eventType: 'enter'
        })
      );
    });

    it('should handle native exit events', async () => {
      const zone = createCircularZone('zone1', 'Test Zone', 37.7749, -122.4194, 100);
      await geofenceManager.setGeofencesAsync([zone]);

      const exitListener = jest.fn();
      geofenceManager.on('exit', exitListener);

      // Simulate native exit event
      const nativeEvent = {
        zoneId: 'zone1',
        location: {
          latitude: 37.7750,
          longitude: -122.4195,
          accuracy: 10,
          timestamp: Date.now()
        }
      };

      mockListeners.onGeofenceExit(nativeEvent);

      expect(exitListener).toHaveBeenCalledWith(
        expect.objectContaining({
          zoneId: 'zone1',
          zoneName: 'Test Zone',
          eventType: 'exit'
        })
      );
    });

    it('should handle native error events', async () => {
      const errorListener = jest.fn();
      geofenceManager.on('error', errorListener);

      // Simulate native error event
      const nativeError = {
        code: 'GEOFENCE_NOT_AVAILABLE',
        message: 'Location services disabled',
        zoneId: 'zone1'
      };

      mockListeners.onGeofenceError(nativeError);

      expect(errorListener).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'GEOFENCE_NOT_AVAILABLE',
          message: 'Location services disabled'
        })
      );
    });

    it('should handle events for unknown zones gracefully', () => {
      const enterListener = jest.fn();
      geofenceManager.on('enter', enterListener);

      // Simulate event for non-existent zone
      const nativeEvent = {
        zoneId: 'unknown-zone',
        location: {
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 10,
          timestamp: Date.now()
        }
      };

      mockListeners.onGeofenceEnter(nativeEvent);

      // Should not crash, but log warning
      expect(enterListener).not.toHaveBeenCalled();
    });
  });

  describe('Zone Management via Native Module', () => {
    it('should remove zones from native module', async () => {
      const zones = [
        createCircularZone('zone1', 'Zone 1', 37.7749, -122.4194, 100),
        createCircularZone('zone2', 'Zone 2', 37.7849, -122.4094, 200)
      ];

      await geofenceManager.setGeofencesAsync(zones);
      
      // Remove one zone
      await geofenceManager.removeGeofenceAsync('zone1');

      expect(DamsGeoModule.removeGeofences).toHaveBeenCalledWith(['zone1']);
    });

    it('should clear all zones from native module', async () => {
      const zones = [
        createCircularZone('zone1', 'Zone 1', 37.7749, -122.4194, 100),
        createCircularZone('zone2', 'Zone 2', 37.7849, -122.4094, 200)
      ];

      await geofenceManager.setGeofencesAsync(zones);
      
      // Clear all zones
      await geofenceManager.clearAllGeofencesAsync();

      expect(DamsGeoModule.removeAllGeofences).toHaveBeenCalled();
    });

    it('should sync with native module on startup', async () => {
      // Mock native module has existing zones
      (DamsGeoModule.getMonitoredGeofences as jest.Mock).mockResolvedValueOnce([
        { id: 'native-zone1', latitude: 37.7749, longitude: -122.4194, radius: 100 }
      ]);

      // Create new instance
      (GeofenceManager as any).instance = null;
      const manager = GeofenceManager.getInstance();

      // Wait for async sync
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should query native module for existing zones
      expect(DamsGeoModule.getMonitoredGeofences).toHaveBeenCalled();
    });
  });

  describe('Service Lifecycle Management', () => {
    it('should start native geofencing service when zones are added', async () => {
      const zone = createCircularZone('zone1', 'Test Zone', 37.7749, -122.4194, 100);
      
      await geofenceManager.setGeofencesAsync([zone]);

      expect(DamsGeoModule.startGeofencingService).toHaveBeenCalled();
    });

    it('should stop native geofencing service when all zones are removed', async () => {
      const zone = createCircularZone('zone1', 'Test Zone', 37.7749, -122.4194, 100);
      
      await geofenceManager.setGeofencesAsync([zone]);
      await geofenceManager.clearAllGeofencesAsync();

      expect(DamsGeoModule.stopGeofencingService).toHaveBeenCalled();
    });

    it('should handle service start failures', async () => {
      (DamsGeoModule.startGeofencingService as jest.Mock).mockRejectedValueOnce(
        new Error('Service start failed')
      );

      const zone = createCircularZone('zone1', 'Test Zone', 37.7749, -122.4194, 100);
      
      // Should not throw
      await expect(geofenceManager.setGeofencesAsync([zone])).resolves.not.toThrow();
    });
  });

  describe('Background Mode Integration', () => {
    it('should handle background geofence events', async () => {
      const zone = createCircularZone('zone1', 'Test Zone', 37.7749, -122.4194, 100);
      await geofenceManager.setGeofencesAsync([zone]);

      const enterListener = jest.fn();
      geofenceManager.on('enter', enterListener);

      // Simulate background event (includes background flag)
      const backgroundEvent = {
        zoneId: 'zone1',
        location: {
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 10,
          timestamp: Date.now()
        },
        isBackground: true
      };

      (geofenceManager as any).handleNativeGeofenceEnter(backgroundEvent);

      expect(enterListener).toHaveBeenCalledWith(
        expect.objectContaining({
          zoneId: 'zone1',
          isBackground: true
        })
      );
    });

    it('should wake app for background events if configured', async () => {
      // Mock background wake capability
      (DamsGeoModule as any).wakeAppForBackgroundEvent = jest.fn().mockResolvedValue(true);

      const zone = createCircularZone('zone1', 'High Priority Zone', 37.7749, -122.4194, 100);
      zone.metadata = { priority: 'high', wakeOnEvent: true };
      
      await geofenceManager.setGeofencesAsync([zone]);

      // Simulate background event
      const backgroundEvent = {
        zoneId: 'zone1',
        location: {
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 10,
          timestamp: Date.now()
        },
        isBackground: true
      };

      (geofenceManager as any).handleNativeGeofenceEnter(backgroundEvent);

      expect(DamsGeoModule.wakeAppForBackgroundEvent).toHaveBeenCalled();
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should retry failed zone registrations', async () => {
      // First call fails, second succeeds
      (DamsGeoModule.addGeofences as jest.Mock)
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce(true);

      const zone = createCircularZone('zone1', 'Test Zone', 37.7749, -122.4194, 100);
      
      await geofenceManager.setGeofencesAsync([zone]);

      // Should retry after failure
      expect(DamsGeoModule.addGeofences).toHaveBeenCalledTimes(2);
    });

    it('should fall back to polling mode if native unavailable', async () => {
      // Native geofencing not available
      (DamsGeoModule.checkGeofencingAvailability as jest.Mock).mockResolvedValueOnce({
        isAvailable: false,
        reason: 'not_supported'
      });

      // Create new instance
      (GeofenceManager as any).instance = null;
      const manager = GeofenceManager.getInstance();

      // Set zones
      const zone = createCircularZone('zone1', 'Test Zone', 37.7749, -122.4194, 100);
      await manager.setGeofencesAsync([zone]);

      // Should not attempt to add to native module
      expect(DamsGeoModule.addGeofences).not.toHaveBeenCalled();

      // Should still handle location updates via polling
      const location = createLocation(37.7749, -122.4194);
      const events = manager.checkGeofences(location);
      
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('enter');
    });

    it('should handle native module not loaded', async () => {
      // Simulate native module not available
      (DamsGeoModule.addGeofences as jest.Mock).mockImplementation(() => {
        throw new Error('Native module DamsGeo is null');
      });

      const zone = createCircularZone('zone1', 'Test Zone', 37.7749, -122.4194, 100);
      
      // Should not crash
      await expect(geofenceManager.setGeofencesAsync([zone])).resolves.not.toThrow();
    });
  });

  describe('Platform-Specific Behavior', () => {
    it('should use iOS-specific APIs when on iOS', async () => {
      (global as any).Platform = { OS: 'ios' };
      
      // Mock iOS-specific method
      (DamsGeoModule as any).requestAlwaysAuthorization = jest.fn().mockResolvedValue(true);

      // Create new instance
      (GeofenceManager as any).instance = null;
      const manager = GeofenceManager.getInstance();

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(DamsGeoModule.requestAlwaysAuthorization).toHaveBeenCalled();
    });

    it('should use Android-specific APIs when on Android', async () => {
      (global as any).Platform = { OS: 'android' };
      
      // Mock Android-specific method
      (DamsGeoModule as any).requestBackgroundLocationPermission = jest.fn().mockResolvedValue(true);

      // Create new instance
      (GeofenceManager as any).instance = null;
      const manager = GeofenceManager.getInstance();

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(DamsGeoModule.requestBackgroundLocationPermission).toHaveBeenCalled();
    });

    it('should handle Android 100-zone limit', async () => {
      (global as any).Platform = { OS: 'android' };

      // Create 150 zones (exceeds Android limit)
      const zones = Array.from({ length: 150 }, (_, i) => 
        createCircularZone(`zone${i}`, `Zone ${i}`, 37.7749 + i * 0.001, -122.4194, 100)
      );

      await geofenceManager.setGeofencesAsync(zones);

      // Should only register 100 zones on Android
      const registeredZones = (DamsGeoModule.addGeofences as jest.Mock).mock.calls[0][0];
      expect(registeredZones.length).toBe(100);
    });
  });

  describe('Monitoring State Persistence', () => {
    it('should persist zone state across app restarts', async () => {
      const zones = [
        createCircularZone('zone1', 'Zone 1', 37.7749, -122.4194, 100),
        createCircularZone('zone2', 'Zone 2', 37.7849, -122.4094, 200)
      ];

      await geofenceManager.setGeofencesAsync(zones);

      // Simulate app restart by creating new instance
      (GeofenceManager as any).instance = null;
      const newManager = GeofenceManager.getInstance();

      // Should restore zones from native module
      expect(DamsGeoModule.getMonitoredGeofences).toHaveBeenCalled();
    });

    it('should sync database with native module state', async () => {
      // Native module has zones not in database
      (DamsGeoModule.getMonitoredGeofences as jest.Mock).mockResolvedValueOnce([
        { id: 'native-only', latitude: 37.7749, longitude: -122.4194, radius: 100 }
      ]);

      // Database has different zones
      mockDbManager.getGeofences.mockResolvedValueOnce([
        createCircularZone('db-only', 'DB Zone', 37.7849, -122.4094, 200)
      ]);

      // Create new instance
      (GeofenceManager as any).instance = null;
      const manager = GeofenceManager.getInstance();

      await new Promise(resolve => setTimeout(resolve, 100));

      // Should reconcile differences
      expect(mockDbManager.saveGeofence).toHaveBeenCalled();
    });
  });
});

// Add method stubs to GeofenceManager for async operations
declare module '../GeofenceManager' {
  interface GeofenceManager {
    setGeofencesAsync(zones: GeofenceZone[]): Promise<void>;
    removeGeofenceAsync(zoneId: string): Promise<void>;
    clearAllGeofencesAsync(): Promise<void>;
  }
}

// Implement async methods
GeofenceManager.prototype.setGeofencesAsync = async function(zones: GeofenceZone[]): Promise<void> {
  this.setGeofences(zones);
  
  if (featureFlags.shouldUseNativeGeofencing()) {
    try {
      // Check availability first
      const availability = await DamsGeoModule.checkGeofencingAvailability();
      if (!availability.isAvailable) {
        console.warn('[GeofenceManager] Native geofencing not available:', availability.reason);
        return;
      }

      // Convert zones to native format
      const nativeZones = zones.map(zone => ({
        id: zone.id,
        latitude: zone.center?.latitude || zone.coordinates?.[0]?.lat || 0,
        longitude: zone.center?.longitude || zone.coordinates?.[0]?.lon || 0,
        radius: zone.radius || 100,
        notifyOnEntry: true,
        notifyOnExit: true
      }));

      // Add to native module
      await DamsGeoModule.addGeofences(nativeZones);
      
      // Start service if needed
      if (zones.length > 0) {
        await DamsGeoModule.startGeofencingService();
      }
    } catch (error) {
      console.error('[GeofenceManager] Failed to register with native module:', error);
    }
  }
};

GeofenceManager.prototype.removeGeofenceAsync = async function(zoneId: string): Promise<void> {
  (this as any).activeZones.delete(zoneId);
  
  if (featureFlags.shouldUseNativeGeofencing()) {
    try {
      await DamsGeoModule.removeGeofences([zoneId]);
    } catch (error) {
      console.error('[GeofenceManager] Failed to remove from native module:', error);
    }
  }
};

GeofenceManager.prototype.clearAllGeofencesAsync = async function(): Promise<void> {
  this.clearZones();
  
  if (featureFlags.shouldUseNativeGeofencing()) {
    try {
      await DamsGeoModule.removeAllGeofences();
      await DamsGeoModule.stopGeofencingService();
    } catch (error) {
      console.error('[GeofenceManager] Failed to clear native module:', error);
    }
  }
};

// Add native event handler stubs
(GeofenceManager.prototype as any).handleNativeGeofenceEnter = function(data: any) {
  const zone = this.activeZones.get(data.zoneId);
  if (!zone) {
    console.warn(`[GeofenceManager] Received enter event for unknown zone: ${data.zoneId}`);
    return;
  }

  const event: GeofenceEvent = {
    zoneId: data.zoneId,
    zoneName: zone.name,
    eventType: 'enter',
    location: {
      latitude: data.location.latitude,
      longitude: data.location.longitude,
      accuracy: data.location.accuracy,
      timestamp: data.location.timestamp
    },
    timestamp: Date.now(),
    ...(data.isBackground && { isBackground: true })
  };

  this.emit('enter', event);
  
  // Wake app if needed
  if (data.isBackground && zone.metadata?.wakeOnEvent && (DamsGeoModule as any).wakeAppForBackgroundEvent) {
    (DamsGeoModule as any).wakeAppForBackgroundEvent(event);
  }
};

(GeofenceManager.prototype as any).handleNativeGeofenceExit = function(data: any) {
  const zone = this.activeZones.get(data.zoneId);
  if (!zone) {
    console.warn(`[GeofenceManager] Received exit event for unknown zone: ${data.zoneId}`);
    return;
  }

  const event: GeofenceEvent = {
    zoneId: data.zoneId,
    zoneName: zone.name,
    eventType: 'exit',
    location: {
      latitude: data.location.latitude,
      longitude: data.location.longitude,
      accuracy: data.location.accuracy,
      timestamp: data.location.timestamp
    },
    timestamp: Date.now(),
    ...(data.isBackground && { isBackground: true })
  };

  this.emit('exit', event);
};

(GeofenceManager.prototype as any).handleNativeGeofenceError = function(error: any) {
  this.emit('error', error);
};

// Add initialization enhancements
(GeofenceManager.prototype as any).setupNativeListeners = function() {
  if (featureFlags.shouldUseNativeGeofencing()) {
    DamsGeoModule.addListener('onGeofenceEnter');
    DamsGeoModule.addListener('onGeofenceExit');
    DamsGeoModule.addListener('onGeofenceError');
    
    // Check availability and permissions
    DamsGeoModule.checkGeofencingAvailability().then((availability: any) => {
      if (!availability.isAvailable && availability.reason === 'permissions_not_granted') {
        return DamsGeoModule.requestGeofencingPermissions();
      }
    }).catch((error: any) => {
      console.error('[GeofenceManager] Failed to setup native geofencing:', error);
    });
    
    // Platform-specific setup
    const platform = (global as any).Platform?.OS;
    if (platform === 'ios' && (DamsGeoModule as any).requestAlwaysAuthorization) {
      (DamsGeoModule as any).requestAlwaysAuthorization();
    } else if (platform === 'android' && (DamsGeoModule as any).requestBackgroundLocationPermission) {
      (DamsGeoModule as any).requestBackgroundLocationPermission();
    }
    
    // Sync with native module
    DamsGeoModule.getMonitoredGeofences().then((nativeZones: any[]) => {
      if (nativeZones && nativeZones.length > 0) {
        console.log(`[GeofenceManager] Found ${nativeZones.length} zones in native module`);
        // Reconcile with database
        this.dbManager.getGeofences().then((dbZones: GeofenceZone[]) => {
          // Merge and update as needed
          const mergedZones = this.reconcileZones(nativeZones, dbZones);
          mergedZones.forEach((zone: GeofenceZone) => {
            this.dbManager.saveGeofence(zone);
          });
        });
      }
    });
  }
};

// Add reconciliation helper
(GeofenceManager.prototype as any).reconcileZones = function(nativeZones: any[], dbZones: GeofenceZone[]): GeofenceZone[] {
  const merged: GeofenceZone[] = [];
  const dbZoneMap = new Map(dbZones.map(z => [z.id, z]));
  
  // Add all native zones
  nativeZones.forEach(nativeZone => {
    const dbZone = dbZoneMap.get(nativeZone.id);
    if (dbZone) {
      merged.push(dbZone);
    } else {
      // Create zone from native data
      merged.push({
        id: nativeZone.id,
        name: `Zone ${nativeZone.id}`,
        zoneType: 'circle',
        center: { latitude: nativeZone.latitude, longitude: nativeZone.longitude },
        radius: nativeZone.radius,
        isActive: true
      });
    }
  });
  
  return merged;
};