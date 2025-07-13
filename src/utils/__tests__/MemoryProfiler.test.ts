import MemoryProfiler, { setupIOSMemoryMonitoring, setupAndroidMemoryMonitoring } from '../MemoryProfiler';
import { Platform } from 'react-native';

// Mock Platform
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    Version: '14.0',
    isPad: false,
    isTV: false
  }
}));

// Mock console to prevent output during tests
const originalConsole = {
  log: console.log,
  warn: console.warn
};

beforeAll(() => {
  console.log = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  console.log = originalConsole.log;
  console.warn = originalConsole.warn;
});

// Mock process.memoryUsage for Node environment
const mockMemoryUsage = jest.fn();
(global as any).process = {
  memoryUsage: mockMemoryUsage
};

describe('MemoryProfiler', () => {
  let profiler: typeof MemoryProfiler;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Reset singleton
    (MemoryProfiler.constructor as any).instance = null;
    profiler = MemoryProfiler;
    
    // Default memory usage mock
    mockMemoryUsage.mockReturnValue({
      heapUsed: 50 * 1024 * 1024, // 50MB
      heapTotal: 100 * 1024 * 1024, // 100MB
      external: 10 * 1024 * 1024 // 10MB
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    profiler.reset();
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = MemoryProfiler;
      const instance2 = MemoryProfiler;
      expect(instance1).toBe(instance2);
    });
  });

  describe('startMonitoring', () => {
    it('should start monitoring with default interval', () => {
      profiler.startMonitoring();

      expect(mockMemoryUsage).toHaveBeenCalled(); // For baseline
      
      // Advance time and check periodic snapshots
      jest.advanceTimersByTime(1000);
      expect(mockMemoryUsage).toHaveBeenCalledTimes(2);
      
      jest.advanceTimersByTime(1000);
      expect(mockMemoryUsage).toHaveBeenCalledTimes(3);
    });

    it('should start monitoring with custom interval', () => {
      profiler.startMonitoring(5000);

      expect(mockMemoryUsage).toHaveBeenCalledTimes(1); // baseline
      
      jest.advanceTimersByTime(4999);
      expect(mockMemoryUsage).toHaveBeenCalledTimes(1); // Not yet
      
      jest.advanceTimersByTime(1);
      expect(mockMemoryUsage).toHaveBeenCalledTimes(2); // Now it should
    });

    it('should warn if already monitoring', () => {
      profiler.startMonitoring();
      profiler.startMonitoring();

      expect(console.warn).toHaveBeenCalledWith('[MemoryProfiler] Already monitoring');
    });
  });

  describe('stopMonitoring', () => {
    it('should stop monitoring and return report', () => {
      profiler.startMonitoring();
      jest.advanceTimersByTime(5000);
      
      const report = profiler.stopMonitoring();

      expect(report).toMatchObject({
        baseline: expect.objectContaining({
          heapUsed: 50 * 1024 * 1024,
          heapTotal: 100 * 1024 * 1024,
          label: 'baseline'
        }),
        peak: expect.any(Object),
        current: expect.any(Object),
        snapshots: expect.any(Array),
        leakDetected: false,
        analysis: expect.any(Array)
      });

      // Check that monitoring stopped
      const callCountBefore = mockMemoryUsage.mock.calls.length;
      jest.advanceTimersByTime(1000);
      expect(mockMemoryUsage).toHaveBeenCalledTimes(callCountBefore);
    });

    it('should warn if not monitoring', () => {
      const report = profiler.stopMonitoring();

      expect(console.warn).toHaveBeenCalledWith('[MemoryProfiler] Not currently monitoring');
      expect(report.analysis).toContain('No data collected');
    });
  });

  describe('captureSnapshot', () => {
    it('should capture snapshot with label', () => {
      profiler.startMonitoring();
      
      const snapshot = profiler.captureSnapshot('test-point');

      expect(snapshot).toMatchObject({
        timestamp: expect.any(Number),
        heapUsed: 50 * 1024 * 1024,
        heapTotal: 100 * 1024 * 1024,
        external: 10 * 1024 * 1024,
        label: 'test-point'
      });
    });

    it('should limit number of snapshots', () => {
      profiler.startMonitoring(100); // Fast interval
      
      // Create more than maxSnapshots (10000)
      for (let i = 0; i < 11000; i += 100) {
        jest.advanceTimersByTime(100);
      }

      const report = profiler.stopMonitoring();
      expect(report.snapshots.length).toBeLessThanOrEqual(10000);
    });
  });

  describe('mark', () => {
    it('should add marked snapshot when monitoring', () => {
      profiler.startMonitoring();
      
      profiler.mark('important-operation');

      const report = profiler.stopMonitoring();
      const markedSnapshot = report.snapshots.find(s => s.label === 'important-operation');
      expect(markedSnapshot).toBeDefined();
    });

    it('should warn if not monitoring', () => {
      profiler.mark('test');

      expect(console.warn).toHaveBeenCalledWith('[MemoryProfiler] Not monitoring, mark ignored');
    });
  });

  describe('memory leak detection', () => {
    it('should detect memory leak with consistent growth', () => {
      profiler.startMonitoring(100);

      // Simulate consistent memory growth
      let heapUsed = 50 * 1024 * 1024;
      mockMemoryUsage.mockImplementation(() => {
        heapUsed += 1024 * 1024; // 1MB growth each time
        return {
          heapUsed,
          heapTotal: 100 * 1024 * 1024,
          external: 10 * 1024 * 1024
        };
      });

      // Advance to get 10+ snapshots
      jest.advanceTimersByTime(1500);

      const report = profiler.stopMonitoring();
      expect(report.leakDetected).toBe(true);
    });

    it('should not detect leak with stable memory', () => {
      profiler.startMonitoring(100);

      // Simulate stable memory with minor fluctuations
      const baseHeap = 50 * 1024 * 1024;
      let callCount = 0;
      mockMemoryUsage.mockImplementation(() => {
        const variation = Math.sin(callCount++) * 1024 * 1024; // ±1MB variation
        return {
          heapUsed: baseHeap + variation,
          heapTotal: 100 * 1024 * 1024,
          external: 10 * 1024 * 1024
        };
      });

      jest.advanceTimersByTime(1500);

      const report = profiler.stopMonitoring();
      expect(report.leakDetected).toBe(false);
    });

    it('should not detect leak with insufficient data', () => {
      profiler.startMonitoring();
      
      // Only a few snapshots
      jest.advanceTimersByTime(3000);

      const report = profiler.stopMonitoring();
      expect(report.leakDetected).toBe(false);
    });
  });

  describe('memory analysis', () => {
    it('should analyze memory growth', () => {
      profiler.startMonitoring();

      // Start at 50MB
      mockMemoryUsage.mockReturnValueOnce({
        heapUsed: 50 * 1024 * 1024,
        heapTotal: 100 * 1024 * 1024,
        external: 10 * 1024 * 1024
      });

      jest.advanceTimersByTime(1000);

      // End at 60MB
      mockMemoryUsage.mockReturnValue({
        heapUsed: 60 * 1024 * 1024,
        heapTotal: 100 * 1024 * 1024,
        external: 10 * 1024 * 1024
      });

      jest.advanceTimersByTime(1000);

      const report = profiler.stopMonitoring();
      
      expect(report.analysis).toContainEqual(expect.stringContaining('Total memory growth: 10 MB'));
      expect(report.analysis).toContainEqual(expect.stringContaining('(20.0%)'));
    });

    it('should detect memory spikes', () => {
      profiler.startMonitoring(100);

      // Normal usage
      const normalHeap = 50 * 1024 * 1024;
      mockMemoryUsage.mockReturnValue({
        heapUsed: normalHeap,
        heapTotal: 100 * 1024 * 1024,
        external: 10 * 1024 * 1024
      });

      // Create some normal snapshots
      jest.advanceTimersByTime(500);

      // Create a spike with mark before changing memory
      mockMemoryUsage.mockReturnValueOnce({
        heapUsed: 80 * 1024 * 1024, // Spike to 80MB
        heapTotal: 100 * 1024 * 1024,
        external: 10 * 1024 * 1024
      });
      profiler.mark('spike-operation');

      // Back to normal
      mockMemoryUsage.mockReturnValue({
        heapUsed: normalHeap,
        heapTotal: 100 * 1024 * 1024,
        external: 10 * 1024 * 1024
      });

      jest.advanceTimersByTime(500);

      const report = profiler.stopMonitoring();
      
      expect(report.analysis).toContainEqual(expect.stringContaining('Memory spikes detected at: spike-operation'));
    });

    it('should detect garbage collection events', () => {
      profiler.startMonitoring(100);

      // Simulate memory pattern with GC
      let heapUsed = 60 * 1024 * 1024;
      mockMemoryUsage.mockImplementation(() => {
        // Gradual increase then sudden drop (GC)
        heapUsed += 2 * 1024 * 1024;
        if (heapUsed > 70 * 1024 * 1024) {
          heapUsed = 50 * 1024 * 1024; // GC event
        }
        return {
          heapUsed,
          heapTotal: 100 * 1024 * 1024,
          external: 10 * 1024 * 1024
        };
      });

      jest.advanceTimersByTime(1000);

      const report = profiler.stopMonitoring();
      
      expect(report.analysis).toContainEqual(expect.stringContaining('Detected 1 probable GC events'));
    });
  });

  describe('printReport', () => {
    it('should print formatted report', () => {
      profiler.startMonitoring();
      jest.advanceTimersByTime(2000);
      const report = profiler.stopMonitoring();

      profiler.printReport(report);

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('=== Memory Profile Report ==='));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Baseline:'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Peak:'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Final:'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Leak detected: NO ✅'));
    });

    it('should show leak warning in report', () => {
      const leakReport = {
        baseline: { heapUsed: 50 * 1024 * 1024, heapTotal: 100 * 1024 * 1024, external: 0, label: 'baseline', timestamp: Date.now() },
        peak: { heapUsed: 80 * 1024 * 1024, heapTotal: 100 * 1024 * 1024, external: 0, label: 'peak', timestamp: Date.now() },
        current: { heapUsed: 75 * 1024 * 1024, heapTotal: 100 * 1024 * 1024, external: 0, label: 'current', timestamp: Date.now() },
        snapshots: [],
        leakDetected: true,
        analysis: ['Memory leak detected']
      };

      profiler.printReport(leakReport);

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Leak detected: YES ⚠️'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('⚠️  WARNING: Potential memory leak detected!'));
    });
  });

  describe('reset', () => {
    it('should reset profiler state', () => {
      profiler.startMonitoring();
      jest.advanceTimersByTime(2000);
      
      profiler.reset();

      // Should stop monitoring
      const callCountAfterReset = mockMemoryUsage.mock.calls.length;
      jest.advanceTimersByTime(1000);
      expect(mockMemoryUsage).toHaveBeenCalledTimes(callCountAfterReset);

      // Should be able to start again
      profiler.startMonitoring();
      expect(console.warn).not.toHaveBeenCalledWith('[MemoryProfiler] Already monitoring');
    });
  });

  describe('platform-specific memory monitoring', () => {
    it('should handle web/node environment', () => {
      (Platform as any).OS = 'web';
      
      profiler.startMonitoring();
      const report = profiler.stopMonitoring();

      expect(report.baseline.heapUsed).toBe(50 * 1024 * 1024);
    });

    it('should handle React Native environment', () => {
      (Platform as any).OS = 'ios';
      delete (global as any).process;

      profiler.startMonitoring();
      const report = profiler.stopMonitoring();

      // Should return zeros when native module not available
      expect(report.baseline.heapUsed).toBe(0);
      
      // Restore process mock
      (global as any).process = { memoryUsage: mockMemoryUsage };
    });
  });
});

describe('Memory monitoring setup functions', () => {
  it('should log iOS setup message', () => {
    setupIOSMemoryMonitoring();
    expect(console.log).toHaveBeenCalledWith('[MemoryProfiler] iOS memory monitoring would be set up here');
  });

  it('should log Android setup message', () => {
    setupAndroidMemoryMonitoring();
    expect(console.log).toHaveBeenCalledWith('[MemoryProfiler] Android memory monitoring would be set up here');
  });
});