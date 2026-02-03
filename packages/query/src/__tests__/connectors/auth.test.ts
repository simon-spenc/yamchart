import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resolvePostgresAuth } from '../../connectors/auth.js';
import type { PostgresConnection } from '@yamchart/schema';

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
