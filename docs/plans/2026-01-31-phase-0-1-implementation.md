# Dashbook Phase 0-1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Set up the TypeScript monorepo and implement schema validation for dashbook config files.

**Architecture:** pnpm workspaces with Turborepo for build orchestration. Shared packages (schema, query, config) consumed by apps (cli, server, web). Zod for runtime schema validation with TypeScript type inference.

**Tech Stack:** pnpm, Turborepo, TypeScript, Zod, Vitest

---

## Task 1: Initialize pnpm Monorepo

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `.npmrc`
- Create: `.gitignore`

**Step 1: Create root package.json**

```json
{
  "name": "dashbook",
  "version": "0.1.0",
  "private": true,
  "description": "Git-native business intelligence dashboards",
  "scripts": {
    "build": "turbo build",
    "dev": "turbo dev",
    "lint": "turbo lint",
    "test": "turbo test",
    "clean": "turbo clean && rm -rf node_modules"
  },
  "devDependencies": {
    "turbo": "^2.3.0",
    "typescript": "^5.7.0"
  },
  "packageManager": "pnpm@9.15.0",
  "engines": {
    "node": ">=20.0.0"
  }
}
```

**Step 2: Create pnpm-workspace.yaml**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

**Step 3: Create .npmrc**

```
auto-install-peers=true
strict-peer-dependencies=false
```

**Step 4: Create .gitignore**

```
# Dependencies
node_modules/
.pnpm-store/

# Build outputs
dist/
.turbo/
*.tsbuildinfo

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*

# Test
coverage/

# Dashbook generated
.dashbook/
```

**Step 5: Commit**

```bash
git add package.json pnpm-workspace.yaml .npmrc .gitignore
git commit -m "chore: initialize pnpm monorepo structure"
```

---

## Task 2: Add Turborepo Configuration

**Files:**
- Create: `turbo.json`

**Step 1: Create turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    },
    "clean": {
      "cache": false
    }
  }
}
```

**Step 2: Commit**

```bash
git add turbo.json
git commit -m "chore: add Turborepo configuration"
```

---

## Task 3: Create Shared TypeScript Config Package

**Files:**
- Create: `packages/config/package.json`
- Create: `packages/config/tsconfig.base.json`
- Create: `packages/config/tsconfig.node.json`
- Create: `packages/config/tsconfig.react.json`

**Step 1: Create packages/config/package.json**

```json
{
  "name": "@dashbook/config",
  "version": "0.1.0",
  "private": true,
  "exports": {
    "./tsconfig.base.json": "./tsconfig.base.json",
    "./tsconfig.node.json": "./tsconfig.node.json",
    "./tsconfig.react.json": "./tsconfig.react.json"
  }
}
```

**Step 2: Create packages/config/tsconfig.base.json**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "isolatedModules": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true
  }
}
```

**Step 3: Create packages/config/tsconfig.node.json**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src"
  }
}
```

**Step 4: Create packages/config/tsconfig.react.json**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "noEmit": true
  }
}
```

**Step 5: Commit**

```bash
git add packages/config/
git commit -m "chore: add shared TypeScript configurations"
```

---

## Task 4: Create Schema Package Structure

**Files:**
- Create: `packages/schema/package.json`
- Create: `packages/schema/tsconfig.json`
- Create: `packages/schema/src/index.ts`

**Step 1: Create packages/schema/package.json**

```json
{
  "name": "@dashbook/schema",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@dashbook/config": "workspace:*",
    "typescript": "^5.7.0",
    "vitest": "^2.1.0"
  }
}
```

**Step 2: Create packages/schema/tsconfig.json**

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

**Step 3: Create packages/schema/src/index.ts**

```typescript
// Dashbook Schema - Zod schemas and TypeScript types
export const VERSION = '0.1.0';
```

**Step 4: Commit**

```bash
git add packages/schema/
git commit -m "chore: add schema package structure"
```

---

## Task 5: Install Dependencies and Verify Setup

**Step 1: Install all dependencies**

Run: `pnpm install`

Expected: Dependencies installed, node_modules created in root and packages.

**Step 2: Build packages**

Run: `pnpm build`

Expected: Build succeeds, `packages/schema/dist/index.js` created.

**Step 3: Commit lockfile**

```bash
git add pnpm-lock.yaml
git commit -m "chore: add pnpm lockfile"
```

---

