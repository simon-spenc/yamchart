# Dashbook Phase 3: API Server Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the Fastify API server that loads config, compiles queries, executes against DuckDB, and returns chart data.

**Architecture:** Stateless server that reads YAML/SQL from filesystem. Config loader watches files for hot reload. In-memory cache with interface for future Redis swap. Routes for config, charts, and queries.

**Tech Stack:** Fastify, YAML parsing (yaml), file watching (chokidar), in-memory LRU cache

**Prerequisites:** Phase 0-2 complete (schema package, query package)

---

## Task 1: Create Server Package Structure

**Files:**
- Create: `apps/server/package.json`
- Create: `apps/server/tsconfig.json`
- Create: `apps/server/src/index.ts`

**Step 1: Create apps/server/package.json**

```json
{
  "name": "@dashbook/server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@dashbook/schema": "workspace:*",
    "@dashbook/query": "workspace:*",
    "fastify": "^5.2.0",
    "@fastify/cors": "^10.0.0",
    "yaml": "^2.7.0",
    "chokidar": "^4.0.0",
    "lru-cache": "^11.0.0"
  },
  "devDependencies": {
    "@dashbook/config": "workspace:*",
    "@types/node": "^22.0.0",
    "typescript": "^5.7.0",
    "tsx": "^4.7.0",
    "vitest": "^2.1.0"
  }
}
```

**Step 2: Create apps/server/tsconfig.json**

```json
{
  "extends": "@dashbook/config/tsconfig.node.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"]
}
```

**Step 3: Create apps/server/src/index.ts**

```typescript
import Fastify from 'fastify';

const server = Fastify({ logger: true });

server.get('/api/health', async () => {
  return { status: 'ok', version: '0.1.0' };
});

const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3001', 10);
    await server.listen({ port, host: '0.0.0.0' });
    console.log(`Server listening on http://localhost:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
```

**Step 4: Install dependencies**

Run: `pnpm install`

**Step 5: Test server starts**

Run: `pnpm --filter @dashbook/server dev`

Expected: Server starts on port 3001.

Test: `curl http://localhost:3001/api/health`

Expected: `{"status":"ok","version":"0.1.0"}`

**Step 6: Commit**

```bash
git add apps/server/
git commit -m "chore: add server package structure with health endpoint"
```

---

## Task 2: Implement Config Loader

**Files:**
- Create: `apps/server/src/services/config-loader.ts`
- Create: `apps/server/src/__tests__/config-loader.test.ts`

**Step 1: Write failing tests for config loader**

Create `apps/server/src/__tests__/config-loader.test.ts`:

```typescript
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
    expect(connections[0].name).toBe('local-duckdb');
    expect(connections[0].type).toBe('duckdb');
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
    expect(charts[0].name).toBe('revenue-trend');
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
-- @param start_date: date = '2025-01-01'

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
    expect(models[0].metadata.name).toBe('monthly_revenue');
    expect(models[0].sql).toContain('SELECT');
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
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @dashbook/server test`

Expected: FAIL - cannot find module '../services/config-loader.js'

**Step 3: Implement config loader**

Create `apps/server/src/services/config-loader.ts`:

```typescript
import { readFile, readdir, access } from 'fs/promises';
import { join, extname } from 'path';
import { parse as parseYaml } from 'yaml';
import { watch, type FSWatcher } from 'chokidar';
import {
  ProjectSchema,
  ConnectionSchema,
  ChartSchema,
  type Project,
  type Connection,
  type Chart,
} from '@dashbook/schema';
import { parseModelMetadata, type ParsedModel } from '@dashbook/query';

export interface LoadedModel {
  metadata: ParsedModel;
  sql: string;
  filePath: string;
}

export class ConfigLoader {
  private projectDir: string;
  private project: Project | null = null;
  private connections: Map<string, Connection> = new Map();
  private charts: Map<string, Chart> = new Map();
  private models: Map<string, LoadedModel> = new Map();
  private watcher: FSWatcher | null = null;
  private onChangeCallbacks: Array<() => void> = [];

  constructor(projectDir: string) {
    this.projectDir = projectDir;
  }

  async load(): Promise<void> {
    await this.loadProject();
    await this.loadConnections();
    await this.loadCharts();
    await this.loadModels();
  }

  private async loadProject(): Promise<void> {
    const projectPath = join(this.projectDir, 'dashbook.yaml');

    try {
      await access(projectPath);
    } catch {
      throw new Error('dashbook.yaml not found');
    }

    const content = await readFile(projectPath, 'utf-8');
    const parsed = parseYaml(content);
    const result = ProjectSchema.safeParse(parsed);

    if (!result.success) {
      throw new Error(`Invalid dashbook.yaml: ${result.error.message}`);
    }

    this.project = result.data;
  }

  private async loadConnections(): Promise<void> {
    const connectionsDir = join(this.projectDir, 'connections');

    try {
      await access(connectionsDir);
    } catch {
      return; // No connections directory is ok
    }

    const files = await readdir(connectionsDir);

    for (const file of files) {
      if (extname(file) !== '.yaml' && extname(file) !== '.yml') continue;

      const filePath = join(connectionsDir, file);
      const content = await readFile(filePath, 'utf-8');
      const parsed = parseYaml(content);
      const result = ConnectionSchema.safeParse(parsed);

      if (result.success) {
        this.connections.set(result.data.name, result.data);
      } else {
        console.warn(`Invalid connection file ${file}: ${result.error.message}`);
      }
    }
  }

  private async loadCharts(): Promise<void> {
    const chartsDir = join(this.projectDir, 'charts');

    try {
      await access(chartsDir);
    } catch {
      return; // No charts directory is ok
    }

    const files = await readdir(chartsDir);

    for (const file of files) {
      if (extname(file) !== '.yaml' && extname(file) !== '.yml') continue;

      const filePath = join(chartsDir, file);
      const content = await readFile(filePath, 'utf-8');
      const parsed = parseYaml(content);
      const result = ChartSchema.safeParse(parsed);

      if (result.success) {
        this.charts.set(result.data.name, result.data);
      } else {
        console.warn(`Invalid chart file ${file}: ${result.error.message}`);
      }
    }
  }

  private async loadModels(): Promise<void> {
    const modelsDir = join(this.projectDir, 'models');

    try {
      await access(modelsDir);
    } catch {
      return; // No models directory is ok
    }

    await this.loadModelsFromDir(modelsDir);
  }

  private async loadModelsFromDir(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        await this.loadModelsFromDir(fullPath);
      } else if (extname(entry.name) === '.sql') {
        const content = await readFile(fullPath, 'utf-8');

        try {
          const parsed = parseModelMetadata(content);
          this.models.set(parsed.name, {
            metadata: parsed,
            sql: parsed.sql,
            filePath: fullPath,
          });
        } catch (err) {
          console.warn(`Invalid model file ${entry.name}: ${err}`);
        }
      }
    }
  }

  startWatching(): void {
    if (this.watcher) return;

    this.watcher = watch(this.projectDir, {
      ignored: /(^|[\/\\])\../, // Ignore dotfiles
      persistent: true,
      ignoreInitial: true,
    });

    this.watcher.on('change', async (path) => {
      console.log(`File changed: ${path}`);
      await this.reload();
    });

    this.watcher.on('add', async (path) => {
      console.log(`File added: ${path}`);
      await this.reload();
    });

    this.watcher.on('unlink', async (path) => {
      console.log(`File removed: ${path}`);
      await this.reload();
    });
  }

  private async reload(): Promise<void> {
    try {
      this.connections.clear();
      this.charts.clear();
      this.models.clear();
      await this.load();

      for (const callback of this.onChangeCallbacks) {
        callback();
      }
    } catch (err) {
      console.error('Error reloading config:', err);
    }
  }

  onChange(callback: () => void): void {
    this.onChangeCallbacks.push(callback);
  }

  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
  }

  getProject(): Project {
    if (!this.project) {
      throw new Error('Config not loaded');
    }
    return this.project;
  }

  getConnections(): Connection[] {
    return Array.from(this.connections.values());
  }

  getConnectionByName(name: string): Connection | undefined {
    return this.connections.get(name);
  }

  getCharts(): Chart[] {
    return Array.from(this.charts.values());
  }

  getChartByName(name: string): Chart | undefined {
    return this.charts.get(name);
  }

  getModels(): LoadedModel[] {
    return Array.from(this.models.values());
  }

  getModelByName(name: string): LoadedModel | undefined {
    return this.models.get(name);
  }

  getDefaultConnection(): Connection | undefined {
    const defaultName = this.project?.defaults?.connection;
    if (defaultName) {
      return this.connections.get(defaultName);
    }
    // Return first connection if no default specified
    return this.connections.values().next().value;
  }
}
```

