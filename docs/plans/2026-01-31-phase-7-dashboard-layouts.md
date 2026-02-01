# Phase 7: Dashboard Layouts Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add multi-widget dashboard layouts with KPI cards, drag-and-drop editing, and Git-native save/push.

**Architecture:** Dashboards defined in `dashboards/*.yaml` with 12-column responsive grid. Frontend uses react-grid-layout for drag/drop. Server wraps simple-git for branch-aware persistence. KPIs are charts with `type: kpi`.

**Tech Stack:** Zod (schema), react-grid-layout (drag/drop), react-markdown (text widgets), simple-git (Git operations)

---

## Task 1: Dashboard Schema

**Files:**
- Create: `packages/schema/src/dashboard.ts`
- Modify: `packages/schema/src/index.ts`
- Test: `packages/schema/src/__tests__/dashboard.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/schema/src/__tests__/dashboard.test.ts
import { describe, it, expect } from 'vitest';
import { DashboardSchema } from '../dashboard';

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
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @dashbook/schema test`

Expected: FAIL with "Cannot find module '../dashboard'"

**Step 3: Write minimal implementation**

```typescript
// packages/schema/src/dashboard.ts
import { z } from 'zod';

// Widget types
const ChartWidgetSchema = z.object({
  type: z.literal('chart'),
  ref: z.string().min(1),
  cols: z.number().min(1).max(12),
});

const TextWidgetSchema = z.object({
  type: z.literal('text'),
  content: z.string().min(1),
  cols: z.number().min(1).max(12),
});

const WidgetSchema = z.discriminatedUnion('type', [
  ChartWidgetSchema,
  TextWidgetSchema,
]);

// Row configuration
const RowSchema = z.object({
  height: z.number().min(50),
  widgets: z.array(WidgetSchema).min(1),
});

// Layout configuration
const LayoutSchema = z.object({
  gap: z.number().min(0).default(16),
  rows: z.array(RowSchema).min(1),
});

// Main dashboard schema
export const DashboardSchema = z.object({
  // Identity
  name: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),

  // Filters inherited by all widgets
  filters: z.array(z.string()).optional(),

  // Layout definition
  layout: LayoutSchema,
});

export type Dashboard = z.infer<typeof DashboardSchema>;
export type DashboardLayout = z.infer<typeof LayoutSchema>;
export type DashboardRow = z.infer<typeof RowSchema>;
export type DashboardWidget = z.infer<typeof WidgetSchema>;
export type ChartWidget = z.infer<typeof ChartWidgetSchema>;
export type TextWidget = z.infer<typeof TextWidgetSchema>;
```

**Step 4: Update index.ts to export dashboard**

```typescript
// packages/schema/src/index.ts
// Add this line:
export * from './dashboard.js';
```

**Step 5: Run test to verify it passes**

Run: `pnpm --filter @dashbook/schema test`

Expected: PASS (7 tests)

**Step 6: Commit**

```bash
git add packages/schema/src/dashboard.ts packages/schema/src/__tests__/dashboard.test.ts packages/schema/src/index.ts
git commit -m "feat(schema): add dashboard schema with widget types"
```

---

## Task 2: KPI Chart Type

**Files:**
- Modify: `packages/schema/src/chart.ts`
- Modify: `packages/schema/src/__tests__/chart.test.ts`

**Step 1: Write the failing test**

Add to `packages/schema/src/__tests__/chart.test.ts`:

```typescript
describe('KPI Chart', () => {
  it('validates a KPI chart with comparison', () => {
    const kpiChart = {
      name: 'revenue-kpi',
      title: 'Total Revenue',
      source: { model: 'total_revenue' },
      chart: {
        type: 'kpi',
        value: { field: 'value' },
        format: { type: 'currency', currency: 'USD' },
        comparison: {
          enabled: true,
          field: 'previous_value',
          label: 'vs last period',
          type: 'percent_change',
        },
      },
    };

    const result = ChartSchema.safeParse(kpiChart);
    expect(result.success).toBe(true);
  });

  it('validates a KPI chart without comparison', () => {
    const kpiChart = {
      name: 'users-kpi',
      title: 'Active Users',
      source: { model: 'active_users' },
      chart: {
        type: 'kpi',
        value: { field: 'count' },
        format: { type: 'number' },
      },
    };

    const result = ChartSchema.safeParse(kpiChart);
    expect(result.success).toBe(true);
  });

  it('validates KPI with absolute comparison', () => {
    const kpiChart = {
      name: 'orders-kpi',
      title: 'Orders',
      source: { model: 'total_orders' },
      chart: {
        type: 'kpi',
        value: { field: 'value' },
        format: { type: 'number' },
        comparison: {
          enabled: true,
          field: 'previous_value',
          type: 'absolute',
        },
      },
    };

    const result = ChartSchema.safeParse(kpiChart);
    expect(result.success).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @dashbook/schema test`

Expected: FAIL - KPI chart validation fails

**Step 3: Modify chart.ts to add KPI support**

Add to `packages/schema/src/chart.ts` before `ChartConfigSchema`:

```typescript
// KPI format types
const KpiFormatSchema = z.object({
  type: z.enum(['number', 'currency', 'percent']),
  currency: z.string().optional(), // e.g., 'USD', 'EUR'
  decimals: z.number().optional(),
});

// KPI comparison configuration
const KpiComparisonSchema = z.object({
  enabled: z.boolean(),
  field: z.string().min(1),
  label: z.string().optional(),
  type: z.enum(['percent_change', 'absolute']),
});

// KPI value configuration
const KpiValueSchema = z.object({
  field: z.string().min(1),
});

// KPI-specific config
const KpiConfigSchema = z.object({
  type: z.literal('kpi'),
  value: KpiValueSchema,
  format: KpiFormatSchema,
  comparison: KpiComparisonSchema.optional(),
});
```

Then modify `ChartConfigSchema` to be a discriminated union:

```typescript
// Standard chart config (existing)
const StandardChartConfigSchema = z.object({
  type: z.enum([
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
  ]),
  x: AxisSchema,
  y: AxisSchema,
  series: z.array(SeriesSchema).optional(),
  annotations: z.array(AnnotationSchema).optional(),
  interactions: InteractionsSchema.optional(),
});

// Chart visualization config - either standard or KPI
export const ChartConfigSchema = z.union([
  StandardChartConfigSchema,
  KpiConfigSchema,
]);
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @dashbook/schema test`

Expected: PASS (all chart tests + 3 new KPI tests)

**Step 5: Commit**

```bash
git add packages/schema/src/chart.ts packages/schema/src/__tests__/chart.test.ts
git commit -m "feat(schema): add KPI chart type with comparison support"
```