## Task 6: Add Vitest Configuration to Schema Package

**Files:**
- Create: `packages/schema/vitest.config.ts`
- Create: `packages/schema/src/__tests__/index.test.ts`

**Step 1: Create packages/schema/vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
});
```

**Step 2: Write initial test**

Create `packages/schema/src/__tests__/index.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { VERSION } from '../index.js';

describe('schema package', () => {
  it('exports VERSION', () => {
    expect(VERSION).toBe('0.1.0');
  });
});
```

**Step 3: Run test to verify setup**

Run: `pnpm --filter @dashbook/schema test`

Expected: 1 test passes.

**Step 4: Commit**

```bash
git add packages/schema/vitest.config.ts packages/schema/src/__tests__/
git commit -m "test: add vitest setup and initial test for schema package"
```

---

## Task 7: Define Connection Schema

**Files:**
- Create: `packages/schema/src/connection.ts`
- Create: `packages/schema/src/__tests__/connection.test.ts`

**Step 1: Write failing tests for connection schema**

Create `packages/schema/src/__tests__/connection.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { ConnectionSchema, type Connection } from '../connection.js';

describe('ConnectionSchema', () => {
  it('validates a valid DuckDB connection', () => {
    const input = {
      name: 'local-duckdb',
      type: 'duckdb',
      config: {
        path: './data.duckdb',
      },
    };

    const result = ConnectionSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('local-duckdb');
      expect(result.data.type).toBe('duckdb');
    }
  });

  it('validates a valid Postgres connection', () => {
    const input = {
      name: 'prod-postgres',
      type: 'postgres',
      config: {
        host: 'localhost',
        port: 5432,
        database: 'analytics',
      },
      auth: {
        type: 'env',
        user_var: 'PG_USER',
        password_var: 'PG_PASSWORD',
      },
    };

    const result = ConnectionSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('rejects connection without name', () => {
    const input = {
      type: 'duckdb',
      config: { path: './data.duckdb' },
    };

    const result = ConnectionSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects unknown connection type', () => {
    const input = {
      name: 'test',
      type: 'unknown_db',
      config: {},
    };

    const result = ConnectionSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @dashbook/schema test`

Expected: FAIL - cannot find module '../connection.js'

**Step 3: Implement connection schema**

Create `packages/schema/src/connection.ts`:

```typescript
import { z } from 'zod';

// Auth configuration for connections
const EnvAuthSchema = z.object({
  type: z.literal('env'),
  user_var: z.string(),
  password_var: z.string(),
});

const KeyPairAuthSchema = z.object({
  type: z.literal('key_pair'),
  user_var: z.string(),
  private_key_path: z.string(),
});

const SecretManagerAuthSchema = z.object({
  type: z.literal('secret_manager'),
  provider: z.enum(['aws_secrets_manager', 'gcp_secret_manager', 'vault']),
  secret_id: z.string(),
});

const AuthSchema = z.discriminatedUnion('type', [
  EnvAuthSchema,
  KeyPairAuthSchema,
  SecretManagerAuthSchema,
]);

// Connection pool configuration
const PoolConfigSchema = z.object({
  min_connections: z.number().int().positive().optional(),
  max_connections: z.number().int().positive().optional(),
  idle_timeout: z.number().int().positive().optional(),
});

// Query settings
const QueryConfigSchema = z.object({
  timeout: z.number().int().positive().optional(),
  max_rows: z.number().int().positive().optional(),
});

// DuckDB-specific config
const DuckDBConfigSchema = z.object({
  path: z.string(), // file path or :memory:
});

// Postgres-specific config
const PostgresConfigSchema = z.object({
  host: z.string(),
  port: z.number().int().positive().default(5432),
  database: z.string(),
  schema: z.string().optional(),
  ssl: z.boolean().optional(),
});

// Snowflake-specific config
const SnowflakeConfigSchema = z.object({
  account: z.string(),
  warehouse: z.string(),
  database: z.string(),
  schema: z.string().optional(),
  role: z.string().optional(),
});

// Base connection schema
const BaseConnectionSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  pool: PoolConfigSchema.optional(),
  query: QueryConfigSchema.optional(),
});

// Type-specific connection schemas
const DuckDBConnectionSchema = BaseConnectionSchema.extend({
  type: z.literal('duckdb'),
  config: DuckDBConfigSchema,
  auth: z.undefined().optional(),
});

const PostgresConnectionSchema = BaseConnectionSchema.extend({
  type: z.literal('postgres'),
  config: PostgresConfigSchema,
  auth: AuthSchema.optional(),
});

const SnowflakeConnectionSchema = BaseConnectionSchema.extend({
  type: z.literal('snowflake'),
  config: SnowflakeConfigSchema,
  auth: AuthSchema,
});

// Union of all connection types
export const ConnectionSchema = z.discriminatedUnion('type', [
  DuckDBConnectionSchema,
  PostgresConnectionSchema,
  SnowflakeConnectionSchema,
]);

export type Connection = z.infer<typeof ConnectionSchema>;
export type DuckDBConnection = z.infer<typeof DuckDBConnectionSchema>;
export type PostgresConnection = z.infer<typeof PostgresConnectionSchema>;
export type SnowflakeConnection = z.infer<typeof SnowflakeConnectionSchema>;
```

**Step 4: Export from index**

Update `packages/schema/src/index.ts`:

```typescript
// Dashbook Schema - Zod schemas and TypeScript types
export const VERSION = '0.1.0';

export * from './connection.js';
```

**Step 5: Run tests to verify they pass**

Run: `pnpm --filter @dashbook/schema test`

Expected: All tests pass.

**Step 6: Commit**

```bash
git add packages/schema/src/
git commit -m "feat(schema): add connection schema with DuckDB, Postgres, Snowflake support"
```

---

## Task 8: Define Chart Schema

**Files:**
- Create: `packages/schema/src/chart.ts`
- Create: `packages/schema/src/__tests__/chart.test.ts`

**Step 1: Write failing tests for chart schema**

Create `packages/schema/src/__tests__/chart.test.ts`:

```typescript
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
      expect(result.data.parameters![0].name).toBe('date_range');
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
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @dashbook/schema test`

Expected: FAIL - cannot find module '../chart.js'

**Step 3: Implement chart schema**

Create `packages/schema/src/chart.ts`:

```typescript
import { z } from 'zod';

// Axis types
const AxisTypeSchema = z.enum(['temporal', 'quantitative', 'ordinal', 'nominal']);

// Axis configuration
const AxisSchema = z.object({
  field: z.string().min(1),
  type: AxisTypeSchema,
  format: z.string().optional(),
  label: z.string().optional(),
});

// Chart types supported
const ChartTypeSchema = z.enum([
  'line',
  'bar',
  'area',
  'scatter',
  'pie',
  'table',
  'metric',
  'map',
  'heatmap',
  'funnel',
  'sankey',
  'treemap',
]);

// Series configuration for multi-series charts
const SeriesSchema = z.object({
  field: z.string().min(1),
  name: z.string().optional(),
  color: z.string().optional(),
  style: z.enum(['solid', 'dashed', 'dotted']).optional(),
});

// Annotation configuration
const LineAnnotationSchema = z.object({
  type: z.literal('line'),
  value: z.number(),
  label: z.string().optional(),
  color: z.string().optional(),
  style: z.enum(['solid', 'dashed', 'dotted']).optional(),
});

const BandAnnotationSchema = z.object({
  type: z.literal('band'),
  from: z.number(),
  to: z.number(),
  label: z.string().optional(),
  color: z.string().optional(),
});

const AnnotationSchema = z.discriminatedUnion('type', [
  LineAnnotationSchema,
  BandAnnotationSchema,
]);

// Interactivity options
const InteractionsSchema = z.object({
  tooltip: z.boolean().default(true),
  zoom: z.boolean().default(false),
  brush: z.boolean().default(false),
});

// Chart visualization config
const ChartConfigSchema = z.object({
  type: ChartTypeSchema,
  x: AxisSchema,
  y: AxisSchema,
  series: z.array(SeriesSchema).optional(),
  annotations: z.array(AnnotationSchema).optional(),
  interactions: InteractionsSchema.optional(),
});

// Parameter types
const ParameterTypeSchema = z.enum([
  'date_range',
  'select',
  'multi_select',
  'text',
  'number',
]);

// Parameter option
const ParameterOptionSchema = z.union([
  z.string(),
  z.object({
    value: z.string(),
    label: z.string(),
  }),
]);

// Parameter source (for dynamic options)
const ParameterSourceSchema = z.object({
  model: z.string(),
  value_field: z.string(),
  label_field: z.string(),
});

// Parameter definition
const ParameterSchema = z.object({
  name: z.string().min(1),
  type: ParameterTypeSchema,
  label: z.string().optional(),
  default: z.union([z.string(), z.number(), z.array(z.string())]).optional(),
  options: z.array(ParameterOptionSchema).optional(),
  source: ParameterSourceSchema.optional(),
});

// Data source - either model reference or inline SQL
const SourceSchema = z.object({
  model: z.string().optional(),
  sql: z.string().optional(),
}).refine(
  (data) => data.model !== undefined || data.sql !== undefined,
  { message: 'Source must specify either model or sql' }
).refine(
  (data) => !(data.model !== undefined && data.sql !== undefined),
  { message: 'Source cannot specify both model and sql' }
);

// Refresh/cache configuration
const RefreshSchema = z.object({
  schedule: z.string().optional(), // cron expression
  timezone: z.string().optional(),
  cache_ttl: z.string().optional(), // e.g., "1h", "30m"
});

// Main chart schema
export const ChartSchema = z.object({
  // Identity
  name: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),

  // Metadata
  owner: z.string().optional(),
  tags: z.array(z.string()).optional(),
  created: z.string().optional(),
  updated: z.string().optional(),

  // Data
  source: SourceSchema,
  parameters: z.array(ParameterSchema).optional(),

  // Visualization
  chart: ChartConfigSchema,

  // Caching
  refresh: RefreshSchema.optional(),
});

export type Chart = z.infer<typeof ChartSchema>;
export type ChartConfig = z.infer<typeof ChartConfigSchema>;
export type ChartType = z.infer<typeof ChartTypeSchema>;
export type Parameter = z.infer<typeof ParameterSchema>;
export type Axis = z.infer<typeof AxisSchema>;
```

**Step 4: Export from index**

Update `packages/schema/src/index.ts`:

```typescript
// Dashbook Schema - Zod schemas and TypeScript types
export const VERSION = '0.1.0';

export * from './connection.js';
export * from './chart.js';
```

**Step 5: Run tests to verify they pass**

Run: `pnpm --filter @dashbook/schema test`

Expected: All tests pass.

**Step 6: Commit**

```bash
git add packages/schema/src/
git commit -m "feat(schema): add chart schema with parameters, axes, and annotations"
```

---

## Task 9: Define Project Config Schema (dashbook.yaml)

**Files:**
- Create: `packages/schema/src/project.ts`
- Create: `packages/schema/src/__tests__/project.test.ts`

**Step 1: Write failing tests for project schema**

Create `packages/schema/src/__tests__/project.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { ProjectSchema, type Project } from '../project.js';

describe('ProjectSchema', () => {
  it('validates minimal project config', () => {
    const input = {
      version: '1.0',
      name: 'my-analytics',
    };

    const result = ProjectSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('my-analytics');
      expect(result.data.version).toBe('1.0');
    }
  });

  it('validates project with defaults', () => {
    const input = {
      version: '1.0',
      name: 'my-analytics',
      defaults: {
        connection: 'local-duckdb',
        timezone: 'America/New_York',
        cache_ttl: '1h',
      },
    };

    const result = ProjectSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.defaults?.connection).toBe('local-duckdb');
    }
  });

  it('validates project with environments', () => {
    const input = {
      version: '1.0',
      name: 'my-analytics',
      environments: {
        development: {
          connection: 'duckdb-local',
          base_url: 'http://localhost:3000',
        },
        production: {
          connection: 'snowflake-prod',
          base_url: 'https://dashbook.example.com',
        },
      },
    };

    const result = ProjectSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.environments?.development?.connection).toBe('duckdb-local');
    }
  });

  it('rejects project without name', () => {
    const input = {
      version: '1.0',
    };

    const result = ProjectSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects project without version', () => {
    const input = {
      name: 'no-version',
    };

    const result = ProjectSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @dashbook/schema test`

Expected: FAIL - cannot find module '../project.js'

**Step 3: Implement project schema**

Create `packages/schema/src/project.ts`:

```typescript
import { z } from 'zod';

// Default settings
const DefaultsSchema = z.object({
  connection: z.string().optional(),
  theme: z.string().optional(),
  timezone: z.string().optional(),
  cache_ttl: z.string().optional(),
});

// Environment-specific settings
const EnvironmentSchema = z.object({
  connection: z.string().optional(),
  base_url: z.string().url().optional(),
});

// Git integration settings
const GitSchema = z.object({
  provider: z.enum(['github', 'gitlab', 'bitbucket']).optional(),
  repo: z.string().optional(),
  branch: z.string().optional(),
  preview_branches: z.boolean().optional(),
});

// Authentication settings
const AuthSchema = z.object({
  provider: z.enum(['oidc', 'saml', 'api_key']).optional(),
  issuer: z.string().optional(),
  client_id: z.string().optional(),
});

// Feature flags
const FeaturesSchema = z.object({
  enable_sql_editor: z.boolean().optional(),
  enable_csv_export: z.boolean().optional(),
  enable_scheduling: z.boolean().optional(),
});

// Main project schema
export const ProjectSchema = z.object({
  version: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),

  defaults: DefaultsSchema.optional(),

  environments: z.record(z.string(), EnvironmentSchema).optional(),

  git: GitSchema.optional(),
  auth: AuthSchema.optional(),
  features: FeaturesSchema.optional(),
});

export type Project = z.infer<typeof ProjectSchema>;
export type Defaults = z.infer<typeof DefaultsSchema>;
export type Environment = z.infer<typeof EnvironmentSchema>;
```

**Step 4: Export from index**

Update `packages/schema/src/index.ts`:

```typescript
// Dashbook Schema - Zod schemas and TypeScript types
export const VERSION = '0.1.0';

export * from './connection.js';
export * from './chart.js';
export * from './project.js';
```

**Step 5: Run tests to verify they pass**

Run: `pnpm --filter @dashbook/schema test`

Expected: All tests pass.

**Step 6: Commit**

```bash
git add packages/schema/src/
git commit -m "feat(schema): add project config schema (dashbook.yaml)"
```

---

## Task 10: Define Model Metadata Schema

**Files:**
- Create: `packages/schema/src/model.ts`
- Create: `packages/schema/src/__tests__/model.test.ts`

**Step 1: Write failing tests for model schema**

Create `packages/schema/src/__tests__/model.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { ModelMetadataSchema, type ModelMetadata } from '../model.js';

describe('ModelMetadataSchema', () => {
  it('validates minimal model metadata', () => {
    const input = {
      name: 'monthly_revenue',
    };

    const result = ModelMetadataSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('validates model with parameters', () => {
    const input = {
      name: 'monthly_revenue',
      description: 'Monthly revenue aggregated by category',
      params: [
        { name: 'start_date', type: 'date', default: 'current_date()' },
        { name: 'end_date', type: 'date' },
        { name: 'granularity', type: 'string', default: 'month', options: ['day', 'week', 'month'] },
      ],
    };

    const result = ModelMetadataSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.params).toHaveLength(3);
      expect(result.data.params![0].name).toBe('start_date');
    }
  });

  it('validates model with returns', () => {
    const input = {
      name: 'monthly_revenue',
      returns: [
        { name: 'period', type: 'date', description: 'The time period' },
        { name: 'revenue', type: 'number', description: 'Total revenue' },
      ],
    };

    const result = ModelMetadataSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.returns).toHaveLength(2);
    }
  });

  it('validates model with tests', () => {
    const input = {
      name: 'monthly_revenue',
      tests: [
        'revenue >= 0',
        'order_count >= 0',
        'period is not null',
      ],
    };

    const result = ModelMetadataSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tests).toHaveLength(3);
    }
  });

  it('rejects model without name', () => {
    const input = {
      description: 'No name model',
    };

    const result = ModelMetadataSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @dashbook/schema test`

Expected: FAIL - cannot find module '../model.js'

**Step 3: Implement model metadata schema**

Create `packages/schema/src/model.ts`:

```typescript
import { z } from 'zod';

// Parameter type
const ParamTypeSchema = z.enum(['string', 'number', 'date', 'boolean', 'string[]', 'number[]']);

// Model parameter
const ModelParamSchema = z.object({
  name: z.string().min(1),
  type: ParamTypeSchema,
  default: z.string().optional(),
  options: z.array(z.string()).optional(), // For enum-like params
  description: z.string().optional(),
});

// Return column definition
const ReturnColumnSchema = z.object({
  name: z.string().min(1),
  type: z.string(),
  description: z.string().optional(),
});

// Model metadata (extracted from SQL comments)
export const ModelMetadataSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  owner: z.string().optional(),
  tags: z.array(z.string()).optional(),

  params: z.array(ModelParamSchema).optional(),
  returns: z.array(ReturnColumnSchema).optional(),
  tests: z.array(z.string()).optional(), // SQL assertions
});

