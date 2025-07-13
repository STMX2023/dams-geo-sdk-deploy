/**
 * Console transport for logging
 */

import { LogTransport, LogEntry, LogLevel } from '../LogLevel';

export class ConsoleTransport implements LogTransport {
  name = 'console';
  
  private readonly colors: Record<LogLevel, string> = {
    [LogLevel.TRACE]: '\x1b[90m', // Gray
    [LogLevel.DEBUG]: '\x1b[36m', // Cyan
    [LogLevel.INFO]: '\x1b[32m',  // Green
    [LogLevel.WARN]: '\x1b[33m',  // Yellow
    [LogLevel.ERROR]: '\x1b[31m', // Red
    [LogLevel.FATAL]: '\x1b[35m', // Magenta
    [LogLevel.OFF]: '',           // No color for OFF
  };
  
  private readonly reset = '\x1b[0m';
  
  log(entry: LogEntry): void {
    const color = this.colors[entry.level] || '';
    const levelName = LogLevel[entry.level];
    const timestamp = new Date(entry.timestamp).toISOString();
    
    let message = `${color}[${timestamp}] [${levelName}] [${entry.category}] ${entry.message}${this.reset}`;
    
    if (entry.data) {
      message += '\n' + JSON.stringify(entry.data, null, 2);
    }
    
    if (entry.error) {
      message += '\n' + entry.error.stack;
    }
    
    switch (entry.level) {
      case LogLevel.TRACE:
      case LogLevel.DEBUG:
        console.debug(message);
        break;
      case LogLevel.INFO:
        console.log(message);
        break;
      case LogLevel.WARN:
        console.warn(message);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(message);
        break;
    }
  }
}