import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { QueryService } from '../services/query-service.js';
import { MemoryCache } from '../services/cache.js';
import { DuckDBConnector } from '@yamchart/query';
import type { Chart } from '@yamchart/schema';

describe('QueryService', () => {
  let queryService: QueryService;
  let connector: DuckDBConnector;
  let cache: MemoryCache;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-31T12:00:00Z'));

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

    await connector.execute(`
      INSERT INTO orders VALUES
        (1, 100.00, '2025-12-15'),
        (2, 200.00, '2025-12-20'),
        (3, 150.00, '2026-01-10'),
        (4, 300.00, '2026-01-15')
    `);

    cache = new MemoryCache({ maxSize: 100, defaultTtlMs: 60000 });

    queryService = new QueryService({
      connector,
      cache,
      models: {
        monthly_revenue: {
          metadata: {
            name: 'monthly_revenue',
            params: [
              { name: 'start_date', type: 'date', default: '2025-01-01' },
              { name: 'end_date', type: 'date', default: '2026-12-31' },
            ],
          },
          sql: `
SELECT
  date_trunc('month', order_date) AS period,
  SUM(amount) AS revenue
FROM orders
WHERE order_date BETWEEN '{{ start_date }}' AND '{{ end_date }}'
GROUP BY 1
ORDER BY 1
`,
        },
      },
      refs: { orders: 'orders' },
    });
  });

  afterEach(async () => {
    await connector.disconnect();
    vi.useRealTimers();
  });

  it('executes chart query', async () => {
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

    const result = await queryService.executeChart(chart, {});

    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.columns.map(c => c.name)).toContain('period');
    expect(result.columns.map(c => c.name)).toContain('revenue');
    expect(result.cached).toBe(false);
  });

  it('returns cached result on second call', async () => {
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

    const result1 = await queryService.executeChart(chart, {});
    const result2 = await queryService.executeChart(chart, {});

    expect(result1.cached).toBe(false);
    expect(result2.cached).toBe(true);
    expect(result1.rows).toEqual(result2.rows);
  });

  it('cache miss on different params', async () => {
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

    const result1 = await queryService.executeChart(chart, { start_date: '2025-12-01' });
    const result2 = await queryService.executeChart(chart, { start_date: '2026-01-01' });

    expect(result1.cached).toBe(false);
    expect(result2.cached).toBe(false);
  });

  it('expands date presets', async () => {
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

    const result = await queryService.executeChart(chart, { date_range: 'last_30_days' });

    // Should have January data (within last 30 days of 2026-01-31)
    expect(result.rows.length).toBeGreaterThan(0);
  });

  it('invalidates cache for chart', async () => {
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

    await queryService.executeChart(chart, {});
    queryService.invalidateChart('revenue-trend');
    const result = await queryService.executeChart(chart, {});

    expect(result.cached).toBe(false);
  });
});
