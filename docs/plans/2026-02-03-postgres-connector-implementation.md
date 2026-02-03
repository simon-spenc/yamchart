# Postgres Connector Implementation Plan

## Overview

Add PostgreSQL database support to Dashbook by implementing a `PostgresConnector` class that follows the existing `Connector` interface pattern established by DuckDB.

## Architecture Context

The connector system is clean and well-abstracted:
- `Connector` interface defines: `connect()`, `disconnect()`, `execute()`, `explain()`, `isConnected()`
- `QueryResult` structure: `{ columns, rows, rowCount, durationMs }`
- Postgres connection schema already exists with auth options (env vars, key pair, secret manager)
- Server instantiates connectors based on `connection.type` and injects into QueryService

## Implementation Steps

### Step 1: Add pg dependency

**File:** `packages/query/package.json`

Add `pg` (node-postgres) library - the most battle-tested Postgres client for Node.js:
```json
"dependencies": {
  "pg": "^8.13.0"
},
"devDependencies": {
  "@types/pg": "^8.11.0"
}
```

Run `pnpm install` after updating.

### Step 2: Create PostgresConnector class

**File:** `packages/query/src/connectors/postgres.ts`

```typescript
import { Pool, type PoolConfig, type QueryResult as PgQueryResult } from 'pg';
import { performance } from 'node:perf_hooks';
import type { Connector, QueryResult } from './index.js';

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
  // Query settings
  statementTimeout?: number;
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
    };

    this.pool = new Pool(poolConfig);

    // Verify connection works
    const client = await this.pool.connect();

    // Set search_path if schema specified
    if (this.config.schema) {
      await client.query(`SET search_path TO ${this.config.schema}`);
    }

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
      return Number(value);
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    return value;
  }
}
```

### Step 3: Export from connectors index

**File:** `packages/query/src/connectors/index.ts`

Add export:
```typescript
export * from './postgres.js';
```

### Step 4: Create auth resolution utility

**File:** `packages/query/src/connectors/auth.ts`

Create utility to resolve credentials from connection auth config:
```typescript
import type { PostgresConnection } from '@dashbook/schema';

export interface ResolvedCredentials {
  user: string;
  password: string;
}

export function resolvePostgresAuth(connection: PostgresConnection): ResolvedCredentials {
  const auth = connection.auth;

  // Auth is optional for Postgres (local dev with trust auth)
  if (!auth) {
    return {
      user: process.env.PGUSER ?? 'postgres',
      password: process.env.PGPASSWORD ?? '',
    };
  }

  if (auth.type === 'env') {
    const user = process.env[auth.user_var];
    const password = process.env[auth.password_var];

    if (!user) {
      throw new Error(`Missing environment variable: ${auth.user_var}`);
    }

    return { user, password: password ?? '' };
  }

  // key_pair and secret_manager deferred to post-MVP
  throw new Error(`Auth type "${auth.type}" not yet implemented`);
}
```

Also export from index:
```typescript
export * from './auth.js';
```

### Step 5: Update server initialization

**File:** `apps/server/src/server.ts`

Update imports (around line 9):
```typescript
import { DuckDBConnector, PostgresConnector, resolvePostgresAuth, type Connector } from '@dashbook/query';
import type { DuckDBConnection, PostgresConnection } from '@dashbook/schema';
```

Add Postgres branch to connector instantiation (after line 89, in the else block):
```typescript
} else if (defaultConnection.type === 'postgres') {
  const pgConnection = defaultConnection as PostgresConnection;
  const credentials = resolvePostgresAuth(pgConnection);

  connector = new PostgresConnector({
    host: pgConnection.config.host,
    port: pgConnection.config.port,
    database: pgConnection.config.database,
    schema: pgConnection.config.schema,
    ssl: pgConnection.config.ssl,
    user: credentials.user,
    password: credentials.password,
    min: pgConnection.pool?.min_connections,
    max: pgConnection.pool?.max_connections,
    idleTimeoutMillis: pgConnection.pool?.idle_timeout,
    statementTimeout: pgConnection.query?.timeout,
  });
  await connector.connect();
} else {
```

### Step 6: Add unit tests