**Step 4: Create vitest config**

Create `apps/server/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
});
```

**Step 5: Run tests to verify they pass**

Run: `pnpm --filter @dashbook/server test`

Expected: All tests pass.

**Step 6: Commit**

```bash
git add apps/server/
git commit -m "feat(server): add config loader with file watching"
```

---

## Task 3: Implement Cache Service

**Files:**
- Create: `apps/server/src/services/cache.ts`
- Create: `apps/server/src/__tests__/cache.test.ts`

**Step 1: Write failing tests for cache**

Create `apps/server/src/__tests__/cache.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryCache, type CacheProvider, type CachedQueryResult } from '../services/cache.js';

describe('MemoryCache', () => {
  let cache: CacheProvider;

  beforeEach(() => {
    cache = new MemoryCache({ maxSize: 100, defaultTtlMs: 60000 });
  });

  it('stores and retrieves values', async () => {
    const result: CachedQueryResult = {
      columns: [{ name: 'id', type: 'integer' }],
      rows: [{ id: 1 }],
      rowCount: 1,
      durationMs: 100,
      cachedAt: Date.now(),
    };

    await cache.set('key1', result);
    const retrieved = await cache.get('key1');

    expect(retrieved).toEqual(result);
  });

  it('returns null for missing keys', async () => {
    const result = await cache.get('nonexistent');
    expect(result).toBeNull();
  });

  it('respects TTL', async () => {
    vi.useFakeTimers();

    const result: CachedQueryResult = {
      columns: [],
      rows: [],
      rowCount: 0,
      durationMs: 0,
      cachedAt: Date.now(),
    };

    await cache.set('key1', result, 1000); // 1 second TTL

    // Should exist immediately
    expect(await cache.get('key1')).not.toBeNull();

    // Advance time past TTL
    vi.advanceTimersByTime(1500);

    // Should be expired
    expect(await cache.get('key1')).toBeNull();

    vi.useRealTimers();
  });

  it('invalidates by exact key', async () => {
    const result: CachedQueryResult = {
      columns: [],
      rows: [],
      rowCount: 0,
      durationMs: 0,
      cachedAt: Date.now(),
    };

    await cache.set('chart:revenue', result);
    await cache.set('chart:orders', result);

    await cache.invalidate('chart:revenue');

    expect(await cache.get('chart:revenue')).toBeNull();
    expect(await cache.get('chart:orders')).not.toBeNull();
  });

  it('invalidates by pattern', async () => {
    const result: CachedQueryResult = {
      columns: [],
      rows: [],
      rowCount: 0,
      durationMs: 0,
      cachedAt: Date.now(),
    };

    await cache.set('chart:revenue:abc123', result);
    await cache.set('chart:revenue:def456', result);
    await cache.set('chart:orders:ghi789', result);

    await cache.invalidatePattern('chart:revenue:*');

    expect(await cache.get('chart:revenue:abc123')).toBeNull();
    expect(await cache.get('chart:revenue:def456')).toBeNull();
    expect(await cache.get('chart:orders:ghi789')).not.toBeNull();
  });

  it('clears all entries', async () => {
    const result: CachedQueryResult = {
      columns: [],
      rows: [],
      rowCount: 0,
      durationMs: 0,
      cachedAt: Date.now(),
    };

    await cache.set('key1', result);
    await cache.set('key2', result);

    await cache.clear();

    expect(await cache.get('key1')).toBeNull();
    expect(await cache.get('key2')).toBeNull();
  });

  it('returns cache stats', async () => {
    const result: CachedQueryResult = {
      columns: [],
      rows: [],
      rowCount: 0,
      durationMs: 0,
      cachedAt: Date.now(),
    };

    await cache.set('key1', result);
    await cache.set('key2', result);

    await cache.get('key1'); // hit
    await cache.get('key1'); // hit
    await cache.get('missing'); // miss

    const stats = cache.getStats();

    expect(stats.size).toBe(2);
    expect(stats.hits).toBe(2);
    expect(stats.misses).toBe(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @dashbook/server test`

