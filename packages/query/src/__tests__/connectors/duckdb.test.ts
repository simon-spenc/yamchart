import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DuckDBConnector } from '../../connectors/duckdb.js';

describe('DuckDBConnector', () => {
  let connector: DuckDBConnector;

  beforeEach(async () => {
    connector = new DuckDBConnector({ path: ':memory:' });
    await connector.connect();
  });

  afterEach(async () => {
    await connector.disconnect();
  });

  it('connects to in-memory database', () => {
    expect(connector.isConnected()).toBe(true);
  });

  it('executes simple query', async () => {
    const result = await connector.execute('SELECT 1 as value');

    expect(result.columns).toHaveLength(1);
    expect(result.columns[0]?.name).toBe('value');
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.value).toBe(1);
    expect(result.rowCount).toBe(1);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('executes query with multiple columns', async () => {
    const result = await connector.execute(`
      SELECT 1 as a, 'hello' as b, 3.14 as c
    `);

    expect(result.columns).toHaveLength(3);
    expect(result.rows[0]).toEqual({ a: 1, b: 'hello', c: 3.14 });
  });

  it('executes query with multiple rows', async () => {
    const result = await connector.execute(`
      SELECT * FROM (VALUES (1, 'a'), (2, 'b'), (3, 'c')) AS t(num, letter)
    `);

    expect(result.rows).toHaveLength(3);
    expect(result.rows[0]).toEqual({ num: 1, letter: 'a' });
    expect(result.rows[2]).toEqual({ num: 3, letter: 'c' });
  });

  it('creates and queries tables', async () => {
    await connector.execute(`
      CREATE TABLE orders (
        id INTEGER,
        amount DECIMAL(10,2),
        order_date DATE
      )
    `);

    await connector.execute(`
      INSERT INTO orders VALUES
        (1, 100.00, '2025-01-15'),
        (2, 250.50, '2025-01-20'),
        (3, 75.25, '2025-02-01')
    `);

    const result = await connector.execute(`
      SELECT
        date_trunc('month', order_date) as period,
        SUM(amount) as revenue
      FROM orders
      GROUP BY 1
      ORDER BY 1
    `);

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]?.revenue).toBeCloseTo(350.50);
  });

  it('handles empty result', async () => {
    await connector.execute('CREATE TABLE empty_table (id INTEGER)');
    const result = await connector.execute('SELECT * FROM empty_table');

    expect(result.rows).toHaveLength(0);
    expect(result.rowCount).toBe(0);
  });

  it('throws on invalid SQL', async () => {
    await expect(
      connector.execute('SELECT * FROM nonexistent_table')
    ).rejects.toThrow();
  });

  it('reports duration', async () => {
    const result = await connector.execute('SELECT 1');
    expect(typeof result.durationMs).toBe('number');
  });
});