**File:** `packages/query/src/__tests__/connectors/postgres.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { PostgresConnector } from '../../connectors/postgres.js';

// Skip tests if no Postgres available (CI without services)
const SKIP_POSTGRES = !process.env.PG_HOST && !process.env.CI_POSTGRES;

describe.skipIf(SKIP_POSTGRES)('PostgresConnector', () => {
  let connector: PostgresConnector;

  beforeAll(async () => {
    connector = new PostgresConnector({
      host: process.env.PG_HOST ?? 'localhost',
      port: parseInt(process.env.PG_PORT ?? '5432'),
      database: process.env.PG_DATABASE ?? 'dashbook_test',
      user: process.env.PG_USER ?? 'postgres',
      password: process.env.PG_PASSWORD ?? 'postgres',
    });
    await connector.connect();
  });

  afterAll(async () => {
    await connector.disconnect();
  });

  it('executes simple query', async () => {
    const result = await connector.execute("SELECT 1 as num, 'hello' as str");

    expect(result.columns).toHaveLength(2);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toEqual({ num: 1, str: 'hello' });
    expect(result.durationMs).toBeGreaterThan(0);
  });

  it('handles BigInt conversion', async () => {
    const result = await connector.execute('SELECT 9223372036854775807::bigint as big');
    expect(typeof result.rows[0].big).toBe('number');
  });

  it('validates queries with explain', async () => {
    const valid = await connector.explain('SELECT 1');
    expect(valid.valid).toBe(true);

    const invalid = await connector.explain('SELECT * FROM nonexistent_table_xyz');
    expect(invalid.valid).toBe(false);
    expect(invalid.error).toBeDefined();
  });

  it('handles Date serialization', async () => {
    const result = await connector.execute("SELECT '2024-01-15'::date as d");
    expect(typeof result.rows[0].d).toBe('string');
    expect(result.rows[0].d).toContain('2024-01-15');
  });

  it('returns correct column types', async () => {
    const result = await connector.execute(`
      SELECT
        1::int as int_col,
        1.5::float as float_col,
        'text'::text as text_col,
        true::boolean as bool_col
    `);

    const colTypes = Object.fromEntries(result.columns.map(c => [c.name, c.type]));
    expect(colTypes.int_col).toBe('integer');
    expect(colTypes.float_col).toBe('number');
    expect(colTypes.text_col).toBe('string');
    expect(colTypes.bool_col).toBe('boolean');
  });
});

describe('PostgresConnector (unit)', () => {
  it('throws when executing without connection', async () => {
    const connector = new PostgresConnector({
      host: 'localhost',
      port: 5432,
      database: 'test',
      user: 'test',
      password: 'test',
    });

    await expect(connector.execute('SELECT 1')).rejects.toThrow('Not connected');
  });

  it('reports not connected before connect()', () => {
    const connector = new PostgresConnector({
      host: 'localhost',
      port: 5432,
      database: 'test',
      user: 'test',
      password: 'test',
    });

    expect(connector.isConnected()).toBe(false);
  });
});
```

**File:** `packages/query/src/__tests__/connectors/auth.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resolvePostgresAuth } from '../../connectors/auth.js';
import type { PostgresConnection } from '@dashbook/schema';

describe('resolvePostgresAuth', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns defaults when no auth configured', () => {
    const connection: PostgresConnection = {
      name: 'test',
      type: 'postgres',
      config: { host: 'localhost', port: 5432, database: 'test' },
    };

    const creds = resolvePostgresAuth(connection);
    expect(creds.user).toBe('postgres');
    expect(creds.password).toBe('');
  });

  it('reads from PGUSER/PGPASSWORD env vars when no auth', () => {
    process.env.PGUSER = 'envuser';
    process.env.PGPASSWORD = 'envpass';

    const connection: PostgresConnection = {
      name: 'test',
      type: 'postgres',
      config: { host: 'localhost', port: 5432, database: 'test' },
    };

    const creds = resolvePostgresAuth(connection);
    expect(creds.user).toBe('envuser');
    expect(creds.password).toBe('envpass');
  });

  it('resolves env auth type', () => {
    process.env.MY_PG_USER = 'myuser';
    process.env.MY_PG_PASS = 'mypass';

    const connection: PostgresConnection = {
      name: 'test',
      type: 'postgres',
      config: { host: 'localhost', port: 5432, database: 'test' },
      auth: {
        type: 'env',
        user_var: 'MY_PG_USER',
        password_var: 'MY_PG_PASS',
      },
    };

    const creds = resolvePostgresAuth(connection);
    expect(creds.user).toBe('myuser');
    expect(creds.password).toBe('mypass');
  });

  it('throws when env var missing', () => {
    const connection: PostgresConnection = {
      name: 'test',
      type: 'postgres',
      config: { host: 'localhost', port: 5432, database: 'test' },
      auth: {
        type: 'env',
        user_var: 'NONEXISTENT_USER_VAR',
        password_var: 'NONEXISTENT_PASS_VAR',
      },
    };

    expect(() => resolvePostgresAuth(connection)).toThrow('Missing environment variable');
  });
});
```

## Files Summary

| File | Action | Purpose |
|------|--------|---------|
| `packages/query/package.json` | Modify | Add pg dependency |
| `packages/query/src/connectors/postgres.ts` | Create | PostgresConnector class |
| `packages/query/src/connectors/auth.ts` | Create | Auth resolution utility |
| `packages/query/src/connectors/index.ts` | Modify | Export PostgresConnector and auth |
| `apps/server/src/server.ts` | Modify | Add Postgres instantiation |
| `packages/query/src/__tests__/connectors/postgres.test.ts` | Create | PostgresConnector tests |
| `packages/query/src/__tests__/connectors/auth.test.ts` | Create | Auth utility tests |

## Verification

After each step, run:
```bash
pnpm --filter @dashbook/query test
```

After Step 5, also run:
```bash
pnpm --filter @dashbook/server test
```

## Out of Scope (Post-MVP)

- Key pair authentication
- Secret manager integration (AWS/GCP/Vault)
- SSL certificate configuration
- Statement timeout enforcement
- Connection health checks / reconnection