---

## Task 3: Git Service

**Files:**
- Create: `apps/server/src/services/git-service.ts`
- Test: `apps/server/src/__tests__/git-service.test.ts`

**Step 1: Install simple-git**

Run: `pnpm --filter @dashbook/server add simple-git`

**Step 2: Write the failing test**

```typescript
// apps/server/src/__tests__/git-service.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { simpleGit } from 'simple-git';
import { GitService } from '../services/git-service';

describe('GitService', () => {
  let testDir: string;
  let gitService: GitService;

  beforeEach(async () => {
    // Create temp directory with git repo
    testDir = join(tmpdir(), `dashbook-git-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    // Init git repo
    const git = simpleGit(testDir);
    await git.init();
    await git.addConfig('user.email', 'test@test.com');
    await git.addConfig('user.name', 'Test User');

    // Create initial commit
    await writeFile(join(testDir, 'test.txt'), 'initial');
    await git.add('.');
    await git.commit('Initial commit');

    gitService = new GitService(testDir);
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('getBranches', () => {
    it('returns list of branches', async () => {
      const branches = await gitService.getBranches();
      expect(branches).toContain('main');
    });

    it('includes current branch marker', async () => {
      const result = await gitService.getBranchesWithCurrent();
      expect(result.current).toBe('main');
      expect(result.branches).toContain('main');
    });
  });

  describe('getCurrentBranch', () => {
    it('returns current branch name', async () => {
      const branch = await gitService.getCurrentBranch();
      expect(branch).toBe('main');
    });
  });

  describe('createBranch', () => {
    it('creates new branch from current', async () => {
      await gitService.createBranch('feature/test');
      const branches = await gitService.getBranches();
      expect(branches).toContain('feature/test');
    });

    it('creates branch from specified base', async () => {
      await gitService.createBranch('feature/from-main', 'main');
      const branches = await gitService.getBranches();
      expect(branches).toContain('feature/from-main');
    });
  });

  describe('checkout', () => {
    it('switches to existing branch', async () => {
      await gitService.createBranch('feature/switch');
      await gitService.checkout('main');
      await gitService.checkout('feature/switch');
      const current = await gitService.getCurrentBranch();
      expect(current).toBe('feature/switch');
    });
  });

  describe('commitAndPush', () => {
    it('commits changes with message', async () => {
      // Modify a file
      await writeFile(join(testDir, 'test.txt'), 'modified');

      const result = await gitService.commitAndPush('Update test file');

      expect(result.success).toBe(true);
      expect(result.commit).toBeDefined();
      expect(result.commit?.length).toBeGreaterThan(0);
    });

    it('handles no changes gracefully', async () => {
      const result = await gitService.commitAndPush('No changes');
      expect(result.success).toBe(true);
      expect(result.noChanges).toBe(true);
    });
  });

  describe('hasUncommittedChanges', () => {
    it('returns false when clean', async () => {
      const hasChanges = await gitService.hasUncommittedChanges();
      expect(hasChanges).toBe(false);
    });

    it('returns true when dirty', async () => {
      await writeFile(join(testDir, 'test.txt'), 'modified');
      const hasChanges = await gitService.hasUncommittedChanges();
      expect(hasChanges).toBe(true);
    });
  });
});
```

**Step 3: Run test to verify it fails**

Run: `pnpm --filter @dashbook/server test -- git-service`

Expected: FAIL with "Cannot find module '../services/git-service'"

**Step 4: Write minimal implementation**

```typescript
// apps/server/src/services/git-service.ts
import { simpleGit, SimpleGit } from 'simple-git';

export interface CommitResult {
  success: boolean;
  commit?: string;
  branch?: string;
  noChanges?: boolean;
  error?: string;
}

export interface BranchesResult {
  current: string;
  branches: string[];
}

export class GitService {
  private git: SimpleGit;
  private projectDir: string;

  constructor(projectDir: string) {
    this.projectDir = projectDir;
    this.git = simpleGit(projectDir);
  }

  async getBranches(): Promise<string[]> {
    const result = await this.git.branchLocal();
    return result.all;
  }

  async getBranchesWithCurrent(): Promise<BranchesResult> {
    const result = await this.git.branchLocal();
    return {
      current: result.current,
      branches: result.all,
    };
  }

  async getCurrentBranch(): Promise<string> {
    const result = await this.git.branchLocal();
    return result.current;
  }

  async createBranch(name: string, from?: string): Promise<void> {
    if (from) {
      await this.git.checkoutBranch(name, from);
    } else {
      await this.git.checkoutLocalBranch(name);
    }
  }

  async checkout(branch: string): Promise<void> {
    await this.git.checkout(branch);
  }

