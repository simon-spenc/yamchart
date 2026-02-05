# sync-dbt Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `yamchart sync-dbt` command that syncs dbt project metadata into AI-readable catalog files.

**Architecture:** Parse dbt schema.yml files from a local directory, extract model/column metadata with test hints, generate `.yamchart/catalog.md` and `.yamchart/catalog.json`. Use a `DbtSource` interface to enable future GitHub/dbt Cloud sources.

**Tech Stack:** TypeScript, Commander (CLI), yaml (parsing), glob patterns via fast-glob, Zod (validation), Vitest (testing)

---

## Task 1: Add fast-glob dependency

**Files:**
- Modify: `apps/cli/package.json`

**Step 1: Add dependency**

```bash
cd /Users/simonspencer/Documents/Projects/yamchart && pnpm --filter yamchart add fast-glob
```

**Step 2: Verify installation**

```bash
pnpm --filter yamchart list fast-glob
```

Expected: Shows fast-glob in dependencies

**Step 3: Commit**

```bash
git add apps/cli/package.json pnpm-lock.yaml && git commit -m "chore(cli): add fast-glob dependency for dbt sync"
```

---

## Task 2: Create dbt source types and interfaces

**Files:**
- Create: `apps/cli/src/dbt/types.ts`
- Test: `apps/cli/src/__tests__/dbt/types.test.ts`

**Step 1: Write the test**

Create `apps/cli/src/__tests__/dbt/types.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  DbtColumnSchema,
  DbtModelSchema,
  DbtProjectConfigSchema,
  type DbtColumn,
  type DbtModel,
} from '../../dbt/types.js';

describe('DbtColumnSchema', () => {
  it('parses minimal column', () => {
    const result = DbtColumnSchema.safeParse({ name: 'id' });
    expect(result.success).toBe(true);
    expect(result.data?.name).toBe('id');
    expect(result.data?.hints).toEqual([]);
  });

  it('parses column with all fields', () => {
    const result = DbtColumnSchema.safeParse({
      name: 'order_id',
      description: 'Unique order identifier',
      data_type: 'string',
      hints: ['primary_key', 'unique'],
    });
    expect(result.success).toBe(true);
    expect(result.data?.hints).toEqual(['primary_key', 'unique']);
  });
});

describe('DbtModelSchema', () => {
  it('parses minimal model', () => {
    const result = DbtModelSchema.safeParse({
      name: 'orders',
      path: 'models/marts/orders.sql',
    });
    expect(result.success).toBe(true);
    expect(result.data?.description).toBe('No description');
  });

  it('parses model with columns and tags', () => {
    const result = DbtModelSchema.safeParse({
      name: 'orders',
      path: 'models/marts/orders.sql',
      description: 'Order transactions',
      table: 'analytics.marts.orders',
      tags: ['bi', 'finance'],
      columns: [{ name: 'id', description: 'Primary key' }],
    });
    expect(result.success).toBe(true);
    expect(result.data?.tags).toEqual(['bi', 'finance']);
    expect(result.data?.columns).toHaveLength(1);
  });
});

describe('DbtProjectConfigSchema', () => {
  it('parses project config', () => {
    const result = DbtProjectConfigSchema.safeParse({
      name: 'analytics',
      version: '1.0.0',
      profile: 'analytics',
      model_paths: ['models'],
      target_path: 'target',
    });
    expect(result.success).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm --filter yamchart test src/__tests__/dbt/types.test.ts
```

Expected: FAIL - Cannot find module '../../dbt/types.js'

**Step 3: Write the implementation**

Create `apps/cli/src/dbt/types.ts`:

```typescript
import { z } from 'zod';

// Column extracted from dbt schema.yml
export const DbtColumnSchema = z.object({
  name: z.string(),
  description: z.string().optional().default(''),
  data_type: z.string().optional(),
  hints: z.array(z.string()).optional().default([]),
});

export type DbtColumn = z.infer<typeof DbtColumnSchema>;

// Model extracted from dbt schema.yml
export const DbtModelSchema = z.object({
  name: z.string(),
  path: z.string(), // relative path to .sql file
  description: z.string().optional().default('No description'),
  table: z.string().optional(), // fully qualified table name
  tags: z.array(z.string()).optional().default([]),
  meta: z.record(z.unknown()).optional().default({}),
  columns: z.array(DbtColumnSchema).optional().default([]),
});

export type DbtModel = z.infer<typeof DbtModelSchema>;

// Summary for listing (before full details loaded)
export interface DbtModelSummary {
  name: string;
  path: string;
  description: string;
  tags: string[];
}

// dbt_project.yml config
export const DbtProjectConfigSchema = z.object({
  name: z.string(),
  version: z.string().optional(),
  profile: z.string().optional(),
  model_paths: z.array(z.string()).optional().default(['models']),
  target_path: z.string().optional().default('target'),
  vars: z.record(z.unknown()).optional().default({}),
});

export type DbtProjectConfig = z.infer<typeof DbtProjectConfigSchema>;

// Interface for dbt sources (local, github, dbt-cloud)
export interface DbtSource {
  type: 'local' | 'github' | 'dbt-cloud';

  // Get project-level config
  getProjectConfig(): Promise<DbtProjectConfig>;

  // List all models (summaries for selection UI)
  listModels(): Promise<DbtModelSummary[]>;

  // Get full model details
  getModel(name: string): Promise<DbtModel>;

  // Get all models matching filter
  getModels(names: string[]): Promise<DbtModel[]>;
}

// Sync configuration saved to .yamchart/dbt-source.yaml
export const DbtSourceConfigSchema = z.object({
  source: z.enum(['local', 'github', 'dbt-cloud']),
  path: z.string().optional(), // for local
  repo: z.string().optional(), // for github
  branch: z.string().optional(), // for github
  lastSync: z.string(), // ISO timestamp
  filters: z.object({
    include: z.array(z.string()).default([]),
    exclude: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
  }),
  stats: z.object({
    modelsIncluded: z.number(),
    modelsExcluded: z.number(),
  }),
});

export type DbtSourceConfig = z.infer<typeof DbtSourceConfigSchema>;
```

**Step 4: Run test to verify it passes**

```bash
pnpm --filter yamchart test src/__tests__/dbt/types.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add apps/cli/src/dbt/types.ts apps/cli/src/__tests__/dbt/types.test.ts
git commit -m "feat(cli): add dbt source types and interfaces"
```

---

## Task 3: Create dbt schema.yml parser

**Files:**
- Create: `apps/cli/src/dbt/parser.ts`
- Test: `apps/cli/src/__tests__/dbt/parser.test.ts`

