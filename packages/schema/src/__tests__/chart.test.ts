import { describe, it, expect } from 'vitest';
import { ChartSchema, type Chart } from '../chart.js';

describe('ChartSchema', () => {
  it('validates a minimal line chart', () => {
    const input = {
      name: 'revenue-trend',
      title: 'Monthly Revenue',
      source: {
        model: 'monthly_revenue',
      },
      chart: {
        type: 'line',
        x: { field: 'period', type: 'temporal' },
        y: { field: 'revenue', type: 'quantitative' },
      },
    };

    const result = ChartSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('revenue-trend');
      expect(result.data.chart.type).toBe('line');
    }
  });

  it('validates a chart with parameters', () => {
    const input = {
      name: 'revenue-trend',
      title: 'Monthly Revenue',
      source: { model: 'monthly_revenue' },
      parameters: [
        {
          name: 'date_range',
          type: 'date_range',
          label: 'Date Range',
          default: 'last_12_months',
        },
      ],
      chart: {
        type: 'line',
        x: { field: 'period', type: 'temporal' },
        y: { field: 'revenue', type: 'quantitative' },
      },
    };

    const result = ChartSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.parameters).toHaveLength(1);
      expect(result.data.parameters?.[0]?.name).toBe('date_range');
    }
  });

  it('validates a chart with inline SQL', () => {
    const input = {
      name: 'quick-query',
      title: 'Quick Query',
      source: {
        sql: 'SELECT date, SUM(amount) as total FROM orders GROUP BY 1',
      },
      chart: {
        type: 'bar',
        x: { field: 'date', type: 'temporal' },
        y: { field: 'total', type: 'quantitative' },
      },
    };

    const result = ChartSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('rejects chart without name', () => {
    const input = {
      title: 'No Name',
      source: { model: 'test' },
      chart: {
        type: 'line',
        x: { field: 'x', type: 'temporal' },
        y: { field: 'y', type: 'quantitative' },
      },
    };

    const result = ChartSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects chart without source', () => {
    const input = {
      name: 'no-source',
      title: 'No Source',
      chart: {
        type: 'line',
        x: { field: 'x', type: 'temporal' },
        y: { field: 'y', type: 'quantitative' },
      },
    };

    const result = ChartSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects unknown chart type', () => {
    const input = {
      name: 'bad-chart',
      title: 'Bad Chart',
      source: { model: 'test' },
      chart: {
        type: 'unknown_chart',
        x: { field: 'x', type: 'temporal' },
        y: { field: 'y', type: 'quantitative' },
      },
    };

    const result = ChartSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});
