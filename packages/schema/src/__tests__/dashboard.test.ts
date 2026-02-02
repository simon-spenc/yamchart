import { describe, it, expect } from 'vitest';
import { DashboardSchema } from '../dashboard.js';

describe('DashboardSchema', () => {
  it('validates a minimal dashboard', () => {
    const dashboard = {
      name: 'executive',
      title: 'Executive Overview',
      layout: {
        rows: [
          {
            height: 400,
            widgets: [{ type: 'chart', ref: 'revenue-trend', cols: 12 }],
          },
        ],
      },
    };

    const result = DashboardSchema.safeParse(dashboard);
    expect(result.success).toBe(true);
  });

  it('validates dashboard with KPI widgets', () => {
    const dashboard = {
      name: 'metrics',
      title: 'Key Metrics',
      layout: {
        gap: 16,
        rows: [
          {
            height: 120,
            widgets: [
              { type: 'chart', ref: 'revenue-kpi', cols: 3 },
              { type: 'chart', ref: 'users-kpi', cols: 3 },
              { type: 'chart', ref: 'orders-kpi', cols: 3 },
              { type: 'chart', ref: 'conversion-kpi', cols: 3 },
            ],
          },
        ],
      },
    };

    const result = DashboardSchema.safeParse(dashboard);
    expect(result.success).toBe(true);
  });

  it('validates dashboard with text widget', () => {
    const dashboard = {
      name: 'with-notes',
      title: 'Dashboard with Notes',
      layout: {
        rows: [
          {
            height: 300,
            widgets: [
              { type: 'chart', ref: 'revenue-trend', cols: 8 },
              { type: 'text', content: '## Notes\n\nSome **markdown** content.', cols: 4 },
            ],
          },
        ],
      },
    };

    const result = DashboardSchema.safeParse(dashboard);
    expect(result.success).toBe(true);
  });

  it('validates dashboard with filters', () => {
    const dashboard = {
      name: 'filtered',
      title: 'Filtered Dashboard',
      filters: ['date_range', 'region'],
      layout: {
        rows: [{ height: 400, widgets: [{ type: 'chart', ref: 'sales', cols: 12 }] }],
      },
    };

    const result = DashboardSchema.safeParse(dashboard);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.filters).toEqual(['date_range', 'region']);
    }
  });

  it('rejects widget cols exceeding 12', () => {
    const dashboard = {
      name: 'invalid',
      title: 'Invalid',
      layout: {
        rows: [{ height: 400, widgets: [{ type: 'chart', ref: 'test', cols: 15 }] }],
      },
    };

    const result = DashboardSchema.safeParse(dashboard);
    expect(result.success).toBe(false);
  });

  it('rejects missing widget ref for chart type', () => {
    const dashboard = {
      name: 'invalid',
      title: 'Invalid',
      layout: {
        rows: [{ height: 400, widgets: [{ type: 'chart', cols: 6 }] }],
      },
    };

    const result = DashboardSchema.safeParse(dashboard);
    expect(result.success).toBe(false);
  });

  it('rejects missing content for text type', () => {
    const dashboard = {
      name: 'invalid',
      title: 'Invalid',
      layout: {
        rows: [{ height: 400, widgets: [{ type: 'text', cols: 6 }] }],
      },
    };

    const result = DashboardSchema.safeParse(dashboard);
    expect(result.success).toBe(false);
  });
});
