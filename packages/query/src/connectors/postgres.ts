import { Pool, types, type PoolConfig, type PoolClient, type QueryResult as PgQueryResult } from 'pg';
import { performance } from 'node:perf_hooks';
import type { Connector, QueryResult } from './index.js';

// Configure pg to return int8 (bigint) as JavaScript BigInt instead of string
// OID 20 = int8 in PostgreSQL
types.setTypeParser(20, (val: string) => {
  if (val === null) return null;
  return BigInt(val);
});

export interface PostgresConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  schema?: string;
  ssl?: boolean | object;
  // Pool settings
  min?: number;
  max?: number;
  idleTimeoutMillis?: number;
  connectTimeoutMillis?: number;
  // Query settings
  statementTimeout?: number;
}

// Safe identifier escaping for schema names
function escapeIdentifier(identifier: string): string {
  // Only allow alphanumeric and underscores for safety
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
    throw new Error(`Invalid identifier: ${identifier}`);
  }
  return `"${identifier}"`;
}

export class PostgresConnector implements Connector {
  private config: PostgresConfig;
  private pool: Pool | null = null;

  constructor(config: PostgresConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    const poolConfig: PoolConfig = {
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
      ssl: this.config.ssl,
      min: this.config.min ?? 2,
      max: this.config.max ?? 10,
      idleTimeoutMillis: this.config.idleTimeoutMillis ?? 30000,
      connectionTimeoutMillis: this.config.connectTimeoutMillis ?? 10000,
    };

    // Add statement timeout if configured
    if (this.config.statementTimeout) {
      poolConfig.statement_timeout = this.config.statementTimeout;
    }

    this.pool = new Pool(poolConfig);

    // Handle pool errors (idle client errors)
    this.pool.on('error', (err) => {
      console.error('Unexpected postgres pool error:', err.message);
    });

    // Set search_path on each new client from the pool
    if (this.config.schema) {
      const schema = escapeIdentifier(this.config.schema);
      this.pool.on('connect', (client: PoolClient) => {
        client.query(`SET search_path TO ${schema}`).catch((err) => {
          console.error('Failed to set search_path:', err.message);
        });
      });
    }

    // Verify connection works
    const client = await this.pool.connect();
    client.release();
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
    const result = await this.pool.query(sql);
    const durationMs = performance.now() - start;

    return {
      columns: this.extractColumns(result),
      rows: result.rows.map(row => this.serializeRow(row)),
      rowCount: result.rowCount ?? result.rows.length,
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

  private extractColumns(result: PgQueryResult<Record<string, unknown>>): Array<{ name: string; type: string }> {
    return result.fields.map(field => ({
      name: field.name,
      type: this.pgTypeToString(field.dataTypeID),
    }));
  }

  private pgTypeToString(oid: number): string {
    // Common Postgres type OIDs
    const typeMap: Record<number, string> = {
      16: 'boolean',      // bool
      20: 'integer',      // int8
      21: 'integer',      // int2
      23: 'integer',      // int4
      700: 'number',      // float4
      701: 'number',      // float8
      1700: 'number',     // numeric
      25: 'string',       // text
      1043: 'string',     // varchar
      1082: 'date',       // date
      1114: 'date',       // timestamp
      1184: 'date',       // timestamptz
      114: 'unknown',     // json
      3802: 'unknown',    // jsonb
    };
    return typeMap[oid] ?? 'unknown';
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
      // Return as string if value exceeds safe integer range to preserve precision
      if (value > Number.MAX_SAFE_INTEGER || value < Number.MIN_SAFE_INTEGER) {
        return value.toString();
      }
      return Number(value);
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    return value;
  }
}
