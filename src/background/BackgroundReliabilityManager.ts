import DamsGeoModule from '../DamsGeoModule';
import type { LocationUpdate } from '../DamsGeo.types';

export interface BackgroundState {
  lastUpdateTime: number;
  isAppInBackground: boolean;
  isTrackingActive: boolean;
  lastKnownLocation: LocationUpdate | null;
  missedUpdatesCount: number;
}

export interface ReliabilityConfig {
  maxUpdateGapMinutes: number;
  enablePersistentTracking: boolean;
  enableLocationCache: boolean;
  cacheExpirationMinutes: number;
}

export class BackgroundReliabilityManager {
  private static instance: BackgroundReliabilityManager | null = null;
  private state: BackgroundState = {
    lastUpdateTime: Date.now(),
    isAppInBackground: false,
    isTrackingActive: false,
    lastKnownLocation: null,
    missedUpdatesCount: 0
  };

  private config: ReliabilityConfig = {
    maxUpdateGapMinutes: 5,
    enablePersistentTracking: true,
    enableLocationCache: true,
    cacheExpirationMinutes: 30
  };

  private updateCheckTimer: ReturnType<typeof global.setInterval> | null = null;
  private locationCache: LocationUpdate[] = [];

  private constructor() {}

  static getInstance(): BackgroundReliabilityManager {
    if (!BackgroundReliabilityManager.instance) {
      BackgroundReliabilityManager.instance = new BackgroundReliabilityManager();
    }
    return BackgroundReliabilityManager.instance;
  }

  startMonitoring(): void {
    // Check for missed updates every minute
    this.updateCheckTimer = global.setInterval(() => {
      this.checkForMissedUpdates();
    }, 60000);
  }

  stopMonitoring(): void {
    if (this.updateCheckTimer) {
      global.clearInterval(this.updateCheckTimer);
      this.updateCheckTimer = null;
    }
  }

  handleLocationUpdate(location: LocationUpdate): void {
    this.state.lastUpdateTime = Date.now();
    this.state.lastKnownLocation = location;
    this.state.missedUpdatesCount = 0;

    // Cache location for background recovery
    if (this.config.enableLocationCache) {
      this.locationCache.push(location);
      this.pruneLocationCache();
    }
  }

  handleAppStateChange(isBackground: boolean): void {
    this.state.isAppInBackground = isBackground;

    if (!isBackground) {
      // App came to foreground - check if we need to recover
      this.recoverFromBackground();
    }
  }

  private checkForMissedUpdates(): void {
    const now = Date.now();
    const timeSinceLastUpdate = now - this.state.lastUpdateTime;
    const maxGapMs = this.config.maxUpdateGapMinutes * 60 * 1000;

    if (this.state.isTrackingActive && timeSinceLastUpdate > maxGapMs) {
      this.state.missedUpdatesCount++;
      console.warn(`[BackgroundReliability] No updates for ${Math.round(timeSinceLastUpdate / 60000)} minutes`);
      
      // Attempt recovery strategies
      this.attemptRecovery();
    }
  }

  private attemptRecovery(): void {
    // Strategy 1: Request immediate location update
    if (DamsGeoModule.requestImmediateLocationUpdate) {
      DamsGeoModule.requestImmediateLocationUpdate().catch((error: any) => {
        console.error('[BackgroundReliability] Failed to request immediate update:', error);
      });
    }

    // Strategy 2: Restart tracking if too many missed updates
    if (this.state.missedUpdatesCount > 3 && this.config.enablePersistentTracking) {
      console.warn('[BackgroundReliability] Restarting tracking due to missed updates');
      this.restartTracking();
    }
  }

  private async restartTracking(): Promise<void> {
    try {
      // Store current config
      const currentConfig = await this.getCurrentTrackingConfig();
      
      // Stop and restart
      await DamsGeoModule.stopTracking('reliability-restart');
      await new Promise(resolve => global.setTimeout(resolve, 1000)); // Brief delay
      await DamsGeoModule.startTracking(currentConfig);
      
      this.state.missedUpdatesCount = 0;
    } catch (error) {
      console.error('[BackgroundReliability] Failed to restart tracking:', error);
    }
  }

  private recoverFromBackground(): void {
    // Check if we have cached locations that weren't saved
    const unsavedLocations = this.getUnsavedLocations();
    
    if (unsavedLocations.length > 0) {
      console.warn(`[BackgroundReliability] Recovering ${unsavedLocations.length} cached locations`);
      // These will be saved by the main SDK's database manager
      unsavedLocations.forEach(location => {
        DamsGeoModule.emitLocationUpdate?.(location);
      });
    }

    // Request fresh location update
    if (DamsGeoModule.requestImmediateLocationUpdate) {
      DamsGeoModule.requestImmediateLocationUpdate();
    }
  }

  private getUnsavedLocations(): LocationUpdate[] {
    const cutoffTime = Date.now() - (this.config.cacheExpirationMinutes * 60 * 1000);
    return this.locationCache.filter(loc => loc.timestamp > cutoffTime);
  }

  private pruneLocationCache(): void {
    const cutoffTime = Date.now() - (this.config.cacheExpirationMinutes * 60 * 1000);
    this.locationCache = this.locationCache.filter(loc => loc.timestamp > cutoffTime);
    
    // Keep max 100 locations in cache
    if (this.locationCache.length > 100) {
      this.locationCache = this.locationCache.slice(-100);
    }
  }

  private async getCurrentTrackingConfig(): Promise<any> {
    // This would retrieve the current tracking configuration
    return {
      enableDebugLogs: false,
      desiredAccuracy: 'best',
      distanceFilter: 10,
      enableAdaptiveTracking: true
    };
  }

  getBackgroundState(): BackgroundState {
    return { ...this.state };
  }

  updateConfig(config: Partial<ReliabilityConfig>): void {
    this.config = { ...this.config, ...config };
  }

  setTrackingActive(active: boolean): void {
    this.state.isTrackingActive = active;
    if (active) {
      this.startMonitoring();
    } else {
      this.stopMonitoring();
    }
  }
}