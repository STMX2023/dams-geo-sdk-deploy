export { default } from './DamsGeo';
export * from './DamsGeo.types';

// Export error handling utilities
export {
  DamsGeoError,
  DamsGeoErrorCode,
  ErrorSeverity,
  createError,
  isDamsGeoError,
  DamsGeoErrorBoundary,
  useDamsGeoError,
  withDamsGeoErrorBoundary
} from './errors';

// Export logging utilities
export { 
  LogLevel,
  logger,
  Logger,
  ChildLogger,
  ConsoleTransport,
  FileTransport,
  RemoteTransport,
  logTrace,
  logDebug,
  logInfo,
  logWarn,
  logError,
  logFatal
} from './logging';
export type { 
  LogEntry,
  LogContext,
  LogTransport,
  LoggerConfig 
} from './logging';