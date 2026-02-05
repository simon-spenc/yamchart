import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { generate } from '../commands/generate.js';
import { mkdir, rm, writeFile, readFile } from 'fs/promises';
import { join } from 'path';

const TEST_DIR = '/tmp/yamchart-generate-integration';

describe('generate integration', () => {
  beforeEach(async () => {
    await mkdir(join(TEST_DIR, '.yamchart'), { recursive: true });

    // Create realistic catalog
    const catalog = {
      syncedAt: '2026-02-04T12:00:00Z',
      source: { type: 'local', path: '../dbt' },
      stats: { modelsIncluded: 2, modelsExcluded: 0 },
      models: [
        {
          name: 'orders',
          path: 'models/marts/orders.sql',
          description: 'Order transactions',
          table: 'analytics.marts.orders',
          tags: ['bi'],
          columns: [
            { name: 'order_id', data_type: 'string', description: 'PK', hints: ['primary_key'] },
            { name: 'customer_id', data_type: 'string', description: 'FK', hints: ['fk:customers'] },
            { name: 'order_date', data_type: 'date', description: 'Order date', hints: [] },
            { name: 'amount', data_type: 'numeric', description: 'Order total', hints: [] },
            { name: 'quantity', data_type: 'integer', description: 'Items', hints: [] },
            { name: 'category', data_type: 'varchar', description: 'Product category', hints: [] },
            { name: 'region', data_type: 'varchar', description: 'Sales region', hints: [] },
          ],
          yamchartModels: [],
        },
        {
          name: 'customers',
          path: 'models/marts/customers.sql',
          description: 'Customer data',
          table: 'analytics.marts.customers',
          tags: ['bi'],
          columns: [
            { name: 'customer_id', data_type: 'string', description: 'PK', hints: ['primary_key'] },
            { name: 'created_at', data_type: 'timestamp', description: 'Signup date', hints: [] },
            { name: 'lifetime_value', data_type: 'numeric', description: 'LTV', hints: [] },
            { name: 'segment', data_type: 'varchar', description: 'Customer segment', hints: [] },
          ],
          yamchartModels: [],
        },
      ],
    };

    await writeFile(
      join(TEST_DIR, '.yamchart', 'catalog.json'),
      JSON.stringify(catalog)
    );
  });

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  it('generates all variants for multiple models in yolo mode', async () => {
    const result = await generate(TEST_DIR, { yolo: true });

    expect(result.success).toBe(true);
    expect(result.modelsProcessed).toBe(2);
    expect(result.filesCreated).toBeGreaterThanOrEqual(6); // At least 3 per model
  });

  it('generated SQL contains correct metadata', async () => {
    await generate(TEST_DIR, { yolo: true });

    const sql = await readFile(join(TEST_DIR, 'models', 'orders_over_time.sql'), 'utf-8');

    expect(sql).toContain("@generated: from dbt model 'orders'");
    expect(sql).toContain('@name: orders_over_time');
    expect(sql).toContain('@source: analytics.marts.orders');
    expect(sql).toContain('date_trunc');
    expect(sql).toContain('"amount"');
  });

  it('generated SQL excludes primary and foreign keys from metrics', async () => {
    await generate(TEST_DIR, { yolo: true });

    const sql = await readFile(join(TEST_DIR, 'models', 'orders_kpi.sql'), 'utf-8');

    expect(sql).not.toContain('"order_id"');
    expect(sql).not.toContain('"customer_id"');
    expect(sql).toContain('"amount"');
    expect(sql).toContain('"quantity"');
  });

  it('generates dimension variants for each categorical column', async () => {
    await generate(TEST_DIR, { yolo: true });

    const categoryVariant = await readFile(join(TEST_DIR, 'models', 'orders_by_category.sql'), 'utf-8');
    const regionVariant = await readFile(join(TEST_DIR, 'models', 'orders_by_region.sql'), 'utf-8');

    expect(categoryVariant).toContain('"category"');
    expect(regionVariant).toContain('"region"');
  });
});
