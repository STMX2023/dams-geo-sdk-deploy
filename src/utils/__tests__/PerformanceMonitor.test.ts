import { PerformanceMonitor } from '../PerformanceMonitor';
import { performance } from 'perf_hooks';

// Mock perf_hooks
jest.mock('perf_hooks', () => ({
  performance: {
    now: jest.fn()
  }
}));

// Mock console to prevent output during tests
const originalConsoleWarn = console.warn;
beforeAll(() => {
  console.warn = jest.fn();
});

afterAll(() => {
  console.warn = originalConsoleWarn;
});

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;
  let mockPerformanceNow: jest.MockedFunction<typeof performance.now>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset singleton
    (PerformanceMonitor as any).instance = null;
    monitor = PerformanceMonitor.getInstance();
    
    // Clear any existing metrics
    monitor.clear();
    
    // Mock performance.now
    mockPerformanceNow = performance.now as jest.MockedFunction<typeof performance.now>;
    mockPerformanceNow.mockReturnValue(1000);
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = PerformanceMonitor.getInstance();
      const instance2 = PerformanceMonitor.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('enable/disable', () => {
    it('should be disabled by default', () => {
      expect(monitor.isEnabled()).toBe(false);
    });

    it('should enable monitoring', () => {
      monitor.enable();
      expect(monitor.isEnabled()).toBe(true);
    });

    it('should disable monitoring', () => {
      monitor.enable();
      monitor.disable();
      expect(monitor.isEnabled()).toBe(false);
    });
  });

  describe('startOperation/endOperation', () => {
    beforeEach(() => {
      monitor.enable();
    });

    it('should track operation timing', () => {
      mockPerformanceNow.mockReturnValueOnce(1000); // start
      monitor.startOperation('op1', 'database-query');

      mockPerformanceNow.mockReturnValueOnce(1250); // end
      monitor.endOperation('op1', 'database-query');

      const metrics = monitor.getMetrics();
      expect(metrics).toHaveLength(1);
      expect(metrics[0]).toMatchObject({
        operation: 'database-query',
        startTime: 1000,
        endTime: 1250,
        duration: 250
      });
    });

    it('should track operation with metadata', () => {
      monitor.startOperation('op1', 'api-call');
      monitor.endOperation('op1', 'api-call', { endpoint: '/users', method: 'GET' });

      const metrics = monitor.getMetrics();
      expect(metrics[0].metadata).toEqual({
        endpoint: '/users',
        method: 'GET'
      });
    });

    it('should handle multiple concurrent operations', () => {
      mockPerformanceNow
        .mockReturnValueOnce(1000) // start op1
        .mockReturnValueOnce(1100) // start op2
        .mockReturnValueOnce(1300) // end op1
        .mockReturnValueOnce(1400); // end op2

      monitor.startOperation('op1', 'task-a');
      monitor.startOperation('op2', 'task-b');
      monitor.endOperation('op1', 'task-a');
      monitor.endOperation('op2', 'task-b');

      const metrics = monitor.getMetrics();
      expect(metrics).toHaveLength(2);
      expect(metrics[0].duration).toBe(300); // task-a
      expect(metrics[1].duration).toBe(300); // task-b
    });

    it('should warn if ending operation without start', () => {
      monitor.endOperation('unknown', 'some-operation');
      
      expect(console.warn).toHaveBeenCalledWith('No start time found for operation: some-operation:unknown');
      expect(monitor.getMetrics()).toHaveLength(0);
    });

    it('should not track when disabled', () => {
      monitor.disable();
      
      monitor.startOperation('op1', 'test');
      monitor.endOperation('op1', 'test');

      expect(monitor.getMetrics()).toHaveLength(0);
    });
  });

  describe('measureAsync', () => {
    beforeEach(() => {
      monitor.enable();
    });

    it('should measure async operation duration', async () => {
      mockPerformanceNow
        .mockReturnValueOnce(1000) // start
        .mockReturnValueOnce(1500); // end

      const result = await monitor.measureAsync('async-task', async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'success';
      });

      expect(result).toBe('success');
      
      const metrics = monitor.getMetrics();
      expect(metrics).toHaveLength(1);
      expect(metrics[0]).toMatchObject({
        operation: 'async-task',
        duration: 500
      });
    });

    it('should measure async operation with metadata', async () => {
      await monitor.measureAsync(
        'fetch-data',
        async () => 'data',
        { source: 'api', size: 1024 }
      );

      const metrics = monitor.getMetrics();
      expect(metrics[0].metadata).toEqual({
        source: 'api',
        size: 1024
      });
    });

    it('should track errors in async operations', async () => {
      mockPerformanceNow
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(1200);

      await expect(
        monitor.measureAsync('failing-task', async () => {
          throw new Error('Task failed');
        })
      ).rejects.toThrow('Task failed');

      const metrics = monitor.getMetrics();
      expect(metrics).toHaveLength(1);
      expect(metrics[0]).toMatchObject({
        operation: 'failing-task',
        duration: 200,
        metadata: { error: true }
      });
    });

    it('should not measure when disabled', async () => {
      monitor.disable();

      const result = await monitor.measureAsync('test', async () => 'result');

      expect(result).toBe('result');
      expect(monitor.getMetrics()).toHaveLength(0);
    });
  });

  describe('measureSync', () => {
    beforeEach(() => {
      monitor.enable();
    });

    it('should measure sync operation duration', () => {
      mockPerformanceNow
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(1050);

      const result = monitor.measureSync('sync-task', () => {
        return 42;
      });

      expect(result).toBe(42);
      
      const metrics = monitor.getMetrics();
      expect(metrics).toHaveLength(1);
      expect(metrics[0]).toMatchObject({
        operation: 'sync-task',
        duration: 50
      });
    });

    it('should track errors in sync operations', () => {
      mockPerformanceNow
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(1100);

      expect(() => {
        monitor.measureSync('failing-sync', () => {
          throw new Error('Sync failed');
        });
      }).toThrow('Sync failed');

      const metrics = monitor.getMetrics();
      expect(metrics[0]).toMatchObject({
        operation: 'failing-sync',
        duration: 100,
        metadata: { error: true }
      });
    });

    it('should not measure when disabled', () => {
      monitor.disable();

      const result = monitor.measureSync('test', () => 123);

      expect(result).toBe(123);
      expect(monitor.getMetrics()).toHaveLength(0);
    });
  });

  describe('getMetrics', () => {
    beforeEach(() => {
      monitor.enable();
    });

    it('should filter metrics by operation', () => {
      // Add various metrics
      monitor.measureSync('op-a', () => 1);
      monitor.measureSync('op-b', () => 2);
      monitor.measureSync('op-a', () => 3);

      const allMetrics = monitor.getMetrics();
      expect(allMetrics).toHaveLength(3);

      const opAMetrics = monitor.getMetrics('op-a');
      expect(opAMetrics).toHaveLength(2);
      expect(opAMetrics.every(m => m.operation === 'op-a')).toBe(true);
    });

    it('should filter metrics by time', () => {
      mockPerformanceNow
        .mockReturnValueOnce(1000).mockReturnValueOnce(1100) // metric 1
        .mockReturnValueOnce(2000).mockReturnValueOnce(2100) // metric 2
        .mockReturnValueOnce(3000).mockReturnValueOnce(3100); // metric 3

      monitor.measureSync('test', () => 1);
      monitor.measureSync('test', () => 2);
      monitor.measureSync('test', () => 3);

      const recentMetrics = monitor.getMetrics(undefined, 2500);
      expect(recentMetrics).toHaveLength(1);
      expect(recentMetrics[0].startTime).toBe(3000);
    });

    it('should filter by both operation and time', () => {
      mockPerformanceNow
        .mockReturnValueOnce(1000).mockReturnValueOnce(1100)
        .mockReturnValueOnce(2000).mockReturnValueOnce(2100)
        .mockReturnValueOnce(3000).mockReturnValueOnce(3100);

      monitor.measureSync('op-a', () => 1);
      monitor.measureSync('op-b', () => 2);
      monitor.measureSync('op-a', () => 3);

      const filtered = monitor.getMetrics('op-a', 1500);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].operation).toBe('op-a');
      expect(filtered[0].startTime).toBe(3000);
    });

    it('should limit stored metrics to prevent memory growth', () => {
      monitor.enable();
      
      // Add more than maxMetrics (10000)
      for (let i = 0; i < 11000; i++) {
        mockPerformanceNow
          .mockReturnValueOnce(i * 10)
          .mockReturnValueOnce(i * 10 + 5);
        monitor.measureSync(`op-${i}`, () => i);
      }

      const metrics = monitor.getMetrics();
      expect(metrics.length).toBeLessThanOrEqual(10000);
      // Should keep the most recent metrics
      expect(metrics[metrics.length - 1].operation).toBe('op-10999');
    });
  });

  describe('generateReport', () => {
    beforeEach(() => {
      monitor.enable();
    });

    it('should generate empty report when no metrics', () => {
      const report = monitor.generateReport();

      expect(report).toEqual({
        totalOperations: 0,
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        p50Duration: 0,
        p95Duration: 0,
        p99Duration: 0,
        operationBreakdown: {}
      });
    });

    it('should generate report with statistics', () => {
      // Add metrics with varying durations
      const durations = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      durations.forEach((duration, i) => {
        mockPerformanceNow
          .mockReturnValueOnce(i * 1000)
          .mockReturnValueOnce(i * 1000 + duration);
        monitor.measureSync('test-op', () => null);
      });

      const report = monitor.generateReport();

      expect(report).toMatchObject({
        totalOperations: 10,
        averageDuration: 55, // (10+20+...+100)/10
        minDuration: 10,
        maxDuration: 100,
        p50Duration: 60, // 50th percentile (index 5 in 0-based array)
        p95Duration: 100, // 95th percentile (index 9)
        p99Duration: 100 // 99th percentile (index 9)
      });
    });

    it('should breakdown by operation type', () => {
      // Add metrics for different operations
      mockPerformanceNow
        .mockReturnValueOnce(1000).mockReturnValueOnce(1100) // db-query: 100ms
        .mockReturnValueOnce(2000).mockReturnValueOnce(2200) // api-call: 200ms
        .mockReturnValueOnce(3000).mockReturnValueOnce(3050) // db-query: 50ms
        .mockReturnValueOnce(4000).mockReturnValueOnce(4300); // api-call: 300ms

      monitor.measureSync('db-query', () => null);
      monitor.measureSync('api-call', () => null);
      monitor.measureSync('db-query', () => null);
      monitor.measureSync('api-call', () => null);

      const report = monitor.generateReport();

      expect(report.operationBreakdown).toEqual({
        'db-query': {
          count: 2,
          avgDuration: 75, // (100+50)/2
          totalDuration: 150
        },
        'api-call': {
          count: 2,
          avgDuration: 250, // (200+300)/2
          totalDuration: 500
        }
      });
    });

    it('should filter report by time', () => {
      mockPerformanceNow
        .mockReturnValueOnce(1000).mockReturnValueOnce(1100) // old
        .mockReturnValueOnce(5000).mockReturnValueOnce(5200); // recent

      monitor.measureSync('test', () => null);
      monitor.measureSync('test', () => null);

      const fullReport = monitor.generateReport();
      expect(fullReport.totalOperations).toBe(2);

      const recentReport = monitor.generateReport(3000);
      expect(recentReport.totalOperations).toBe(1);
      expect(recentReport.averageDuration).toBe(200);
    });
  });

  describe('clear', () => {
    it('should clear all metrics', () => {
      monitor.enable();
      monitor.measureSync('test', () => null);
      
      expect(monitor.getMetrics()).toHaveLength(1);

      monitor.clear();

      expect(monitor.getMetrics()).toHaveLength(0);
    });

    it('should clear active operations', () => {
      monitor.enable();
      monitor.startOperation('op1', 'test');
      
      monitor.clear();

      // Should not throw or warn
      monitor.endOperation('op1', 'test');
      expect(console.warn).toHaveBeenCalledWith('No start time found for operation: test:op1');
    });
  });

  describe('logSlowOperations', () => {
    beforeEach(() => {
      monitor.enable();
      console.warn = jest.fn();
    });

    it('should log operations slower than threshold', () => {
      mockPerformanceNow
        .mockReturnValueOnce(1000).mockReturnValueOnce(1050)  // 50ms - fast
        .mockReturnValueOnce(2000).mockReturnValueOnce(2150)  // 150ms - slow
        .mockReturnValueOnce(3000).mockReturnValueOnce(3300); // 300ms - slow

      monitor.measureSync('fast-op', () => null);
      monitor.measureSync('slow-op-1', () => null, { context: 'test' });
      monitor.measureSync('slow-op-2', () => null);

      monitor.logSlowOperations(100);

      expect(console.warn).toHaveBeenCalledWith('Found 2 slow operations (>100ms):');
      expect(console.warn).toHaveBeenCalledWith('  slow-op-1: 150.00ms', { context: 'test' });
      expect(console.warn).toHaveBeenCalledWith('  slow-op-2: 300.00ms', '');
    });

    it('should use default threshold of 100ms', () => {
      mockPerformanceNow
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(1120); // 120ms

      monitor.measureSync('slow', () => null);

      monitor.logSlowOperations();

      expect(console.warn).toHaveBeenCalledWith('Found 1 slow operations (>100ms):');
    });

    it('should not log when no slow operations', () => {
      mockPerformanceNow
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(1050); // 50ms

      monitor.measureSync('fast', () => null);

      monitor.logSlowOperations(100);

      expect(console.warn).not.toHaveBeenCalled();
    });
  });

  describe('exportMetrics/importMetrics', () => {
    beforeEach(() => {
      monitor.enable();
    });

    it('should export metrics as JSON string', () => {
      monitor.measureSync('test', () => null, { value: 42 });

      const exported = monitor.exportMetrics();
      const parsed = JSON.parse(exported);

      expect(parsed).toBeInstanceOf(Array);
      expect(parsed).toHaveLength(1);
      expect(parsed[0]).toMatchObject({
        operation: 'test',
        metadata: { value: 42 }
      });
    });

    it('should import metrics from JSON string', () => {
      const metricsData = JSON.stringify([
        {
          operation: 'imported-op',
          startTime: 1000,
          endTime: 1500,
          duration: 500,
          metadata: { imported: true }
        }
      ]);

      monitor.importMetrics(metricsData);

      const metrics = monitor.getMetrics();
      expect(metrics).toHaveLength(1);
      expect(metrics[0]).toMatchObject({
        operation: 'imported-op',
        duration: 500,
        metadata: { imported: true }
      });
    });

    it('should handle invalid import data', () => {
      console.error = jest.fn();

      monitor.importMetrics('invalid json');

      expect(console.error).toHaveBeenCalledWith('Failed to import metrics:', expect.any(Error));
      expect(monitor.getMetrics()).toHaveLength(0);
    });

    it('should ignore non-array imports', () => {
      monitor.importMetrics('{"not": "array"}');

      expect(monitor.getMetrics()).toHaveLength(0);
    });
  });
});