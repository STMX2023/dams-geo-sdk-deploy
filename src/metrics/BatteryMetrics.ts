/**
 * Battery Metrics Collection for Geofencing Migration
 * 
 * Measures battery impact of polygon vs native geofencing
 * to validate the migration's primary goal.
 */

export interface BatterySnapshot {
  timestamp: number;
  batteryLevel: number; // 0-100
  isCharging: boolean;
  temperature?: number; // Celsius
  voltage?: number; // Volts
}

export interface BatterySession {
  sessionId: string;
  startTime: number;
  endTime?: number;
  geofencingMode: 'polygon' | 'native';
  activeZoneCount: number;
  snapshots: BatterySnapshot[];
  locationUpdates: number;
  geofenceChecks: number;
  deviceInfo: {
    platform: 'ios' | 'android';
    model: string;
    osVersion: string;
  };
}

export interface BatteryMetrics {
  sessionId: string;
  duration: number; // minutes
  batteryDrain: number; // percentage
  drainPerHour: number; // percentage/hour
  averageTemperature?: number;
  locationUpdatesPerHour: number;
  geofenceChecksPerHour: number;
  efficiency: {
    batteryPerLocationUpdate: number;
    batteryPerGeofenceCheck: number;
  };
}

export class BatteryMetricsCollector {
  private static instance: BatteryMetricsCollector | null = null;
  private currentSession: BatterySession | null = null;
  private snapshotInterval: NodeJS.Timeout | null = null;
  private metricsHistory: BatteryMetrics[] = [];

  private constructor() {}

  static getInstance(): BatteryMetricsCollector {
    if (!BatteryMetricsCollector.instance) {
      BatteryMetricsCollector.instance = new BatteryMetricsCollector();
    }
    return BatteryMetricsCollector.instance;
  }