**Step 1: Write the test**

Create `apps/cli/src/__tests__/dbt/parser.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parseSchemaYml, extractHintsFromTests } from '../../dbt/parser.js';

describe('extractHintsFromTests', () => {
  it('extracts unique hint', () => {
    const tests = ['unique'];
    expect(extractHintsFromTests(tests)).toContain('unique');
  });

  it('extracts required from not_null', () => {
    const tests = ['not_null'];
    expect(extractHintsFromTests(tests)).toContain('required');
  });

  it('extracts fk from relationships', () => {
    const tests = [
      { relationships: { to: "ref('customers')", field: 'id' } },
    ];
    expect(extractHintsFromTests(tests)).toContain('fk:customers');
  });

  it('extracts primary_key from meta', () => {
    const tests = [{ dbt_constraints: { type: 'primary_key' } }];
    // This may vary based on how dbt stores PK info
    expect(extractHintsFromTests(tests)).toBeDefined();
  });
});

describe('parseSchemaYml', () => {
  it('parses minimal schema', () => {
    const yaml = `
version: 2
models:
  - name: orders
`;
    const result = parseSchemaYml(yaml, 'models/marts/_schema.yml');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('orders');
  });

  it('parses model with description and columns', () => {
    const yaml = `
version: 2
models:
  - name: orders
    description: "Daily order transactions"
    columns:
      - name: order_id
        description: "Unique identifier"
        data_type: string
        tests:
          - unique
          - not_null
      - name: customer_id
        tests:
          - not_null
          - relationships:
              to: ref('customers')
              field: id
`;
    const result = parseSchemaYml(yaml, 'models/marts/_schema.yml');
    expect(result).toHaveLength(1);
    expect(result[0].description).toBe('Daily order transactions');
    expect(result[0].columns).toHaveLength(2);
    expect(result[0].columns[0].hints).toContain('unique');
    expect(result[0].columns[0].hints).toContain('required');
    expect(result[0].columns[1].hints).toContain('fk:customers');
  });

  it('parses model with tags and meta', () => {
    const yaml = `
version: 2
models:
  - name: orders
    meta:
      yamchart: true
      owner: analytics
    tags:
      - bi
      - finance
`;
    const result = parseSchemaYml(yaml, 'models/marts/_schema.yml');
    expect(result[0].tags).toEqual(['bi', 'finance']);
    expect(result[0].meta).toEqual({ yamchart: true, owner: 'analytics' });
  });

  it('derives path from schema file location', () => {
    const yaml = `
version: 2
models:
  - name: orders
`;
    const result = parseSchemaYml(yaml, 'models/marts/_schema.yml');
    expect(result[0].path).toBe('models/marts/orders.sql');
  });

  it('returns empty array for schema with no models', () => {
    const yaml = `
version: 2
sources:
  - name: raw_data
`;
    const result = parseSchemaYml(yaml, 'models/_schema.yml');
    expect(result).toHaveLength(0);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm --filter yamchart test src/__tests__/dbt/parser.test.ts
```

Expected: FAIL - Cannot find module '../../dbt/parser.js'

**Step 3: Write the implementation**

Create `apps/cli/src/dbt/parser.ts`:

```typescript
import { parse as parseYaml } from 'yaml';
import { dirname, join } from 'path';
import type { DbtModel, DbtColumn } from './types.js';

interface RawSchemaYml {
  version: number;
  models?: RawModel[];
}

interface RawModel {
  name: string;
  description?: string;
  meta?: Record<string, unknown>;
  tags?: string[];
  columns?: RawColumn[];
}

interface RawColumn {
  name: string;
  description?: string;
  data_type?: string;
  tests?: (string | Record<string, unknown>)[];
}

/**
 * Extract hints from dbt column tests.
 * - unique → "unique"
 * - not_null → "required"
 * - relationships: { to: ref('X') } → "fk:X"
 */
export function extractHintsFromTests(tests: (string | Record<string, unknown>)[]): string[] {
  const hints: string[] = [];

  for (const test of tests) {
    if (typeof test === 'string') {
      if (test === 'unique') {
        hints.push('unique');
      } else if (test === 'not_null') {
        hints.push('required');
      } else if (test === 'primary_key') {
        hints.push('primary_key');
      }
    } else if (typeof test === 'object' && test !== null) {
      // Handle relationships test
      if ('relationships' in test) {
        const rel = test.relationships as { to?: string; field?: string };
        if (rel.to) {
          // Extract table name from ref('table_name')
          const match = rel.to.match(/ref\(['"]([^'"]+)['"]\)/);
          if (match) {
            hints.push(`fk:${match[1]}`);
          }
        }
      }
      // Handle dbt_constraints for primary key
      if ('dbt_constraints' in test) {
        const constraint = test.dbt_constraints as { type?: string };
        if (constraint.type === 'primary_key') {
          hints.push('primary_key');
        }
      }
    }
  }

  return hints;
}

/**
 * Parse a dbt schema.yml file and extract model definitions.
 * @param content - Raw YAML content
 * @param schemaPath - Path to the schema file (e.g., "models/marts/_schema.yml")
 * @returns Array of parsed models
 */
export function parseSchemaYml(content: string, schemaPath: string): DbtModel[] {
  const parsed = parseYaml(content) as RawSchemaYml;

  if (!parsed?.models || !Array.isArray(parsed.models)) {
    return [];
  }

  const schemaDir = dirname(schemaPath);

  return parsed.models.map((model): DbtModel => {
    const columns: DbtColumn[] = (model.columns || []).map((col) => ({
      name: col.name,
      description: col.description || '',
      data_type: col.data_type,
      hints: col.tests ? extractHintsFromTests(col.tests) : [],
    }));

    return {
      name: model.name,
      path: join(schemaDir, `${model.name}.sql`),
      description: model.description || 'No description',
      tags: model.tags || [],
      meta: model.meta || {},
      columns,
    };
  });
}

/**
 * Parse dbt_project.yml to get project-level config.
 */
export function parseProjectYml(content: string): {
  name: string;
  version?: string;
  profile?: string;
  modelPaths: string[];
  vars: Record<string, unknown>;
} {
  const parsed = parseYaml(content) as Record<string, unknown>;

  return {
    name: (parsed.name as string) || 'unknown',
    version: parsed.version as string | undefined,
    profile: parsed.profile as string | undefined,
    modelPaths: (parsed['model-paths'] as string[]) || (parsed.model_paths as string[]) || ['models'],
    vars: (parsed.vars as Record<string, unknown>) || {},
  };
}
```

**Step 4: Run test to verify it passes**

