import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgresConnector } from '../../connectors/postgres.js';

// Skip tests if no Postgres available (CI without services)
const SKIP_POSTGRES = !process.env.PG_HOST && !process.env.CI_POSTGRES;

describe.skipIf(SKIP_POSTGRES)('PostgresConnector', () => {
  let connector: PostgresConnector;

  beforeAll(async () => {
    connector = new PostgresConnector({
      host: process.env.PG_HOST ?? 'localhost',
      port: parseInt(process.env.PG_PORT ?? '5432'),
      database: process.env.PG_DATABASE ?? 'yamchart_test',
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
    expect(typeof result.rows[0]!.big).toBe('number');
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
    const row = result.rows[0]!;
    expect(typeof row.d).toBe('string');
    expect(row.d as string).toContain('2024-01-15');
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
