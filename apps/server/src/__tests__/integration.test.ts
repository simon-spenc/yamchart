import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type DashbookServer } from '../server.js';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { DuckDBConnector } from '@yamchart/query';

describe('Server Integration', () => {
  let testDir: string;
  let server: DashbookServer;
  let dbPath: string;

  beforeAll(async () => {
    // Create temp project directory
    testDir = join(tmpdir(), `yamchart-server-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    await mkdir(join(testDir, 'connections'), { recursive: true });
    await mkdir(join(testDir, 'models'), { recursive: true });
    await mkdir(join(testDir, 'charts'), { recursive: true });

    // Create test database
    dbPath = join(testDir, 'test.duckdb');
    const connector = new DuckDBConnector({ path: dbPath });
    await connector.connect();

    await connector.execute(`
      CREATE TABLE orders (
        id INTEGER,
        amount DECIMAL(10,2),
        order_date DATE
      )
    `);

    await connector.execute(`
      INSERT INTO orders VALUES
        (1, 100.00, '2025-01-15'),
        (2, 200.00, '2025-01-20'),
        (3, 150.00, '2025-02-10')
    `);

    await connector.disconnect();

    // Write config files
    await writeFile(
      join(testDir, 'yamchart.yaml'),
      `
version: "1.0"
name: integration-test
defaults:
  connection: test-duckdb
  cache_ttl: 5m
`
    );

    await writeFile(
      join(testDir, 'connections', 'test-duckdb.yaml'),
      `
name: test-duckdb
type: duckdb
config:
  path: ${dbPath}
`
    );

    await writeFile(
      join(testDir, 'models', 'revenue.sql'),
      `
-- @name: monthly_revenue
-- @param start_date: date = 2025-01-01
-- @param end_date: date = 2025-12-31

SELECT
  date_trunc('month', order_date) AS period,
  SUM(amount) AS revenue,
  COUNT(*) AS order_count
FROM orders
WHERE order_date BETWEEN '{{ start_date }}' AND '{{ end_date }}'
GROUP BY 1
ORDER BY 1
`
    );

    await writeFile(
      join(testDir, 'charts', 'revenue-trend.yaml'),
      `
name: revenue-trend
title: Monthly Revenue
source:
  model: monthly_revenue
parameters:
  - name: date_range
    type: date_range
    default: last_12_months
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

    // Create and start server
    server = await createServer({
      projectDir: testDir,
      port: 0, // Random port
      watch: false,
    });
  });

  afterAll(async () => {
    if (server) {
      await server.stop();
    }
    await rm(testDir, { recursive: true, force: true });
  });

  it('GET /api/health returns ok', async () => {
    const response = await server.fastify.inject({
      method: 'GET',
      url: '/api/health',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.status).toBe('ok');
    expect(body.project).toBe('integration-test');
  });

  it('GET /api/config returns project info', async () => {
    const response = await server.fastify.inject({
      method: 'GET',
      url: '/api/config',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.name).toBe('integration-test');
    expect(body.charts).toHaveLength(1);
    expect(body.charts[0].name).toBe('revenue-trend');
  });

  it('GET /api/charts/:name returns chart definition', async () => {
    const response = await server.fastify.inject({
      method: 'GET',
      url: '/api/charts/revenue-trend',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.name).toBe('revenue-trend');
    expect(body.title).toBe('Monthly Revenue');
    expect(body.chart.type).toBe('line');
  });

  it('GET /api/charts/:name returns 404 for unknown chart', async () => {
    const response = await server.fastify.inject({
      method: 'GET',
      url: '/api/charts/nonexistent',
    });

    expect(response.statusCode).toBe(404);
  });

  it('POST /api/charts/:name/query executes query', async () => {
    const response = await server.fastify.inject({
      method: 'POST',
      url: '/api/charts/revenue-trend/query',
      payload: {},
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.columns).toBeDefined();
    expect(body.rows).toBeDefined();
    expect(body.rows.length).toBeGreaterThan(0);
    expect(body.meta.cached).toBe(false);
  });

  it('POST /api/charts/:name/query returns cached result', async () => {
    // First request
    await server.fastify.inject({
      method: 'POST',
      url: '/api/charts/revenue-trend/query',
      payload: { start_date: '2025-01-01', end_date: '2025-01-31' },
    });

    // Second request with same params
    const response = await server.fastify.inject({
      method: 'POST',
      url: '/api/charts/revenue-trend/query',
      payload: { start_date: '2025-01-01', end_date: '2025-01-31' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.meta.cached).toBe(true);
  });

  it('POST /api/charts/:name/query with params filters data', async () => {
    // Use distinct date range to avoid cache interference from previous tests
    const response = await server.fastify.inject({
      method: 'POST',
      url: '/api/charts/revenue-trend/query',
      payload: { start_date: '2025-02-01', end_date: '2025-02-28' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();

    // Should only have February data (150 from single order)
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0].revenue).toBeCloseTo(150.0);
  });

  it('POST /api/charts/:name/invalidate clears cache', async () => {
    // Execute query to populate cache
    await server.fastify.inject({
      method: 'POST',
      url: '/api/charts/revenue-trend/query',
      payload: { start_date: '2025-02-01', end_date: '2025-02-28' },
    });

    // Invalidate
    const invalidateResponse = await server.fastify.inject({
      method: 'POST',
      url: '/api/charts/revenue-trend/invalidate',
    });
    expect(invalidateResponse.statusCode).toBe(200);

    // Execute again - should not be cached
    const response = await server.fastify.inject({
      method: 'POST',
      url: '/api/charts/revenue-trend/query',
      payload: { start_date: '2025-02-01', end_date: '2025-02-28' },
    });

    const body = response.json();
    expect(body.meta.cached).toBe(false);
  });
});