Expected: FAIL - cannot find module '../services/cache.js'

**Step 3: Implement cache service**

Create `apps/server/src/services/cache.ts`:

```typescript
import { LRUCache } from 'lru-cache';

export interface CachedQueryResult {
  columns: Array<{ name: string; type: string }>;
  rows: Array<Record<string, unknown>>;
  rowCount: number;
  durationMs: number;
  cachedAt: number;
}

export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
}

export interface CacheProvider {
  get(key: string): Promise<CachedQueryResult | null>;
  set(key: string, value: CachedQueryResult, ttlMs?: number): Promise<void>;
  invalidate(key: string): Promise<void>;
  invalidatePattern(pattern: string): Promise<void>;
  clear(): Promise<void>;
  getStats(): CacheStats;
}

export interface MemoryCacheOptions {
  maxSize: number;
  defaultTtlMs: number;
}

export class MemoryCache implements CacheProvider {
  private cache: LRUCache<string, CachedQueryResult>;
  private defaultTtlMs: number;
  private hits = 0;
  private misses = 0;

  constructor(options: MemoryCacheOptions) {
    this.defaultTtlMs = options.defaultTtlMs;
    this.cache = new LRUCache<string, CachedQueryResult>({
      max: options.maxSize,
      ttl: options.defaultTtlMs,
      ttlAutopurge: true,
    });
  }

  async get(key: string): Promise<CachedQueryResult | null> {
    const value = this.cache.get(key);
    if (value) {
      this.hits++;
      return value;
    }
    this.misses++;
    return null;
  }

  async set(key: string, value: CachedQueryResult, ttlMs?: number): Promise<void> {
    this.cache.set(key, value, { ttl: ttlMs ?? this.defaultTtlMs });
  }

  async invalidate(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async invalidatePattern(pattern: string): Promise<void> {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special chars
      .replace(/\*/g, '.*'); // Convert * to .*

    const regex = new RegExp(`^${regexPattern}$`);

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  getStats(): CacheStats {
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
    };
  }
}

/**
 * Parse TTL string (e.g., "1h", "30m", "5s") to milliseconds.
 */
export function parseTtl(ttl: string): number {
  const match = ttl.match(/^(\d+)(ms|s|m|h|d)$/);
  if (!match) {
    throw new Error(`Invalid TTL format: ${ttl}`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 'ms':
      return value;
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      throw new Error(`Unknown TTL unit: ${unit}`);
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm --filter @dashbook/server test`

Expected: All tests pass.

**Step 5: Commit**

```bash
git add apps/server/src/services/cache.ts apps/server/src/__tests__/cache.test.ts
git commit -m "feat(server): add in-memory LRU cache with TTL support"
```

---

## Task 4: Implement Query Service

**Files:**
- Create: `apps/server/src/services/query-service.ts`
- Create: `apps/server/src/__tests__/query-service.test.ts`

**Step 1: Write failing tests for query service**

Create `apps/server/src/__tests__/query-service.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { QueryService } from '../services/query-service.js';
import { MemoryCache } from '../services/cache.js';
import { DuckDBConnector } from '@dashbook/query';
import type { Chart } from '@dashbook/schema';

describe('QueryService', () => {
  let queryService: QueryService;
  let connector: DuckDBConnector;
  let cache: MemoryCache;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-31T12:00:00Z'));

    connector = new DuckDBConnector({ path: ':memory:' });
    await connector.connect();

    // Create test table
    await connector.execute(`
      CREATE TABLE orders (
        id INTEGER,
        amount DECIMAL(10,2),
        order_date DATE
      )
    `);

    await connector.execute(`
      INSERT INTO orders VALUES
        (1, 100.00, '2025-12-15'),
        (2, 200.00, '2025-12-20'),
        (3, 150.00, '2026-01-10'),
        (4, 300.00, '2026-01-15')
    `);

    cache = new MemoryCache({ maxSize: 100, defaultTtlMs: 60000 });

    queryService = new QueryService({
      connector,
      cache,
      models: {
        monthly_revenue: {
          metadata: {
            name: 'monthly_revenue',
            params: [
              { name: 'start_date', type: 'date', default: '2025-01-01' },
              { name: 'end_date', type: 'date', default: '2026-12-31' },
            ],
          },
          sql: `
