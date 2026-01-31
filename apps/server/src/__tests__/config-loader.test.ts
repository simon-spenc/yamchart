import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConfigLoader } from '../services/config-loader.js';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('ConfigLoader', () => {
  let testDir: string;
  let loader: ConfigLoader;

  beforeEach(async () => {
    // Create temp directory for test files
    testDir = join(tmpdir(), `dashbook-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    await mkdir(join(testDir, 'connections'), { recursive: true });
    await mkdir(join(testDir, 'models'), { recursive: true });
    await mkdir(join(testDir, 'charts'), { recursive: true });
  });

  afterEach(async () => {
    if (loader) {
      await loader.stop();
    }
    await rm(testDir, { recursive: true, force: true });
  });

  it('loads project config', async () => {
    await writeFile(
      join(testDir, 'dashbook.yaml'),
      `
version: "1.0"
name: test-project
defaults:
  connection: local-duckdb
`
    );

    loader = new ConfigLoader(testDir);
    await loader.load();

    expect(loader.getProject().name).toBe('test-project');
    expect(loader.getProject().defaults?.connection).toBe('local-duckdb');
  });

  it('loads connections', async () => {
    await writeFile(
      join(testDir, 'dashbook.yaml'),
      'version: "1.0"\nname: test'
    );
    await writeFile(
      join(testDir, 'connections', 'local-duckdb.yaml'),
      `
name: local-duckdb
type: duckdb
config:
  path: ./data.duckdb
`
    );

    loader = new ConfigLoader(testDir);
    await loader.load();

    const connections = loader.getConnections();
    expect(connections).toHaveLength(1);
    expect(connections[0]?.name).toBe('local-duckdb');
    expect(connections[0]?.type).toBe('duckdb');
  });

  it('loads charts', async () => {
    await writeFile(
      join(testDir, 'dashbook.yaml'),
      'version: "1.0"\nname: test'
    );
    await writeFile(
      join(testDir, 'charts', 'revenue-trend.yaml'),
      `
name: revenue-trend
title: Monthly Revenue
source:
  model: monthly_revenue
chart:
  type: line
  x:
    field: period
    type: temporal
  y:
    field: revenue
    type: quantitative
`
    );

    loader = new ConfigLoader(testDir);
    await loader.load();

    const charts = loader.getCharts();
    expect(charts).toHaveLength(1);
    expect(charts[0]?.name).toBe('revenue-trend');
  });

  it('loads models from SQL files', async () => {
    await writeFile(
      join(testDir, 'dashbook.yaml'),
      'version: "1.0"\nname: test'
    );
    await writeFile(
      join(testDir, 'models', 'revenue.sql'),
      `
-- @name: monthly_revenue
-- @param start_date: date = 2025-01-01

SELECT date, SUM(amount) as revenue
FROM orders
WHERE date >= '{{ start_date }}'
GROUP BY 1
`
    );

    loader = new ConfigLoader(testDir);
    await loader.load();

    const models = loader.getModels();
    expect(models).toHaveLength(1);
    expect(models[0]?.metadata.name).toBe('monthly_revenue');
    expect(models[0]?.sql).toContain('SELECT');
  });

  it('gets chart by name', async () => {
    await writeFile(
      join(testDir, 'dashbook.yaml'),
      'version: "1.0"\nname: test'
    );
    await writeFile(
      join(testDir, 'charts', 'revenue-trend.yaml'),
      `
name: revenue-trend
title: Monthly Revenue
source:
  model: monthly_revenue
chart:
  type: line
  x:
    field: period
    type: temporal
  y:
    field: revenue
    type: quantitative
`
    );

    loader = new ConfigLoader(testDir);
    await loader.load();

    const chart = loader.getChartByName('revenue-trend');
    expect(chart).toBeDefined();
    expect(chart?.name).toBe('revenue-trend');

    const missing = loader.getChartByName('nonexistent');
    expect(missing).toBeUndefined();
  });

  it('gets connection by name', async () => {
    await writeFile(
      join(testDir, 'dashbook.yaml'),
      'version: "1.0"\nname: test'
    );
    await writeFile(
      join(testDir, 'connections', 'local-duckdb.yaml'),
      `
name: local-duckdb
type: duckdb
config:
  path: ./data.duckdb
`
    );

    loader = new ConfigLoader(testDir);
    await loader.load();

    const conn = loader.getConnectionByName('local-duckdb');
    expect(conn).toBeDefined();
    expect(conn?.type).toBe('duckdb');
  });

  it('throws on invalid project config', async () => {
    await writeFile(
      join(testDir, 'dashbook.yaml'),
      'invalid: yaml: content:'
    );

    loader = new ConfigLoader(testDir);
    await expect(loader.load()).rejects.toThrow();
  });

  it('throws if dashbook.yaml is missing', async () => {
    loader = new ConfigLoader(testDir);
    await expect(loader.load()).rejects.toThrow('dashbook.yaml not found');
  });
});
