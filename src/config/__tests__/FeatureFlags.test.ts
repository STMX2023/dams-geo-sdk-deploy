/**
 * Unit Tests for FeatureFlags
 * 
 * Tests the feature flag system for geofencing migration
 */

import { FeatureFlagManager, featureFlags, FeatureFlagConfig, FeatureFlags } from '../FeatureFlags';

// Store original NODE_ENV
const originalNodeEnv = process.env.NODE_ENV;

describe('FeatureFlags', () => {
  let manager: FeatureFlagManager;
  
  beforeEach(() => {
    // Reset singleton instance
    (FeatureFlagManager as any).instance = null;
    manager = FeatureFlagManager.getInstance();
    
    // Mock environment
    Object.defineProperty(process.env, 'NODE_ENV', {
      configurable: true,
      enumerable: true,
      value: 'test'
    });
  });
  
  afterEach(() => {
    // Reset singleton instance
    (FeatureFlagManager as any).instance = null;
    
    // Restore original NODE_ENV
    Object.defineProperty(process.env, 'NODE_ENV', {
      configurable: true,
      enumerable: true,
      value: originalNodeEnv
    });
  });
  
  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = FeatureFlagManager.getInstance();
      const instance2 = FeatureFlagManager.getInstance();
      expect(instance1).toBe(instance2);
    });
    
    it('should export singleton instance as featureFlags', () => {
      // featureFlags is a different singleton instance created at module load
      expect(featureFlags).toBeInstanceOf(FeatureFlagManager);
    });
  });
  
  describe('Initialization', () => {
    it('should initialize with default flags', async () => {
      await manager.initialize({});
      
      const flags = manager.getFlags();
      expect(flags).toEqual({
        useNativeGeofencing: true, // Test env gets development defaults
        nativeGeofencingRolloutPercentage: 100,
        enableGeofencingDebugLogs: true,
        forcePolygonMode: false
      });
    });
    
    it('should apply configuration overrides', async () => {
      await manager.initialize({
        overrides: {
          useNativeGeofencing: true,
          nativeGeofencingRolloutPercentage: 50
        }
      });
      
      const flags = manager.getFlags();
      expect(flags.useNativeGeofencing).toBe(true);
      expect(flags.nativeGeofencingRolloutPercentage).toBe(50);
    });
    
    it('should apply platform-specific configuration', async () => {
      await manager.initialize({
        platform: 'ios',
        userId: 'test-user'
      });
      
      // iOS should have limited rollout percentage
      const flags = manager.getFlags();
      expect(flags.nativeGeofencingRolloutPercentage).toBeLessThanOrEqual(50);
    });
    
    it('should store configuration for later use', async () => {
      const config: FeatureFlagConfig = {
        userId: 'user123',
        deviceId: 'device456',
        platform: 'android',
        appVersion: '1.2.3'
      };
      
      await manager.initialize(config);
      
      const debugInfo = manager.getDebugInfo();
      expect(debugInfo.userId).toBe('user123');
      expect(debugInfo.platform).toBe('android');
    });
  });
  
  describe('Remote Flag Loading', () => {
    it('should load production defaults in production', async () => {
      Object.defineProperty(process.env, 'NODE_ENV', {
        configurable: true,
        enumerable: true,
        value: 'production'
      });
      
      await manager.initialize({});
      
      const flags = manager.getFlags();
      expect(flags.useNativeGeofencing).toBe(true);
      expect(flags.nativeGeofencingRolloutPercentage).toBe(5); // Conservative start
      expect(flags.enableGeofencingDebugLogs).toBe(false);
    });
    
    it('should load development defaults in development', async () => {
      Object.defineProperty(process.env, 'NODE_ENV', {
        configurable: true,
        enumerable: true,
        value: 'development'
      });
      
      await manager.initialize({});
      
      const flags = manager.getFlags();
      expect(flags.useNativeGeofencing).toBe(true);
      expect(flags.nativeGeofencingRolloutPercentage).toBe(100);
      expect(flags.enableGeofencingDebugLogs).toBe(true);
    });
    
    it('should handle remote loading errors gracefully', async () => {
      // Mock console.error to verify error logging
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      
      // Force an error by manipulating the environment
      Object.defineProperty(process.env, 'NODE_ENV', {
        get() { throw new Error('Environment error'); }
      });
      
      await manager.initialize({});
      
      // Should fall back to safe defaults
      const flags = manager.getFlags();
      expect(flags.useNativeGeofencing).toBe(false);
      expect(flags.nativeGeofencingRolloutPercentage).toBe(0);
      
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to load remote feature flags:',
        expect.any(Error)
      );
      
      consoleError.mockRestore();
    });
  });
  
  describe('Native Geofencing Decision', () => {
    it('should return false when forcePolygonMode is true', async () => {
      await manager.initialize({
        overrides: {
          useNativeGeofencing: true,
          nativeGeofencingRolloutPercentage: 100,
          forcePolygonMode: true
        }
      });
      
      expect(manager.shouldUseNativeGeofencing()).toBe(false);
    });
    
    it('should return false when useNativeGeofencing is false', async () => {
      await manager.initialize({
        overrides: {
          useNativeGeofencing: false,
          nativeGeofencingRolloutPercentage: 100
        }
      });
      
      expect(manager.shouldUseNativeGeofencing()).toBe(false);
    });
    
    it('should return false when user not in rollout', async () => {
      await manager.initialize({
        userId: 'user123',
        overrides: {
          useNativeGeofencing: true,
          nativeGeofencingRolloutPercentage: 0
        }
      });
      
      expect(manager.shouldUseNativeGeofencing()).toBe(false);
    });
    
    it('should return true when user in rollout', async () => {
      await manager.initialize({
        userId: 'user123',
        overrides: {
          useNativeGeofencing: true,
          nativeGeofencingRolloutPercentage: 100
        }
      });
      
      expect(manager.shouldUseNativeGeofencing()).toBe(true);
    });
    
    it('should return false when no userId provided', async () => {
      await manager.initialize({
        overrides: {
          useNativeGeofencing: true,
          nativeGeofencingRolloutPercentage: 50
        }
      });
      
      expect(manager.shouldUseNativeGeofencing()).toBe(false);
    });
  });
  
  describe('Rollout Percentage', () => {
    it('should consistently hash users', async () => {
      // Test that same user always gets same result
      const userId = 'consistent-user';
      
      await manager.initialize({
        userId,
        overrides: {
          useNativeGeofencing: true,
          nativeGeofencingRolloutPercentage: 50
        }
      });
      
      const result1 = manager.shouldUseNativeGeofencing();
      
      // Reinitialize and check again
      await manager.initialize({
        userId,
        overrides: {
          useNativeGeofencing: true,
          nativeGeofencingRolloutPercentage: 50
        }
      });
      
      const result2 = manager.shouldUseNativeGeofencing();
      
      expect(result1).toBe(result2);
    });
    
    it('should distribute users across rollout percentage', async () => {
      const results = { included: 0, excluded: 0 };
      
      // Test 100 different users
      for (let i = 0; i < 100; i++) {
        await manager.initialize({
          userId: `user-${i}`,
          overrides: {
            useNativeGeofencing: true,
            nativeGeofencingRolloutPercentage: 30 // 30% rollout
          }
        });
        
        if (manager.shouldUseNativeGeofencing()) {
          results.included++;
        } else {
          results.excluded++;
        }
      }
      
      // Should be roughly 30% included (with some variance)
      expect(results.included).toBeGreaterThan(15);
      expect(results.included).toBeLessThan(45);
    });
  });
  
  describe('Flag Management', () => {
    it('should update individual flags', async () => {
      await manager.initialize({});
      
      manager.setFlag('enableGeofencingDebugLogs', true);
      
      const flags = manager.getFlags();
      expect(flags.enableGeofencingDebugLogs).toBe(true);
    });
    
    it('should clear all overrides', async () => {
      await manager.initialize({
        overrides: {
          useNativeGeofencing: true,
          enableGeofencingDebugLogs: true
        }
      });
      
      manager.clearOverrides();
      
      const flags = manager.getFlags();
      // Should revert to remote flags (test environment defaults)
      expect(flags.useNativeGeofencing).toBe(true); // Test env gets dev defaults
    });
    
    it('should return immutable flag object', async () => {
      await manager.initialize({});
      
      const flags1 = manager.getFlags();
      const flags2 = manager.getFlags();
      
      // Should be different objects
      expect(flags1).not.toBe(flags2);
      
      // Modifying returned object shouldn't affect internal state
      (flags1 as any).useNativeGeofencing = false;
      
      const flags3 = manager.getFlags();
      expect(flags3.useNativeGeofencing).toBe(true); // Should not be affected by mutation
    });
  });
  
  describe('Refresh', () => {
    it('should refresh flags from remote', async () => {
      await manager.initialize({
        overrides: {
          useNativeGeofencing: false
        }
      });
      
      // Change environment to trigger different remote flags
      Object.defineProperty(process.env, 'NODE_ENV', {
        configurable: true,
        enumerable: true,
        value: 'production'
      });
      
      await manager.refresh();
      
      const flags = manager.getFlags();
      // Should have production defaults but keep local overrides
      expect(flags.useNativeGeofencing).toBe(false); // Override preserved
      expect(flags.nativeGeofencingRolloutPercentage).toBe(5); // From production
    });
  });
  
  describe('Debug Information', () => {
    it('should provide complete debug information', async () => {
      await manager.initialize({
        userId: 'debug-user',
        deviceId: 'debug-device',
        platform: 'ios',
        appVersion: '2.0.0',
        overrides: {
          enableGeofencingDebugLogs: true
        }
      });
      
      const debugInfo = manager.getDebugInfo();
      
      expect(debugInfo).toEqual({
        userId: 'debug-user',
        platform: 'ios',
        isInRollout: expect.any(Boolean),
        flags: expect.objectContaining({
          useNativeGeofencing: expect.any(Boolean),
          nativeGeofencingRolloutPercentage: expect.any(Number),
          enableGeofencingDebugLogs: true,
          forcePolygonMode: false
        }),
        sources: {
          remote: expect.any(Object),
          local: { enableGeofencingDebugLogs: true },
          persisted: {}
        }
      });
    });
  });
  
  describe('Platform-Specific Behavior', () => {
    it('should limit iOS rollout percentage', async () => {
      Object.defineProperty(process.env, 'NODE_ENV', {
        configurable: true,
        enumerable: true,
        value: 'production'
      });
      
      await manager.initialize({
        platform: 'ios'
      });
      
      const flags = manager.getFlags();
      // iOS should be capped at 50% even if remote says higher
      expect(flags.nativeGeofencingRolloutPercentage).toBeLessThanOrEqual(50);
    });
    
    it('should allow full rollout on Android', async () => {
      Object.defineProperty(process.env, 'NODE_ENV', {
        configurable: true,
        enumerable: true,
        value: 'development'
      });
      
      await manager.initialize({
        platform: 'android'
      });
      
      const flags = manager.getFlags();
      // Android can have full 100% rollout
      expect(flags.nativeGeofencingRolloutPercentage).toBe(100);
    });
  });
  
  describe('Edge Cases', () => {
    it('should handle empty userId in hash', async () => {
      await manager.initialize({
        userId: '',
        overrides: {
          useNativeGeofencing: true,
          nativeGeofencingRolloutPercentage: 50 // Less than 100 to trigger rollout check
        }
      });
      
      // Empty userId should return false (no userId = not in rollout)
      expect(manager.shouldUseNativeGeofencing()).toBe(false);
    });
    
    it('should handle special characters in userId', async () => {
      await manager.initialize({
        userId: '用户123!@#$%',
        overrides: {
          useNativeGeofencing: true,
          nativeGeofencingRolloutPercentage: 100
        }
      });
      
      // Should handle unicode and special chars
      expect(() => manager.shouldUseNativeGeofencing()).not.toThrow();
    });
    
    it('should handle undefined platform gracefully', async () => {
      await manager.initialize({
        platform: undefined
      });
      
      const flags = manager.getFlags();
      expect(flags).toBeDefined();
    });
  });
  
  describe('Priority Order', () => {
    it('should apply correct priority: local > remote > defaults', async () => {
      // Set up a complex scenario
      Object.defineProperty(process.env, 'NODE_ENV', {
        configurable: true,
        enumerable: true,
        value: 'production'
      }); // Will set remote flags
      
      await manager.initialize({
        overrides: {
          enableGeofencingDebugLogs: true // Local override
        }
      });
      
      const flags = manager.getFlags();
      
      // Default is false, remote (production) is false, local is true
      expect(flags.enableGeofencingDebugLogs).toBe(true);
      
      // Remote should override default
      expect(flags.nativeGeofencingRolloutPercentage).toBe(5); // Production default
    });
  });
});