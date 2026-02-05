import snowflake from 'snowflake-sdk';
import { performance } from 'node:perf_hooks';
import type { Connector, QueryResult } from './index.js';

export interface SnowflakeConfig {
  account: string;
  username: string;
  password?: string;
  privateKey?: string;
  warehouse: string;
  database: string;
  schema?: string;
  role?: string;
  // Connection settings
  connectTimeoutMillis?: number;
  // Query settings
  statementTimeout?: number;
}

export class SnowflakeConnector implements Connector {
  private config: SnowflakeConfig;
  private connection: snowflake.Connection | null = null;

  constructor(config: SnowflakeConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    const connectionOptions: snowflake.ConnectionOptions = {
      account: this.config.account,
      username: this.config.username,
      password: this.config.password,
      privateKey: this.config.privateKey,
      warehouse: this.config.warehouse,
      database: this.config.database,
      schema: this.config.schema,
      role: this.config.role,
      timeout: this.config.connectTimeoutMillis ?? 60000,
    };

    this.connection = snowflake.createConnection(connectionOptions);

    return new Promise((resolve, reject) => {
      this.connection!.connect((err) => {
        if (err) {
          this.connection = null;
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      return new Promise((resolve, reject) => {
        this.connection!.destroy((err) => {
          this.connection = null;
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }
  }

  isConnected(): boolean {
    return this.connection !== null && this.connection.isUp();
  }

  async execute(sql: string): Promise<QueryResult> {
    if (!this.connection) {
      throw new Error('Not connected to database');
    }

    const start = performance.now();

    return new Promise((resolve, reject) => {
      this.connection!.execute({
        sqlText: sql,
        complete: (err, stmt, rows) => {
          const durationMs = performance.now() - start;

          if (err) {
            reject(err);
            return;
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const columns = stmt ? (stmt as any).getColumns().map((col: any) => ({
            name: col.getName(),
            type: this.snowflakeTypeToString(col.getType()),
          })) : [];

          resolve({
            columns,
            rows: (rows || []).map(row => this.serializeRow(row as Record<string, unknown>)),
            rowCount: rows?.length ?? 0,
            durationMs,
          });
        },
      });
    });
  }

  async explain(sql: string): Promise<{ valid: boolean; error?: string }> {
    if (!this.connection) {
      throw new Error('Not connected to database');
    }

    try {
      await this.execute(`EXPLAIN ${sql}`);
      return { valid: true };
    } catch (err) {
      return {
        valid: false,
        error: err instanceof Error ? err.message : String(err)
      };
    }
  }

  private snowflakeTypeToString(type: string): string {
    const typeMap: Record<string, string> = {
      'NUMBER': 'number',
      'DECIMAL': 'number',
      'NUMERIC': 'number',
      'INT': 'integer',
      'INTEGER': 'integer',
      'BIGINT': 'integer',
      'SMALLINT': 'integer',
      'TINYINT': 'integer',
      'BYTEINT': 'integer',
      'FLOAT': 'number',
      'FLOAT4': 'number',
      'FLOAT8': 'number',
      'DOUBLE': 'number',
      'DOUBLE PRECISION': 'number',
      'REAL': 'number',
      'VARCHAR': 'string',
      'CHAR': 'string',
      'CHARACTER': 'string',
      'STRING': 'string',
      'TEXT': 'string',
      'BINARY': 'unknown',
      'VARBINARY': 'unknown',
      'BOOLEAN': 'boolean',
      'DATE': 'date',
      'DATETIME': 'date',
      'TIME': 'string',
      'TIMESTAMP': 'date',
      'TIMESTAMP_LTZ': 'date',
      'TIMESTAMP_NTZ': 'date',
      'TIMESTAMP_TZ': 'date',
      'VARIANT': 'unknown',
      'OBJECT': 'unknown',
      'ARRAY': 'unknown',
    };

    const upperType = type.toUpperCase();
    return typeMap[upperType] ?? 'unknown';
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
    if (value instanceof Date) {
      return value.toISOString();
    }
    return value;
  }
}
