/**
 * Log levels for DAMS Geo SDK
 */

export enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
  FATAL = 5,
  OFF = 99
}

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  category: string;
  message: string;
  data?: any;
  error?: Error;
  context?: LogContext;
}

export interface LogContext {
  userId?: string;
  sessionId?: string;
  operation?: string;
  component?: string;
  metadata?: Record<string, any>;
}

export interface LogTransport {
  name: string;
  log(entry: LogEntry): void | Promise<void>;
  flush?(): Promise<void>;
}

export interface LoggerConfig {
  level: LogLevel;
  transports: LogTransport[];
  enableConsole: boolean;
  enableFile: boolean;
  enableRemote: boolean;
  maxFileSize?: number;
  maxFiles?: number;
  remoteEndpoint?: string;
  remoteApiKey?: string;
  batchSize?: number;
  flushInterval?: number;
}