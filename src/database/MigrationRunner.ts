/**
 * Database Migration Runner
 * 
 * Handles applying and rolling back database migrations
 * in the correct order with proper error handling.
 */

import { DatabaseManager } from './DatabaseManager';
import { Migration } from './migrations/001_add_circular_geofence_support';

export class MigrationRunner {
  private static instance: MigrationRunner | null = null;
  private db: DatabaseManager;
  private migrations: Migration[] = [];

  private constructor() {
    this.db = DatabaseManager.getInstance();
  }

  static getInstance(): MigrationRunner {
    if (!MigrationRunner.instance) {
      MigrationRunner.instance = new MigrationRunner();
    }
    return MigrationRunner.instance;
  }

  /**
   * Register a migration to be run
   */
  registerMigration(migration: Migration): void {
    this.migrations.push(migration);
    // Sort by version to ensure correct order
    this.migrations.sort((a, b) => a.version - b.version);
  }

  /**
   * Run all pending migrations
   */
  async runMigrations(): Promise<void> {
    try {
      // Ensure migrations table exists
      await this.ensureMigrationsTable();

      // Get applied migrations
      const appliedVersions = await this.getAppliedMigrations();

      // Run pending migrations
      for (const migration of this.migrations) {
        if (!appliedVersions.includes(migration.version)) {
          console.log(`Running migration ${migration.version}: ${migration.name}`);
          
          try {
            await migration.up(this.db);
            await this.recordMigration(migration);
            console.log(`✓ Migration ${migration.version} completed`);
          } catch (error) {
            console.error(`✗ Migration ${migration.version} failed:`, error);
            // Attempt rollback
            try {
              await migration.down(this.db);
              console.log(`Rolled back migration ${migration.version}`);
            } catch (rollbackError) {
              console.error(`Failed to rollback migration ${migration.version}:`, rollbackError);
            }
            throw error;
          }
        }
      }
    } catch (error) {
      console.error('Migration runner error:', error);
      throw error;
    }
  }

  /**
   * Rollback the last applied migration
   */
  async rollbackLastMigration(): Promise<void> {
    const appliedVersions = await this.getAppliedMigrations();
    if (appliedVersions.length === 0) {
      console.log('No migrations to rollback');
      return;
    }

    const lastVersion = Math.max(...appliedVersions);
    const migration = this.migrations.find(m => m.version === lastVersion);

    if (!migration) {
      throw new Error(`Migration ${lastVersion} not found in registered migrations`);
    }

    console.log(`Rolling back migration ${migration.version}: ${migration.name}`);
    await migration.down(this.db);
    await this.removeMigrationRecord(migration.version);
    console.log(`✓ Rolled back migration ${migration.version}`);
  }

  /**
   * Check if a specific migration has been applied
   */
  async isMigrationApplied(version: number): Promise<boolean> {
    const appliedVersions = await this.getAppliedMigrations();
    return appliedVersions.includes(version);
  }

  /**
   * Get migration status report
   */
  async getMigrationStatus(): Promise<{
    applied: Migration[];
    pending: Migration[];
  }> {
    const appliedVersions = await this.getAppliedMigrations();
    
    const applied = this.migrations.filter(m => 
      appliedVersions.includes(m.version)
    );
    
    const pending = this.migrations.filter(m => 
      !appliedVersions.includes(m.version)
    );

    return { applied, pending };
  }

  private async ensureMigrationsTable(): Promise<void> {
    const db = (this.db as any).db; // Access underlying database
    if (!db) {
      throw new Error('Database not initialized');
    }

    await db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at INTEGER NOT NULL
      );
    `);
  }

  private async getAppliedMigrations(): Promise<number[]> {
    const db = (this.db as any).db;
    if (!db) {
      return [];
    }

    try {
      const rows = await db.all(`
        SELECT version FROM schema_migrations ORDER BY version
      `);
      return rows.map((row: any) => row.version);
    } catch (error) {
      // Table might not exist yet
      return [];
    }
  }

  private async recordMigration(migration: Migration): Promise<void> {
    const db = (this.db as any).db;
    if (!db) {
      throw new Error('Database not initialized');
    }

    await db.run(`
      INSERT INTO schema_migrations (version, name, applied_at)
      VALUES (?, ?, ?)
    `, [migration.version, migration.name, Date.now()]);
  }

  private async removeMigrationRecord(version: number): Promise<void> {
    const db = (this.db as any).db;
    if (!db) {
      throw new Error('Database not initialized');
    }

    await db.run(`
      DELETE FROM schema_migrations WHERE version = ?
    `, [version]);
  }
}

// Export a singleton instance
export const migrationRunner = MigrationRunner.getInstance();