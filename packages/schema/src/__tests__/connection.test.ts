import { describe, it, expect } from 'vitest';
import { ConnectionSchema, type Connection } from '../connection.js';

describe('ConnectionSchema', () => {
  it('validates a valid DuckDB connection', () => {
    const input = {
      name: 'local-duckdb',
      type: 'duckdb',
      config: {
        path: './data.duckdb',
      },
    };

    const result = ConnectionSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('local-duckdb');
      expect(result.data.type).toBe('duckdb');
    }
  });

  it('validates a valid Postgres connection', () => {
    const input = {
      name: 'prod-postgres',
      type: 'postgres',
      config: {
        host: 'localhost',
        port: 5432,
        database: 'analytics',
      },
      auth: {
        type: 'env',
        user_var: 'PG_USER',
        password_var: 'PG_PASSWORD',
      },
    };

    const result = ConnectionSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('rejects connection without name', () => {
    const input = {
      type: 'duckdb',
      config: { path: './data.duckdb' },
    };

    const result = ConnectionSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects unknown connection type', () => {
    const input = {
      name: 'test',
      type: 'unknown_db',
      config: {},
    };

    const result = ConnectionSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});
