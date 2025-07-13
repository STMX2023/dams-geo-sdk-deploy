/**
 * DAMS Geo SDK Logging Module
 * 
 * Exports all logging utilities and types
 */

export {
  LogLevel,
  LogEntry,
  LogContext,
  LogTransport,
  LoggerConfig
} from './LogLevel';

export {
  Logger,
  ChildLogger,
  logger
} from './Logger';

export { ConsoleTransport } from './transports/ConsoleTransport';
export { FileTransport } from './transports/FileTransport';
export { RemoteTransport } from './transports/RemoteTransport';

/**
 * Convenience functions for logging
 */
import { logger } from './Logger';

export const logTrace = (category: string, message: string, data?: any) => 
  logger.trace(category, message, data);

export const logDebug = (category: string, message: string, data?: any) => 
  logger.debug(category, message, data);

export const logInfo = (category: string, message: string, data?: any) => 
  logger.info(category, message, data);

export const logWarn = (category: string, message: string, data?: any) => 
  logger.warn(category, message, data);

export const logError = (category: string, message: string, error?: Error, data?: any) => 
  logger.error(category, message, error, data);

export const logFatal = (category: string, message: string, error?: Error, data?: any) => 
  logger.fatal(category, message, error, data);