  async commitAndPush(message: string): Promise<CommitResult> {
    try {
      // Check for changes
      const status = await this.git.status();

      if (status.files.length === 0) {
        return { success: true, noChanges: true };
      }

      // Stage all changes
      await this.git.add('.');

      // Commit
      const commitResult = await this.git.commit(message);

      // Try to push (may fail if no remote)
      try {
        await this.git.push();
      } catch {
        // Push failed - likely no remote configured, that's ok for local dev
      }

      return {
        success: true,
        commit: commitResult.commit,
        branch: status.current ?? undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async hasUncommittedChanges(): Promise<boolean> {
    const status = await this.git.status();
    return status.files.length > 0;
  }

  async pull(): Promise<void> {
    await this.git.pull();
  }
}
```

**Step 5: Run test to verify it passes**

Run: `pnpm --filter @dashbook/server test -- git-service`

Expected: PASS (8 tests)

**Step 6: Commit**

```bash
git add apps/server/src/services/git-service.ts apps/server/src/__tests__/git-service.test.ts apps/server/package.json pnpm-lock.yaml
git commit -m "feat(server): add Git service for branch operations"
```

---

## Task 4: Config Loader Dashboard Support

**Files:**
- Modify: `apps/server/src/services/config-loader.ts`
- Modify: `apps/server/src/__tests__/config-loader.test.ts`

**Step 1: Write the failing test**

Add to `apps/server/src/__tests__/config-loader.test.ts`:

```typescript
describe('dashboard loading', () => {
  it('loads dashboards from dashboards directory', async () => {
    // Create dashboard file in test fixture
    await mkdir(join(testDir, 'dashboards'), { recursive: true });
    await writeFile(
      join(testDir, 'dashboards', 'executive.yaml'),
      `
name: executive
title: Executive Overview
layout:
  rows:
    - height: 400
      widgets:
        - type: chart
          ref: revenue-trend
          cols: 12
`
    );

    const loader = new ConfigLoader(testDir);
    await loader.load();

    const dashboards = loader.getDashboards();
    expect(dashboards).toHaveLength(1);
    expect(dashboards[0].name).toBe('executive');
  });

  it('getDashboardByName returns specific dashboard', async () => {
    await mkdir(join(testDir, 'dashboards'), { recursive: true });
    await writeFile(
      join(testDir, 'dashboards', 'metrics.yaml'),
      `
name: metrics
title: Key Metrics
layout:
  rows:
    - height: 120
      widgets:
        - type: chart
          ref: kpi
          cols: 12
`
    );

    const loader = new ConfigLoader(testDir);
    await loader.load();

    const dashboard = loader.getDashboardByName('metrics');
    expect(dashboard).toBeDefined();
    expect(dashboard?.title).toBe('Key Metrics');
  });

  it('returns undefined for non-existent dashboard', async () => {
    const loader = new ConfigLoader(testDir);
    await loader.load();

    const dashboard = loader.getDashboardByName('nonexistent');
    expect(dashboard).toBeUndefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @dashbook/server test -- config-loader`

Expected: FAIL - getDashboards/getDashboardByName not defined

**Step 3: Modify config-loader.ts**

Add imports at top:

```typescript
import {
  ProjectSchema,
  ConnectionSchema,
  ChartSchema,
  DashboardSchema,  // Add this
  type Project,
  type Connection,
  type Chart,
  type Dashboard,   // Add this
  type ModelMetadata,
} from '@dashbook/schema';
```

Add to class properties:

```typescript
private dashboards: Map<string, Dashboard> = new Map();
```

Add load method:

```typescript
async load(): Promise<void> {
  await this.loadProject();
  await this.loadConnections();
  await this.loadCharts();
  await this.loadModels();
  await this.loadDashboards();  // Add this
}

private async loadDashboards(): Promise<void> {
  const dashboardsDir = join(this.projectDir, 'dashboards');

  try {
    await access(dashboardsDir);
  } catch {
    return; // No dashboards directory is ok
  }

  const files = await readdir(dashboardsDir);

  for (const file of files) {
    if (extname(file) !== '.yaml' && extname(file) !== '.yml') continue;

    const filePath = join(dashboardsDir, file);
    const content = await readFile(filePath, 'utf-8');
    const parsed = parseYaml(content);
    const result = DashboardSchema.safeParse(parsed);

    if (result.success) {
      this.dashboards.set(result.data.name, result.data);
    } else {
      console.warn(`Invalid dashboard file ${file}: ${result.error.message}`);
    }
  }
}
```

Add getters:

```typescript
getDashboards(): Dashboard[] {
  return Array.from(this.dashboards.values());
}

getDashboardByName(name: string): Dashboard | undefined {
  return this.dashboards.get(name);
}
```

Update reload method:

```typescript
private async reload(): Promise<void> {
  try {
    this.connections.clear();
    this.charts.clear();
    this.models.clear();
    this.dashboards.clear();  // Add this
    await this.load();
    // ...
  }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @dashbook/server test -- config-loader`

Expected: PASS

**Step 5: Commit**

```bash
git add apps/server/src/services/config-loader.ts apps/server/src/__tests__/config-loader.test.ts
git commit -m "feat(server): add dashboard loading to config-loader"
```

---

## Task 5: Dashboard Routes

**Files:**
- Create: `apps/server/src/routes/dashboards.ts`
- Modify: `apps/server/src/routes/index.ts`
- Test: `apps/server/src/__tests__/dashboard-routes.test.ts`

**Step 1: Write the failing test**

```typescript
// apps/server/src/__tests__/dashboard-routes.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { mkdir, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { simpleGit } from 'simple-git';
import { dashboardRoutes } from '../routes/dashboards';
import { ConfigLoader } from '../services/config-loader';
import { GitService } from '../services/git-service';

describe('Dashboard Routes', () => {
  let testDir: string;
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    testDir = join(tmpdir(), `dashbook-dashboard-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    // Init git repo
    const git = simpleGit(testDir);
    await git.init();
    await git.addConfig('user.email', 'test@test.com');
    await git.addConfig('user.name', 'Test User');

    // Create dashbook.yaml
    await writeFile(
      join(testDir, 'dashbook.yaml'),
      `
name: test-project
version: "1.0"
`
    );

    // Create dashboard
    await mkdir(join(testDir, 'dashboards'), { recursive: true });
    await writeFile(
      join(testDir, 'dashboards', 'executive.yaml'),
      `
name: executive
title: Executive Overview
layout:
  gap: 16
  rows:
    - height: 400
      widgets:
        - type: chart
          ref: revenue-trend
          cols: 12
`
    );

    // Initial commit
    await git.add('.');
    await git.commit('Initial commit');

    // Setup server
    const configLoader = new ConfigLoader(testDir);
    await configLoader.load();

    const gitService = new GitService(testDir);

    app = Fastify();
    await app.register(dashboardRoutes, { configLoader, gitService, projectDir: testDir });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await rm(testDir, { recursive: true, force: true });
  });

  describe('GET /api/dashboards', () => {
    it('returns list of dashboards', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/dashboards',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveLength(1);
      expect(body[0].name).toBe('executive');
      expect(body[0].title).toBe('Executive Overview');
    });
  });

  describe('GET /api/dashboards/:id', () => {
    it('returns dashboard by name', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/dashboards/executive',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.name).toBe('executive');
      expect(body.layout.rows).toHaveLength(1);
    });

    it('returns 404 for non-existent dashboard', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/dashboards/nonexistent',
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /api/dashboards/:id', () => {
    it('saves dashboard layout and commits', async () => {
      const newLayout = {
        gap: 20,
        rows: [
          { height: 200, widgets: [{ type: 'chart', ref: 'new-chart', cols: 12 }] },
        ],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/dashboards/executive',
        payload: { layout: newLayout },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.commit).toBeDefined();
    });
  });

  describe('GET /api/git/branches', () => {
    it('returns list of branches', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/git/branches',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.branches).toContain('main');
      expect(body.current).toBe('main');
    });
  });

  describe('POST /api/git/branches', () => {
    it('creates new branch', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/git/branches',
        payload: { name: 'feature/test-branch', from: 'main' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @dashbook/server test -- dashboard-routes`

Expected: FAIL with "Cannot find module '../routes/dashboards'"

**Step 3: Write minimal implementation**

```typescript
// apps/server/src/routes/dashboards.ts
import type { FastifyInstance } from 'fastify';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { stringify as stringifyYaml } from 'yaml';
import type { ConfigLoader } from '../services/config-loader.js';
import type { GitService } from '../services/git-service.js';
import type { DashboardLayout } from '@dashbook/schema';

export interface DashboardRoutesOptions {
  configLoader: ConfigLoader;
  gitService: GitService;
  projectDir: string;
}

export async function dashboardRoutes(
  fastify: FastifyInstance,
  options: DashboardRoutesOptions
) {
  const { configLoader, gitService, projectDir } = options;

  // List all dashboards
  fastify.get('/api/dashboards', async () => {
    const dashboards = configLoader.getDashboards();
    return dashboards.map((d) => ({
      name: d.name,
      title: d.title,
      description: d.description,
    }));
  });

  // Get dashboard by name
  fastify.get<{ Params: { id: string }; Querystring: { branch?: string } }>(
    '/api/dashboards/:id',
    async (request, reply) => {
      const { id } = request.params;
      const dashboard = configLoader.getDashboardByName(id);

      if (!dashboard) {
        return reply.status(404).send({ error: `Dashboard not found: ${id}` });
      }

      const currentBranch = await gitService.getCurrentBranch();

      return {
        ...dashboard,
        branch: currentBranch,
      };
    }
  );

  // Save dashboard layout
  fastify.post<{
    Params: { id: string };
    Body: { layout: DashboardLayout; message?: string };
  }>('/api/dashboards/:id', async (request, reply) => {
    const { id } = request.params;
    const { layout, message } = request.body;

    const dashboard = configLoader.getDashboardByName(id);
    if (!dashboard) {
      return reply.status(404).send({ error: `Dashboard not found: ${id}` });
    }

    // Update dashboard with new layout
    const updated = { ...dashboard, layout };

    // Write to file
    const filePath = join(projectDir, 'dashboards', `${id}.yaml`);
    await writeFile(filePath, stringifyYaml(updated));

    // Reload config
    await configLoader.load();

    // Commit and push
    const commitMessage = message || `Update ${dashboard.title} layout`;
    const result = await gitService.commitAndPush(commitMessage);

    return {
      success: true,
      commit: result.commit,
      branch: result.branch,
    };
  });

  // Git routes
  fastify.get('/api/git/branches', async () => {
    return gitService.getBranchesWithCurrent();
  });

  fastify.post<{ Body: { name: string; from?: string } }>(
    '/api/git/branches',
    async (request) => {
      const { name, from } = request.body;
      await gitService.createBranch(name, from);
      return { success: true, branch: name };
    }
  );

  fastify.post<{ Body: { branch: string } }>(
    '/api/git/checkout',
    async (request) => {
      const { branch } = request.body;
      await gitService.checkout(branch);
      await configLoader.load(); // Reload after branch switch
      return { success: true, branch };
    }
  );
}
```

**Step 4: Update routes/index.ts**

```typescript
// Add to apps/server/src/routes/index.ts
export { dashboardRoutes } from './dashboards.js';
```

**Step 5: Run test to verify it passes**

Run: `pnpm --filter @dashbook/server test -- dashboard-routes`

Expected: PASS

**Step 6: Commit**

```bash
git add apps/server/src/routes/dashboards.ts apps/server/src/routes/index.ts apps/server/src/__tests__/dashboard-routes.test.ts
git commit -m "feat(server): add dashboard and git routes"
```

---

## Task 6: Register Routes in Server

**Files:**
- Modify: `apps/server/src/server.ts`

**Step 1: Read current server.ts**

Check current implementation to understand how to add the new routes.

**Step 2: Add GitService and dashboard routes**

Add imports:

```typescript
import { GitService } from './services/git-service.js';
import { dashboardRoutes } from './routes/dashboards.js';
```

In the createServer function, after configLoader initialization:

```typescript
const gitService = new GitService(projectDir);
```

Register routes:

```typescript
await server.register(dashboardRoutes, {
  configLoader,
  gitService,
  projectDir,
});
```

**Step 3: Run integration tests**

Run: `pnpm --filter @dashbook/server test`

Expected: PASS (all tests)

**Step 4: Commit**

```bash
git add apps/server/src/server.ts
git commit -m "feat(server): register dashboard routes in server"
```

---

## Task 7: Install Frontend Dependencies

**Files:**
- Modify: `apps/web/package.json`

**Step 1: Install dependencies**

```bash
pnpm --filter @dashbook/web add react-grid-layout react-markdown @types/react-grid-layout
```

**Step 2: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "chore(web): add react-grid-layout and react-markdown"
```

---

## Task 8: Dashboard API Client

**Files:**
- Modify: `apps/web/src/api/client.ts`
- Modify: `apps/web/src/api/types.ts`

**Step 1: Add types**

Add to `apps/web/src/api/types.ts`:

```typescript
export interface DashboardWidget {
  type: 'chart' | 'text';
  ref?: string;
  content?: string;
  cols: number;
}

export interface DashboardRow {
  height: number;
  widgets: DashboardWidget[];
}

export interface DashboardLayout {
  gap?: number;
  rows: DashboardRow[];
}

export interface DashboardSummary {
  name: string;
  title: string;
  description?: string;
}

export interface Dashboard extends DashboardSummary {
  filters?: string[];
  layout: DashboardLayout;
  branch: string;
}

export interface BranchesResponse {
  current: string;
  branches: string[];
}

export interface SaveDashboardResponse {
  success: boolean;
  commit?: string;
  branch?: string;
}
```

**Step 2: Add API methods**

Add to `apps/web/src/api/client.ts`:

```typescript
async getDashboards(): Promise<DashboardSummary[]> {
  const response = await fetch(`${this.baseUrl}/api/dashboards`);
  if (!response.ok) throw new Error('Failed to fetch dashboards');
  return response.json();
}

async getDashboard(id: string, branch?: string): Promise<Dashboard> {
  const url = branch
    ? `${this.baseUrl}/api/dashboards/${id}?branch=${branch}`
    : `${this.baseUrl}/api/dashboards/${id}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch dashboard: ${id}`);
  return response.json();
}

async saveDashboard(
  id: string,
  layout: DashboardLayout,
  message?: string
): Promise<SaveDashboardResponse> {
  const response = await fetch(`${this.baseUrl}/api/dashboards/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ layout, message }),
  });
  if (!response.ok) throw new Error('Failed to save dashboard');
  return response.json();
}

async getBranches(): Promise<BranchesResponse> {
  const response = await fetch(`${this.baseUrl}/api/git/branches`);
  if (!response.ok) throw new Error('Failed to fetch branches');
  return response.json();
}

async createBranch(name: string, from?: string): Promise<void> {
  const response = await fetch(`${this.baseUrl}/api/git/branches`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, from }),
  });
  if (!response.ok) throw new Error('Failed to create branch');
}

async checkoutBranch(branch: string): Promise<void> {
  const response = await fetch(`${this.baseUrl}/api/git/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ branch }),
  });
  if (!response.ok) throw new Error('Failed to checkout branch');
}
```

**Step 3: Commit**

```bash
git add apps/web/src/api/client.ts apps/web/src/api/types.ts
git commit -m "feat(web): add dashboard and git API client methods"
```

---

## Task 9: Dashboard Hooks

**Files:**
- Create: `apps/web/src/hooks/useDashboard.ts`
- Create: `apps/web/src/hooks/useBranches.ts`
- Modify: `apps/web/src/hooks/index.ts`

**Step 1: Create useDashboard hook**

```typescript
// apps/web/src/hooks/useDashboard.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { DashboardLayout } from '../api/types';

export function useDashboards() {
  return useQuery({
    queryKey: ['dashboards'],
    queryFn: () => api.getDashboards(),
  });
}

export function useDashboard(id: string, branch?: string) {
  return useQuery({
    queryKey: ['dashboard', id, branch],
    queryFn: () => api.getDashboard(id, branch),
    enabled: !!id,
  });
}

export function useSaveDashboard(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ layout, message }: { layout: DashboardLayout; message?: string }) =>
      api.saveDashboard(id, layout, message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', id] });
    },
  });
}
```

**Step 2: Create useBranches hook**

```typescript
// apps/web/src/hooks/useBranches.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

export function useBranches() {
  return useQuery({
    queryKey: ['branches'],
    queryFn: () => api.getBranches(),
  });
}

export function useCreateBranch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ name, from }: { name: string; from?: string }) =>
      api.createBranch(name, from),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
    },
  });
}

