/**
 * Remote transport for sending logs to a server
 */

import { LogTransport, LogEntry, LogLevel } from '../LogLevel';
import { retryManager } from '../../errors';

export interface RemoteTransportOptions {
  endpoint: string;
  apiKey?: string;
  batchSize?: number;
  flushInterval?: number;
  maxRetries?: number;
  headers?: Record<string, string>;
}

export class RemoteTransport implements LogTransport {
  name = 'remote';
  
  private readonly endpoint: string;
  private readonly apiKey?: string;
  private readonly batchSize: number;
  private readonly flushInterval: number;
  private readonly maxRetries: number;
  private readonly headers: Record<string, string>;
  
  private batch: LogEntry[] = [];
  private flushTimer?: NodeJS.Timeout;
  private isFlashing = false;
  
  constructor(options: RemoteTransportOptions) {
    this.endpoint = options.endpoint;
    this.apiKey = options.apiKey;
    this.batchSize = options.batchSize || 100;
    this.flushInterval = options.flushInterval || 30000; // 30 seconds
    this.maxRetries = options.maxRetries || 3;
    this.headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };
    
    if (this.apiKey) {
      this.headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    
    this.startFlushTimer();
  }
  
  log(entry: LogEntry): void {
    this.batch.push(entry);
    
    if (this.batch.length >= this.batchSize) {
      this.flush().catch(console.error);
    }
  }
  
  async flush(): Promise<void> {
    if (this.isFlashing || this.batch.length === 0) {
      return;
    }
    
    this.isFlashing = true;
    const logsToSend = [...this.batch];
    this.batch = [];
    
    try {
      await retryManager.withRetry(
        async () => {
          const response = await fetch(this.endpoint, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify({
              logs: logsToSend.map(entry => ({
                timestamp: entry.timestamp,
                level: LogLevel[entry.level],
                category: entry.category,
                message: entry.message,
                data: entry.data,
                error: entry.error ? {
                  name: entry.error.name,
                  message: entry.error.message,
                  stack: entry.error.stack
                } : undefined,
                context: entry.context
              }))
            })
          });
          
          if (!response.ok) {
            throw new Error(`Failed to send logs: ${response.status} ${response.statusText}`);
          }
        },
        {
          maxRetries: this.maxRetries,
          retryCondition: (error) => {
            // Retry on network errors or 5xx server errors
            if (error.name === 'NetworkError' || error.name === 'TypeError') {
              return true;
            }
            if (error.message.includes('Failed to send logs:')) {
              const status = parseInt(error.message.match(/:\s*(\d+)/)?.[1] || '0');
              return status >= 500 && status < 600;
            }
            return false;
          }
        },
        'RemoteTransport.flush'
      );
    } catch (error) {
      // Failed to send logs - add them back to batch
      console.error('[RemoteTransport] Failed to send logs:', error);
      this.batch.unshift(...logsToSend);
      
      // Trim batch if it's getting too large
      if (this.batch.length > this.batchSize * 3) {
        this.batch = this.batch.slice(-this.batchSize * 2);
      }
    } finally {
      this.isFlashing = false;
    }
  }
  
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush().catch(console.error);
    }, this.flushInterval);
  }
  
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    
    // Try to flush remaining logs
    this.flush().catch(console.error);
  }
}