// Full model (metadata + SQL)
export const ModelSchema = z.object({
  metadata: ModelMetadataSchema,
  sql: z.string().min(1),
  filePath: z.string().optional(),
});

export type ModelMetadata = z.infer<typeof ModelMetadataSchema>;
export type ModelParam = z.infer<typeof ModelParamSchema>;
export type ReturnColumn = z.infer<typeof ReturnColumnSchema>;
export type Model = z.infer<typeof ModelSchema>;
```

**Step 4: Export from index**

Update `packages/schema/src/index.ts`:

```typescript
// Dashbook Schema - Zod schemas and TypeScript types
export const VERSION = '0.1.0';

export * from './connection.js';
export * from './chart.js';
export * from './project.js';
export * from './model.js';
```

**Step 5: Run tests to verify they pass**

Run: `pnpm --filter @dashbook/schema test`

Expected: All tests pass.

**Step 6: Commit**

```bash
git add packages/schema/src/
git commit -m "feat(schema): add model metadata schema for SQL files"
```

---

## Task 11: Create Example Project

**Files:**
- Create: `examples/dashbook.yaml`
- Create: `examples/connections/local-duckdb.yaml`
- Create: `examples/models/revenue.sql`
- Create: `examples/charts/revenue-trend.yaml`

**Step 1: Create examples/dashbook.yaml**

```yaml
version: "1.0"
name: example-analytics
description: "Example Dashbook project for development"