SELECT
  date_trunc('month', order_date) AS period,
  SUM(amount) AS revenue
FROM orders
WHERE order_date BETWEEN '{{ start_date }}' AND '{{ end_date }}'
GROUP BY 1
ORDER BY 1
`,
        },
      },
      refs: { orders: 'orders' },
    });
  });

  afterEach(async () => {
    await connector.disconnect();
    vi.useRealTimers();
  });

  it('executes chart query', async () => {
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

    const result = await queryService.executeChart(chart, {});

    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.columns.map(c => c.name)).toContain('period');
    expect(result.columns.map(c => c.name)).toContain('revenue');
    expect(result.cached).toBe(false);
  });

  it('returns cached result on second call', async () => {
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

    const result1 = await queryService.executeChart(chart, {});
    const result2 = await queryService.executeChart(chart, {});

    expect(result1.cached).toBe(false);
    expect(result2.cached).toBe(true);
    expect(result1.rows).toEqual(result2.rows);
  });

  it('cache miss on different params', async () => {
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

    const result1 = await queryService.executeChart(chart, { start_date: '2025-12-01' });
    const result2 = await queryService.executeChart(chart, { start_date: '2026-01-01' });

    expect(result1.cached).toBe(false);
    expect(result2.cached).toBe(false);
  });

  it('expands date presets', async () => {
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

    const result = await queryService.executeChart(chart, { date_range: 'last_30_days' });

    // Should have January data (within last 30 days of 2026-01-31)
    expect(result.rows.length).toBeGreaterThan(0);
  });

  it('invalidates cache for chart', async () => {
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

    await queryService.executeChart(chart, {});
    queryService.invalidateChart('revenue-trend');
    const result = await queryService.executeChart(chart, {});

    expect(result.cached).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @dashbook/server test`

Expected: FAIL - cannot find module '../services/query-service.js'

**Step 3: Implement query service**

Create `apps/server/src/services/query-service.ts`:

```typescript
import {
  QueryCompiler,
  type Connector,
  type QueryResult,
  type CompilerConfig,
} from '@dashbook/query';
import type { Chart } from '@dashbook/schema';
import type { CacheProvider, CachedQueryResult } from './cache.js';

export interface ChartQueryResult extends QueryResult {
  cached: boolean;
  cacheKey: string;
}

export interface QueryServiceConfig extends CompilerConfig {
  connector: Connector;
  cache: CacheProvider;
}

export class QueryService {
  private compiler: QueryCompiler;
  private connector: Connector;
  private cache: CacheProvider;

  constructor(config: QueryServiceConfig) {
    this.compiler = new QueryCompiler({
      models: config.models,
      refs: config.refs,
    });
    this.connector = config.connector;
    this.cache = config.cache;
  }

  async executeChart(
    chart: Chart,
    params: Record<string, unknown>
  ): Promise<ChartQueryResult> {
    // Compile the query
    const compiled = this.compiler.compile(chart, params);

    // Check cache
    const cached = await this.cache.get(compiled.cacheKey);
    if (cached) {
      return {
        columns: cached.columns,
        rows: cached.rows,
        rowCount: cached.rowCount,
        durationMs: cached.durationMs,
        cached: true,
        cacheKey: compiled.cacheKey,
      };
    }

    // Execute query
    const result = await this.connector.execute(compiled.sql);

    // Store in cache
    const cacheEntry: CachedQueryResult = {
      columns: result.columns,
      rows: result.rows,
      rowCount: result.rowCount,
      durationMs: result.durationMs,
      cachedAt: Date.now(),
    };
    await this.cache.set(compiled.cacheKey, cacheEntry);

    return {
      ...result,
      cached: false,
      cacheKey: compiled.cacheKey,
    };
  }

  invalidateChart(chartName: string): void {
    this.cache.invalidatePattern(`${chartName}:*`);
  }

  invalidateAll(): void {
    this.cache.clear();
  }

  getCacheStats() {
    return this.cache.getStats();
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm --filter @dashbook/server test`

Expected: All tests pass.

**Step 5: Commit**

```bash
git add apps/server/src/services/query-service.ts apps/server/src/__tests__/query-service.test.ts
git commit -m "feat(server): add query service with caching"
```

---

## Task 5: Implement API Routes