  /**
   * Start a battery measurement session
   */
  async startSession(config: {
    geofencingMode: 'polygon' | 'native';
    activeZoneCount: number;
    snapshotIntervalMs?: number;
  }): Promise<string> {
    if (this.currentSession) {
      await this.endSession();
    }

    const sessionId = `battery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.currentSession = {
      sessionId,
      startTime: Date.now(),
      geofencingMode: config.geofencingMode,
      activeZoneCount: config.activeZoneCount,
      snapshots: [],
      locationUpdates: 0,
      geofenceChecks: 0,
      deviceInfo: await this.getDeviceInfo()
    };

    // Take initial snapshot
    const initialSnapshot = await this.takeBatterySnapshot();
    this.currentSession.snapshots.push(initialSnapshot);

    // Start periodic snapshots
    const interval = config.snapshotIntervalMs || 60000; // Default 1 minute
    this.snapshotInterval = setInterval(async () => {
      if (this.currentSession) {
        const snapshot = await this.takeBatterySnapshot();
        this.currentSession.snapshots.push(snapshot);
      }
    }, interval);

    console.log(`Battery measurement session started: ${sessionId}`);
    return sessionId;
  }

  /**
   * End the current battery measurement session
   */
  async endSession(): Promise<BatteryMetrics | null> {
    if (!this.currentSession) {
      return null;
    }

    // Clear interval
    if (this.snapshotInterval) {
      clearInterval(this.snapshotInterval);
      this.snapshotInterval = null;
    }

    // Take final snapshot
    const finalSnapshot = await this.takeBatterySnapshot();
    this.currentSession.snapshots.push(finalSnapshot);
    this.currentSession.endTime = Date.now();

    // Calculate metrics
    const metrics = this.calculateMetrics(this.currentSession);
    this.metricsHistory.push(metrics);

    // Log summary
    console.log(`Battery session ${this.currentSession.sessionId} completed:`);
    console.log(`  Mode: ${this.currentSession.geofencingMode}`);
    console.log(`  Duration: ${metrics.duration.toFixed(1)} minutes`);
    console.log(`  Battery drain: ${metrics.batteryDrain.toFixed(2)}%`);
    console.log(`  Drain per hour: ${metrics.drainPerHour.toFixed(2)}%/hr`);

    this.currentSession = null;
    return metrics;
  }

  /**
   * Record a location update event
   */
  recordLocationUpdate(): void {
    if (this.currentSession) {
      this.currentSession.locationUpdates++;
    }
  }

  /**
   * Record a geofence check event
   */
  recordGeofenceCheck(): void {
    if (this.currentSession) {
      this.currentSession.geofenceChecks++;
    }
  }

  /**
   * Get battery metrics comparison between modes
   */
  getComparison(): {
    polygon: BatteryMetrics[];
    native: BatteryMetrics[];
    improvement?: {
      batteryDrain: number; // percentage improvement
      efficiency: number; // percentage improvement
    };
  } {
    const polygonMetrics = this.metricsHistory.filter(m => 
      this.findSession(m.sessionId)?.geofencingMode === 'polygon'
    );
    
    const nativeMetrics = this.metricsHistory.filter(m => 
      this.findSession(m.sessionId)?.geofencingMode === 'native'
    );

    let improvement;
    if (polygonMetrics.length > 0 && nativeMetrics.length > 0) {
      const avgPolygonDrain = this.average(polygonMetrics.map(m => m.drainPerHour));
      const avgNativeDrain = this.average(nativeMetrics.map(m => m.drainPerHour));
      
      improvement = {
        batteryDrain: ((avgPolygonDrain - avgNativeDrain) / avgPolygonDrain) * 100,
        efficiency: 0 // Calculate based on operations per battery %
      };
    }

    return { polygon: polygonMetrics, native: nativeMetrics, improvement };
  }

  /**
   * Export metrics for analysis
   */
  exportMetrics(): {
    sessions: BatterySession[];
    metrics: BatteryMetrics[];
    summary: any;
  } {
    const sessions = this.getAllSessions();
    
    return {
      sessions,
      metrics: this.metricsHistory,
      summary: {
        totalSessions: sessions.length,
        polygonSessions: sessions.filter(s => s.geofencingMode === 'polygon').length,
        nativeSessions: sessions.filter(s => s.geofencingMode === 'native').length,
        comparison: this.getComparison()
      }
    };
  }

  /**
   * Generate baseline report for migration plan
   */
  generateBaselineReport(): string {
    const comparison = this.getComparison();
    const polygonAvg = comparison.polygon.length > 0
      ? this.average(comparison.polygon.map(m => m.drainPerHour))
      : 0;

    return `
Battery Baseline Report
======================
Date: ${new Date().toISOString()}

Polygon Mode Baseline:
- Average drain: ${polygonAvg.toFixed(2)}%/hour
- Sessions measured: ${comparison.polygon.length}
- Average duration: ${this.average(comparison.polygon.map(m => m.duration)).toFixed(1)} minutes

Native Mode Results:
- Sessions measured: ${comparison.native.length}
${comparison.native.length > 0 ? `- Average drain: ${this.average(comparison.native.map(m => m.drainPerHour)).toFixed(2)}%/hour` : '- No data yet'}

${comparison.improvement ? `
Improvement:
- Battery savings: ${comparison.improvement.batteryDrain.toFixed(1)}%
- Target achieved: ${comparison.improvement.batteryDrain >= 80 ? '✓ YES' : '✗ NO'}
` : 'Comparison not available - need both polygon and native sessions'}
`;
  }

  private async takeBatterySnapshot(): Promise<BatterySnapshot> {
    // In real implementation, this would use native modules
    // For now, simulate with realistic values
    
    return {
      timestamp: Date.now(),
      batteryLevel: await this.getBatteryLevel(),
      isCharging: await this.isCharging(),
      temperature: await this.getBatteryTemperature(),
      voltage: await this.getBatteryVoltage()
    };
  }

  private async getBatteryLevel(): Promise<number> {
    // Simulate battery drain
    // In production, use DamsGeoModule.getBatteryLevel()
    return Math.max(0, 100 - (Date.now() % 100) * 0.1);
  }

  private async isCharging(): Promise<boolean> {
    // In production, use DamsGeoModule.isCharging()
    return false;
  }

  private async getBatteryTemperature(): Promise<number | undefined> {
    // In production, use DamsGeoModule.getBatteryTemperature()
    return 25 + Math.random() * 10; // 25-35°C
  }

  private async getBatteryVoltage(): Promise<number | undefined> {
    // In production, use DamsGeoModule.getBatteryVoltage()
    return 3.7 + Math.random() * 0.5; // 3.7-4.2V
  }

  private async getDeviceInfo(): Promise<BatterySession['deviceInfo']> {
    // In production, get from React Native Device Info
    return {
      platform: 'ios',
      model: 'iPhone 13',
      osVersion: '16.0'
    };
  }

  private calculateMetrics(session: BatterySession): BatteryMetrics {
    const duration = (session.endTime! - session.startTime) / 1000 / 60; // minutes
    const firstSnapshot = session.snapshots[0];
    const lastSnapshot = session.snapshots[session.snapshots.length - 1];
    
    const batteryDrain = firstSnapshot.batteryLevel - lastSnapshot.batteryLevel;
    const drainPerHour = (batteryDrain / duration) * 60;
    
    const temperatures = session.snapshots
      .map(s => s.temperature)
      .filter(t => t !== undefined) as number[];
    
    const averageTemperature = temperatures.length > 0
      ? this.average(temperatures)
      : undefined;

    const hoursElapsed = duration / 60;
    const locationUpdatesPerHour = session.locationUpdates / hoursElapsed;
    const geofenceChecksPerHour = session.geofenceChecks / hoursElapsed;

    return {
      sessionId: session.sessionId,
      duration,
      batteryDrain,
      drainPerHour,
      averageTemperature,
      locationUpdatesPerHour,
      geofenceChecksPerHour,
      efficiency: {
        batteryPerLocationUpdate: batteryDrain / Math.max(1, session.locationUpdates),
        batteryPerGeofenceCheck: batteryDrain / Math.max(1, session.geofenceChecks)
      }
    };
  }

  private findSession(sessionId: string): BatterySession | undefined {
    // In production, would query from database
    return undefined;
  }

  private getAllSessions(): BatterySession[] {
    // In production, would query from database
    return [];
  }

  private average(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((a, b) => a + b, 0) / numbers.length;
  }
}

// Export singleton instance
export const batteryMetrics = BatteryMetricsCollector.getInstance();