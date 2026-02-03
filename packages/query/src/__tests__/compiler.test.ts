import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryCompiler } from '../compiler.js';
import type { Chart } from '@yamchart/schema';

describe('QueryCompiler', () => {
  let compiler: QueryCompiler;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-31T12:00:00Z'));

    compiler = new QueryCompiler({
      models: {
        monthly_revenue: {
          metadata: {
            name: 'monthly_revenue',
            params: [
              { name: 'start_date', type: 'date', default: '2025-01-01' },
              { name: 'end_date', type: 'date', default: '2026-01-31' },
            ],
          },
          sql: `
SELECT
  date_trunc('month', order_date) AS period,
  SUM(amount) AS revenue
FROM {{ ref('orders') }}
WHERE order_date BETWEEN '{{ start_date }}' AND '{{ end_date }}'
GROUP BY 1
`,
        },
      },
      refs: {
        orders: 'public.orders',
      },
    });
  });

  it('compiles a chart with model reference', () => {
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

    const result = compiler.compile(chart, {});

    expect(result.sql).toContain('SELECT');
    expect(result.sql).toContain('public.orders');
    expect(result.sql).toContain("'2025-01-01'");
    expect(result.sql).toContain("'2026-01-31'");
  });

  it('applies parameter overrides', () => {
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

    const result = compiler.compile(chart, {
      start_date: '2025-06-01',
      end_date: '2025-12-31',
    });

    expect(result.sql).toContain("'2025-06-01'");
    expect(result.sql).toContain("'2025-12-31'");
  });

  it('expands date presets', () => {
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

    const result = compiler.compile(chart, { date_range: 'last_30_days' });

    expect(result.sql).toContain("'2026-01-01'"); // 30 days before 2026-01-31
    expect(result.sql).toContain("'2026-01-31'");
    expect(result.params.start_date).toBe('2026-01-01');
    expect(result.params.end_date).toBe('2026-01-31');
  });

  it('compiles inline SQL', () => {
    const chart: Chart = {
      name: 'quick-query',
      title: 'Quick Query',
      source: {
        sql: "SELECT date, SUM(amount) as total FROM orders WHERE date > '{{ start_date }}' GROUP BY 1",
      },
      chart: {
        type: 'bar',
        x: { field: 'date', type: 'temporal' },
        y: { field: 'total', type: 'quantitative' },
      },
    };

    const result = compiler.compile(chart, { start_date: '2025-01-01' });

    expect(result.sql).toContain("date > '2025-01-01'");
  });

  it('generates cache key', () => {
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

    const result1 = compiler.compile(chart, { start_date: '2025-01-01' });
    const result2 = compiler.compile(chart, { start_date: '2025-01-01' });
    const result3 = compiler.compile(chart, { start_date: '2025-06-01' });

    expect(result1.cacheKey).toBe(result2.cacheKey);
    expect(result1.cacheKey).not.toBe(result3.cacheKey);
  });

  it('throws for unknown model', () => {
    const chart: Chart = {
      name: 'bad-chart',
      title: 'Bad Chart',
      source: { model: 'unknown_model' },
      chart: {
        type: 'line',
        x: { field: 'x', type: 'temporal' },
        y: { field: 'y', type: 'quantitative' },
      },
    };

    expect(() => compiler.compile(chart, {})).toThrow('Unknown model: unknown_model');
  });
});
