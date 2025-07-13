import type { ActivityType } from '../DamsGeo.types';

export interface ActivityConfig {
  enableAdaptiveTracking: boolean;
  activityUpdateInterval: number; // milliseconds
}

export interface ActivityDetectionResult {
  type: ActivityType;
  confidence: number; // 0-100
  timestamp: number;
}

export interface ActivityRecord {
  type: ActivityType;
  confidence: number;
  timestamp: number;
}

export class ActivityManager {
  private static instance: ActivityManager | null = null;
  private lastActivity: ActivityType = 'unknown';
  private lastActivityTimestamp: number = 0;
  private currentActivity: ActivityType = 'unknown';
  private activityHistory: ActivityRecord[] = [];
  private config: ActivityConfig = {
    enableAdaptiveTracking: true,
    activityUpdateInterval: 30000 // 30 seconds
  };

  private constructor() {}

  static getInstance(): ActivityManager {
    if (!ActivityManager.instance) {
      ActivityManager.instance = new ActivityManager();
    }
    return ActivityManager.instance;
  }

  configure(config: Partial<ActivityConfig>): void {
    this.config = { ...this.config, ...config };
  }

  updateActivity(activity: ActivityType, confidence: number): ActivityDetectionResult {
    const now = Date.now();
    
    // Only update if confidence is high enough or enough time has passed
    if (confidence >= 70 || (now - this.lastActivityTimestamp) > this.config.activityUpdateInterval) {
      this.lastActivity = activity;
      this.lastActivityTimestamp = now;
      this.currentActivity = activity;
    }

    const result = {
      type: activity,
      confidence,
      timestamp: now
    };

    // Add to history
    this.activityHistory.push(result);
    // Keep only last 10 entries
    if (this.activityHistory.length > 10) {
      this.activityHistory.shift();
    }

    return result;
  }

  getCurrentActivity(): { type: ActivityType; confidence: number } {
    if (this.activityHistory.length === 0) {
      return { type: 'unknown', confidence: 0 };
    }
    const latest = this.activityHistory[this.activityHistory.length - 1];
    return { type: latest.type, confidence: latest.confidence };
  }

  getActivityHistory(): ActivityRecord[] {
    return [...this.activityHistory];
  }

  getConfidence(activityType: ActivityType, timeWindowMs: number = 60000): number {
    const now = Date.now();
    const recentActivities = this.activityHistory.filter(
      record => record.type === activityType && (now - record.timestamp) <= timeWindowMs
    );

    if (recentActivities.length === 0) {
      return 0;
    }

    const totalConfidence = recentActivities.reduce((sum, record) => sum + record.confidence, 0);
    return Math.round(totalConfidence / recentActivities.length);
  }

  shouldUpdateTracking(newActivity: ActivityType): boolean {
    return this.currentActivity !== newActivity;
  }

  reset(): void {
    this.activityHistory = [];
    this.currentActivity = 'unknown';
    this.lastActivity = 'unknown';
    this.lastActivityTimestamp = 0;
  }

  // Get tracking parameters based on current activity
  getTrackingParameters(activity: ActivityType): {
    distanceFilter: number;
    desiredAccuracy: string;
    updateInterval: number;
  } {
    switch (activity) {
      case 'stationary':
        return {
          distanceFilter: 50, // 50 meters
          desiredAccuracy: 'low',
          updateInterval: 600000 // 10 minutes
        };
      
      case 'walking':
        return {
          distanceFilter: 20, // 20 meters
          desiredAccuracy: 'high',
          updateInterval: 60000 // 1 minute
        };
      
      case 'vehicle':
        return {
          distanceFilter: 10, // 10 meters
          desiredAccuracy: 'best',
          updateInterval: 15000 // 15 seconds
        };
      
      case 'unknown':
      default:
        return {
          distanceFilter: 30, // 30 meters
          desiredAccuracy: 'balanced',
          updateInterval: 30000 // 30 seconds
        };
    }
  }

  // Determine activity from speed (fallback method)
  inferActivityFromSpeed(speedMps: number | null): ActivityType {
    if (speedMps === null || speedMps < 0) {
      return 'unknown';
    }

    // Convert m/s to km/h
    const speedKmh = speedMps * 3.6;

    if (speedKmh < 0.5) {
      return 'stationary';
    } else if (speedKmh < 6) {
      return 'walking';
    } else {
      return 'vehicle';
    }
  }

  // Calculate confidence based on various factors
  calculateConfidence(
    nativeConfidence?: number,
    speedBasedActivity?: ActivityType,
    declaredActivity?: ActivityType
  ): number {
    if (nativeConfidence !== undefined) {
      return nativeConfidence;
    }

    // If native confidence not available, use heuristics
    if (speedBasedActivity && declaredActivity && speedBasedActivity === declaredActivity) {
      return 85; // High confidence when speed matches declared activity
    }

    return 60; // Medium confidence for fallback detection
  }
}