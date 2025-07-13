import { performance } from 'perf_hooks';

export interface PerformanceMetric {
  operation: string;
  startTime: number;
  endTime: number;
  duration: number;
  metadata?: Record<string, any>;
}

export interface PerformanceReport {
  totalOperations: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  p50Duration: number;
  p95Duration: number;
  p99Duration: number;
  operationBreakdown: Record<string, {
    count: number;
    avgDuration: number;
    totalDuration: number;
  }>;
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor | null = null;
  private metrics: PerformanceMetric[] = [];
  private activeOperations: Map<string, number> = new Map();
  private enabled: boolean = false;
  private maxMetrics: number = 10000; // Limit memory usage

  private constructor() {}

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  enable(): void {
    this.enabled = true;
  }

  disable(): void {
    this.enabled = false;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  startOperation(operationId: string, operation: string): void {
    if (!this.enabled) {return;}
    
    const key = `${operation}:${operationId}`;
    this.activeOperations.set(key, performance.now());
  }

  endOperation(operationId: string, operation: string, metadata?: Record<string, any>): void {
    if (!this.enabled) {return;}
    
    const key = `${operation}:${operationId}`;
    const startTime = this.activeOperations.get(key);
    
    if (startTime === undefined) {
      console.warn(`No start time found for operation: ${key}`);
      return;
    }
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    this.activeOperations.delete(key);
    
    this.addMetric({
      operation,
      startTime,
      endTime,
      duration,
      metadata,
    });
  }

  async measureAsync<T>(
    operation: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    if (!this.enabled) {
      return fn();
    }
    
    const startTime = performance.now();
    try {
      const result = await fn();
      const endTime = performance.now();
      
      this.addMetric({
        operation,
        startTime,
        endTime,
        duration: endTime - startTime,
        metadata,
      });
      
      return result;
    } catch (error) {
      const endTime = performance.now();
      
      this.addMetric({
        operation,
        startTime,
        endTime,
        duration: endTime - startTime,
        metadata: { ...metadata, error: true },
      });
      
      throw error;
    }
  }

  measureSync<T>(
    operation: string,
    fn: () => T,
    metadata?: Record<string, any>
  ): T {
    if (!this.enabled) {
      return fn();
    }
    
    const startTime = performance.now();
    try {
      const result = fn();
      const endTime = performance.now();
      
      this.addMetric({
        operation,
        startTime,
        endTime,
        duration: endTime - startTime,
        metadata,
      });
      
      return result;
    } catch (error) {
      const endTime = performance.now();
      
      this.addMetric({
        operation,
        startTime,
        endTime,
        duration: endTime - startTime,
        metadata: { ...metadata, error: true },
      });
      
      throw error;
    }
  }

  private addMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);
    
    // Prevent unbounded growth
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  getMetrics(operation?: string, since?: number): PerformanceMetric[] {
    let filtered = this.metrics;
    
    if (operation) {
      filtered = filtered.filter(m => m.operation === operation);
    }
    
    if (since) {
      filtered = filtered.filter(m => m.startTime >= since);
    }
    
    return filtered;
  }

  generateReport(since?: number): PerformanceReport {
    const metrics = this.getMetrics(undefined, since);
    
    if (metrics.length === 0) {
      return {
        totalOperations: 0,
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        p50Duration: 0,
        p95Duration: 0,
        p99Duration: 0,
        operationBreakdown: {},
      };
    }
    
    const durations = metrics.map(m => m.duration).sort((a, b) => a - b);
    const totalDuration = durations.reduce((sum, d) => sum + d, 0);
    
    // Calculate percentiles
    const p50Index = Math.floor(durations.length * 0.5);
    const p95Index = Math.floor(durations.length * 0.95);
    const p99Index = Math.floor(durations.length * 0.99);
    
    // Group by operation
    const operationBreakdown: Record<string, any> = {};
    metrics.forEach(m => {
      if (!operationBreakdown[m.operation]) {
        operationBreakdown[m.operation] = {
          count: 0,
          totalDuration: 0,
          durations: [],
        };
      }
      
      operationBreakdown[m.operation].count++;
      operationBreakdown[m.operation].totalDuration += m.duration;
      operationBreakdown[m.operation].durations.push(m.duration);
    });
    
    // Calculate averages for each operation
    Object.keys(operationBreakdown).forEach(op => {
      const data = operationBreakdown[op];
      data.avgDuration = data.totalDuration / data.count;
      delete data.durations; // Remove raw data from report
    });
    
    return {
      totalOperations: metrics.length,
      averageDuration: totalDuration / metrics.length,
      minDuration: durations[0],
      maxDuration: durations[durations.length - 1],
      p50Duration: durations[p50Index],
      p95Duration: durations[p95Index],
      p99Duration: durations[p99Index],
      operationBreakdown,
    };
  }

  clear(): void {
    this.metrics = [];
    this.activeOperations.clear();
  }

  // Utility method to log slow operations
  logSlowOperations(threshold: number = 100): void {
    const slowOps = this.metrics.filter(m => m.duration > threshold);
    
    if (slowOps.length > 0) {
      console.warn(`Found ${slowOps.length} slow operations (>${threshold}ms):`);
      slowOps.forEach(op => {
        console.warn(`  ${op.operation}: ${op.duration.toFixed(2)}ms`, op.metadata || '');
      });
    }
  }

  // Export metrics for analysis
  exportMetrics(): string {
    return JSON.stringify(this.metrics, null, 2);
  }

  // Import metrics for analysis
  importMetrics(data: string): void {
    try {
      const imported = JSON.parse(data);
      if (Array.isArray(imported)) {
        this.metrics = imported;
      }
    } catch (error) {
      console.error('Failed to import metrics:', error);
    }
  }
}