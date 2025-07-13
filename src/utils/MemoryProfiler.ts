/**
 * Memory Profiler for DAMS Geo SDK
 * 
 * Monitors memory usage during SDK operations to identify leaks
 * and optimize memory consumption.
 */

import { Platform } from 'react-native';

interface MemorySnapshot {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  label: string;
}

interface MemoryReport {
  baseline: MemorySnapshot;
  peak: MemorySnapshot;
  current: MemorySnapshot;
  snapshots: MemorySnapshot[];
  leakDetected: boolean;
  analysis: string[];
}

export class MemoryProfiler {
  private static instance: MemoryProfiler;
  private snapshots: MemorySnapshot[] = [];
  private baseline: MemorySnapshot | null = null;
  private isMonitoring = false;
  private monitoringInterval: ReturnType<typeof setInterval> | null = null;
  
  private constructor() {}

  static getInstance(): MemoryProfiler {
    if (!MemoryProfiler.instance) {
      MemoryProfiler.instance = new MemoryProfiler();
    }
    return MemoryProfiler.instance;
  }

  /**
   * Start memory monitoring
   */
  startMonitoring(intervalMs: number = 1000): void {
    if (this.isMonitoring) {
      console.warn('[MemoryProfiler] Already monitoring');
      return;
    }

    this.isMonitoring = true;
    this.snapshots = [];
    this.baseline = this.captureSnapshot('baseline');

    this.monitoringInterval = setInterval(() => {
      this.captureSnapshot('auto');
    }, intervalMs);
  }

  /**
   * Stop memory monitoring
   */
  stopMonitoring(): MemoryReport {
    if (!this.isMonitoring) {
      console.warn('[MemoryProfiler] Not currently monitoring');
      return this.generateEmptyReport();
    }

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.isMonitoring = false;
    const _finalSnapshot = this.captureSnapshot('final');
    
    return this.generateReport();
  }

  /**
   * Capture a memory snapshot
   */
  captureSnapshot(label: string): MemorySnapshot {
    const memory = this.getMemoryUsage();
    
    const snapshot: MemorySnapshot = {
      timestamp: Date.now(),
      heapUsed: memory.heapUsed,
      heapTotal: memory.heapTotal,
      external: memory.external || 0,
      label,
    };

    this.snapshots.push(snapshot);
    return snapshot;
  }

  /**
   * Mark a specific point in execution
   */
  mark(label: string): void {
    if (!this.isMonitoring) {
      console.warn('[MemoryProfiler] Not monitoring, mark ignored');
      return;
    }
    
    this.captureSnapshot(label);
  }

  /**
   * Get memory usage based on platform
   */
  private getMemoryUsage(): any {
    if (Platform.OS === 'web' || typeof process !== 'undefined') {
      // Node.js environment (for testing)
      return process.memoryUsage();
    }
    
    // For React Native, we need to use native modules
    // This is a simplified version - in production, you'd use a native module
    return {
      heapUsed: 0,
      heapTotal: 0,
      external: 0,
    };
  }

  /**
   * Generate memory report
   */
  private generateReport(): MemoryReport {
    if (!this.baseline || this.snapshots.length === 0) {
      return this.generateEmptyReport();
    }

    const peak = this.findPeakUsage();
    const current = this.snapshots[this.snapshots.length - 1];
    const leakDetected = this.detectMemoryLeak();
    const analysis = this.analyzeMemoryPattern();

    return {
      baseline: this.baseline,
      peak,
      current,
      snapshots: this.snapshots,
      leakDetected,
      analysis,
    };
  }

  /**
   * Find peak memory usage
   */
  private findPeakUsage(): MemorySnapshot {
    return this.snapshots.reduce((peak, snapshot) => 
      snapshot.heapUsed > peak.heapUsed ? snapshot : peak
    );
  }

  /**
   * Detect potential memory leaks
   */
  private detectMemoryLeak(): boolean {
    if (this.snapshots.length < 10) {
      return false;
    }

    // Simple leak detection: consistent memory growth
    const recentSnapshots = this.snapshots.slice(-10);
    let increasingCount = 0;

    for (let i = 1; i < recentSnapshots.length; i++) {
      if (recentSnapshots[i].heapUsed > recentSnapshots[i - 1].heapUsed) {
        increasingCount++;
      }
    }

    // If memory increased in 80% of recent snapshots, possible leak
    return increasingCount > recentSnapshots.length * 0.8;
  }

