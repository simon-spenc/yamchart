import duckdb from 'duckdb';
import { performance } from 'node:perf_hooks';
import type { Connector, QueryResult } from './index.js';

export interface DuckDBConfig {
  path: string; // file path or ':memory:'
}

export class DuckDBConnector implements Connector {
  private config: DuckDBConfig;
  private db: duckdb.Database | null = null;
  private connection: duckdb.Connection | null = null;

  constructor(config: DuckDBConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db = new duckdb.Database(this.config.path, (err) => {
        if (err) {
          reject(err);
          return;
        }
        this.connection = this.db!.connect();
        resolve();
      });
    });
  }

  async disconnect(): Promise<void> {
    return new Promise((resolve) => {
      if (this.connection) {
        this.connection.close(() => {
          this.connection = null;
        });
      }
      if (this.db) {
        this.db.close(() => {
          this.db = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  async execute(sql: string): Promise<QueryResult> {
    if (!this.connection) {
      throw new Error('Not connected to database');
    }

    const startTime = performance.now();

    return new Promise((resolve, reject) => {
      this.connection!.all(sql, (err, rows) => {
        const durationMs = performance.now() - startTime;

        if (err) {
          reject(err);
          return;
        }

        const typedRows = rows as Array<Record<string, unknown>>;
        // Convert BigInt values to numbers for JSON serialization
        const serializedRows = typedRows.map((row) => this.serializeRow(row));
        const columns = this.extractColumns(serializedRows);

        resolve({
          columns,
          rows: serializedRows,
          rowCount: serializedRows.length,
          durationMs,
        });
      });
    });
  }

  isConnected(): boolean {
    return this.connection !== null;
  }

  private extractColumns(rows: Array<Record<string, unknown>>): QueryResult['columns'] {
    if (rows.length === 0) {
      return [];
    }

    const firstRow = rows[0];
    if (!firstRow) {
      return [];
    }
    return Object.keys(firstRow).map((name) => ({
      name,
      type: this.inferType(firstRow[name]),
    }));
  }

  private inferType(value: unknown): string {
    if (value === null) return 'null';
    if (typeof value === 'bigint') return 'integer';
    if (typeof value === 'number') {
      return Number.isInteger(value) ? 'integer' : 'number';
    }
    if (typeof value === 'string') return 'string';
    if (typeof value === 'boolean') return 'boolean';
    if (value instanceof Date) return 'date';
    return 'unknown';
  }

  private serializeRow(row: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      if (typeof value === 'bigint') {
        // Convert BigInt to number for JSON serialization
        result[key] = Number(value);
      } else {
        result[key] = value;
      }
    }
    return result;
  }
}
