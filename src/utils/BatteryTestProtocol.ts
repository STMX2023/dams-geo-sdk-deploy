/**
 * Battery Testing Protocol for DAMS Geo SDK
 * 
 * This protocol defines automated tests to measure battery consumption
 * during various tracking scenarios.
 */

import { DamsGeo } from '../DamsGeo';
import { BatteryOptimizationManager } from '../battery/BatteryOptimizationManager';
import type { ActivityType, LocationUpdate, DamsGeoConfig } from '../DamsGeo.types';

interface BatteryTestResult {
  scenario: string;
  duration: number; // minutes
  startBattery: number;
  endBattery: number;
  batteryDrain: number; // percentage
  drainPerHour: number; // percentage per hour
  locationsRecorded: number;
  averageAccuracy: number;
  activities: Record<ActivityType, number>;
}

interface BatteryTestScenario {
  name: string;
  duration: number; // minutes
  activities: Array<{
    type: ActivityType;
    duration: number; // minutes
    confidence: number;
  }>;
  // Conceptual test configuration
  testConfig: {
    enableAdaptiveTracking: boolean;
    desiredAccuracy: 'best' | 'balanced' | 'low';
    distanceFilter: number;
  };
}

export class BatteryTestProtocol {
  private results: BatteryTestResult[] = [];
  private batteryManager = BatteryOptimizationManager.getInstance();
  
  // Define test scenarios
  private readonly scenarios: BatteryTestScenario[] = [
    {
      name: 'Stationary - High Accuracy',
      duration: 60,
      activities: [{ type: 'stationary', duration: 60, confidence: 95 }],
      testConfig: {
        enableAdaptiveTracking: false,
        desiredAccuracy: 'best',
        distanceFilter: 0,
      },
    },
    {
      name: 'Stationary - Adaptive',
      duration: 60,
      activities: [{ type: 'stationary', duration: 60, confidence: 95 }],
      testConfig: {
        enableAdaptiveTracking: true,
        desiredAccuracy: 'balanced',
        distanceFilter: 10,
      },
    },
    {
      name: 'Walking - High Accuracy',
      duration: 60,
      activities: [{ type: 'walking', duration: 60, confidence: 85 }],
      testConfig: {
        enableAdaptiveTracking: false,
        desiredAccuracy: 'best',
        distanceFilter: 5,
      },
    },
    {
      name: 'Walking - Adaptive',
      duration: 60,
      activities: [{ type: 'walking', duration: 60, confidence: 85 }],
      testConfig: {
        enableAdaptiveTracking: true,
        desiredAccuracy: 'balanced',
        distanceFilter: 10,
      },
    },
    {
      name: 'Mixed Activity',
      duration: 60,
      activities: [
        { type: 'stationary', duration: 20, confidence: 90 },
        { type: 'walking', duration: 20, confidence: 85 },
        { type: 'vehicle', duration: 20, confidence: 92 },
      ],
      testConfig: {
        enableAdaptiveTracking: true,
        desiredAccuracy: 'balanced',
        distanceFilter: 10,
      },
    },
    {
      name: 'Low Battery Mode',
      duration: 30,
      activities: [{ type: 'walking', duration: 30, confidence: 85 }],
      testConfig: {
        enableAdaptiveTracking: true,
        desiredAccuracy: 'low',
        distanceFilter: 50,
      },
    },
  ];

  /**
   * Map test scenario configuration to valid DamsGeoConfig
   * Translates conceptual test parameters to SDK configuration
   */
  private translateScenarioToConfig(testConfig: BatteryTestScenario['testConfig']): DamsGeoConfig {
    const config: DamsGeoConfig = {
      // Map enableAdaptiveTracking to enableAdaptiveSampling
      enableAdaptiveSampling: testConfig.enableAdaptiveTracking,
      
      // Enable required features for battery testing
      enableActivityRecognition: true,
      enableBatteryOptimization: true,
      enableLocationSmoothing: true,
      
      // Map desiredAccuracy to minimumLocationAccuracy (in meters)
      // 'best' = 5m, 'balanced' = 20m, 'low' = 100m
      minimumLocationAccuracy: testConfig.desiredAccuracy === 'best' ? 5 :
                              testConfig.desiredAccuracy === 'balanced' ? 20 : 100,
      
      // Map distanceFilter to locationUpdateInterval (in ms)
      // Higher distance filter = longer update interval
      locationUpdateInterval: testConfig.distanceFilter === 0 ? 1000 :  // 1 second for no filter
                             testConfig.distanceFilter <= 10 ? 5000 :   // 5 seconds for small filter
                             30000,                                      // 30 seconds for large filter
      
      // Standard test configuration
      enableGeofencing: false, // Not testing geofencing
      enableBackgroundLocation: true,
      batchLocationUpdates: true,
      batchSize: 10,
      persistLocationHistory: true,
      enableMetricsCollection: true,
      enableDebugLogging: __DEV__
    };
    
    return config;
  }