**Files:**
- Create: `apps/server/src/routes/config.ts`
- Create: `apps/server/src/routes/charts.ts`
- Create: `apps/server/src/routes/index.ts`

**Step 1: Create config routes**

Create `apps/server/src/routes/config.ts`:

```typescript
import type { FastifyInstance } from 'fastify';
import type { ConfigLoader } from '../services/config-loader.js';

export interface ConfigRoutesOptions {
  configLoader: ConfigLoader;
}

export async function configRoutes(
  fastify: FastifyInstance,
  options: ConfigRoutesOptions
) {
  const { configLoader } = options;

  // Get project config and available resources
  fastify.get('/api/config', async () => {
    const project = configLoader.getProject();
    const charts = configLoader.getCharts();
    const connections = configLoader.getConnections();

    return {
      name: project.name,
      version: project.version,
      description: project.description,
      defaults: project.defaults,
      charts: charts.map((c) => ({
        name: c.name,
        title: c.title,
        description: c.description,
        type: c.chart.type,
      })),
      connections: connections.map((c) => ({
        name: c.name,
        type: c.type,
        description: c.description,
      })),
    };
  });

  // Get connection status
  fastify.get<{ Params: { name: string } }>(
    '/api/connections/:name/status',
    async (request, reply) => {
      const { name } = request.params;
      const connection = configLoader.getConnectionByName(name);

      if (!connection) {
        return reply.status(404).send({ error: `Connection not found: ${name}` });
      }

      // TODO: Actually test connection
      return {
        name: connection.name,
        type: connection.type,
        status: 'healthy',
        latencyMs: 0,
      };
    }
  );
}
```

**Step 2: Create chart routes**

Create `apps/server/src/routes/charts.ts`:

```typescript
import type { FastifyInstance } from 'fastify';
import type { ConfigLoader } from '../services/config-loader.js';
import type { QueryService } from '../services/query-service.js';

export interface ChartRoutesOptions {
  configLoader: ConfigLoader;
  queryService: QueryService;
}

export async function chartRoutes(
  fastify: FastifyInstance,
  options: ChartRoutesOptions
) {
  const { configLoader, queryService } = options;

  // Get chart definition
  fastify.get<{ Params: { name: string } }>(
    '/api/charts/:name',
    async (request, reply) => {
      const { name } = request.params;
      const chart = configLoader.getChartByName(name);

      if (!chart) {
        return reply.status(404).send({ error: `Chart not found: ${name}` });
      }

      return {
        name: chart.name,
        title: chart.title,
        description: chart.description,
        parameters: chart.parameters ?? [],
        chart: chart.chart,
      };
    }
  );

  // Execute chart query
  fastify.post<{
    Params: { name: string };
    Body: Record<string, unknown>;
  }>('/api/charts/:name/query', async (request, reply) => {
    const { name } = request.params;
    const params = request.body ?? {};

    const chart = configLoader.getChartByName(name);
    if (!chart) {
      return reply.status(404).send({ error: `Chart not found: ${name}` });
    }

    try {
      const result = await queryService.executeChart(chart, params);

      return {
        columns: result.columns,
        rows: result.rows,
        meta: {
          cached: result.cached,
          durationMs: result.durationMs,
          rowCount: result.rowCount,
          cacheKey: result.cacheKey,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Query execution failed';
      return reply.status(500).send({ error: message });
    }
  });

  // Invalidate chart cache
  fastify.post<{ Params: { name: string } }>(
    '/api/charts/:name/invalidate',
    async (request, reply) => {
      const { name } = request.params;

      const chart = configLoader.getChartByName(name);
      if (!chart) {
        return reply.status(404).send({ error: `Chart not found: ${name}` });
      }

      queryService.invalidateChart(name);

      return { success: true, message: `Cache invalidated for chart: ${name}` };
    }
  );
}
```

**Step 3: Create routes index**

Create `apps/server/src/routes/index.ts`:

```typescript
export { configRoutes, type ConfigRoutesOptions } from './config.js';
export { chartRoutes, type ChartRoutesOptions } from './charts.js';
```

**Step 4: Commit**

```bash
git add apps/server/src/routes/
git commit -m "feat(server): add API routes for config and charts"
```

---

## Task 6: Create Server Factory

