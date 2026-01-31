import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { QueryCompiler } from '../compiler.js';
import { parseModelMetadata } from '../parser.js';
import { DuckDBConnector } from '../connectors/duckdb.js';
import type { Chart } from '@dashbook/schema';

describe('Query Engine Integration', () => {
  let connector: DuckDBConnector;
  let compiler: QueryCompiler;

  beforeAll(async () => {
    // Create in-memory DuckDB with test data
    connector = new DuckDBConnector({ path: ':memory:' });
    await connector.connect();

    // Create test table
    await connector.execute(`
      CREATE TABLE orders (
        id INTEGER,
        amount DECIMAL(10,2),
        order_date DATE
      )
    `);

    // Insert test data
    await connector.execute(`
      INSERT INTO orders VALUES
        (1, 100.00, '2025-01-15'),
        (2, 200.00, '2025-01-20'),
        (3, 150.00, '2025-02-10'),
        (4, 300.00, '2025-02-15'),
        (5, 250.00, '2025-03-01')
    `);
  });

  afterAll(async () => {
    await connector.disconnect();
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-03-15T12:00:00Z'));

    // Parse model from SQL
    const modelSQL = `
-- @name: monthly_revenue
-- @description: Monthly revenue aggregation
-- @param start_date: date = 2025-01-01
-- @param end_date: date = 2025-12-31

SELECT
  date_trunc('month', order_date) AS period,
  SUM(amount) AS revenue,
  COUNT(*) AS order_count
FROM orders
WHERE order_date BETWEEN '{{ start_date }}' AND '{{ end_date }}'
GROUP BY 1
ORDER BY 1
`;

    const parsed = parseModelMetadata(modelSQL);

    compiler = new QueryCompiler({
      models: {
        monthly_revenue: {
          metadata: {
            name: parsed.name,
            params: parsed.params,
          },
          sql: parsed.sql,
        },
      },
      refs: {
        orders: 'orders',
      },
    });
  });

  it('compiles and executes chart query', async () => {
    const chart: Chart = {
      name: 'revenue-trend',
      title: 'Revenue Trend',
      source: { model: 'monthly_revenue' },
      chart: {
        type: 'line',
        x: { field: 'period', type: 'temporal' },
        y: { field: 'revenue', type: 'quantitative' },
      },
    };

    // Compile
    const compiled = compiler.compile(chart, {});

    // Execute
    const result = await connector.execute(compiled.sql);

    // Verify
    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.columns.map(c => c.name)).toContain('period');
    expect(result.columns.map(c => c.name)).toContain('revenue');
  });

  it('applies date filter parameters', async () => {
    const chart: Chart = {
      name: 'revenue-trend',
      title: 'Revenue Trend',
      source: { model: 'monthly_revenue' },
      chart: {
        type: 'line',
        x: { field: 'period', type: 'temporal' },
        y: { field: 'revenue', type: 'quantitative' },
      },
    };

    // Compile with specific date range
    const compiled = compiler.compile(chart, {
      start_date: '2025-01-01',
      end_date: '2025-01-31',
    });

    // Execute
    const result = await connector.execute(compiled.sql);

    // Should only have January data
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.revenue).toBeCloseTo(300.00);
    expect(Number(result.rows[0]?.order_count)).toBe(2);
  });

  it('handles date preset expansion', async () => {
    const chart: Chart = {
      name: 'revenue-trend',
      title: 'Revenue Trend',
      source: { model: 'monthly_revenue' },
      parameters: [
        { name: 'date_range', type: 'date_range', default: 'last_30_days' },
      ],
      chart: {
        type: 'line',
        x: { field: 'period', type: 'temporal' },
        y: { field: 'revenue', type: 'quantitative' },
      },
    };

    // Compile with preset (mocked date is 2025-03-15)
    const compiled = compiler.compile(chart, { date_range: 'last_30_days' });

    // Verify dates are expanded
    expect(compiled.params.start_date).toBe('2025-02-13');
    expect(compiled.params.end_date).toBe('2025-03-15');

    // Execute
    const result = await connector.execute(compiled.sql);

    // Should have February and March data
    expect(result.rows.length).toBeGreaterThanOrEqual(1);
  });

  it('generates consistent cache keys', () => {
    const chart: Chart = {
      name: 'revenue-trend',
      title: 'Revenue Trend',
      source: { model: 'monthly_revenue' },
      chart: {
        type: 'line',
        x: { field: 'period', type: 'temporal' },
        y: { field: 'revenue', type: 'quantitative' },
      },
    };

    const params = { start_date: '2025-01-01', end_date: '2025-03-31' };

    const compiled1 = compiler.compile(chart, params);
    const compiled2 = compiler.compile(chart, params);
    const compiled3 = compiler.compile(chart, { ...params, end_date: '2025-06-30' });

    expect(compiled1.cacheKey).toBe(compiled2.cacheKey);
    expect(compiled1.cacheKey).not.toBe(compiled3.cacheKey);
  });
});
