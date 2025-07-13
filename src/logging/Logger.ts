/**
 * Main logger implementation for DAMS Geo SDK
 */

import { 
  LogLevel, 
  LogEntry, 
  LogTransport, 
  LoggerConfig,
  LogContext 
} from './LogLevel';
import { ConsoleTransport } from './transports/ConsoleTransport';
import { FileTransport } from './transports/FileTransport';
import { RemoteTransport } from './transports/RemoteTransport';
import { errorContext } from '../errors';

export class Logger {
  private static instance: Logger;
  private config: LoggerConfig;
  private transports: Map<string, LogTransport> = new Map();
  private context: LogContext = {};
  
  private constructor() {
    // Default configuration
    this.config = {
      level: __DEV__ ? LogLevel.DEBUG : LogLevel.INFO,
      transports: [],
      enableConsole: __DEV__,
      enableFile: true,
      enableRemote: false
    };
  }
  
  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }
  
  /**
   * Configure the logger
   */
  configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Update transports based on configuration
    this.updateTransports();
  }
  
  /**
   * Update active transports based on configuration
   */
  private updateTransports(): void {
    // Clear existing transports
    this.transports.clear();
    
    // Add console transport
    if (this.config.enableConsole) {
      this.transports.set('console', new ConsoleTransport());
    }
    
    // Add file transport
    if (this.config.enableFile) {
      const fileTransport = new FileTransport({
        maxEntries: this.config.maxFiles,
        maxAge: this.config.maxFileSize
      });
      this.transports.set('file', fileTransport);
      
      // Initialize file transport
      fileTransport.initialize().catch(error => {
        console.error('[Logger] Failed to initialize file transport:', error);
      });
    }
    
    // Add remote transport
    if (this.config.enableRemote && this.config.remoteEndpoint) {
      const remoteTransport = new RemoteTransport({
        endpoint: this.config.remoteEndpoint,
        apiKey: this.config.remoteApiKey,
        batchSize: this.config.batchSize,
        flushInterval: this.config.flushInterval
      });
      this.transports.set('remote', remoteTransport);
    }
    
    // Add custom transports
    for (const transport of this.config.transports) {
      this.transports.set(transport.name, transport);
    }
  }
  
  /**
   * Set global context for all log entries
   */
  setContext(context: Partial<LogContext>): void {
    this.context = { ...this.context, ...context };
  }
  
  /**
   * Clear global context
   */
  clearContext(): void {
    this.context = {};
  }
  
  /**
   * Core logging method
   */
  private log(
    level: LogLevel, 
    category: string, 
    message: string, 
    data?: any, 
    error?: Error,
    context?: LogContext
  ): void {
    // Check if we should log this level
    if (level < this.config.level) {
      return;
    }
    
    // Create log entry
    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      category,
      message,
      data,
      error,
      context: {
        ...this.context,
        ...context
      }
    };
    
    // Add breadcrumb to error context
    errorContext.addBreadcrumb({
      category,
      message,
      level: this.mapLogLevelToBreadcrumbLevel(level),
      data
    });
    
    // Send to all transports
    for (const transport of this.transports.values()) {
      try {
        const result = transport.log(entry);
        if (result instanceof Promise) {
          result.catch(error => {
            console.error(`[Logger] Transport ${transport.name} failed:`, error);
          });
        }
      } catch (error) {
        console.error(`[Logger] Transport ${transport.name} failed:`, error);
      }
    }
  }
  
  /**
   * Map log level to breadcrumb level
   */
  private mapLogLevelToBreadcrumbLevel(level: LogLevel): 'debug' | 'info' | 'warning' | 'error' {
    switch (level) {
      case LogLevel.TRACE:
      case LogLevel.DEBUG:
        return 'debug';
      case LogLevel.INFO:
        return 'info';
      case LogLevel.WARN:
        return 'warning';
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        return 'error';
      default:
        return 'info';
    }
  }
  
  /**
   * Log methods for each level
   */
  trace(category: string, message: string, data?: any, context?: LogContext): void {
    this.log(LogLevel.TRACE, category, message, data, undefined, context);
  }
  
  debug(category: string, message: string, data?: any, context?: LogContext): void {
    this.log(LogLevel.DEBUG, category, message, data, undefined, context);
  }
  
  info(category: string, message: string, data?: any, context?: LogContext): void {
    this.log(LogLevel.INFO, category, message, data, undefined, context);
  }
  
  warn(category: string, message: string, data?: any, context?: LogContext): void {
    this.log(LogLevel.WARN, category, message, data, undefined, context);
  }
  
  error(category: string, message: string, error?: Error, data?: any, context?: LogContext): void {
    this.log(LogLevel.ERROR, category, message, data, error, context);
  }
  
  fatal(category: string, message: string, error?: Error, data?: any, context?: LogContext): void {
    this.log(LogLevel.FATAL, category, message, data, error, context);
  }
  
  /**
   * Create a child logger with additional context
   */
  child(context: LogContext): ChildLogger {
    return new ChildLogger(this, context);
  }
  
  /**
   * Flush all transports
   */
  async flush(): Promise<void> {
    const flushPromises: Promise<void>[] = [];
    
    for (const transport of this.transports.values()) {
      if (transport.flush) {
        flushPromises.push(transport.flush());
      }
    }
    
    await Promise.all(flushPromises);
  }
  
  /**
   * Get logs from file transport
   */
  async getLogs(options?: {
    startTime?: number;
    endTime?: number;
    level?: LogLevel;
    category?: string;
    limit?: number;
  }): Promise<LogEntry[]> {
    const fileTransport = this.transports.get('file') as FileTransport;
    if (!fileTransport) {
      return [];
    }
    
    return fileTransport.getLogs(options);
  }
  
  /**
   * Export logs for debugging
   */
  async exportLogs(options?: {
    startTime?: number;
    endTime?: number;
    format?: 'json' | 'text';
  }): Promise<string> {
    const logs = await this.getLogs({
      startTime: options?.startTime,
      endTime: options?.endTime
    });
    
    if (options?.format === 'text') {
      return logs.map(log => {
        const timestamp = new Date(log.timestamp).toISOString();
        const level = LogLevel[log.level];
        let text = `[${timestamp}] [${level}] [${log.category}] ${log.message}`;
        
        if (log.data) {
          text += '\nData: ' + JSON.stringify(log.data, null, 2);
        }
        
        if (log.error) {
          text += '\nError: ' + log.error.stack;
        }
        
        return text;
      }).join('\n\n');
    }
    
    return JSON.stringify(logs, null, 2);
  }
}

/**
 * Child logger with additional context
 */
export class ChildLogger {
  constructor(
    private parent: Logger,
    private context: LogContext
  ) {}
  
  trace(category: string, message: string, data?: any): void {
    this.parent.trace(category, message, data, this.context);
  }
  
  debug(category: string, message: string, data?: any): void {
    this.parent.debug(category, message, data, this.context);
  }
  
  info(category: string, message: string, data?: any): void {
    this.parent.info(category, message, data, this.context);
  }
  
  warn(category: string, message: string, data?: any): void {
    this.parent.warn(category, message, data, this.context);
  }
  
  error(category: string, message: string, error?: Error, data?: any): void {
    this.parent.error(category, message, error, data, this.context);
  }
  
  fatal(category: string, message: string, error?: Error, data?: any): void {
    this.parent.fatal(category, message, error, data, this.context);
  }
}

// Export singleton instance
export const logger = Logger.getInstance();