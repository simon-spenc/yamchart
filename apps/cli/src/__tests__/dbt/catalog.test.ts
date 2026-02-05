import { describe, it, expect } from 'vitest';
import { generateCatalogMd, generateCatalogJson, type CatalogData } from '../../dbt/catalog.js';

const sampleData: CatalogData = {
  syncedAt: '2026-02-04T10:30:00Z',
  source: { type: 'local', path: '../analytics-dbt' },
  stats: { modelsIncluded: 2, modelsExcluded: 10 },
  models: [
    {
      name: 'orders',
      description: 'Daily order transactions',
      table: 'analytics.marts.orders',
      path: 'models/marts/orders.sql',
      tags: ['bi', 'finance'],
      meta: {},
      columns: [
        { name: 'order_id', description: 'Unique ID', data_type: 'string', hints: ['primary_key', 'unique'] },
        { name: 'customer_id', description: 'FK to customers', hints: ['required', 'fk:customers'] },
      ],
      yamchartModels: [
        { name: 'revenue_by_region', description: 'Revenue by region', path: 'models/revenue_by_region.sql' },
      ],
    },
    {
      name: 'customers',
      description: 'Customer dimension',
      table: 'analytics.marts.customers',
      path: 'models/marts/customers.sql',
      tags: ['bi'],
      meta: {},
      columns: [
        { name: 'id', description: 'Customer ID', hints: ['primary_key'] },
      ],
      yamchartModels: [],
    },
  ],
};

describe('generateCatalogMd', () => {
  it('generates markdown with header', () => {
    const md = generateCatalogMd(sampleData);
    expect(md).toContain('# Data Catalog');
    expect(md).toContain('Source: local:../analytics-dbt');
    expect(md).toContain('Last synced: 2026-02-04');
    expect(md).toContain('Models: 2 included, 10 filtered out');
  });

  it('includes model sections', () => {
    const md = generateCatalogMd(sampleData);
    expect(md).toContain('### orders');
    expect(md).toContain('Daily order transactions');
    expect(md).toContain('**Table:** `analytics.marts.orders`');
    expect(md).toContain('**Tags:** `bi`, `finance`');
  });

  it('includes column table', () => {
    const md = generateCatalogMd(sampleData);
    expect(md).toContain('| Column | Type | Description | Hints |');
    expect(md).toContain('| order_id | string | Unique ID | primary_key, unique |');
  });

  it('includes yamchart model references', () => {
    const md = generateCatalogMd(sampleData);
    expect(md).toContain('**Yamchart models:**');
    expect(md).toContain('[`revenue_by_region`](../models/revenue_by_region.sql)');
  });

  it('shows "None yet" when no yamchart models', () => {
    const md = generateCatalogMd(sampleData);
    // For customers model which has no yamchart models
    expect(md).toContain('None yet');
  });
});

describe('generateCatalogJson', () => {
  it('generates valid JSON structure', () => {
    const json = generateCatalogJson(sampleData);
    const parsed = JSON.parse(json);
    expect(parsed.syncedAt).toBe('2026-02-04T10:30:00Z');
    expect(parsed.models).toHaveLength(2);
    expect(parsed.models[0].name).toBe('orders');
  });

  it('includes all model fields', () => {
    const json = generateCatalogJson(sampleData);
    const parsed = JSON.parse(json);
    expect(parsed.models[0].columns).toHaveLength(2);
    expect(parsed.models[0].yamchartModels).toHaveLength(1);
  });
});