defaults:
  connection: local-duckdb
  timezone: UTC
  cache_ttl: 5m
```

**Step 2: Create examples/connections/local-duckdb.yaml**

```yaml
name: local-duckdb
type: duckdb
description: "Local DuckDB for development"

config:
  path: ./sample-data.duckdb
```

**Step 3: Create examples/models/revenue.sql**

```sql
-- @name: monthly_revenue
-- @description: Monthly revenue aggregated by date
-- @owner: analytics-team
-- @tags: [revenue, monthly, core]
--
-- @param start_date: date = dateadd(month, -12, current_date())
-- @param end_date: date = current_date()
--
-- @returns:
--   - period: date -- The month
--   - revenue: number -- Total revenue in USD
--   - order_count: integer -- Number of orders

SELECT
    date_trunc('month', order_date) AS period,
    SUM(amount) AS revenue,
    COUNT(*) AS order_count
FROM {{ ref('orders') }}
WHERE order_date BETWEEN '{{ start_date }}' AND '{{ end_date }}'
GROUP BY 1
ORDER BY 1
```

**Step 4: Create examples/charts/revenue-trend.yaml**

```yaml
name: revenue-trend
title: Monthly Revenue
description: |
  Shows revenue trends over time.
  Primary metric for executive dashboard.

owner: analytics-team
tags: [revenue, trend, executive]