```bash
pnpm --filter yamchart test src/__tests__/dbt/parser.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add apps/cli/src/dbt/parser.ts apps/cli/src/__tests__/dbt/parser.test.ts
git commit -m "feat(cli): add dbt schema.yml parser with test hint extraction"
```

---

## Task 4: Create LocalDbtSource implementation

**Files:**
- Create: `apps/cli/src/dbt/local-source.ts`
- Test: `apps/cli/src/__tests__/dbt/local-source.test.ts`
- Create: `apps/cli/src/__fixtures__/dbt-project/` (fixture files)

**Step 1: Create fixture dbt project**

Create directory structure:

```bash
mkdir -p apps/cli/src/__fixtures__/dbt-project/models/marts
mkdir -p apps/cli/src/__fixtures__/dbt-project/models/staging
```

Create `apps/cli/src/__fixtures__/dbt-project/dbt_project.yml`:

```yaml
name: test_project
version: '1.0.0'
profile: test
model-paths: ['models']
```

Create `apps/cli/src/__fixtures__/dbt-project/models/marts/_schema.yml`:

```yaml
version: 2
models:
  - name: orders
    description: "Daily order transactions"
    meta:
      yamchart: true
    tags:
      - bi
      - finance
    columns:
      - name: order_id
        description: "Unique order identifier"
        data_type: string
        tests:
          - unique
          - not_null
      - name: customer_id
        description: "FK to customers"
        tests:
          - not_null
          - relationships:
              to: ref('customers')
              field: id
      - name: total_amount
        description: "Order total in USD"
        data_type: numeric

  - name: customers
    description: "Customer dimension table"
    tags:
      - bi
    columns:
      - name: id
        description: "Customer ID"
        tests:
          - unique
          - not_null
      - name: region
        description: "Customer region"
```

Create `apps/cli/src/__fixtures__/dbt-project/models/staging/_schema.yml`:

```yaml
version: 2
models:
  - name: stg_orders
    description: "Staged orders from source"
    columns:
      - name: id
        tests:
          - not_null
```

**Step 2: Write the test**

Create `apps/cli/src/__tests__/dbt/local-source.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { LocalDbtSource } from '../../dbt/local-source.js';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(__dirname, '../__fixtures__/dbt-project');

describe('LocalDbtSource', () => {
  let source: LocalDbtSource;

  beforeAll(() => {
    source = new LocalDbtSource(fixtureDir);
  });

  describe('getProjectConfig', () => {
    it('reads dbt_project.yml', async () => {
      const config = await source.getProjectConfig();
      expect(config.name).toBe('test_project');
      expect(config.model_paths).toContain('models');
    });
  });

  describe('listModels', () => {
    it('lists all models from schema files', async () => {
      const models = await source.listModels();
      expect(models.length).toBeGreaterThanOrEqual(3);
      expect(models.find(m => m.name === 'orders')).toBeDefined();
      expect(models.find(m => m.name === 'customers')).toBeDefined();
      expect(models.find(m => m.name === 'stg_orders')).toBeDefined();
    });

    it('includes path for each model', async () => {
      const models = await source.listModels();
      const orders = models.find(m => m.name === 'orders');
      expect(orders?.path).toContain('models/marts/orders.sql');
    });
  });

  describe('getModel', () => {
    it('returns full model details', async () => {
      const model = await source.getModel('orders');
      expect(model.name).toBe('orders');
      expect(model.description).toBe('Daily order transactions');
      expect(model.tags).toContain('bi');
      expect(model.columns.length).toBeGreaterThanOrEqual(3);
    });

    it('includes column hints from tests', async () => {
      const model = await source.getModel('orders');
      const orderId = model.columns.find(c => c.name === 'order_id');
      expect(orderId?.hints).toContain('unique');
      expect(orderId?.hints).toContain('required');

      const customerId = model.columns.find(c => c.name === 'customer_id');
      expect(customerId?.hints).toContain('fk:customers');
    });

    it('throws for non-existent model', async () => {
      await expect(source.getModel('nonexistent')).rejects.toThrow();
    });
  });

  describe('getModels', () => {
    it('returns multiple models', async () => {
      const models = await source.getModels(['orders', 'customers']);
      expect(models).toHaveLength(2);
    });
  });

  describe('filterModels', () => {
    it('filters by include pattern', async () => {
      const allModels = await source.listModels();
      const filtered = source.filterModels(allModels, {
        include: ['models/marts/**'],
        exclude: [],
        tags: [],
      });
      expect(filtered.every(m => m.path.includes('marts'))).toBe(true);
      expect(filtered.find(m => m.name === 'stg_orders')).toBeUndefined();
    });

    it('filters by exclude pattern', async () => {
      const allModels = await source.listModels();
      const filtered = source.filterModels(allModels, {
        include: [],
        exclude: ['models/staging/**'],
        tags: [],
      });
      expect(filtered.find(m => m.name === 'stg_orders')).toBeUndefined();
    });

    it('filters by tag', async () => {
      const allModels = await source.listModels();
      const filtered = source.filterModels(allModels, {
        include: [],
        exclude: [],
        tags: ['finance'],
      });
      expect(filtered.every(m => m.tags.includes('finance'))).toBe(true);
    });
  });
});
```

**Step 3: Run test to verify it fails**

```bash
pnpm --filter yamchart test src/__tests__/dbt/local-source.test.ts
```

Expected: FAIL - Cannot find module '../../dbt/local-source.js'

**Step 4: Write the implementation**

Create `apps/cli/src/dbt/local-source.ts`:

