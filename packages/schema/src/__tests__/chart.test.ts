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

describe('KPI Chart', () => {
  it('validates a KPI chart with comparison', () => {
    const kpiChart = {
      name: 'revenue-kpi',
      title: 'Total Revenue',
      source: { model: 'total_revenue' },
      chart: {
        type: 'kpi',
        value: { field: 'value' },
        format: { type: 'currency', currency: 'USD' },
        comparison: {
          enabled: true,
          field: 'previous_value',
          label: 'vs last period',
          type: 'percent_change',
        },
      },
    };

    const result = ChartSchema.safeParse(kpiChart);
    expect(result.success).toBe(true);
  });

  it('validates a KPI chart without comparison', () => {
    const kpiChart = {
      name: 'users-kpi',
      title: 'Active Users',
      source: { model: 'active_users' },
      chart: {
        type: 'kpi',
        value: { field: 'count' },
        format: { type: 'number' },
      },
    };

    const result = ChartSchema.safeParse(kpiChart);
    expect(result.success).toBe(true);
  });

  it('validates KPI with absolute comparison', () => {
    const kpiChart = {
      name: 'orders-kpi',
      title: 'Orders',
      source: { model: 'total_orders' },
      chart: {
        type: 'kpi',
        value: { field: 'value' },
        format: { type: 'number' },
        comparison: {
          enabled: true,
          field: 'previous_value',
          type: 'absolute',
        },
      },
    };

    const result = ChartSchema.safeParse(kpiChart);
    expect(result.success).toBe(true);
  });
});