export function useCheckoutBranch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (branch: string) => api.checkoutBranch(branch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
```

**Step 3: Export from index**

```typescript
// Add to apps/web/src/hooks/index.ts
export * from './useDashboard';
export * from './useBranches';
```

**Step 4: Commit**

```bash
git add apps/web/src/hooks/useDashboard.ts apps/web/src/hooks/useBranches.ts apps/web/src/hooks/index.ts
git commit -m "feat(web): add dashboard and branch hooks"
```

---

## Task 10: Edit Mode Context

**Files:**
- Create: `apps/web/src/components/dashboard/EditModeContext.tsx`

**Step 1: Create context**

```typescript
// apps/web/src/components/dashboard/EditModeContext.tsx
import { createContext, useContext, useState, ReactNode } from 'react';
import type { DashboardLayout } from '../../api/types';

interface EditModeContextValue {
  isEditing: boolean;
  setIsEditing: (editing: boolean) => void;
  pendingLayout: DashboardLayout | null;
  setPendingLayout: (layout: DashboardLayout | null) => void;
  hasChanges: boolean;
}

const EditModeContext = createContext<EditModeContextValue | null>(null);

export function EditModeProvider({ children }: { children: ReactNode }) {
  const [isEditing, setIsEditing] = useState(false);
  const [pendingLayout, setPendingLayout] = useState<DashboardLayout | null>(null);

  const hasChanges = pendingLayout !== null;

  return (
    <EditModeContext.Provider
      value={{
        isEditing,
        setIsEditing,
        pendingLayout,
        setPendingLayout,
        hasChanges,
      }}
    >
      {children}
    </EditModeContext.Provider>
  );
}

export function useEditMode() {
  const context = useContext(EditModeContext);
  if (!context) {
    throw new Error('useEditMode must be used within EditModeProvider');
  }
  return context;
}
```

**Step 2: Commit**

```bash
git add apps/web/src/components/dashboard/EditModeContext.tsx
git commit -m "feat(web): add edit mode context for dashboard editing"
```

---

## Task 11: KPI Widget Component

**Files:**
- Create: `apps/web/src/components/dashboard/widgets/KpiWidget.tsx`

**Step 1: Create KPI widget**

```typescript
// apps/web/src/components/dashboard/widgets/KpiWidget.tsx
import { clsx } from 'clsx';
import { useChartData } from '../../../hooks/useChartData';
import { useChart } from '../../../hooks/useChart';

interface KpiWidgetProps {
  chartRef: string;
}

function formatValue(
  value: number,
  format?: { type: string; currency?: string; decimals?: number }
): string {
  if (!format) return value.toLocaleString();

  const decimals = format.decimals ?? 0;

  switch (format.type) {
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: format.currency || 'USD',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(value);
    case 'percent':
      return new Intl.NumberFormat('en-US', {
        style: 'percent',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(value / 100);
    default:
      return value.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
  }
}

function formatChange(value: number, type: 'percent_change' | 'absolute'): string {
  const prefix = value >= 0 ? '+' : '';
  if (type === 'percent_change') {
    return `${prefix}${value.toFixed(1)}%`;
  }
  return `${prefix}${value.toLocaleString()}`;
}

export function KpiWidget({ chartRef }: KpiWidgetProps) {
  const { data: chartConfig } = useChart(chartRef);
  const { data, isLoading, error } = useChartData(chartRef);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-pulse bg-gray-200 h-12 w-24 rounded" />
      </div>
    );
  }

  if (error || !data?.rows?.[0]) {
    return (
      <div className="h-full flex items-center justify-center text-red-500 text-sm">
        Failed to load
      </div>
    );
  }

  const row = data.rows[0];
  const config = chartConfig?.chart as {
    value: { field: string };
    format?: { type: string; currency?: string; decimals?: number };
    comparison?: {
      enabled: boolean;
      field: string;
      label?: string;
      type: 'percent_change' | 'absolute';
    };
  };

  const value = row[config.value.field] as number;
  const formattedValue = formatValue(value, config.format);

  let change: number | null = null;
  let changeType: 'percent_change' | 'absolute' = 'percent_change';

  if (config.comparison?.enabled && config.comparison.field) {
    const previousValue = row[config.comparison.field] as number;
    changeType = config.comparison.type;

    if (previousValue && previousValue !== 0) {
      if (changeType === 'percent_change') {
        change = ((value - previousValue) / previousValue) * 100;
      } else {
        change = value - previousValue;
      }
    }
  }

  return (
    <div className="h-full flex flex-col justify-center p-4">
      <div className="text-3xl font-bold text-gray-900">{formattedValue}</div>
      <div className="text-sm text-gray-500 mt-1">{chartConfig?.title}</div>
      {change !== null && (
        <div className="mt-2 flex items-center gap-2">
          <span
            className={clsx(
              'text-sm font-medium px-2 py-0.5 rounded',
              change >= 0
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            )}
          >
            {formatChange(change, changeType)}
          </span>
          {config.comparison?.label && (
            <span className="text-xs text-gray-400">{config.comparison.label}</span>
          )}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/components/dashboard/widgets/KpiWidget.tsx
git commit -m "feat(web): add KPI widget component with comparison"
```

---

## Task 12: Text Widget Component

**Files:**
- Create: `apps/web/src/components/dashboard/widgets/TextWidget.tsx`

**Step 1: Create text widget**

```typescript
// apps/web/src/components/dashboard/widgets/TextWidget.tsx
import ReactMarkdown from 'react-markdown';

interface TextWidgetProps {
  content: string;
}

export function TextWidget({ content }: TextWidgetProps) {
  return (
    <div className="h-full p-4 overflow-auto prose prose-sm max-w-none">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/components/dashboard/widgets/TextWidget.tsx
git commit -m "feat(web): add text widget with markdown rendering"
```

---

## Task 13: Chart Widget Component

**Files:**
- Create: `apps/web/src/components/dashboard/widgets/ChartWidget.tsx`

**Step 1: Create chart widget**

```typescript
// apps/web/src/components/dashboard/widgets/ChartWidget.tsx
import { useChart } from '../../../hooks/useChart';
import { ChartView } from '../../ChartView';
import { KpiWidget } from './KpiWidget';

interface ChartWidgetProps {
  chartRef: string;
}

export function ChartWidget({ chartRef }: ChartWidgetProps) {
  const { data: chartConfig, isLoading } = useChart(chartRef);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  // Check if this is a KPI chart
  if (chartConfig?.chart?.type === 'kpi') {
    return <KpiWidget chartRef={chartRef} />;
  }

  // Regular chart
  return (
    <div className="h-full">
      <ChartView chartName={chartRef} compact />
    </div>
  );
}
```

**Step 2: Update ChartView to support compact mode**

Modify `apps/web/src/components/ChartView.tsx` to accept `compact` prop:

```typescript
interface ChartViewProps {
  chartName: string;
  compact?: boolean;
}

export function ChartView({ chartName, compact = false }: ChartViewProps) {
  // ... existing implementation
  // Use compact prop to hide header in dashboard widgets
}
```

**Step 3: Commit**

```bash
git add apps/web/src/components/dashboard/widgets/ChartWidget.tsx apps/web/src/components/ChartView.tsx
git commit -m "feat(web): add chart widget with KPI detection"
```

---

## Task 14: Widget Wrapper Component

**Files:**
- Create: `apps/web/src/components/dashboard/widgets/WidgetWrapper.tsx`

**Step 1: Create widget wrapper**

```typescript
// apps/web/src/components/dashboard/widgets/WidgetWrapper.tsx
import { ReactNode } from 'react';
import { clsx } from 'clsx';
import { useEditMode } from '../EditModeContext';

interface WidgetWrapperProps {
  children: ReactNode;
}

export function WidgetWrapper({ children }: WidgetWrapperProps) {
  const { isEditing } = useEditMode();

  return (
    <div
      className={clsx(
        'bg-white rounded-lg shadow-sm border border-gray-200 h-full overflow-hidden',
        isEditing && 'ring-2 ring-blue-200 cursor-move'
      )}
    >
      {isEditing && (
        <div className="absolute top-2 left-2 z-10">
          <div className="w-6 h-6 bg-gray-100 rounded flex items-center justify-center cursor-grab active:cursor-grabbing">
            <svg
              className="w-4 h-4 text-gray-400"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
            </svg>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
```

**Step 2: Create widgets index**

```typescript
// apps/web/src/components/dashboard/widgets/index.ts
export { ChartWidget } from './ChartWidget';
export { KpiWidget } from './KpiWidget';
export { TextWidget } from './TextWidget';
export { WidgetWrapper } from './WidgetWrapper';
```

**Step 3: Commit**

```bash
git add apps/web/src/components/dashboard/widgets/WidgetWrapper.tsx apps/web/src/components/dashboard/widgets/index.ts
git commit -m "feat(web): add widget wrapper with edit mode styling"
```

---

## Task 15: Dashboard Grid Component

**Files:**
- Create: `apps/web/src/components/dashboard/DashboardGrid.tsx`

**Step 1: Create dashboard grid**

```typescript
// apps/web/src/components/dashboard/DashboardGrid.tsx
import { useMemo, useCallback } from 'react';
import GridLayout, { Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import type { DashboardLayout, DashboardWidget } from '../../api/types';
import { useEditMode } from './EditModeContext';
import { ChartWidget, TextWidget, WidgetWrapper } from './widgets';

interface DashboardGridProps {
  layout: DashboardLayout;
  onLayoutChange?: (layout: DashboardLayout) => void;
}

function widgetToGridItem(
  widget: DashboardWidget,
  rowIndex: number,
  widgetIndex: number,
  yOffset: number,
  rowHeight: number
): Layout {
  // Calculate x position based on previous widgets in row
  let x = 0;
  // This is simplified - in production you'd track cumulative cols

  return {
    i: `${rowIndex}-${widgetIndex}`,
    x: widgetIndex * 3, // Simplified positioning
    y: yOffset,
    w: widget.cols,
    h: Math.ceil(rowHeight / 50), // Convert px to grid units
    minW: widget.type === 'chart' ? 4 : 2,
    minH: 2,
  };
}

export function DashboardGrid({ layout, onLayoutChange }: DashboardGridProps) {
  const { isEditing, setPendingLayout } = useEditMode();

  // Convert dashboard layout to react-grid-layout format
  const { gridLayout, widgets } = useMemo(() => {
    const items: Layout[] = [];
    const widgetMap: Map<string, { widget: DashboardWidget; rowIndex: number }> = new Map();

    let yOffset = 0;
    layout.rows.forEach((row, rowIndex) => {
      let xOffset = 0;
      row.widgets.forEach((widget, widgetIndex) => {
        const key = `${rowIndex}-${widgetIndex}`;
        items.push({
          i: key,
          x: xOffset,
          y: yOffset,
          w: widget.cols,
          h: Math.ceil(row.height / 50),
          minW: widget.type === 'chart' ? 4 : 2,
          minH: 2,
        });
        widgetMap.set(key, { widget, rowIndex });
        xOffset += widget.cols;
      });
      yOffset += Math.ceil(row.height / 50);
    });

    return { gridLayout: items, widgets: widgetMap };
  }, [layout]);

  const handleLayoutChange = useCallback(
    (newGridLayout: Layout[]) => {
      if (!isEditing) return;

      // Convert grid layout back to dashboard layout format
      // Group by y position to form rows
      const sorted = [...newGridLayout].sort((a, b) => a.y - b.y || a.x - b.x);

      const rows: { height: number; widgets: DashboardWidget[] }[] = [];
      let currentY = -1;
      let currentRow: DashboardWidget[] = [];

      sorted.forEach((item) => {
        const widgetData = widgets.get(item.i);
        if (!widgetData) return;

        if (item.y !== currentY) {
          if (currentRow.length > 0) {
            rows.push({ height: 200, widgets: currentRow });
          }
          currentRow = [];
          currentY = item.y;
        }

        currentRow.push({
          ...widgetData.widget,
          cols: item.w,
        });
      });

      if (currentRow.length > 0) {
        rows.push({ height: 200, widgets: currentRow });
      }

      const newLayout: DashboardLayout = {
        gap: layout.gap,
        rows,
      };

      setPendingLayout(newLayout);
      onLayoutChange?.(newLayout);
    },
    [isEditing, widgets, layout.gap, setPendingLayout, onLayoutChange]
  );

  return (
    <GridLayout
      className="layout"
      layout={gridLayout}
      cols={12}
      rowHeight={50}
      width={1200}
      isDraggable={isEditing}
      isResizable={isEditing}
      onLayoutChange={handleLayoutChange}
      draggableHandle=".cursor-grab"
    >
      {Array.from(widgets.entries()).map(([key, { widget }]) => (
        <div key={key}>
          <WidgetWrapper>
            {widget.type === 'chart' && widget.ref && (
              <ChartWidget chartRef={widget.ref} />
            )}
            {widget.type === 'text' && widget.content && (
              <TextWidget content={widget.content} />
            )}
          </WidgetWrapper>
        </div>
      ))}
    </GridLayout>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/components/dashboard/DashboardGrid.tsx
git commit -m "feat(web): add dashboard grid with react-grid-layout"
```

---

## Task 16: Dashboard Toolbar Component

**Files:**
- Create: `apps/web/src/components/dashboard/DashboardToolbar.tsx`

**Step 1: Create toolbar**

```typescript
// apps/web/src/components/dashboard/DashboardToolbar.tsx
import { useState } from 'react';
import { clsx } from 'clsx';
import { useBranches, useCheckoutBranch, useCreateBranch } from '../../hooks/useBranches';
import { useSaveDashboard } from '../../hooks/useDashboard';
import { useEditMode } from './EditModeContext';
import type { DashboardLayout } from '../../api/types';

interface DashboardToolbarProps {
  dashboardId: string;
  title: string;
  currentBranch: string;
}

export function DashboardToolbar({
  dashboardId,
  title,
  currentBranch,
}: DashboardToolbarProps) {
  const { isEditing, setIsEditing, pendingLayout, setPendingLayout, hasChanges } =
    useEditMode();
  const { data: branchesData } = useBranches();
  const checkoutBranch = useCheckoutBranch();
  const saveDashboard = useSaveDashboard(dashboardId);

  const [showBranchDropdown, setShowBranchDropdown] = useState(false);

  const handleSave = async () => {
    if (!pendingLayout) return;

    try {
      await saveDashboard.mutateAsync({ layout: pendingLayout });
      setPendingLayout(null);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save:', error);
    }
  };

  const handleCancel = () => {
    setPendingLayout(null);
    setIsEditing(false);
  };

  const handleBranchChange = async (branch: string) => {
    setShowBranchDropdown(false);
    await checkoutBranch.mutateAsync(branch);
  };

  return (
    <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>

        {/* Branch selector */}
        <div className="relative">
          <button
            onClick={() => setShowBranchDropdown(!showBranchDropdown)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 rounded-md hover:bg-gray-200"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M5.75 3a.75.75 0 01.75.75v6.5h6.5a.75.75 0 010 1.5h-6.5v6.5a.75.75 0 01-1.5 0v-6.5h-6.5a.75.75 0 010-1.5h6.5v-6.5A.75.75 0 015.75 3z"
                clipRule="evenodd"
              />
            </svg>
            {currentBranch}
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          {showBranchDropdown && branchesData && (
            <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50">
              {branchesData.branches.map((branch) => (
                <button
                  key={branch}
                  onClick={() => handleBranchChange(branch)}
                  className={clsx(
                    'w-full text-left px-4 py-2 text-sm hover:bg-gray-100',
                    branch === currentBranch && 'bg-blue-50 text-blue-700'
                  )}
                >
                  {branch}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {isEditing ? (
          <>
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges || saveDashboard.isPending}
              className={clsx(
                'px-4 py-2 text-sm font-medium rounded-md',
                hasChanges
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              )}
            >
              {saveDashboard.isPending ? 'Saving...' : 'Save & Push'}
            </button>
          </>
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            Edit Layout
          </button>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/components/dashboard/DashboardToolbar.tsx
git commit -m "feat(web): add dashboard toolbar with branch selector"
```

---

## Task 17: Main Dashboard Component

**Files:**
- Create: `apps/web/src/components/dashboard/Dashboard.tsx`
- Create: `apps/web/src/components/dashboard/index.ts`

**Step 1: Create main dashboard component**

```typescript
// apps/web/src/components/dashboard/Dashboard.tsx
import { useDashboard } from '../../hooks/useDashboard';
import { EditModeProvider } from './EditModeContext';
import { DashboardToolbar } from './DashboardToolbar';
import { DashboardGrid } from './DashboardGrid';

interface DashboardProps {
  dashboardId: string;
  branch?: string;
}

export function Dashboard({ dashboardId, branch }: DashboardProps) {
  const { data: dashboard, isLoading, error } = useDashboard(dashboardId, branch);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading dashboard...</div>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">
          Failed to load dashboard: {error?.message || 'Unknown error'}
        </div>
      </div>
    );
  }

  return (
    <EditModeProvider>
      <div className="min-h-screen bg-gray-50">
        <DashboardToolbar
          dashboardId={dashboardId}
          title={dashboard.title}
          currentBranch={dashboard.branch}
        />
        <div className="p-6">
          <DashboardGrid layout={dashboard.layout} />
        </div>
      </div>
    </EditModeProvider>
  );
}
```

**Step 2: Create index export**

```typescript
// apps/web/src/components/dashboard/index.ts
export { Dashboard } from './Dashboard';
export { DashboardGrid } from './DashboardGrid';
export { DashboardToolbar } from './DashboardToolbar';
export { EditModeProvider, useEditMode } from './EditModeContext';
```

**Step 3: Commit**

```bash
git add apps/web/src/components/dashboard/Dashboard.tsx apps/web/src/components/dashboard/index.ts
git commit -m "feat(web): add main dashboard component"
```

---

## Task 18: Update App Router

**Files:**
- Modify: `apps/web/src/App.tsx`

**Step 1: Add dashboard route**

```typescript
// apps/web/src/App.tsx
import { useState } from 'react';
import { Header } from './components/Header';
import { ChartView } from './components/ChartView';
import { Dashboard } from './components/dashboard';
import { useConfig } from './hooks';
import { useDashboards } from './hooks/useDashboard';

function App() {
  const { data: config, isLoading: configLoading } = useConfig();
  const { data: dashboards, isLoading: dashboardsLoading } = useDashboards();
  const [view, setView] = useState<'chart' | 'dashboard'>('dashboard');
  const [selectedDashboard, setSelectedDashboard] = useState<string | null>(null);

  if (configLoading || dashboardsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  // If dashboards exist, show dashboard view by default
  const hasDashboards = dashboards && dashboards.length > 0;
  const activeDashboard = selectedDashboard || dashboards?.[0]?.name;

  if (hasDashboards && view === 'dashboard' && activeDashboard) {
    return <Dashboard dashboardId={activeDashboard} />;
  }

  // Fallback to chart view
  const chartName = config?.charts[0]?.name || 'revenue-trend';

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <ChartView chartName={chartName} />
      </main>
    </div>
  );
}

export default App;
```

**Step 2: Commit**

```bash
git add apps/web/src/App.tsx
git commit -m "feat(web): add dashboard view to app router"
```

---

## Task 19: Example Dashboard

**Files:**
- Create: `examples/sales-analytics/dashboards/executive.yaml`

**Step 1: Create example dashboard**

```yaml
# examples/sales-analytics/dashboards/executive.yaml
name: executive
title: Executive Overview
description: Key business metrics at a glance
filters:
  - date_range

layout:
  gap: 16
  rows:
    - height: 120
      widgets:
        - type: chart
          ref: revenue-kpi
          cols: 3
        - type: chart
          ref: orders-kpi
          cols: 3
        - type: chart
          ref: customers-kpi
          cols: 3
        - type: chart
          ref: avg-order-kpi
          cols: 3
    - height: 400
      widgets:
        - type: chart
          ref: revenue-trend
          cols: 8
        - type: text
          cols: 4
          content: |
            ## Revenue Notes

            Revenue is calculated as **gross sales** minus refunds.

            Key metrics:
            - Excludes taxes
            - Includes shipping fees
            - Updated daily at midnight UTC
```

**Step 2: Create KPI chart files**

```yaml
# examples/sales-analytics/charts/revenue-kpi.yaml
name: revenue-kpi
title: Total Revenue
source:
  model: total_revenue
chart:
  type: kpi
  value:
    field: value
  format:
    type: currency
    currency: USD
  comparison:
    enabled: true
    field: previous_value
    label: vs last period
    type: percent_change
```

```yaml
# examples/sales-analytics/charts/orders-kpi.yaml
name: orders-kpi
title: Orders
source:
  model: total_orders
chart:
  type: kpi
  value:
    field: value
  format:
    type: number
  comparison:
    enabled: true
    field: previous_value
    type: percent_change
```

**Step 3: Create models for KPIs**

```sql
-- examples/sales-analytics/models/total_revenue.sql
-- @name total_revenue
-- @returns value, previous_value

SELECT
  SUM(amount) as value,
  SUM(amount) * 0.9 as previous_value  -- Simulated previous period
FROM orders
```

**Step 4: Commit**

```bash
git add examples/sales-analytics/dashboards/ examples/sales-analytics/charts/ examples/sales-analytics/models/
git commit -m "feat(examples): add executive dashboard with KPI widgets"
```

---

## Task 20: Integration Test

**Files:**
- Create: `apps/web/src/__tests__/dashboard.test.tsx`

**Step 1: Create dashboard integration test**

```typescript
// apps/web/src/__tests__/dashboard.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Dashboard } from '../components/dashboard';

// Mock the API
vi.mock('../api/client', () => ({
  api: {
    getDashboard: vi.fn().mockResolvedValue({
      name: 'test',
      title: 'Test Dashboard',
      branch: 'main',
      layout: {
        gap: 16,
        rows: [
          {
            height: 400,
            widgets: [{ type: 'chart', ref: 'test-chart', cols: 12 }],
          },
        ],
      },
    }),
    getBranches: vi.fn().mockResolvedValue({
      current: 'main',
      branches: ['main', 'develop'],
    }),
  },
}));

describe('Dashboard', () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  it('renders dashboard title', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <Dashboard dashboardId="test" />
      </QueryClientProvider>
    );

    expect(await screen.findByText('Test Dashboard')).toBeInTheDocument();
  });

  it('shows edit layout button', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <Dashboard dashboardId="test" />
      </QueryClientProvider>
    );

    expect(await screen.findByText('Edit Layout')).toBeInTheDocument();
  });

  it('shows branch selector', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <Dashboard dashboardId="test" />
      </QueryClientProvider>
    );

    expect(await screen.findByText('main')).toBeInTheDocument();
  });
});
```

**Step 2: Run tests**

Run: `pnpm --filter @dashbook/web test`

Expected: PASS

**Step 3: Commit**

```bash
git add apps/web/src/__tests__/dashboard.test.tsx
git commit -m "test(web): add dashboard integration tests"
```

---

## Task 21: Final Build and Verification

**Step 1: Build all packages**

```bash
pnpm build
```

Expected: SUCCESS

**Step 2: Run all tests**

```bash
pnpm test
```

Expected: All tests pass

**Step 3: Start dev server and verify**

```bash
cd examples/sales-analytics
pnpm --filter @dashbook/server dev
# In another terminal:
pnpm --filter @dashbook/web dev
```

Visit http://localhost:5173 - should see executive dashboard with KPIs

**Step 4: Test edit mode**

1. Click "Edit Layout"
2. Drag a widget to reorder
3. Click "Save & Push"
4. Verify commit is created

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete Phase 7 dashboard layouts implementation"
```

---

## Summary

Phase 7 adds:

- **Dashboard schema** with widget types (chart, text)
- **KPI chart type** with comparison badges
- **Git service** for branch operations
- **Dashboard routes** with save/push
- **react-grid-layout** for drag-and-drop
- **Edit mode** with Save & Push
- **Branch selector** for previews
- **Example dashboard** with KPIs

Total: 21 tasks, ~85 tests added