```typescript
import { readFile, access } from 'fs/promises';
import { join } from 'path';
import fg from 'fast-glob';
import { minimatch } from 'minimatch';
import type { DbtSource, DbtModel, DbtModelSummary, DbtProjectConfig } from './types.js';
import { DbtProjectConfigSchema } from './types.js';
import { parseSchemaYml, parseProjectYml } from './parser.js';

export interface FilterOptions {
  include: string[];
  exclude: string[];
  tags: string[];
}

export class LocalDbtSource implements DbtSource {
  type: 'local' = 'local';
  private projectPath: string;
  private modelsCache: Map<string, DbtModel> = new Map();
  private modelListCache: DbtModelSummary[] | null = null;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  async getProjectConfig(): Promise<DbtProjectConfig> {
    const configPath = join(this.projectPath, 'dbt_project.yml');

    try {
      await access(configPath);
    } catch {
      throw new Error(`dbt_project.yml not found at ${configPath}`);
    }

    const content = await readFile(configPath, 'utf-8');
    const parsed = parseProjectYml(content);

    return DbtProjectConfigSchema.parse({
      name: parsed.name,
      version: parsed.version,
      profile: parsed.profile,
      model_paths: parsed.modelPaths,
    });
  }

  async listModels(): Promise<DbtModelSummary[]> {
    if (this.modelListCache) {
      return this.modelListCache;
    }

    const config = await this.getProjectConfig();
    const models: DbtModelSummary[] = [];

    // Find all schema.yml files
    for (const modelPath of config.model_paths) {
      const pattern = join(this.projectPath, modelPath, '**/*.yml');
      const schemaFiles = await fg(pattern, { onlyFiles: true });

      for (const schemaFile of schemaFiles) {
        const content = await readFile(schemaFile, 'utf-8');
        // Get relative path from project root
        const relativePath = schemaFile.replace(this.projectPath + '/', '');
        const parsed = parseSchemaYml(content, relativePath);

        for (const model of parsed) {
          // Cache the full model
          this.modelsCache.set(model.name, model);

          // Add summary to list
          models.push({
            name: model.name,
            path: model.path,
            description: model.description,
            tags: model.tags,
          });
        }
      }
    }

    this.modelListCache = models;
    return models;
  }

  async getModel(name: string): Promise<DbtModel> {
    // Ensure models are loaded
    if (this.modelsCache.size === 0) {
      await this.listModels();
    }

    const model = this.modelsCache.get(name);
    if (!model) {
      throw new Error(`Model "${name}" not found`);
    }

    return model;
  }

  async getModels(names: string[]): Promise<DbtModel[]> {
    return Promise.all(names.map((name) => this.getModel(name)));
  }

  /**
   * Filter models by include/exclude patterns and tags.
   */
  filterModels(models: DbtModelSummary[], filters: FilterOptions): DbtModelSummary[] {
    return models.filter((model) => {
      // Check include patterns (if any specified, model must match at least one)
      if (filters.include.length > 0) {
        const matches = filters.include.some((pattern) =>
          minimatch(model.path, pattern, { matchBase: true })
        );
        if (!matches) return false;
      }

      // Check exclude patterns (model must not match any)
      if (filters.exclude.length > 0) {
        const excluded = filters.exclude.some((pattern) =>
          minimatch(model.path, pattern, { matchBase: true })
        );
        if (excluded) return false;
      }

      // Check tags (if any specified, model must have at least one)
      if (filters.tags.length > 0) {
        const hasTag = filters.tags.some((tag) => model.tags.includes(tag));
        if (!hasTag) return false;
      }

      return true;
    });
  }

  /**
   * Get smart default filters based on common dbt conventions.
   */
  static getDefaultFilters(): FilterOptions {
    return {
      include: ['**/marts/**', '**/reporting/**', '**/analytics/**'],
      exclude: ['**/staging/**', '**/intermediate/**', '**/base/**'],
      tags: [],
    };
  }
}
```

**Step 5: Add minimatch dependency**

```bash
cd /Users/simonspencer/Documents/Projects/yamchart && pnpm --filter yamchart add minimatch
```

**Step 6: Run test to verify it passes**

```bash
pnpm --filter yamchart test src/__tests__/dbt/local-source.test.ts
```

Expected: PASS

**Step 7: Commit**

```bash
git add apps/cli/src/dbt/local-source.ts apps/cli/src/__tests__/dbt/local-source.test.ts apps/cli/src/__fixtures__/dbt-project apps/cli/package.json pnpm-lock.yaml
git commit -m "feat(cli): add LocalDbtSource for reading dbt projects"
```

---

## Task 5: Create yamchart model scanner for cross-references

**Files:**
- Create: `apps/cli/src/dbt/scanner.ts`
- Test: `apps/cli/src/__tests__/dbt/scanner.test.ts`

**Step 1: Write the test**

Create `apps/cli/src/__tests__/dbt/scanner.test.ts`:

```typescript
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
```

**Step 2: Run test to verify it fails**

```bash
pnpm --filter yamchart test src/__tests__/dbt/scanner.test.ts
```

Expected: FAIL - Cannot find module '../../dbt/scanner.js'

**Step 3: Write the implementation**

Create `apps/cli/src/dbt/scanner.ts`:

```typescript
import { readFile, access, readdir } from 'fs/promises';
import { join, extname, relative } from 'path';

export interface YamchartModel {
  name: string;
  description: string;
  path: string; // relative to project
  source?: string; // dbt table this queries
}

/**
 * Scan yamchart models directory and extract metadata.
 * Used to cross-reference which yamchart models use which dbt tables.
 */
export async function scanYamchartModels(projectDir: string): Promise<YamchartModel[]> {
  const modelsDir = join(projectDir, 'models');
  const models: YamchartModel[] = [];

  try {
    await access(modelsDir);
  } catch {
    return [];
  }

  await scanModelsRecursive(modelsDir, projectDir, models);
  return models;
}

async function scanModelsRecursive(
  dir: string,
  projectDir: string,
  models: YamchartModel[]
): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      await scanModelsRecursive(fullPath, projectDir, models);
    } else if (extname(entry.name) === '.sql') {
      const content = await readFile(fullPath, 'utf-8');
      const metadata = parseModelMetadata(content);

      if (metadata.name) {
        models.push({
          name: metadata.name,
          description: metadata.description || '',
          path: relative(projectDir, fullPath),
          source: metadata.source || extractSourceFromSql(content),
        });
      }
    }
  }
}

interface ModelMetadata {
  name?: string;
  description?: string;
  source?: string;
}

/**
 * Parse yamchart model metadata from SQL comments.
 */
function parseModelMetadata(content: string): ModelMetadata {
  const metadata: ModelMetadata = {};

  // Match @name: value
  const nameMatch = content.match(/--\s*@name:\s*(.+)/);
  if (nameMatch) {
    metadata.name = nameMatch[1].trim();
  }

  // Match @description: value
  const descMatch = content.match(/--\s*@description:\s*(.+)/);
  if (descMatch) {
    metadata.description = descMatch[1].trim();
  }

  // Match @source: value (explicit dbt table reference)
  const sourceMatch = content.match(/--\s*@source:\s*(.+)/);
  if (sourceMatch) {
    metadata.source = sourceMatch[1].trim();
  }

  return metadata;
}

/**
 * Extract the primary table name from SQL FROM clause.
 * This is a best-effort extraction for cross-referencing.
 */
function extractSourceFromSql(sql: string): string | undefined {
  // Remove comments
  const noComments = sql.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

  // Match FROM table_name (handles schema.table and database.schema.table)
  const fromMatch = noComments.match(/\bFROM\s+(\{\{\s*ref\(['"]([^'"]+)['"]\)\s*\}\}|[\w.]+)/i);

  if (fromMatch) {
    // If it's a Jinja ref(), extract the table name
    if (fromMatch[2]) {
      return fromMatch[2];
    }
    // Otherwise return the raw table name
    return fromMatch[1];
  }

  return undefined;
}
```