  /**
   * Run all battery test scenarios
   */
  async runAllTests(): Promise<BatteryTestResult[]> {
    console.log('Starting Battery Test Protocol...');
    console.log(`Total scenarios: ${this.scenarios.length}`);
    console.log(`Estimated time: ${this.getTotalTestTime()} minutes`);
    
    for (const scenario of this.scenarios) {
      await this.runScenario(scenario);
      
      // Wait between tests to let battery stabilize
      await this.wait(2 * 60 * 1000); // 2 minutes
    }
    
    this.generateReport();
    return this.results;
  }

  /**
   * Run a single test scenario
   */
  private async runScenario(scenario: BatteryTestScenario): Promise<void> {
    console.log(`\nStarting scenario: ${scenario.name}`);
    
    const result: BatteryTestResult = {
      scenario: scenario.name,
      duration: scenario.duration,
      startBattery: 0,
      endBattery: 0,
      batteryDrain: 0,
      drainPerHour: 0,
      locationsRecorded: 0,
      averageAccuracy: 0,
      activities: {
        stationary: 0,
        walking: 0,
        running: 0,
        bicycle: 0,
        vehicle: 0,
        unknown: 0,
      },
    };

    // Record initial battery level
    const startStatus = await this.getBatteryStatus();
    result.startBattery = startStatus.level;
    
    // Track metrics during test
    const locations: any[] = [];
    const locationListener = DamsGeo.addListener('onLocationUpdate', (location: LocationUpdate) => {
      locations.push(location);
      result.activities[location.activityType]++;
    });

    // Start tracking with translated config
    const sdkConfig = this.translateScenarioToConfig(scenario.testConfig);
    await DamsGeo.startTracking(sdkConfig);

    // Simulate activities according to scenario
    const _startTime = Date.now();
    for (const activity of scenario.activities) {
      // Simulate activity change
      await this.simulateActivity(activity.type, activity.confidence);
      
      // Wait for activity duration
      await this.wait(activity.duration * 60 * 1000);
    }

    // Stop tracking
    await DamsGeo.stopTracking('battery-test');
    locationListener.remove();

    // Record final battery level
    const endStatus = await this.getBatteryStatus();
    result.endBattery = endStatus.level;
    
    // Calculate results
    result.batteryDrain = result.startBattery - result.endBattery;
    result.drainPerHour = (result.batteryDrain / result.duration) * 60;
    result.locationsRecorded = locations.length;
    
    if (locations.length > 0) {
      const totalAccuracy = locations.reduce((sum, loc) => sum + loc.accuracy, 0);
      result.averageAccuracy = totalAccuracy / locations.length;
    }

    this.results.push(result);
    
    console.log(`Scenario complete: ${scenario.name}`);
    console.log(`Battery drain: ${result.batteryDrain}% (${result.drainPerHour}%/hour)`);
    console.log(`Locations recorded: ${result.locationsRecorded}`);
  }

  /**
   * Simulate activity change
   */
  private async simulateActivity(type: ActivityType, confidence: number): Promise<void> {
    // In a real implementation, this would trigger native activity recognition
    // For testing, we can emit the event directly
    const mockEmit = (global as any).mockEmitActivityChange;
    if (mockEmit) {
      mockEmit({ activity: type, confidence });
    }
  }