  /**
   * Analyze memory usage pattern
   */
  private analyzeMemoryPattern(): string[] {
    const analysis: string[] = [];
    
    if (!this.baseline || this.snapshots.length === 0) {
      return analysis;
    }

    // Memory growth
    const current = this.snapshots[this.snapshots.length - 1];
    const growth = current.heapUsed - this.baseline.heapUsed;
    const growthPercent = (growth / this.baseline.heapUsed) * 100;
    
    analysis.push(`Total memory growth: ${this.formatBytes(growth)} (${growthPercent.toFixed(1)}%)`);

    // Average memory usage
    const avgHeap = this.snapshots.reduce((sum, s) => sum + s.heapUsed, 0) / this.snapshots.length;
    analysis.push(`Average heap usage: ${this.formatBytes(avgHeap)}`);

    // Memory spikes
    const spikes = this.findMemorySpikes();
    if (spikes.length > 0) {
      analysis.push(`Memory spikes detected at: ${spikes.map(s => s.label).join(', ')}`);
    }

    // Garbage collection patterns
    const gcEvents = this.detectGCEvents();
    if (gcEvents > 0) {
      analysis.push(`Detected ${gcEvents} probable GC events`);
    }

    return analysis;
  }

  /**
   * Find memory spikes
   */
  private findMemorySpikes(): MemorySnapshot[] {
    const spikes: MemorySnapshot[] = [];
    const avgHeap = this.snapshots.reduce((sum, s) => sum + s.heapUsed, 0) / this.snapshots.length;
    const threshold = avgHeap * 1.5; // 50% above average

    for (const snapshot of this.snapshots) {
      if (snapshot.heapUsed > threshold) {
        spikes.push(snapshot);
      }
    }

    return spikes;
  }

  /**
   * Detect garbage collection events
   */
  private detectGCEvents(): number {
    let gcEvents = 0;
    
    for (let i = 1; i < this.snapshots.length; i++) {
      const drop = this.snapshots[i - 1].heapUsed - this.snapshots[i].heapUsed;
      const dropPercent = (drop / this.snapshots[i - 1].heapUsed) * 100;
      
      // If memory dropped by more than 10%, likely a GC event
      if (dropPercent > 10) {
        gcEvents++;
      }
    }

    return gcEvents;
  }

  /**
   * Format bytes to human readable
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) {return '0 B';}
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Generate empty report
   */
  private generateEmptyReport(): MemoryReport {
    const emptySnapshot: MemorySnapshot = {
      timestamp: Date.now(),
      heapUsed: 0,
      heapTotal: 0,
      external: 0,
      label: 'empty',
    };

    return {
      baseline: emptySnapshot,
      peak: emptySnapshot,
      current: emptySnapshot,
      snapshots: [],
      leakDetected: false,
      analysis: ['No data collected'],
    };
  }

  /**
   * Print memory report
   */
  printReport(report: MemoryReport): void {
    console.log('\n=== Memory Profile Report ===\n');
    
    console.log(`Baseline: ${this.formatBytes(report.baseline.heapUsed)}`);
    console.log(`Peak: ${this.formatBytes(report.peak.heapUsed)} (at ${report.peak.label})`);
    console.log(`Final: ${this.formatBytes(report.current.heapUsed)}`);
    console.log(`Leak detected: ${report.leakDetected ? 'YES ⚠️' : 'NO ✅'}`);
    
    console.log('\nAnalysis:');
    report.analysis.forEach(item => console.log(`  - ${item}`));
    
    if (report.leakDetected) {
      console.log('\n⚠️  WARNING: Potential memory leak detected!');
      console.log('Consider reviewing:');
      console.log('  - Event listener cleanup');
      console.log('  - Timer/interval cleanup');
      console.log('  - Large data structure retention');
    }
  }

  /**
   * Reset profiler state
   */
  reset(): void {
    if (this.isMonitoring) {
      this.stopMonitoring();
    }
    
    this.snapshots = [];
    this.baseline = null;
  }
}

// Helper function for iOS native memory monitoring
export function setupIOSMemoryMonitoring(): void {
  // In a real implementation, this would set up native iOS memory monitoring
  // using task_info and mach_task_basic_info
  console.log('[MemoryProfiler] iOS memory monitoring would be set up here');
}

// Helper function for Android native memory monitoring
export function setupAndroidMemoryMonitoring(): void {
  // In a real implementation, this would set up native Android memory monitoring
  // using Debug.MemoryInfo and ActivityManager
  console.log('[MemoryProfiler] Android memory monitoring would be set up here');
}

export default MemoryProfiler.getInstance();