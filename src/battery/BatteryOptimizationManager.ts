import type { ActivityType } from '../DamsGeo.types';

export interface BatteryOptimizationConfig {
  enableAdaptiveIntervals: boolean;
  reducedAccuracyOnLowBattery: boolean;
  pauseOnCriticalBattery: boolean;
  criticalBatteryThreshold: number; // percentage
  lowBatteryThreshold: number; // percentage
}

export interface TrackingParameters {
  distanceFilter: number;
  desiredAccuracy: 'best' | 'high' | 'medium' | 'low';
  interval: number; // milliseconds
}

export class BatteryOptimizationManager {
  private static instance: BatteryOptimizationManager | null = null;
  private config: BatteryOptimizationConfig = {
    enableAdaptiveIntervals: true,
    reducedAccuracyOnLowBattery: true,
    pauseOnCriticalBattery: true,
    criticalBatteryThreshold: 5,
    lowBatteryThreshold: 20
  };

  private batteryLevel: number = 100;
  private isCharging: boolean = false;

  private constructor() {}

  static getInstance(): BatteryOptimizationManager {
    if (!BatteryOptimizationManager.instance) {
      BatteryOptimizationManager.instance = new BatteryOptimizationManager();
    }
    return BatteryOptimizationManager.instance;
  }

  updateBatteryStatus(level: number, charging: boolean): void {
    this.batteryLevel = level;
    this.isCharging = charging;
  }

  getOptimizedTrackingParameters(activityType: ActivityType): TrackingParameters {
    const baseParams = this.getBaseParametersForActivity(activityType);
    
    // Apply battery optimizations
    if (!this.isCharging && this.config.enableAdaptiveIntervals) {
      if (this.batteryLevel <= this.config.criticalBatteryThreshold) {
        // Critical battery - maximize battery life
        return {
          distanceFilter: 100,
          desiredAccuracy: 'low',
          interval: 600000 // 10 minutes
        };
      } else if (this.batteryLevel <= this.config.lowBatteryThreshold) {
        // Low battery - reduce accuracy
        return {
          distanceFilter: Math.max(baseParams.distanceFilter * 2, 50),
          desiredAccuracy: this.config.reducedAccuracyOnLowBattery ? 'medium' : baseParams.desiredAccuracy,
          interval: baseParams.interval * 2
        };
      }
    }

    return baseParams;
  }

  private getBaseParametersForActivity(activityType: ActivityType): TrackingParameters {
    switch (activityType) {
      case 'stationary':
        return {
          distanceFilter: 50,
          desiredAccuracy: 'medium',
          interval: 600000 // 10 minutes
        };
      case 'walking':
        return {
          distanceFilter: 20,
          desiredAccuracy: 'high',
          interval: 60000 // 1 minute
        };
      case 'vehicle':
        return {
          distanceFilter: 10,
          desiredAccuracy: 'best',
          interval: 15000 // 15 seconds
        };
      default:
        return {
          distanceFilter: 30,
          desiredAccuracy: 'high',
          interval: 30000 // 30 seconds
        };
    }
  }

  shouldPauseTracking(): boolean {
    return !this.isCharging && 
           this.config.pauseOnCriticalBattery && 
           this.batteryLevel <= this.config.criticalBatteryThreshold;
  }

  getRecommendedUpdateInterval(): number {
    if (this.isCharging) {
      return 1; // Most frequent updates when charging
    }

    if (this.batteryLevel > 50) {
      return 1; // Normal frequency
    } else if (this.batteryLevel > 20) {
      return 2; // Half frequency
    } else {
      return 4; // Quarter frequency
    }
  }

  getBatteryStatus(): { level: number; isCharging: boolean; isLow: boolean; isCritical: boolean } {
    return {
      level: this.batteryLevel,
      isCharging: this.isCharging,
      isLow: this.batteryLevel <= this.config.lowBatteryThreshold,
      isCritical: this.batteryLevel <= this.config.criticalBatteryThreshold
    };
  }

  updateConfig(config: Partial<BatteryOptimizationConfig>): void {
    this.config = { ...this.config, ...config };
  }
}