import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { scanYamchartModels } from '../../dbt/scanner.js';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('scanYamchartModels', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `yamchart-scanner-test-${Date.now()}`);
    await mkdir(join(testDir, 'models'), { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('finds models and extracts metadata', async () => {
    await writeFile(
      join(testDir, 'models', 'revenue_by_region.sql'),
      `-- @name: revenue_by_region
-- @description: Revenue by region
-- @source: marts.orders

SELECT region, sum(amount) FROM orders GROUP BY 1`
    );

    const models = await scanYamchartModels(testDir);
    expect(models).toHaveLength(1);
    expect(models[0].name).toBe('revenue_by_region');
    expect(models[0].description).toBe('Revenue by region');
    expect(models[0].source).toBe('marts.orders');
  });

  it('extracts source from SQL FROM clause if not in metadata', async () => {
    await writeFile(
      join(testDir, 'models', 'simple.sql'),
      `-- @name: simple_query

SELECT * FROM analytics.marts.orders WHERE date > '2024-01-01'`
    );

    const models = await scanYamchartModels(testDir);
    expect(models[0].source).toBe('analytics.marts.orders');
  });

  it('handles nested model directories', async () => {
    await mkdir(join(testDir, 'models', 'finance'), { recursive: true });
    await writeFile(
      join(testDir, 'models', 'finance', 'revenue.sql'),
      `-- @name: finance_revenue
SELECT * FROM orders`
    );

    const models = await scanYamchartModels(testDir);
    expect(models.find(m => m.name === 'finance_revenue')).toBeDefined();
  });

  it('returns empty array if no models directory', async () => {
    await rm(join(testDir, 'models'), { recursive: true });
    const models = await scanYamchartModels(testDir);
    expect(models).toEqual([]);
  });
});
