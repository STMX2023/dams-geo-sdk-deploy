import BatteryTestProtocol from '../BatteryTestProtocol';
import { DamsGeo } from '../../DamsGeo';
import { BatteryOptimizationManager } from '../../battery/BatteryOptimizationManager';

// Mock dependencies
jest.mock('../../DamsGeo');
jest.mock('../../battery/BatteryOptimizationManager');

// Mock console.log to prevent output during tests
const originalConsoleLog = console.log;
beforeAll(() => {
  console.log = jest.fn();
});

afterAll(() => {
  console.log = originalConsoleLog;
});

describe('BatteryTestProtocol', () => {
  let mockDamsGeo: any;
  let mockBatteryManager: jest.Mocked<BatteryOptimizationManager>;
  let mockLocationListener: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Reset the BatteryTestProtocol instance
    (BatteryTestProtocol as any).results = [];
    
    // Mock DamsGeo
    mockDamsGeo = DamsGeo as any;
    mockLocationListener = { remove: jest.fn() };
    mockDamsGeo.addListener = jest.fn().mockReturnValue(mockLocationListener);
    mockDamsGeo.startTracking = jest.fn().mockResolvedValue(undefined);
    mockDamsGeo.stopTracking = jest.fn().mockResolvedValue(undefined);

    // Mock BatteryOptimizationManager
    mockBatteryManager = {
      getInstance: jest.fn()
    } as any;
    (BatteryOptimizationManager.getInstance as jest.Mock).mockReturnValue(mockBatteryManager);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('runQuickTest', () => {
    it('should run a quick battery test successfully', async () => {
      // Mock battery status
      (global as any).mockGetBatteryStatus = jest.fn()
        .mockResolvedValueOnce({ level: 80, isCharging: false }) // start
        .mockResolvedValueOnce({ level: 79, isCharging: false }); // end

      // Mock activity simulation
      (global as any).mockEmitActivityChange = jest.fn();

      const testPromise = BatteryTestProtocol.runQuickTest();

      // Advance timers to complete the test
      jest.advanceTimersByTime(10 * 60 * 1000); // 10 minutes

      const result = await testPromise;

      expect(result).toBe(true); // Battery drain < 5%/hour
      expect(mockDamsGeo.startTracking).toHaveBeenCalledWith(expect.objectContaining({
        enableAdaptiveSampling: true,
        enableActivityRecognition: true,
        enableBatteryOptimization: true,
        minimumLocationAccuracy: 20,
        locationUpdateInterval: 5000
      }));
      expect(mockDamsGeo.stopTracking).toHaveBeenCalledWith('battery-test');
      expect(mockLocationListener.remove).toHaveBeenCalled();
    });

    it('should fail quick test if battery drain is too high', async () => {
      // Mock battery status with high drain
      (global as any).mockGetBatteryStatus = jest.fn()
        .mockResolvedValueOnce({ level: 80, isCharging: false }) // start
        .mockResolvedValueOnce({ level: 70, isCharging: false }); // end - 10% drain

      (global as any).mockEmitActivityChange = jest.fn();

      const testPromise = BatteryTestProtocol.runQuickTest();
      jest.advanceTimersByTime(10 * 60 * 1000);

      const result = await testPromise;

      expect(result).toBe(false); // Battery drain > 5%/hour
    });

    it('should handle location updates during test', async () => {
      (global as any).mockGetBatteryStatus = jest.fn()
        .mockResolvedValueOnce({ level: 80, isCharging: false })
        .mockResolvedValueOnce({ level: 79.5, isCharging: false });

      let locationCallback: any;
      mockDamsGeo.addListener.mockImplementation((event: string, callback: any) => {
        if (event === 'onLocationUpdate') {
          locationCallback = callback;
        }
        return mockLocationListener;
      });

      const testPromise = BatteryTestProtocol.runQuickTest();

      // Simulate location updates
      locationCallback({
        lat: 37.7749,
        lon: -122.4194,
        accuracy: 10,
        speed: 5,
        heading: 180,
        altitude: 50,
        activityType: 'walking',
        timestamp: Date.now()
      });

      jest.advanceTimersByTime(10 * 60 * 1000);

      await testPromise;

      const results = (BatteryTestProtocol as any).results;
      expect(results[0].locationsRecorded).toBe(1);
      expect(results[0].activities.walking).toBe(1);
      expect(results[0].averageAccuracy).toBe(10);
    });
  });

  describe('runAllTests', () => {
    it('should run all test scenarios', async () => {
      // Mock battery status for multiple scenarios
      (global as any).mockGetBatteryStatus = jest.fn()
        .mockResolvedValue({ level: 80, isCharging: false });

      (global as any).mockEmitActivityChange = jest.fn();

      const testPromise = BatteryTestProtocol.runAllTests();

      // Fast-forward through all tests
      // Each scenario is 60 minutes + 2 minute wait between tests
      const scenarios = (BatteryTestProtocol as any).scenarios;
      for (let i = 0; i < scenarios.length; i++) {
        jest.advanceTimersByTime(scenarios[i].duration * 60 * 1000);
        if (i < scenarios.length - 1) {
          jest.advanceTimersByTime(2 * 60 * 1000); // Wait between tests
        }
      }

      const results = await testPromise;

      expect(results).toHaveLength(scenarios.length);
      expect(mockDamsGeo.startTracking).toHaveBeenCalledTimes(scenarios.length);
      expect(mockDamsGeo.stopTracking).toHaveBeenCalledTimes(scenarios.length);
    });

    it('should calculate correct battery drain metrics', async () => {
      // Mock varying battery levels
      (global as any).mockGetBatteryStatus = jest.fn()
        .mockResolvedValueOnce({ level: 80, isCharging: false }) // start
        .mockResolvedValueOnce({ level: 77, isCharging: false }); // end - 3% in 60 min = 3%/hour

      (global as any).mockEmitActivityChange = jest.fn();

      // Run just one scenario
      const scenarios = (BatteryTestProtocol as any).scenarios;
      (BatteryTestProtocol as any).scenarios = [scenarios[0]]; // Stationary - High Accuracy

      const testPromise = BatteryTestProtocol.runAllTests();
      jest.advanceTimersByTime(60 * 60 * 1000); // 60 minutes

      const results = await testPromise;

      expect(results[0].batteryDrain).toBe(3);
      expect(results[0].drainPerHour).toBe(3);

      // Restore scenarios
      (BatteryTestProtocol as any).scenarios = scenarios;
    });

    it('should simulate different activities correctly', async () => {
      (global as any).mockGetBatteryStatus = jest.fn()
        .mockResolvedValue({ level: 80, isCharging: false });

      let activitySimulator: jest.Mock;
      (global as any).mockEmitActivityChange = activitySimulator = jest.fn();

      // Test Mixed Activity scenario (index 4)
      const scenarios = (BatteryTestProtocol as any).scenarios;
      const mixedScenario = scenarios[4]; // Mixed Activity scenario
      (BatteryTestProtocol as any).scenarios = [mixedScenario];

      const testPromise = BatteryTestProtocol.runAllTests();

      // Advance through activities
      jest.advanceTimersByTime(20 * 60 * 1000); // stationary
      jest.advanceTimersByTime(20 * 60 * 1000); // walking  
      jest.advanceTimersByTime(20 * 60 * 1000); // vehicle

      await testPromise;

      // Check that activities were simulated
      expect(activitySimulator).toHaveBeenCalledWith({ activity: 'stationary', confidence: 90 });
      expect(activitySimulator).toHaveBeenCalledWith({ activity: 'walking', confidence: 85 });
      expect(activitySimulator).toHaveBeenCalledWith({ activity: 'vehicle', confidence: 92 });

      // Restore scenarios
      (BatteryTestProtocol as any).scenarios = scenarios;
    });
  });

  describe('private methods', () => {
    it('should wait for specified duration', async () => {
      const wait = (BatteryTestProtocol as any).prototype.wait.bind(BatteryTestProtocol);
      
      const startTime = Date.now();
      const waitPromise = wait(1000);
      
      jest.advanceTimersByTime(1000);
      await waitPromise;
      
      expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 1000);
    });

    it('should calculate total test time correctly', () => {
      const getTotalTestTime = (BatteryTestProtocol as any).prototype.getTotalTestTime.bind(BatteryTestProtocol);
      
      // 6 scenarios: 60 + 60 + 60 + 60 + 60 + 30 = 330 minutes
      // 5 waits between tests: 5 * 2 = 10 minutes
      // Total: 340 minutes
      const totalTime = getTotalTestTime();
      
      expect(totalTime).toBe(340);
    });

    it('should handle missing battery status gracefully', async () => {
      // Remove mock to use default implementation
      delete (global as any).mockGetBatteryStatus;

      const getBatteryStatus = (BatteryTestProtocol as any).prototype.getBatteryStatus.bind(BatteryTestProtocol);
      const status = await getBatteryStatus();

      expect(status).toEqual({ level: 80, isCharging: false });
    });

    it('should handle missing activity simulator gracefully', async () => {
      // Remove mock
      delete (global as any).mockEmitActivityChange;

      const simulateActivity = (BatteryTestProtocol as any).prototype.simulateActivity.bind(BatteryTestProtocol);
      
      // Should not throw
      await expect(simulateActivity('walking', 85)).resolves.toBeUndefined();
    });
  });

  describe('report generation', () => {
    it('should generate comprehensive report', async () => {
      // Set up test results
      (BatteryTestProtocol as any).results = [
        {
          scenario: 'Test Scenario 1',
          duration: 60,
          startBattery: 80,
          endBattery: 77,
          batteryDrain: 3,
          drainPerHour: 3,
          locationsRecorded: 100,
          averageAccuracy: 15.5,
          activities: {
            stationary: 50,
            walking: 50,
            running: 0,
            bicycle: 0,
            vehicle: 0,
            unknown: 0
          }
        },
        {
          scenario: 'Test Scenario 2',
          duration: 30,
          startBattery: 77,
          endBattery: 71,
          batteryDrain: 6,
          drainPerHour: 12, // High drain
          locationsRecorded: 50,
          averageAccuracy: 10.2,
          activities: {
            stationary: 0,
            walking: 0,
            running: 0,
            bicycle: 0,
            vehicle: 50,
            unknown: 0
          }
        }
      ];

      const generateReport = (BatteryTestProtocol as any).prototype.generateReport.bind(BatteryTestProtocol);
      
      // Capture console output
      const consoleLog = console.log as jest.Mock;
      consoleLog.mockClear();
      
      generateReport();
      
      // Check report structure
      const output = consoleLog.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('=== Battery Test Report ===');
      expect(output).toContain('Test Scenario 1');
      expect(output).toContain('Test Scenario 2');
      expect(output).toContain('3.0%'); // drain per hour for scenario 1
      expect(output).toContain('12.0%'); // drain per hour for scenario 2
      expect(output).toContain('Average drain per hour: 7.50%');
      expect(output).toContain('Status: FAIL'); // Average > 5%
      expect(output).toContain('⚠️  Battery drain exceeds target');
      expect(output).toContain('Most efficient: Test Scenario 1');
      expect(output).toContain('Least efficient: Test Scenario 2');
      expect(output).toContain('=== Activity Breakdown ===');
    });

    it('should show PASS status when battery drain is acceptable', () => {
      (BatteryTestProtocol as any).results = [
        {
          scenario: 'Efficient Test',
          duration: 60,
          startBattery: 80,
          endBattery: 78,
          batteryDrain: 2,
          drainPerHour: 2,
          locationsRecorded: 100,
          averageAccuracy: 15,
          activities: { stationary: 100, walking: 0, running: 0, bicycle: 0, vehicle: 0, unknown: 0 }
        }
      ];

      const generateReport = (BatteryTestProtocol as any).prototype.generateReport.bind(BatteryTestProtocol);
      const consoleLog = console.log as jest.Mock;
      consoleLog.mockClear();
      
      generateReport();
      
      const output = consoleLog.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Status: PASS');
      expect(output).toContain('✅ Battery drain is within acceptable limits');
      expect(output).not.toContain('⚠️  Battery drain exceeds target');
    });
  });
});