source:
  model: monthly_revenue

parameters:
  - name: date_range
    type: date_range
    label: Date Range
    default: last_12_months

chart:
  type: line
  x:
    field: period
    type: temporal
    format: "%b %Y"
    label: Month
  y:
    field: revenue
    type: quantitative
    format: "$,.0f"
    label: Revenue
  interactions:
    tooltip: true
    zoom: true
```

**Step 5: Commit**

```bash
git add examples/
git commit -m "feat: add example dashbook project"
```

---

## Task 12: Final Build and Push

**Step 1: Run full build**

Run: `pnpm build`

Expected: Build succeeds for all packages.

**Step 2: Run all tests**

Run: `pnpm test`

Expected: All tests pass.

**Step 3: Push to remote**

```bash
git push origin main
```

---

## Summary

After completing these tasks, you will have:

1. **Monorepo structure** - pnpm + Turborepo configured
2. **Shared configs** - TypeScript configurations for Node and React
3. **Schema package** - Zod schemas with full test coverage:
   - `ConnectionSchema` - DuckDB, Postgres, Snowflake
   - `ChartSchema` - Line, bar, etc. with parameters
   - `ProjectSchema` - dashbook.yaml configuration
   - `ModelMetadataSchema` - SQL file metadata
4. **Example project** - Reference implementation

Next phase will implement the query compilation engine in `packages/query`.