**Files:**
- Update: `apps/server/src/index.ts`
- Create: `apps/server/src/server.ts`

**Step 1: Create server factory**

Create `apps/server/src/server.ts`:

```typescript
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { ConfigLoader } from './services/config-loader.js';
import { MemoryCache, parseTtl } from './services/cache.js';
import { QueryService } from './services/query-service.js';
import { configRoutes, chartRoutes } from './routes/index.js';
import { DuckDBConnector } from '@dashbook/query';
import type { DuckDBConnection } from '@dashbook/schema';

export interface ServerOptions {
  projectDir: string;
  port?: number;
  host?: string;
  watch?: boolean;
}

export interface DashbookServer {
  fastify: FastifyInstance;
  configLoader: ConfigLoader;
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

export async function createServer(options: ServerOptions): Promise<DashbookServer> {
  const { projectDir, port = 3001, host = '0.0.0.0', watch = false } = options;

  // Initialize Fastify
  const fastify = Fastify({ logger: true });
  await fastify.register(cors, { origin: true });

  // Load config
  const configLoader = new ConfigLoader(projectDir);
  await configLoader.load();

  // Get default connection and create connector
  const defaultConnection = configLoader.getDefaultConnection();
  if (!defaultConnection) {
    throw new Error('No connection configured');
  }

  let connector;
  if (defaultConnection.type === 'duckdb') {
    const duckdbConfig = defaultConnection as DuckDBConnection;
    connector = new DuckDBConnector({ path: duckdbConfig.config.path });
    await connector.connect();
  } else {
    throw new Error(`Unsupported connection type: ${defaultConnection.type}`);
  }

  // Setup cache
  const project = configLoader.getProject();
  const cacheTtl = project.defaults?.cache_ttl
    ? parseTtl(project.defaults.cache_ttl)
    : 5 * 60 * 1000; // 5 minutes default

  const cache = new MemoryCache({
    maxSize: 1000,
    defaultTtlMs: cacheTtl,
  });

  // Build model refs
  const models: Record<string, { metadata: any; sql: string }> = {};
  const refs: Record<string, string> = {};

  for (const model of configLoader.getModels()) {
    models[model.metadata.name] = {
      metadata: model.metadata,
      sql: model.sql,
    };
    // For MVP, ref resolves to table name directly
    refs[model.metadata.name] = model.metadata.name;
  }

  // Add base table refs (assume table names match for MVP)
  // In production, this would come from schema introspection
  refs['orders'] = 'orders';
  refs['customers'] = 'customers';
  refs['products'] = 'products';

  // Create query service
  const queryService = new QueryService({
    connector,
    cache,
    models,
    refs,
  });

  // Register routes
  fastify.get('/api/health', async () => ({
    status: 'ok',
    version: '0.1.0',
    project: project.name,
  }));

  await fastify.register(configRoutes, { configLoader });
  await fastify.register(chartRoutes, { configLoader, queryService });

  // Setup file watching for hot reload
  if (watch) {
    configLoader.startWatching();
    configLoader.onChange(() => {
      fastify.log.info('Config reloaded');
      // Invalidate all cache on config change
      queryService.invalidateAll();
    });
  }

  return {
    fastify,
    configLoader,
    start: async () => {
      await fastify.listen({ port, host });
      console.log(`
  ┌─────────────────────────────────────────┐
  │                                         │
  │   Dashbook Server v0.1.0                │
  │                                         │
  │   API:     http://localhost:${port}       │
  │   Project: ${project.name.padEnd(27)}│
  │                                         │
  │   Charts:  ${String(configLoader.getCharts().length).padEnd(27)}│
  │   Models:  ${String(configLoader.getModels().length).padEnd(27)}│
  │   Connection: ${(defaultConnection.name + ' (' + defaultConnection.type + ')').padEnd(22)}│
  │                                         │
  └─────────────────────────────────────────┘
      `);
    },
    stop: async () => {
      await configLoader.stop();
      await connector.disconnect();
      await fastify.close();
    },
  };
}
```

**Step 2: Update main entry point**

Update `apps/server/src/index.ts`:

