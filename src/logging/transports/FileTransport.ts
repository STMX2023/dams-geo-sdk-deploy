/**
 * File transport for logging - persists logs to database
 */

import { LogTransport, LogEntry, LogLevel } from '../LogLevel';
import { DatabaseManager } from '../../database/DatabaseManager';
import { createError, DamsGeoErrorCode } from '../../errors/DamsGeoError';

export interface FileTransportOptions {
  maxEntries?: number;
  maxAge?: number; // in milliseconds
  tableName?: string;
}

export class FileTransport implements LogTransport {
  name = 'file';
  
  private dbManager: DatabaseManager;
  private readonly maxEntries: number;
  private readonly maxAge: number;
  private readonly tableName: string;
  private isInitialized = false;
  private queue: LogEntry[] = [];
  
  constructor(options: FileTransportOptions = {}) {
    this.maxEntries = options.maxEntries || 10000;
    this.maxAge = options.maxAge || 7 * 24 * 60 * 60 * 1000; // 7 days
    this.tableName = options.tableName || 'logs';
    this.dbManager = DatabaseManager.getInstance();
  }
  
  async initialize(): Promise<void> {
    if (this.isInitialized) {return;}
    
    try {
      // Create logs table if it doesn't exist
      // Ensure database is initialized
      if (!this.dbManager['db']) {
        throw new Error('Database not initialized');
      }
      const db = this.dbManager['db'];
      
      await db.execute(`
        CREATE TABLE IF NOT EXISTS ${this.tableName} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp INTEGER NOT NULL,
          level INTEGER NOT NULL,
          category TEXT NOT NULL,
          message TEXT NOT NULL,
          data TEXT,
          error TEXT,
          context TEXT,
          created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
        )
      `);
      
      // Create index for efficient queries
      await db.execute(`
        CREATE INDEX IF NOT EXISTS idx_${this.tableName}_timestamp 
        ON ${this.tableName}(timestamp DESC)
      `);
      
      await db.execute(`
        CREATE INDEX IF NOT EXISTS idx_${this.tableName}_level 
        ON ${this.tableName}(level)
      `);
      
      this.isInitialized = true;
      
      // Process queued logs
      if (this.queue.length > 0) {
        const queuedLogs = [...this.queue];
        this.queue = [];
        for (const entry of queuedLogs) {
          await this.persistLog(entry);
        }
      }
    } catch (error) {
      throw createError(
        DamsGeoErrorCode.DATABASE_ERROR,
        'Failed to initialize logging database',
        { originalError: error as Error }
      );
    }
  }
  
  async log(entry: LogEntry): Promise<void> {
    if (!this.isInitialized) {
      // Queue logs until initialized
      this.queue.push(entry);
      this.initialize().catch(console.error);
      return;
    }
    
    await this.persistLog(entry);
  }
  
  private async persistLog(entry: LogEntry): Promise<void> {
    try {
      const db = this.dbManager['db'];
      if (!db) {return;}
      
      await db.execute(
        `INSERT INTO ${this.tableName} (timestamp, level, category, message, data, error, context)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          entry.timestamp,
          entry.level,
          entry.category,
          entry.message,
          entry.data ? JSON.stringify(entry.data) : null,
          entry.error ? JSON.stringify({
            name: entry.error.name,
            message: entry.error.message,
            stack: entry.error.stack
          }) : null,
          entry.context ? JSON.stringify(entry.context) : null
        ]
      );
      
      // Cleanup old logs periodically
      if (Math.random() < 0.01) { // 1% chance
        await this.cleanup();
      }
    } catch (error) {
      // Don't throw in logging - fail silently
      console.error('[FileTransport] Failed to persist log:', error);
    }
  }
  
  async cleanup(): Promise<void> {
    try {
      const db = this.dbManager['db'];
      if (!db) {return;}
      
      // Remove logs older than maxAge
      const cutoffTime = Date.now() - this.maxAge;
      await db.execute(
        `DELETE FROM ${this.tableName} WHERE timestamp < ?`,
        [cutoffTime]
      );
      
      // Keep only maxEntries most recent logs
      await db.execute(`
        DELETE FROM ${this.tableName} 
        WHERE id NOT IN (
          SELECT id FROM ${this.tableName} 
          ORDER BY timestamp DESC 
          LIMIT ?
        )
      `, [this.maxEntries]);
    } catch (error) {
      console.error('[FileTransport] Failed to cleanup logs:', error);
    }
  }
  
  async flush(): Promise<void> {
    // Process any queued logs
    if (this.queue.length > 0) {
      const queuedLogs = [...this.queue];
      this.queue = [];
      for (const entry of queuedLogs) {
        await this.persistLog(entry);
      }
    }
  }
  
  async getLogs(options?: {
    startTime?: number;
    endTime?: number;
    level?: LogLevel;
    category?: string;
    limit?: number;
  }): Promise<LogEntry[]> {
    try {
      const db = this.dbManager['db'];
      if (!db) {return [];}
      
      let query = `SELECT * FROM ${this.tableName} WHERE 1=1`;
      const params: any[] = [];
      
      if (options?.startTime) {
        query += ' AND timestamp >= ?';
        params.push(options.startTime);
      }
      
      if (options?.endTime) {
        query += ' AND timestamp <= ?';
        params.push(options.endTime);
      }
      
      if (options?.level !== undefined) {
        query += ' AND level >= ?';
        params.push(options.level);
      }
      
      if (options?.category) {
        query += ' AND category = ?';
        params.push(options.category);
      }
      
      query += ' ORDER BY timestamp DESC';
      
      if (options?.limit) {
        query += ' LIMIT ?';
        params.push(options.limit);
      }
      
      const result = await db.execute(query, params);
      const rows = result.rows || [];
      
      return rows.map((row: any) => ({
        timestamp: row.timestamp,
        level: row.level,
        category: row.category,
        message: row.message,
        data: row.data ? JSON.parse(row.data) : undefined,
        error: row.error ? JSON.parse(row.error) : undefined,
        context: row.context ? JSON.parse(row.context) : undefined
      }));
    } catch (error) {
      console.error('[FileTransport] Failed to get logs:', error);
      return [];
    }
  }
}