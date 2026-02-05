import { createPool, type Pool, type PoolOptions, type RowDataPacket, type FieldPacket } from 'mysql2/promise';
import { performance } from 'node:perf_hooks';
import type { Connector, QueryResult } from './index.js';

export interface MySQLConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean | object;
  // Pool settings
  min?: number;
  max?: number;
  idleTimeoutMillis?: number;
  connectTimeoutMillis?: number;
  // Query settings
  statementTimeout?: number;
}

export class MySQLConnector implements Connector {
  private config: MySQLConfig;
  private pool: Pool | null = null;

  constructor(config: MySQLConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    const poolConfig: PoolOptions = {
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
      ssl: this.config.ssl ? {} : undefined,
      waitForConnections: true,
      connectionLimit: this.config.max ?? 10,
      queueLimit: 0,
      connectTimeout: this.config.connectTimeoutMillis ?? 10000,
    };

    this.pool = createPool(poolConfig);

    // Verify connection works
    const connection = await this.pool.getConnection();
    connection.release();
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  isConnected(): boolean {
    return this.pool !== null;
  }

  async execute(sql: string): Promise<QueryResult> {
    if (!this.pool) {
      throw new Error('Not connected to database');
    }

    const start = performance.now();
    const [rows, fields] = await this.pool.query<RowDataPacket[]>(sql);
    const durationMs = performance.now() - start;

    return {
      columns: this.extractColumns(fields),
      rows: rows.map(row => this.serializeRow(row)),
      rowCount: rows.length,
      durationMs,
    };
  }

  async explain(sql: string): Promise<{ valid: boolean; error?: string }> {
    if (!this.pool) {
      throw new Error('Not connected to database');
    }

    try {
      await this.pool.query(`EXPLAIN ${sql}`);
      return { valid: true };
    } catch (err) {
      return {
        valid: false,
        error: err instanceof Error ? err.message : String(err)
      };
    }
  }

  private extractColumns(fields: FieldPacket[]): Array<{ name: string; type: string }> {
    return fields.map(field => ({
      name: field.name,
      type: this.mysqlTypeToString(field.type),
    }));
  }

  private mysqlTypeToString(type: number | undefined): string {
    // MySQL field type constants
    const typeMap: Record<number, string> = {
      0: 'number',     // DECIMAL
      1: 'integer',    // TINY
      2: 'integer',    // SHORT
      3: 'integer',    // LONG
      4: 'number',     // FLOAT
      5: 'number',     // DOUBLE
      7: 'date',       // TIMESTAMP
      8: 'integer',    // LONGLONG
      9: 'integer',    // INT24
      10: 'date',      // DATE
      11: 'string',    // TIME
      12: 'date',      // DATETIME
      13: 'integer',   // YEAR
      15: 'string',    // VARCHAR
      245: 'unknown',  // JSON
      246: 'number',   // NEWDECIMAL
      252: 'string',   // BLOB
      253: 'string',   // VAR_STRING
      254: 'string',   // STRING
    };
    return typeMap[type ?? 0] ?? 'unknown';
  }

  private serializeRow(row: RowDataPacket): Record<string, unknown> {
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
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (Buffer.isBuffer(value)) {
      return value.toString('utf-8');
    }
    return value;
  }
}