**Step 4: Run test to verify it passes**

```bash
pnpm --filter yamchart test src/__tests__/dbt/scanner.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add apps/cli/src/dbt/scanner.ts apps/cli/src/__tests__/dbt/scanner.test.ts
git commit -m "feat(cli): add yamchart model scanner for cross-references"
```

---

## Task 6: Create catalog generator

**Files:**
- Create: `apps/cli/src/dbt/catalog.ts`
- Test: `apps/cli/src/__tests__/dbt/catalog.test.ts`

**Step 1: Write the test**

Create `apps/cli/src/__tests__/dbt/catalog.test.ts`:

```typescript
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
```

**Step 2: Run test to verify it fails**

```bash
pnpm --filter yamchart test src/__tests__/dbt/catalog.test.ts
```

Expected: FAIL - Cannot find module '../../dbt/catalog.js'

**Step 3: Write the implementation**

Create `apps/cli/src/dbt/catalog.ts`:

```typescript
import type { DbtModel, DbtColumn } from './types.js';
import type { YamchartModel } from './scanner.js';

export interface CatalogModel extends DbtModel {
  yamchartModels: YamchartModel[];
}

export interface CatalogData {
  syncedAt: string;
  source: { type: string; path?: string; repo?: string };
  stats: { modelsIncluded: number; modelsExcluded: number };
  models: CatalogModel[];
}

/**
 * Generate catalog.md content.
 */
export function generateCatalogMd(data: CatalogData): string {
  const lines: string[] = [];

  // Header
  lines.push('# Data Catalog');
  lines.push('');
  lines.push(`> Source: ${data.source.type}:${data.source.path || data.source.repo || 'unknown'}`);
  lines.push(`> Last synced: ${data.syncedAt.split('T')[0]}`);
  lines.push(`> Models: ${data.stats.modelsIncluded} included, ${data.stats.modelsExcluded} filtered out`);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## Models');
  lines.push('');

  // Each model
  for (const model of data.models) {
    lines.push(`### ${model.name}`);
    lines.push('');
    lines.push(model.description);
    lines.push('');

    if (model.table) {
      lines.push(`**Table:** \`${model.table}\``);
    }

    if (model.tags.length > 0) {
      lines.push(`**Tags:** ${model.tags.map(t => `\`${t}\``).join(', ')}`);
    }

    lines.push('');

    // Column table
    if (model.columns.length > 0) {
      lines.push('| Column | Type | Description | Hints |');
      lines.push('|--------|------|-------------|-------|');

      for (const col of model.columns) {
        const type = col.data_type || '';
        const hints = col.hints.join(', ');
        lines.push(`| ${col.name} | ${type} | ${col.description} | ${hints} |`);
      }

      lines.push('');
    }

    // Yamchart models using this
    lines.push('**Yamchart models:**');
    if (model.yamchartModels.length > 0) {
      for (const ym of model.yamchartModels) {
        lines.push(`- [\`${ym.name}\`](../${ym.path}) - ${ym.description || 'No description'}`);
      }
    } else {
      lines.push('None yet');
    }

    lines.push('');
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Generate catalog.json content.
 */
