import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { generate, type GenerateOptions } from '../../commands/generate.js';
import { mkdir, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const TEST_DIR = '/tmp/yamchart-generate-test';

const MOCK_CATALOG = {
  syncedAt: '2026-02-04T12:00:00Z',
  source: { type: 'local', path: '../dbt' },
  stats: { modelsIncluded: 1, modelsExcluded: 0 },
  models: [{
    name: 'orders',
    path: 'models/orders.sql',
    description: 'Order data',
    table: 'analytics.orders',
    tags: [],
    columns: [
      { name: 'id', data_type: 'integer', description: '', hints: ['primary_key'] },
      { name: 'order_date', data_type: 'date', description: '', hints: [] },
      { name: 'amount', data_type: 'numeric', description: '', hints: [] },
      { name: 'category', data_type: 'varchar', description: '', hints: [] },
    ],
    yamchartModels: [],
  }],
};

describe('generate command', () => {
  beforeEach(async () => {
    await mkdir(join(TEST_DIR, '.yamchart'), { recursive: true });
    await writeFile(
      join(TEST_DIR, '.yamchart', 'catalog.json'),
      JSON.stringify(MOCK_CATALOG)
    );
  });

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  it('generates stubs in yolo mode', async () => {
    const options: GenerateOptions = { yolo: true };
    const result = await generate(TEST_DIR, options);

    expect(result.success).toBe(true);
    expect(result.filesCreated).toBeGreaterThan(0);
    expect(existsSync(join(TEST_DIR, 'models', 'orders_over_time.sql'))).toBe(true);
    expect(existsSync(join(TEST_DIR, 'models', 'orders_kpi.sql'))).toBe(true);
  });

  it('filters to single model when specified', async () => {
    const options: GenerateOptions = { yolo: true, model: 'orders' };
    const result = await generate(TEST_DIR, options);

    expect(result.success).toBe(true);
    expect(result.modelsProcessed).toBe(1);
  });

  it('fails when catalog not found', async () => {
    await rm(join(TEST_DIR, '.yamchart', 'catalog.json'));

    const options: GenerateOptions = { yolo: true };
    const result = await generate(TEST_DIR, options);

    expect(result.success).toBe(false);
    expect(result.error).toContain('catalog.json');
  });

  it('fails when model not found', async () => {
    const options: GenerateOptions = { yolo: true, model: 'nonexistent' };
    const result = await generate(TEST_DIR, options);

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });
});
