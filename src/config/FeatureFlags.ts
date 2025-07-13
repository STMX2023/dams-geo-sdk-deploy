/**
 * Feature Flag System for Geofencing Migration
 * 
 * Enables gradual rollout and quick rollback of native geofencing
 */


export interface FeatureFlags {
  useNativeGeofencing: boolean;
  nativeGeofencingRolloutPercentage: number;
  enableGeofencingDebugLogs: boolean;
  forcePolygonMode: boolean; // Emergency override
}

export interface FeatureFlagConfig {
  userId?: string;
  deviceId?: string;
  platform?: 'ios' | 'android';
  appVersion?: string;
  overrides?: Partial<FeatureFlags>;
}

export class FeatureFlagManager {
  private static instance: FeatureFlagManager | null = null;
  private flags: FeatureFlags = {
    useNativeGeofencing: false,
    nativeGeofencingRolloutPercentage: 0,
    enableGeofencingDebugLogs: false,
    forcePolygonMode: false
  };
  
  private config: FeatureFlagConfig = {};
  private remoteFlags: Partial<FeatureFlags> = {};
  private localOverrides: Partial<FeatureFlags> = {};

  private constructor() {}

  static getInstance(): FeatureFlagManager {
    if (!FeatureFlagManager.instance) {
      FeatureFlagManager.instance = new FeatureFlagManager();
    }
    return FeatureFlagManager.instance;
  }

  /**
   * Initialize feature flags with configuration
   */
  async initialize(config: FeatureFlagConfig): Promise<void> {
    this.config = config;
    
    // Apply any local overrides first
    if (config.overrides) {
      this.localOverrides = config.overrides;
    }

    // Load remote flags
    await this.loadRemoteFlags();
    
    // Load persisted flags
    await this.loadPersistedFlags();
    
    // Compute final flag values
    this.computeFlags();
  }

  /**
   * Check if native geofencing should be used for this user
   */
  shouldUseNativeGeofencing(): boolean {
    // Emergency override
    if (this.flags.forcePolygonMode) {
      return false;
    }

    // Check if feature is enabled at all
    if (!this.flags.useNativeGeofencing) {
      return false;
    }

    // Check rollout percentage
    if (this.flags.nativeGeofencingRolloutPercentage < 100) {
      return this.isUserInRollout();
    }

    return true;
  }

  /**
   * Get current feature flag values
   */
  getFlags(): Readonly<FeatureFlags> {
    return { ...this.flags };
  }

  /**
   * Update a specific flag (for testing/debugging)
   */
  setFlag<K extends keyof FeatureFlags>(key: K, value: FeatureFlags[K]): void {
    this.localOverrides[key] = value;
    this.computeFlags();
  }

  /**
   * Clear all local overrides
   */
  clearOverrides(): void {
    this.localOverrides = {};
    this.computeFlags();
  }

  /**
   * Force refresh from remote
   */
  async refresh(): Promise<void> {
    await this.loadRemoteFlags();
    this.computeFlags();
  }

  /**
   * Get debug information about flag resolution
   */
  getDebugInfo(): {
    userId?: string;
    platform?: string;
    isInRollout: boolean;
    flags: FeatureFlags;
    sources: {
      remote: Partial<FeatureFlags>;
      local: Partial<FeatureFlags>;
      persisted: Partial<FeatureFlags>;
    };
  } {
    return {
      userId: this.config.userId,
      platform: this.config.platform,
      isInRollout: this.isUserInRollout(),
      flags: this.getFlags(),
      sources: {
        remote: this.remoteFlags,
        local: this.localOverrides,
        persisted: {} // Would be loaded from storage
      }
    };
  }

  private async loadRemoteFlags(): Promise<void> {
    try {
      // In production, this would fetch from your feature flag service
      // For now, simulate with environment-based config
      
      if (process.env.NODE_ENV === 'production') {
        // Production defaults - start conservative
        this.remoteFlags = {
          useNativeGeofencing: true,
          nativeGeofencingRolloutPercentage: 5, // Start with 5%
          enableGeofencingDebugLogs: false
        };
      } else {
        // Development defaults - full access
        this.remoteFlags = {
          useNativeGeofencing: true,
          nativeGeofencingRolloutPercentage: 100,
          enableGeofencingDebugLogs: true
        };
      }

      // Platform-specific adjustments
      if (this.config.platform === 'ios') {
        // iOS might have different rollout due to 20-zone limit
        this.remoteFlags.nativeGeofencingRolloutPercentage = 
          Math.min(this.remoteFlags.nativeGeofencingRolloutPercentage || 0, 50);
      }
    } catch (error) {
      console.error('Failed to load remote feature flags:', error);
      // Fall back to safe defaults
      this.remoteFlags = {
        useNativeGeofencing: false,
        nativeGeofencingRolloutPercentage: 0
      };
    }
  }

  private async loadPersistedFlags(): Promise<void> {
    // In production, load from AsyncStorage or similar
    // This allows flags to work offline
  }

  private computeFlags(): void {
    // Priority order: local overrides > remote > defaults
    this.flags = {
      ...this.flags, // defaults
      ...this.remoteFlags, // remote config
      ...this.localOverrides // local overrides (highest priority)
    };
  }

  private isUserInRollout(): boolean {
    if (!this.config.userId) {
      return false;
    }

    // Use consistent hashing to determine rollout
    const hash = this.hashUserId(this.config.userId);
    const bucket = hash % 100;
    
    return bucket < this.flags.nativeGeofencingRolloutPercentage;
  }

  private hashUserId(userId: string): number {
    // Simple hash function for consistent bucketing
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}

// Export singleton instance
export const featureFlags = FeatureFlagManager.getInstance();