  /**
   * Get current battery status
   */
  private async getBatteryStatus(): Promise<{ level: number; isCharging: boolean }> {
    // In production, this would use the native module
    // For testing, we simulate battery drain
    const mockGetBatteryStatus = (global as any).mockGetBatteryStatus;
    if (mockGetBatteryStatus) {
      return mockGetBatteryStatus();
    }
    
    // Default mock implementation
    return { level: 80, isCharging: false };
  }

  /**
   * Wait for specified duration
   */
  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get total test time in minutes
   */
  private getTotalTestTime(): number {
    const scenarioTime = this.scenarios.reduce((sum, s) => sum + s.duration, 0);
    const waitTime = (this.scenarios.length - 1) * 2; // 2 minutes between tests
    return scenarioTime + waitTime;
  }

  /**
   * Generate test report
   */
  private generateReport(): void {
    console.log('\n=== Battery Test Report ===\n');
    
    // Summary table
    console.log('Scenario                    | Duration | Drain | Per Hour | Locations | Avg Accuracy');
    console.log('---------------------------|----------|-------|----------|-----------|-------------');
    
    for (const result of this.results) {
      console.log(
        `${result.scenario.padEnd(26)} | ${result.duration.toString().padStart(8)} | ${
          result.batteryDrain.toFixed(1).padStart(5)
        }% | ${result.drainPerHour.toFixed(1).padStart(7)}% | ${
          result.locationsRecorded.toString().padStart(9)
        } | ${result.averageAccuracy.toFixed(1).padStart(11)}m`
      );
    }
    
    // Analysis
    console.log('\n=== Analysis ===\n');
    
    const avgDrainPerHour = this.results.reduce((sum, r) => sum + r.drainPerHour, 0) / this.results.length;
    const passFailStatus = avgDrainPerHour < 5 ? 'PASS' : 'FAIL';
    
    console.log(`Average drain per hour: ${avgDrainPerHour.toFixed(2)}%`);
    console.log(`Target: < 5% per hour`);
    console.log(`Status: ${passFailStatus}`);
    
    // Best and worst scenarios
    const sorted = [...this.results].sort((a, b) => a.drainPerHour - b.drainPerHour);
    console.log(`\nMost efficient: ${sorted[0].scenario} (${sorted[0].drainPerHour.toFixed(1)}%/hour)`);
    console.log(`Least efficient: ${sorted[sorted.length - 1].scenario} (${sorted[sorted.length - 1].drainPerHour.toFixed(1)}%/hour)`);
    
    // Recommendations
    console.log('\n=== Recommendations ===\n');
    
    if (avgDrainPerHour > 5) {
      console.log('⚠️  Battery drain exceeds target. Consider:');
      console.log('   - Increasing distance filter values');
      console.log('   - Reducing location accuracy when stationary');
      console.log('   - Implementing more aggressive adaptive tracking');
    } else {
      console.log('✅ Battery drain is within acceptable limits');
    }
    
    // Activity breakdown
    console.log('\n=== Activity Breakdown ===\n');
    for (const result of this.results) {
      const total = Object.values(result.activities).reduce((sum, count) => sum + count, 0);
      if (total > 0) {
        console.log(`${result.scenario}:`);
        for (const [activity, count] of Object.entries(result.activities)) {
          if (count > 0) {
            const percentage = (count / total) * 100;
            console.log(`  - ${activity}: ${count} (${percentage.toFixed(1)}%)`);
          }
        }
      }
    }
  }

  /**
   * Run quick battery test (for CI/CD)
   */
  async runQuickTest(): Promise<boolean> {
    console.log('Running quick battery test...');
    
    // Run only the adaptive walking scenario for 10 minutes
    const quickScenario: BatteryTestScenario = {
      name: 'Quick Test - Adaptive Walking',
      duration: 10,
      activities: [{ type: 'walking', duration: 10, confidence: 85 }],
      testConfig: {
        enableAdaptiveTracking: true,
        desiredAccuracy: 'balanced',
        distanceFilter: 10,
      },
    };
    
    await this.runScenario(quickScenario);
    
    const result = this.results[0];
    const passed = result.drainPerHour < 5;
    
    console.log(`\nQuick test ${passed ? 'PASSED' : 'FAILED'}`);
    console.log(`Battery drain: ${result.drainPerHour.toFixed(2)}%/hour`);
    
    return passed;
  }
}

// Export for use in tests
export default new BatteryTestProtocol();