export function generateCatalogJson(data: CatalogData): string {
  return JSON.stringify(data, null, 2);
}
```

**Step 4: Run test to verify it passes**

```bash
pnpm --filter yamchart test src/__tests__/dbt/catalog.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add apps/cli/src/dbt/catalog.ts apps/cli/src/__tests__/dbt/catalog.test.ts
git commit -m "feat(cli): add catalog generator for markdown and JSON output"
```

---

## Task 7: Create sync-dbt command handler

**Files:**
- Create: `apps/cli/src/commands/sync-dbt.ts`
- Modify: `apps/cli/src/index.ts`
- Test: `apps/cli/src/__tests__/sync-dbt.test.ts`

**Step 1: Write the test**

Create `apps/cli/src/__tests__/sync-dbt.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { syncDbt, type SyncDbtOptions } from '../commands/sync-dbt.js';
import { mkdir, writeFile, rm, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('syncDbt', () => {
  let yamchartDir: string;
  let dbtDir: string;

  beforeEach(async () => {
    const base = join(tmpdir(), `yamchart-sync-test-${Date.now()}`);
    yamchartDir = join(base, 'yamchart-project');
    dbtDir = join(base, 'dbt-project');

    // Create yamchart project
    await mkdir(yamchartDir, { recursive: true });
    await writeFile(join(yamchartDir, 'yamchart.yaml'), 'version: "1.0"\nname: test');

    // Create dbt project
    await mkdir(join(dbtDir, 'models', 'marts'), { recursive: true });
    await writeFile(join(dbtDir, 'dbt_project.yml'), 'name: test_dbt\nmodel-paths: ["models"]');
    await writeFile(
      join(dbtDir, 'models', 'marts', '_schema.yml'),
      `version: 2
models:
  - name: orders
    description: "Order transactions"
    columns:
      - name: id
        tests:
          - unique`
    );
  });

  afterEach(async () => {
    const base = join(yamchartDir, '..');
    await rm(base, { recursive: true, force: true });
  });

  it('creates .yamchart directory', async () => {
    const options: SyncDbtOptions = {
      source: 'local',
      path: dbtDir,
      include: [],
      exclude: [],
      tags: [],
    };

    await syncDbt(yamchartDir, options);

    const catalogMd = await readFile(join(yamchartDir, '.yamchart', 'catalog.md'), 'utf-8');
    expect(catalogMd).toContain('# Data Catalog');
    expect(catalogMd).toContain('### orders');
  });

  it('creates catalog.json', async () => {
    const options: SyncDbtOptions = {
      source: 'local',
      path: dbtDir,
      include: [],
      exclude: [],
      tags: [],
    };

    await syncDbt(yamchartDir, options);

    const catalogJson = await readFile(join(yamchartDir, '.yamchart', 'catalog.json'), 'utf-8');
    const parsed = JSON.parse(catalogJson);
    expect(parsed.models).toHaveLength(1);
    expect(parsed.models[0].name).toBe('orders');
  });

  it('saves config for re-sync', async () => {
    const options: SyncDbtOptions = {
      source: 'local',
      path: dbtDir,
      include: ['**/marts/**'],
      exclude: [],
      tags: [],
    };

    await syncDbt(yamchartDir, options);

    const configYaml = await readFile(join(yamchartDir, '.yamchart', 'dbt-source.yaml'), 'utf-8');
    expect(configYaml).toContain('source: local');
    expect(configYaml).toContain('**/marts/**');
  });

  it('filters models by include pattern', async () => {
    // Add a staging model
    await mkdir(join(dbtDir, 'models', 'staging'), { recursive: true });
    await writeFile(
      join(dbtDir, 'models', 'staging', '_schema.yml'),
      `version: 2
models:
  - name: stg_orders`
    );

    const options: SyncDbtOptions = {
      source: 'local',
      path: dbtDir,
      include: ['**/marts/**'],
      exclude: [],
      tags: [],
    };

    await syncDbt(yamchartDir, options);

    const catalogJson = await readFile(join(yamchartDir, '.yamchart', 'catalog.json'), 'utf-8');
    const parsed = JSON.parse(catalogJson);
    expect(parsed.models.find((m: { name: string }) => m.name === 'stg_orders')).toBeUndefined();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm --filter yamchart test src/__tests__/sync-dbt.test.ts
```

Expected: FAIL - Cannot find module '../commands/sync-dbt.js'

**Step 3: Write the implementation**

Create `apps/cli/src/commands/sync-dbt.ts`:

```typescript
import { mkdir, writeFile, readFile, access } from 'fs/promises';
import { join, resolve, relative } from 'path';
import { stringify as stringifyYaml, parse as parseYaml } from 'yaml';
import { LocalDbtSource } from '../dbt/local-source.js';
import { scanYamchartModels } from '../dbt/scanner.js';
import { generateCatalogMd, generateCatalogJson, type CatalogData, type CatalogModel } from '../dbt/catalog.js';
import type { DbtSourceConfig } from '../dbt/types.js';

export interface SyncDbtOptions {
  source: 'local' | 'github' | 'dbt-cloud';
  path?: string; // for local
  repo?: string; // for github
  branch?: string; // for github
  include: string[];
  exclude: string[];
  tags: string[];
  refresh?: boolean;
}

export interface SyncDbtResult {
  success: boolean;
  modelsIncluded: number;
  modelsExcluded: number;
  catalogPath: string;
  error?: string;
}

/**
 * Load saved sync config from .yamchart/dbt-source.yaml
 */
export async function loadSyncConfig(projectDir: string): Promise<DbtSourceConfig | null> {
  const configPath = join(projectDir, '.yamchart', 'dbt-source.yaml');

  try {
    await access(configPath);
    const content = await readFile(configPath, 'utf-8');
    return parseYaml(content) as DbtSourceConfig;
  } catch {
    return null;
  }
}

/**
 * Main sync function.
 */
export async function syncDbt(projectDir: string, options: SyncDbtOptions): Promise<SyncDbtResult> {
  const yamchartDir = join(projectDir, '.yamchart');

  // Ensure .yamchart directory exists
  await mkdir(yamchartDir, { recursive: true });

  // Handle refresh mode - load saved config
  if (options.refresh) {
    const savedConfig = await loadSyncConfig(projectDir);
    if (!savedConfig) {
      return {
        success: false,
        modelsIncluded: 0,
        modelsExcluded: 0,
        catalogPath: '',
        error: 'No saved sync config found. Run sync-dbt without --refresh first.',
      };
    }

    // Merge saved config into options
    options.source = savedConfig.source;
    options.path = savedConfig.path;
    options.repo = savedConfig.repo;
    options.include = savedConfig.filters.include;
    options.exclude = savedConfig.filters.exclude;
    options.tags = savedConfig.filters.tags;
  }

  // Currently only local source is supported
  if (options.source !== 'local') {
    return {
      success: false,
      modelsIncluded: 0,
      modelsExcluded: 0,
      catalogPath: '',
      error: `Source type "${options.source}" is not yet supported. Use --source local.`,
    };
  }

  if (!options.path) {
    return {
      success: false,
      modelsIncluded: 0,
      modelsExcluded: 0,
      catalogPath: '',
      error: 'Path to dbt project is required. Use --path <directory>.',
    };
  }

  // Resolve dbt project path
  const dbtPath = resolve(projectDir, options.path);

  // Create source and load models
  const source = new LocalDbtSource(dbtPath);

  let allModels;
  try {
    allModels = await source.listModels();
  } catch (err) {
    return {
      success: false,
      modelsIncluded: 0,
      modelsExcluded: 0,
      catalogPath: '',
      error: err instanceof Error ? err.message : 'Failed to read dbt project',
    };
  }

  // Apply filters
  const filters = {
    include: options.include.length > 0 ? options.include : [],
    exclude: options.exclude.length > 0 ? options.exclude : [],
    tags: options.tags,
  };

  // If no filters specified, use smart defaults
  if (filters.include.length === 0 && filters.exclude.length === 0 && filters.tags.length === 0) {
    const defaults = LocalDbtSource.getDefaultFilters();
    // Only apply defaults if they would match something
    const withDefaults = source.filterModels(allModels, defaults);
    if (withDefaults.length > 0) {
      filters.include = defaults.include;
      filters.exclude = defaults.exclude;
    }
    // Otherwise include all models
  }

  const filteredModels = filters.include.length > 0 || filters.exclude.length > 0 || filters.tags.length > 0
    ? source.filterModels(allModels, filters)
    : allModels;

  // Get full model details
  const fullModels = await source.getModels(filteredModels.map((m) => m.name));

  // Scan yamchart models for cross-references
  const yamchartModels = await scanYamchartModels(projectDir);

  // Build catalog data
  const catalogModels: CatalogModel[] = fullModels.map((model) => {
    // Find yamchart models that reference this dbt model
    const relatedYamchartModels = yamchartModels.filter((ym) => {
      if (!ym.source) return false;
      // Match by model name (with or without schema prefix)
      return ym.source === model.name ||
        ym.source.endsWith(`.${model.name}`) ||
        ym.source === model.table;
    });

    return {
      ...model,
      yamchartModels: relatedYamchartModels,
    };
  });

  const catalogData: CatalogData = {
    syncedAt: new Date().toISOString(),
    source: {
      type: options.source,
      path: relative(projectDir, dbtPath),
    },
    stats: {
      modelsIncluded: filteredModels.length,
      modelsExcluded: allModels.length - filteredModels.length,
    },
    models: catalogModels,
  };

  // Generate and write catalog files
  const catalogMd = generateCatalogMd(catalogData);
  const catalogJson = generateCatalogJson(catalogData);

  await writeFile(join(yamchartDir, 'catalog.md'), catalogMd);
  await writeFile(join(yamchartDir, 'catalog.json'), catalogJson);

  // Save sync config
  const syncConfig: DbtSourceConfig = {
    source: options.source,
    path: relative(projectDir, dbtPath),
    lastSync: catalogData.syncedAt,
    filters: {
      include: filters.include,
      exclude: filters.exclude,
      tags: filters.tags,
    },
    stats: catalogData.stats,
  };

  await writeFile(join(yamchartDir, 'dbt-source.yaml'), stringifyYaml(syncConfig));

  return {
    success: true,
    modelsIncluded: filteredModels.length,
    modelsExcluded: allModels.length - filteredModels.length,
    catalogPath: join(yamchartDir, 'catalog.md'),
  };
}
```

**Step 4: Run test to verify it passes**

```bash
pnpm --filter yamchart test src/__tests__/sync-dbt.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add apps/cli/src/commands/sync-dbt.ts apps/cli/src/__tests__/sync-dbt.test.ts
git commit -m "feat(cli): add sync-dbt command handler"
```

---

## Task 8: Wire up CLI command

**Files:**
- Modify: `apps/cli/src/index.ts`

**Step 1: Add the command to index.ts**

Add after the `init` command in `apps/cli/src/index.ts`:

```typescript
program
  .command('sync-dbt')
  .description('Sync dbt project metadata into AI-readable catalog')
  .option('-s, --source <type>', 'Source type: local, github, dbt-cloud', 'local')
  .option('-p, --path <dir>', 'Path to dbt project (for local source)')
  .option('--repo <repo>', 'GitHub repository (for github source)')
  .option('--branch <branch>', 'Git branch (for github source)', 'main')
  .option('-i, --include <patterns...>', 'Include glob patterns')
  .option('-e, --exclude <patterns...>', 'Exclude glob patterns')
  .option('-t, --tag <tags...>', 'Filter by dbt tags')
  .option('--refresh', 'Re-sync using saved configuration')
  .action(async (options: {
    source: 'local' | 'github' | 'dbt-cloud';
    path?: string;
    repo?: string;
    branch?: string;
    include?: string[];
    exclude?: string[];
    tag?: string[];
    refresh?: boolean;
  }) => {
    const { syncDbt, loadSyncConfig } = await import('./commands/sync-dbt.js');

    // Find project root
    const projectDir = await findProjectRoot(process.cwd());

    if (!projectDir) {
      output.error('yamchart.yaml not found');
      output.detail('Run this command from a yamchart project directory');
      process.exit(2);
    }

    // Handle refresh mode
    if (options.refresh) {
      const savedConfig = await loadSyncConfig(projectDir);
      if (!savedConfig) {
        output.error('No saved sync config found');
        output.detail('Run sync-dbt without --refresh first');
        process.exit(1);
      }
      output.info(`Re-syncing from ${savedConfig.source}:${savedConfig.path || savedConfig.repo}`);
    }

    const spin = output.spinner('Syncing dbt metadata...');

    const result = await syncDbt(projectDir, {
      source: options.source,
      path: options.path,
      repo: options.repo,
      branch: options.branch,
      include: options.include || [],
      exclude: options.exclude || [],
      tags: options.tag || [],
      refresh: options.refresh,
    });

    spin.stop();

    if (!result.success) {
      output.error(result.error || 'Sync failed');
      process.exit(1);
    }

    output.success(`Synced ${result.modelsIncluded} models to .yamchart/catalog.md`);
    if (result.modelsExcluded > 0) {
      output.detail(`${result.modelsExcluded} models filtered out`);
    }
  });
```

**Step 2: Test CLI manually**

```bash
cd /Users/simonspencer/Documents/Projects/yamchart
pnpm build
# Create a test scenario or use examples directory
./apps/cli/bin/yamchart sync-dbt --help
```

Expected: Shows help with all options

**Step 3: Run all tests**

```bash
pnpm --filter yamchart test
```

Expected: All tests pass

**Step 4: Commit**

```bash
git add apps/cli/src/index.ts
git commit -m "feat(cli): wire up sync-dbt command to CLI"
```

---

## Task 9: Add index exports for dbt module

**Files:**
- Create: `apps/cli/src/dbt/index.ts`

**Step 1: Create index file**

Create `apps/cli/src/dbt/index.ts`:

```typescript
export * from './types.js';
export * from './parser.js';
export * from './local-source.js';
export * from './scanner.js';
export * from './catalog.js';
```

**Step 2: Commit**

```bash
git add apps/cli/src/dbt/index.ts
git commit -m "chore(cli): add dbt module index exports"
```

---

## Task 10: Integration test with real dbt-like structure

**Files:**
- Test: `apps/cli/src/__tests__/sync-dbt-integration.test.ts`

**Step 1: Write integration test**

Create `apps/cli/src/__tests__/sync-dbt-integration.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { syncDbt } from '../commands/sync-dbt.js';
import { mkdir, writeFile, rm, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('sync-dbt integration', () => {
  let baseDir: string;
  let yamchartDir: string;
  let dbtDir: string;

  beforeEach(async () => {
    baseDir = join(tmpdir(), `yamchart-integration-${Date.now()}`);
    yamchartDir = join(baseDir, 'dashboard-project');
    dbtDir = join(baseDir, 'analytics-dbt');

    // Create yamchart project with existing models
    await mkdir(join(yamchartDir, 'models'), { recursive: true });
    await writeFile(join(yamchartDir, 'yamchart.yaml'), 'version: "1.0"\nname: dashboard-project');
    await writeFile(
      join(yamchartDir, 'models', 'revenue_by_region.sql'),
      `-- @name: revenue_by_region
-- @description: Revenue breakdown by region
-- @source: marts.orders

SELECT region, sum(amount) as revenue
FROM {{ ref('orders') }}
GROUP BY region`
    );

    // Create realistic dbt project structure
    await mkdir(join(dbtDir, 'models', 'staging'), { recursive: true });
    await mkdir(join(dbtDir, 'models', 'intermediate'), { recursive: true });
    await mkdir(join(dbtDir, 'models', 'marts', 'finance'), { recursive: true });
    await mkdir(join(dbtDir, 'models', 'marts', 'marketing'), { recursive: true });

    await writeFile(join(dbtDir, 'dbt_project.yml'), `
name: analytics
version: '1.0.0'
profile: analytics
model-paths: ['models']
`);

    // Staging models (should be filtered out by default)
    await writeFile(join(dbtDir, 'models', 'staging', '_schema.yml'), `
version: 2
models:
  - name: stg_orders
    description: Staged orders
  - name: stg_customers
    description: Staged customers
`);

    // Marts models (should be included by default)
    await writeFile(join(dbtDir, 'models', 'marts', 'finance', '_schema.yml'), `
version: 2
models:
  - name: orders
    description: "Order transactions - one row per order"
    meta:
      yamchart: true
    tags:
      - bi
      - finance
    columns:
      - name: order_id
        description: "Unique order identifier"
        data_type: string
        tests:
          - unique
          - not_null
      - name: customer_id
        description: "FK to customers"
        tests:
          - not_null
          - relationships:
              to: ref('customers')
              field: customer_id
      - name: amount
        description: "Order amount in USD"
        data_type: numeric
      - name: region
        description: "Sales region"
        data_type: string

  - name: revenue_daily
    description: "Daily revenue aggregations"
    tags:
      - bi
    columns:
      - name: date
        data_type: date
      - name: revenue
        data_type: numeric
`);

    await writeFile(join(dbtDir, 'models', 'marts', 'marketing', '_schema.yml'), `
version: 2
models:
  - name: customers
    description: "Customer dimension table"
    tags:
      - bi
    columns:
      - name: customer_id
        tests:
          - unique
          - not_null
      - name: name
        description: "Customer name"
      - name: region
        description: "Customer region"
`);
  });

  afterEach(async () => {
    await rm(baseDir, { recursive: true, force: true });
  });

  it('syncs with smart defaults filtering staging models', async () => {
    const result = await syncDbt(yamchartDir, {
      source: 'local',
      path: dbtDir,
      include: [],
      exclude: [],
      tags: [],
    });

    expect(result.success).toBe(true);
    expect(result.modelsIncluded).toBe(3); // orders, revenue_daily, customers
    expect(result.modelsExcluded).toBe(2); // stg_orders, stg_customers

    const catalogMd = await readFile(join(yamchartDir, '.yamchart', 'catalog.md'), 'utf-8');
    expect(catalogMd).toContain('### orders');
    expect(catalogMd).toContain('### customers');
    expect(catalogMd).not.toContain('### stg_orders');
  });

  it('cross-references yamchart models using dbt tables', async () => {
    const result = await syncDbt(yamchartDir, {
      source: 'local',
      path: dbtDir,
      include: [],
      exclude: [],
      tags: [],
    });

    expect(result.success).toBe(true);

    const catalogMd = await readFile(join(yamchartDir, '.yamchart', 'catalog.md'), 'utf-8');
    // The orders model should reference the revenue_by_region yamchart model
    expect(catalogMd).toContain('revenue_by_region');
    expect(catalogMd).toContain('Revenue breakdown by region');
  });

  it('includes column hints from dbt tests', async () => {
    await syncDbt(yamchartDir, {
      source: 'local',
      path: dbtDir,
      include: [],
      exclude: [],
      tags: [],
    });

    const catalogJson = await readFile(join(yamchartDir, '.yamchart', 'catalog.json'), 'utf-8');
    const catalog = JSON.parse(catalogJson);

    const orders = catalog.models.find((m: { name: string }) => m.name === 'orders');
    const orderId = orders.columns.find((c: { name: string }) => c.name === 'order_id');
    expect(orderId.hints).toContain('unique');
    expect(orderId.hints).toContain('required');

    const customerId = orders.columns.find((c: { name: string }) => c.name === 'customer_id');
    expect(customerId.hints).toContain('fk:customers');
  });

  it('supports --refresh to re-sync with saved config', async () => {
    // First sync
    await syncDbt(yamchartDir, {
      source: 'local',
      path: dbtDir,
      include: ['**/marts/**'],
      exclude: [],
      tags: [],
    });

    // Refresh sync
    const result = await syncDbt(yamchartDir, {
      source: 'local',
      include: [],
      exclude: [],
      tags: [],
      refresh: true,
    });

    expect(result.success).toBe(true);
    expect(result.modelsIncluded).toBe(3);
  });

  it('filters by tag when specified', async () => {
    const result = await syncDbt(yamchartDir, {
      source: 'local',
      path: dbtDir,
      include: [],
      exclude: [],
      tags: ['finance'],
    });

    expect(result.success).toBe(true);
    expect(result.modelsIncluded).toBe(1); // only orders has finance tag

    const catalogJson = await readFile(join(yamchartDir, '.yamchart', 'catalog.json'), 'utf-8');
    const catalog = JSON.parse(catalogJson);
    expect(catalog.models[0].name).toBe('orders');
  });
});
```

**Step 2: Run integration test**

```bash
pnpm --filter yamchart test src/__tests__/sync-dbt-integration.test.ts
```

Expected: PASS

**Step 3: Commit**

```bash
git add apps/cli/src/__tests__/sync-dbt-integration.test.ts
git commit -m "test(cli): add sync-dbt integration tests"
```

---

## Task 11: Final verification and documentation

**Step 1: Run all tests**

```bash
pnpm test
```

Expected: All tests pass

**Step 2: Build and verify CLI**

```bash
pnpm build
./apps/cli/bin/yamchart sync-dbt --help
```

**Step 3: Manual test with examples project**

Create a mock dbt project alongside examples and test:

```bash
mkdir -p /tmp/test-dbt/models/marts
echo 'name: test_dbt' > /tmp/test-dbt/dbt_project.yml
echo 'version: 2
models:
  - name: test_model
    description: Test model' > /tmp/test-dbt/models/marts/_schema.yml

cd examples
../apps/cli/bin/yamchart sync-dbt --path /tmp/test-dbt
cat .yamchart/catalog.md
```

**Step 4: Update CLAUDE.md with sync-dbt info**

Add to the Commands section of CLAUDE.md:

```markdown
**dbt sync:**
```bash
yamchart sync-dbt --path ../dbt-project  # Sync dbt metadata
yamchart sync-dbt --refresh              # Re-sync with saved config
```
```

**Step 5: Final commit**

```bash
git add CLAUDE.md
git commit -m "docs: add sync-dbt command to CLAUDE.md"
```

---

## Summary

This plan creates the `yamchart sync-dbt` command in 11 tasks:

1. Add fast-glob dependency
2. Create dbt types and interfaces
3. Create dbt schema.yml parser
4. Create LocalDbtSource implementation
5. Create yamchart model scanner
6. Create catalog generator
7. Create sync-dbt command handler
8. Wire up CLI command
9. Add module exports
10. Integration tests
11. Final verification

Each task follows TDD: write failing test, implement, verify, commit.