```typescript
import { createServer } from './server.js';
import { resolve } from 'path';

const projectDir = process.env.DASHBOOK_PROJECT_DIR || process.cwd();
const port = parseInt(process.env.PORT || '3001', 10);
const watch = process.env.NODE_ENV !== 'production';

async function main() {
  try {
    const server = await createServer({
      projectDir: resolve(projectDir),
      port,
      watch,
    });

    await server.start();

    // Graceful shutdown
    const shutdown = async () => {
      console.log('\nShutting down...');
      await server.stop();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();
```

**Step 3: Export server factory**

Create `apps/server/src/exports.ts`:

```typescript
export { createServer, type ServerOptions, type DashbookServer } from './server.js';
export { ConfigLoader } from './services/config-loader.js';
export { MemoryCache, parseTtl, type CacheProvider } from './services/cache.js';
export { QueryService } from './services/query-service.js';
```

**Step 4: Commit**

```bash
git add apps/server/src/
git commit -m "feat(server): add server factory with full initialization"
```

---

## Task 7: Integration Test - Full Server

**Files:**
- Create: `apps/server/src/__tests__/integration.test.ts`

**Step 1: Write integration test**

Create `apps/server/src/__tests__/integration.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type DashbookServer } from '../server.js';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { DuckDBConnector } from '@dashbook/query';

describe('Server Integration', () => {
  let testDir: string;
  let server: DashbookServer;
  let dbPath: string;

  beforeAll(async () => {
    // Create temp project directory
    testDir = join(tmpdir(), `dashbook-server-test-${Date.now()}`);
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
      join(testDir, 'dashbook.yaml'),
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
-- @param start_date: date = '2025-01-01'
-- @param end_date: date = '2025-12-31'

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
    const response = await server.fastify.inject({
      method: 'POST',
      url: '/api/charts/revenue-trend/query',
      payload: { start_date: '2025-01-01', end_date: '2025-01-31' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();

    // Should only have January data
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0].revenue).toBeCloseTo(300.0);
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
```

**Step 2: Run integration tests**

Run: `pnpm --filter @dashbook/server test`

Expected: All tests pass.

**Step 3: Commit**

```bash
git add apps/server/src/__tests__/integration.test.ts
git commit -m "test(server): add full server integration tests"
```

---

## Task 8: Add Services Index Export

**Files:**
- Create: `apps/server/src/services/index.ts`

**Step 1: Create services index**

Create `apps/server/src/services/index.ts`:

```typescript
export { ConfigLoader, type LoadedModel } from './config-loader.js';
export {
  MemoryCache,
  parseTtl,
  type CacheProvider,
  type CachedQueryResult,
  type CacheStats,
} from './cache.js';
export { QueryService, type ChartQueryResult } from './query-service.js';
```

**Step 2: Commit**

```bash
git add apps/server/src/services/index.ts
git commit -m "chore(server): add services index export"
```

---

## Task 9: Final Build and Push

**Step 1: Run full build**

Run: `pnpm build`

Expected: All packages build successfully.

**Step 2: Run all tests**

Run: `pnpm test`

Expected: All tests pass.

**Step 3: Test server manually**

```bash
# From examples directory (assuming it exists with config)
cd examples
DASHBOOK_PROJECT_DIR=. pnpm --filter @dashbook/server dev
```

Test endpoints:
```bash
curl http://localhost:3001/api/health
curl http://localhost:3001/api/config
curl http://localhost:3001/api/charts/revenue-trend
curl -X POST http://localhost:3001/api/charts/revenue-trend/query \
  -H "Content-Type: application/json" \
  -d '{"date_range": "last_30_days"}'
```

**Step 4: Push to remote**

```bash
git push origin main
```

---

## Summary

After completing these tasks, you will have:

1. **Server package** (`apps/server`) with:
   - Fastify server with CORS
   - Config loader with file watching
   - In-memory LRU cache with TTL
   - Query service with caching
   - API routes: `/api/health`, `/api/config`, `/api/charts/:name`, `/api/charts/:name/query`

2. **Full test coverage**:
   - Config loader tests
   - Cache tests
   - Query service tests
   - Integration tests

3. **Endpoints ready for frontend**:
   - `GET /api/health` - Health check
   - `GET /api/config` - Project config and available charts
   - `GET /api/charts/:name` - Chart definition
   - `POST /api/charts/:name/query` - Execute chart query
   - `POST /api/charts/:name/invalidate` - Clear chart cache

Next phase will implement the React web app that consumes this API.
