import Database, { type Database as DatabaseType } from 'better-sqlite3';
import { performance } from 'node:perf_hooks';
import type { Connector, QueryResult } from './index.js';

export interface SQLiteConfig {
  path: string; // file path or :memory:
  readonly?: boolean;
}

export class SQLiteConnector implements Connector {
  private config: SQLiteConfig;
  private db: DatabaseType | null = null;

  constructor(config: SQLiteConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    this.db = new Database(this.config.path, {
      readonly: this.config.readonly ?? false,
    });

    // Enable foreign keys and WAL mode for better performance
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
  }

  async disconnect(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  isConnected(): boolean {
    return this.db !== null;
  }

  async execute(sql: string): Promise<QueryResult> {
    if (!this.db) {
      throw new Error('Not connected to database');
    }

    const start = performance.now();
    const stmt = this.db.prepare(sql);
    const rows = stmt.all() as Record<string, unknown>[];
    const durationMs = performance.now() - start;

    // Extract column info from the statement
    const columns = stmt.columns().map(col => ({
      name: col.name,
      type: this.sqliteTypeToString(col.type),
    }));

    return {
      columns,
      rows: rows.map(row => this.serializeRow(row)),
      rowCount: rows.length,
      durationMs,
    };
  }

  async explain(sql: string): Promise<{ valid: boolean; error?: string }> {
    if (!this.db) {
      throw new Error('Not connected to database');
    }

    try {
      this.db.prepare(`EXPLAIN ${sql}`);
      return { valid: true };
    } catch (err) {
      return {
        valid: false,
        error: err instanceof Error ? err.message : String(err)
      };
    }
  }

  private sqliteTypeToString(type: string | null): string {
    if (!type) return 'unknown';

    const upperType = type.toUpperCase();

    if (upperType.includes('INT')) return 'integer';
    if (upperType.includes('CHAR') || upperType.includes('TEXT') || upperType.includes('CLOB')) return 'string';
    if (upperType.includes('BLOB')) return 'unknown';
    if (upperType.includes('REAL') || upperType.includes('FLOA') || upperType.includes('DOUB')) return 'number';
    if (upperType.includes('NUMERIC') || upperType.includes('DECIMAL')) return 'number';
    if (upperType.includes('DATE') || upperType.includes('TIME')) return 'date';
    if (upperType.includes('BOOL')) return 'boolean';

    return 'unknown';
  }

  private serializeRow(row: Record<string, unknown>): Record<string, unknown> {
    const serialized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      serialized[key] = this.serializeValue(value);
    }
    return serialized;
  }

  private serializeValue(value: unknown): unknown {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === 'bigint') {
      if (value > Number.MAX_SAFE_INTEGER || value < Number.MIN_SAFE_INTEGER) {
        return value.toString();
      }
      return Number(value);
    }
    if (Buffer.isBuffer(value)) {
      return value.toString('base64');
    }
    return value;
  }
}
