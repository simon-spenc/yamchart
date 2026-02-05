# Generate Command Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement `yamchart generate` command that creates SQL model stubs from dbt catalog.

**Architecture:** Detector analyzes columns → Variants generates stub content → Prompts confirms with user → Writer creates files.

**Tech Stack:** Commander.js, @inquirer/prompts, Vitest

---

## Task 1: Column Type Detector

**Files:**
- Create: `apps/cli/src/generate/detector.ts`
- Test: `apps/cli/src/__tests__/generate/detector.test.ts`

**Step 1: Write failing tests**

```typescript
import { describe, it, expect } from 'vitest';
import { detectColumnTypes } from '../../generate/detector.js';
import type { DbtColumn } from '../../dbt/types.js';

describe('detectColumnTypes', () => {
  it('detects date columns by type', () => {
    const columns: DbtColumn[] = [
      { name: 'order_date', data_type: 'date', description: '', hints: [] },
      { name: 'amount', data_type: 'numeric', description: '', hints: [] },
    ];
    const result = detectColumnTypes(columns);
    expect(result.dateColumns).toEqual(['order_date']);
  });

  it('detects date columns by name pattern', () => {
    const columns: DbtColumn[] = [
      { name: 'created_at', data_type: 'string', description: '', hints: [] },
      { name: 'updated_at', data_type: 'string', description: '', hints: [] },
    ];
    const result = detectColumnTypes(columns);
    expect(result.dateColumns).toContain('created_at');
    expect(result.dateColumns).toContain('updated_at');
  });

  it('detects metric columns (numeric, non-key)', () => {
    const columns: DbtColumn[] = [
      { name: 'id', data_type: 'integer', description: '', hints: ['primary_key'] },
      { name: 'amount', data_type: 'numeric', description: '', hints: [] },
      { name: 'quantity', data_type: 'integer', description: '', hints: [] },
    ];
    const result = detectColumnTypes(columns);
    expect(result.metricColumns).toEqual(['amount', 'quantity']);
    expect(result.metricColumns).not.toContain('id');
  });

  it('detects dimension columns', () => {
    const columns: DbtColumn[] = [
      { name: 'category', data_type: 'varchar', description: '', hints: [] },
      { name: 'region', data_type: 'string', description: '', hints: [] },
      { name: 'customer_id', data_type: 'string', description: '', hints: ['fk:customers'] },
    ];
    const result = detectColumnTypes(columns);
    expect(result.dimensionColumns).toContain('category');
    expect(result.dimensionColumns).toContain('region');
    expect(result.dimensionColumns).not.toContain('customer_id');
  });

  it('excludes foreign keys from dimensions', () => {
    const columns: DbtColumn[] = [
      { name: 'user_id', data_type: 'string', description: '', hints: ['fk:users'] },
    ];
    const result = detectColumnTypes(columns);
    expect(result.dimensionColumns).not.toContain('user_id');
  });
});
```

**Step 2: Run tests to verify failure**

```bash
pnpm --filter @yamchart/cli test src/__tests__/generate/detector.test.ts
```

**Step 3: Implement detector**

```typescript
// apps/cli/src/generate/detector.ts
import type { DbtColumn } from '../dbt/types.js';

export interface DetectedColumns {
  dateColumns: string[];
  metricColumns: string[];
  dimensionColumns: string[];
  primaryKeys: string[];
  foreignKeys: string[];
}

const DATE_TYPES = ['date', 'timestamp', 'datetime', 'timestamptz', 'timestamp_ntz'];
const NUMERIC_TYPES = ['int', 'integer', 'bigint', 'smallint', 'numeric', 'decimal', 'float', 'double', 'real', 'number'];
const STRING_TYPES = ['string', 'varchar', 'char', 'text', 'character varying'];

function isDateColumn(col: DbtColumn): boolean {
  const typeLower = (col.data_type || '').toLowerCase();
  if (DATE_TYPES.some(t => typeLower.includes(t))) return true;

  const nameLower = col.name.toLowerCase();
  return nameLower.endsWith('_at') || nameLower.endsWith('_date') || nameLower.endsWith('_time');
}

function isNumericColumn(col: DbtColumn): boolean {
  const typeLower = (col.data_type || '').toLowerCase();
  return NUMERIC_TYPES.some(t => typeLower.includes(t));
}

function isStringColumn(col: DbtColumn): boolean {
  const typeLower = (col.data_type || '').toLowerCase();
  return STRING_TYPES.some(t => typeLower.includes(t));
}

function isPrimaryKey(col: DbtColumn): boolean {
  if (col.hints.includes('primary_key') || col.hints.includes('unique')) return true;
  return col.name === 'id' || col.name.endsWith('_id');
}

function isForeignKey(col: DbtColumn): boolean {
  return col.hints.some(h => h.startsWith('fk:'));
}

export function detectColumnTypes(columns: DbtColumn[]): DetectedColumns {
  const dateColumns: string[] = [];
  const metricColumns: string[] = [];
  const dimensionColumns: string[] = [];
  const primaryKeys: string[] = [];
  const foreignKeys: string[] = [];

  for (const col of columns) {
    if (isPrimaryKey(col)) {
      primaryKeys.push(col.name);
      continue;
    }

    if (isForeignKey(col)) {
      foreignKeys.push(col.name);
      continue;
    }

    if (isDateColumn(col)) {
      dateColumns.push(col.name);
    } else if (isNumericColumn(col)) {
      metricColumns.push(col.name);
    } else if (isStringColumn(col)) {
      // Check for dimension-like names
      const nameLower = col.name.toLowerCase();
      const isDimensionName = ['category', 'type', 'status', 'region', 'country', 'state', 'name'].some(
        pattern => nameLower.includes(pattern)
      );
      if (isDimensionName || isStringColumn(col)) {
        dimensionColumns.push(col.name);
      }
    }
  }

  return { dateColumns, metricColumns, dimensionColumns, primaryKeys, foreignKeys };
}
```

**Step 4: Run tests to verify passing**

```bash
pnpm --filter @yamchart/cli test src/__tests__/generate/detector.test.ts
```

**Step 5: Commit**

```bash
git add apps/cli/src/generate/detector.ts apps/cli/src/__tests__/generate/detector.test.ts
git commit -m "feat(cli): add column type detector for generate command"
```

---

## Task 2: Variant Generator

**Files:**
- Create: `apps/cli/src/generate/variants.ts`
- Test: `apps/cli/src/__tests__/generate/variants.test.ts`

**Step 1: Write failing tests**

```typescript
import { describe, it, expect } from 'vitest';
import { generateVariants, type VariantConfig } from '../../generate/variants.js';

describe('generateVariants', () => {
  it('generates time series variant when date and metric exist', () => {
    const config: VariantConfig = {
      modelName: 'orders',
      tableName: 'analytics.orders',
      dateColumn: 'order_date',
      metricColumns: [{ name: 'amount', aggregation: 'sum' }],
      dimensionColumns: [],
    };
    const variants = generateVariants(config);

    const timeSeries = variants.find(v => v.name === 'orders_over_time');
    expect(timeSeries).toBeDefined();
    expect(timeSeries?.sql).toContain("date_trunc('{{ granularity }}'");
    expect(timeSeries?.sql).toContain('SUM(amount)');
  });

  it('generates dimension variant for each dimension', () => {
    const config: VariantConfig = {
      modelName: 'orders',
      tableName: 'analytics.orders',
      dateColumn: 'order_date',
      metricColumns: [{ name: 'amount', aggregation: 'sum' }],
      dimensionColumns: ['category', 'region'],
    };
    const variants = generateVariants(config);

    expect(variants.find(v => v.name === 'orders_by_category')).toBeDefined();
    expect(variants.find(v => v.name === 'orders_by_region')).toBeDefined();
  });

  it('generates KPI variant when metrics exist', () => {
    const config: VariantConfig = {
      modelName: 'orders',
      tableName: 'analytics.orders',
      dateColumn: 'order_date',
      metricColumns: [{ name: 'amount', aggregation: 'sum' }],
      dimensionColumns: [],
    };
    const variants = generateVariants(config);

    const kpi = variants.find(v => v.name === 'orders_kpi');
    expect(kpi).toBeDefined();
    expect(kpi?.sql).not.toContain('GROUP BY');
  });

  it('includes @generated comment with model name', () => {
    const config: VariantConfig = {
      modelName: 'orders',
      tableName: 'analytics.orders',
      dateColumn: null,
      metricColumns: [{ name: 'amount', aggregation: 'sum' }],
      dimensionColumns: [],
    };
    const variants = generateVariants(config);

    expect(variants[0].sql).toContain("@generated: from dbt model 'orders'");
  });
});
```

**Step 2: Run tests to verify failure**

```bash
pnpm --filter @yamchart/cli test src/__tests__/generate/variants.test.ts
```

**Step 3: Implement variant generator**

```typescript
// apps/cli/src/generate/variants.ts

export interface MetricColumn {
  name: string;
  aggregation: 'sum' | 'avg' | 'count' | 'min' | 'max';
}

export interface VariantConfig {
  modelName: string;
  tableName: string;
  dateColumn: string | null;
  metricColumns: MetricColumn[];
  dimensionColumns: string[];
}

export interface GeneratedVariant {
  name: string;
  filename: string;
  description: string;
  sql: string;
}

function formatDate(): string {
  return new Date().toISOString().split('T')[0];
}

function generateHeader(modelName: string, variantName: string, description: string, tableName: string): string {
  return `-- @generated: from dbt model '${modelName}' on ${formatDate()}
-- @name: ${variantName}
-- @description: ${description}
-- @source: ${tableName}

`;
}

function generateMetricSelects(metrics: MetricColumn[]): string {
  return metrics
    .map(m => `  ${m.aggregation.toUpperCase()}(${m.name}) AS ${m.aggregation}_${m.name}`)
    .join(',\n');
}

export function generateVariants(config: VariantConfig): GeneratedVariant[] {
  const variants: GeneratedVariant[] = [];
  const { modelName, tableName, dateColumn, metricColumns, dimensionColumns } = config;

  // Time series variant
  if (dateColumn && metricColumns.length > 0) {
    const name = `${modelName}_over_time`;
    const description = `${modelName} aggregated over time`;
    const sql = `${generateHeader(modelName, name, description, tableName)}SELECT
  date_trunc('{{ granularity }}', ${dateColumn}) AS period,
${generateMetricSelects(metricColumns)}
FROM ${tableName}
WHERE ${dateColumn} >= '{{ start_date }}'
  AND ${dateColumn} <= '{{ end_date }}'
GROUP BY 1
ORDER BY 1
`;
    variants.push({ name, filename: `${name}.sql`, description, sql });
  }

  // Dimension variants
  for (const dim of dimensionColumns) {
    const name = `${modelName}_by_${dim}`;
    const description = `${modelName} grouped by ${dim}`;
    let sql = generateHeader(modelName, name, description, tableName);
    sql += `SELECT
  ${dim},
${generateMetricSelects(metricColumns)}
FROM ${tableName}
`;
    if (dateColumn) {
      sql += `WHERE ${dateColumn} >= '{{ start_date }}'
  AND ${dateColumn} <= '{{ end_date }}'
`;
    }
    sql += `GROUP BY 1
ORDER BY 2 DESC
`;
    variants.push({ name, filename: `${name}.sql`, description, sql });
  }

  // KPI variant
  if (metricColumns.length > 0) {
    const name = `${modelName}_kpi`;
    const description = `${modelName} summary metrics`;
    let sql = generateHeader(modelName, name, description, tableName);
    sql += `SELECT
${generateMetricSelects(metricColumns)}
FROM ${tableName}
`;
    if (dateColumn) {
      sql += `WHERE ${dateColumn} >= '{{ start_date }}'
  AND ${dateColumn} <= '{{ end_date }}'
`;
    }
    variants.push({ name, filename: `${name}.sql`, description, sql });
  }

  return variants;
}
```

**Step 4: Run tests to verify passing**

```bash
pnpm --filter @yamchart/cli test src/__tests__/generate/variants.test.ts
```

**Step 5: Commit**

```bash
git add apps/cli/src/generate/variants.ts apps/cli/src/__tests__/generate/variants.test.ts
git commit -m "feat(cli): add variant generator for model stubs"
```

---

## Task 3: Stub File Writer

**Files:**
- Create: `apps/cli/src/generate/writer.ts`
- Test: `apps/cli/src/__tests__/generate/writer.test.ts`

**Step 1: Write failing tests**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeStub, stubExists } from '../../generate/writer.js';
import { mkdir, rm, readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const TEST_DIR = '/tmp/yamchart-writer-test';

describe('writer', () => {
  beforeEach(async () => {
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  it('writes stub file to models directory', async () => {
    await writeStub(TEST_DIR, 'orders_kpi.sql', 'SELECT 1');

    const content = await readFile(join(TEST_DIR, 'models', 'orders_kpi.sql'), 'utf-8');
    expect(content).toBe('SELECT 1');
  });

  it('creates models directory if missing', async () => {
    await writeStub(TEST_DIR, 'test.sql', 'SELECT 1');
    expect(existsSync(join(TEST_DIR, 'models'))).toBe(true);
  });

  it('stubExists returns true for existing file', async () => {
    await writeStub(TEST_DIR, 'existing.sql', 'SELECT 1');
    expect(await stubExists(TEST_DIR, 'existing.sql')).toBe(true);
  });

  it('stubExists returns false for missing file', async () => {
    expect(await stubExists(TEST_DIR, 'missing.sql')).toBe(false);
  });
});
```

**Step 2: Run tests to verify failure**

```bash
pnpm --filter @yamchart/cli test src/__tests__/generate/writer.test.ts
```

**Step 3: Implement writer**

```typescript
// apps/cli/src/generate/writer.ts
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export async function writeStub(projectDir: string, filename: string, content: string): Promise<void> {
  const modelsDir = join(projectDir, 'models');
  await mkdir(modelsDir, { recursive: true });
  await writeFile(join(modelsDir, filename), content, 'utf-8');
}

export async function stubExists(projectDir: string, filename: string): Promise<boolean> {
  return existsSync(join(projectDir, 'models', filename));
}
```

**Step 4: Run tests to verify passing**

```bash
pnpm --filter @yamchart/cli test src/__tests__/generate/writer.test.ts
```

**Step 5: Commit**

```bash
git add apps/cli/src/generate/writer.ts apps/cli/src/__tests__/generate/writer.test.ts
git commit -m "feat(cli): add stub file writer"
```

---

## Task 4: Interactive Prompts

**Files:**
- Create: `apps/cli/src/generate/prompts.ts`
- Test: `apps/cli/src/__tests__/generate/prompts.test.ts`

**Step 1: Add dependency**

```bash
cd apps/cli && pnpm add @inquirer/prompts
```

**Step 2: Write tests for prompt config builders**

```typescript
import { describe, it, expect } from 'vitest';
import { buildDateColumnChoices, buildMetricChoices, buildDimensionChoices } from '../../generate/prompts.js';
import type { DetectedColumns } from '../../generate/detector.js';

describe('prompt builders', () => {
  it('buildDateColumnChoices includes detected columns plus skip option', () => {
    const detected: DetectedColumns = {
      dateColumns: ['order_date', 'created_at'],
      metricColumns: [],
      dimensionColumns: [],
      primaryKeys: [],
      foreignKeys: [],
    };
    const choices = buildDateColumnChoices(detected);

    expect(choices).toHaveLength(3); // 2 columns + skip
    expect(choices[0]).toEqual({ name: 'order_date', value: 'order_date', checked: true });
    expect(choices[2]).toEqual({ name: 'Skip time series', value: null, checked: false });
  });

  it('buildMetricChoices includes aggregation type', () => {
    const detected: DetectedColumns = {
      dateColumns: [],
      metricColumns: ['amount', 'quantity'],
      dimensionColumns: [],
      primaryKeys: [],
      foreignKeys: [],
    };
    const choices = buildMetricChoices(detected);

    expect(choices).toHaveLength(2);
    expect(choices[0].value).toEqual({ name: 'amount', aggregation: 'sum' });
  });

  it('buildDimensionChoices returns dimension columns', () => {
    const detected: DetectedColumns = {
      dateColumns: [],
      metricColumns: [],
      dimensionColumns: ['category', 'region'],
      primaryKeys: [],
      foreignKeys: [],
    };
    const choices = buildDimensionChoices(detected);

    expect(choices).toHaveLength(2);
    expect(choices[0]).toEqual({ name: 'category', value: 'category', checked: true });
  });
});
```

**Step 3: Implement prompt helpers**

```typescript
// apps/cli/src/generate/prompts.ts
import { confirm, select, checkbox } from '@inquirer/prompts';
import type { DetectedColumns } from './detector.js';
import type { MetricColumn } from './variants.js';

export interface DateColumnChoice {
  name: string;
  value: string | null;
  checked: boolean;
}

export interface MetricChoice {
  name: string;
  value: MetricColumn;
  checked: boolean;
}

export interface DimensionChoice {
  name: string;
  value: string;
  checked: boolean;
}

export function buildDateColumnChoices(detected: DetectedColumns): DateColumnChoice[] {
  const choices: DateColumnChoice[] = detected.dateColumns.map((col, i) => ({
    name: col,
    value: col,
    checked: i === 0, // First one is default
  }));
  choices.push({ name: 'Skip time series', value: null, checked: false });
  return choices;
}

export function buildMetricChoices(detected: DetectedColumns): MetricChoice[] {
  return detected.metricColumns.map(col => ({
    name: `${col} (sum)`,
    value: { name: col, aggregation: 'sum' as const },
    checked: true,
  }));
}

export function buildDimensionChoices(detected: DetectedColumns): DimensionChoice[] {
  return detected.dimensionColumns.map(col => ({
    name: col,
    value: col,
    checked: true,
  }));
}

export async function promptDateColumn(modelName: string, detected: DetectedColumns): Promise<string | null> {
  if (detected.dateColumns.length === 0) return null;

  const defaultCol = detected.dateColumns[0];
  const confirmed = await confirm({
    message: `${modelName}: Use '${defaultCol}' for time series?`,
    default: true,
  });

  if (confirmed) return defaultCol;

  if (detected.dateColumns.length === 1) return null;

  return select({
    message: 'Select date column:',
    choices: buildDateColumnChoices(detected).map(c => ({ name: c.name, value: c.value })),
  });
}

export async function promptMetrics(modelName: string, detected: DetectedColumns): Promise<MetricColumn[]> {
  if (detected.metricColumns.length === 0) return [];

  const choices = buildMetricChoices(detected);
  const selected = await checkbox({
    message: `${modelName}: Select metrics to aggregate:`,
    choices: choices.map(c => ({ name: c.name, value: c.value, checked: c.checked })),
  });

  return selected;
}

export async function promptDimensions(modelName: string, detected: DetectedColumns): Promise<string[]> {
  if (detected.dimensionColumns.length === 0) return [];

  const choices = buildDimensionChoices(detected);
  const selected = await checkbox({
    message: `${modelName}: Select dimensions for grouping:`,
    choices: choices.map(c => ({ name: c.name, value: c.value, checked: c.checked })),
  });

  return selected;
}

export async function promptConfirmVariants(modelName: string, variantNames: string[]): Promise<string[]> {
  const choices = variantNames.map(name => ({ name, value: name, checked: true }));

  return checkbox({
    message: `${modelName}: Generate these stubs?`,
    choices,
  });
}

export async function promptOverwrite(filename: string): Promise<'overwrite' | 'skip' | 'rename'> {
  return select({
    message: `${filename} already exists:`,
    choices: [
      { name: 'Overwrite', value: 'overwrite' as const },
      { name: 'Skip', value: 'skip' as const },
      { name: 'Rename (add suffix)', value: 'rename' as const },
    ],
  });
}
```

**Step 4: Run tests**

```bash
pnpm --filter @yamchart/cli test src/__tests__/generate/prompts.test.ts
```

**Step 5: Commit**

```bash
git add apps/cli/src/generate/prompts.ts apps/cli/src/__tests__/generate/prompts.test.ts apps/cli/package.json pnpm-lock.yaml
git commit -m "feat(cli): add interactive prompt helpers for generate"
```

---

## Task 5: Generate Command Handler

**Files:**
- Create: `apps/cli/src/commands/generate.ts`
- Test: `apps/cli/src/__tests__/generate/generate.test.ts`

**Step 1: Write tests**

```typescript
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
```

**Step 2: Implement command handler**

```typescript
// apps/cli/src/commands/generate.ts
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import type { CatalogData, CatalogModel } from '../dbt/catalog.js';
import { detectColumnTypes } from '../generate/detector.js';
import { generateVariants, type MetricColumn } from '../generate/variants.js';
import { writeStub, stubExists } from '../generate/writer.js';
import {
  promptDateColumn,
  promptMetrics,
  promptDimensions,
  promptConfirmVariants,
  promptOverwrite,
} from '../generate/prompts.js';

export interface GenerateOptions {
  model?: string;
  yolo?: boolean;
}

export interface GenerateResult {
  success: boolean;
  error?: string;
  modelsProcessed: number;
  filesCreated: number;
  filesSkipped: number;
}

async function loadCatalog(projectDir: string): Promise<CatalogData | null> {
  const catalogPath = join(projectDir, '.yamchart', 'catalog.json');
  if (!existsSync(catalogPath)) return null;

  const content = await readFile(catalogPath, 'utf-8');
  return JSON.parse(content);
}

async function processModel(
  projectDir: string,
  model: CatalogModel,
  yolo: boolean
): Promise<{ created: number; skipped: number }> {
  const detected = detectColumnTypes(model.columns);

  let dateColumn: string | null;
  let metrics: MetricColumn[];
  let dimensions: string[];

  if (yolo) {
    // Use all defaults
    dateColumn = detected.dateColumns[0] || null;
    metrics = detected.metricColumns.map(name => ({ name, aggregation: 'sum' as const }));
    dimensions = detected.dimensionColumns;
  } else {
    // Interactive prompts
    dateColumn = await promptDateColumn(model.name, detected);
    metrics = await promptMetrics(model.name, detected);
    dimensions = await promptDimensions(model.name, detected);
  }

  if (metrics.length === 0) {
    return { created: 0, skipped: 0 };
  }

  const variants = generateVariants({
    modelName: model.name,
    tableName: model.table || model.name,
    dateColumn,
    metricColumns: metrics,
    dimensionColumns: dimensions,
  });

  let confirmedVariants = variants;
  if (!yolo && variants.length > 0) {
    const selected = await promptConfirmVariants(
      model.name,
      variants.map(v => v.name)
    );
    confirmedVariants = variants.filter(v => selected.includes(v.name));
  }

  let created = 0;
  let skipped = 0;

  for (const variant of confirmedVariants) {
    const exists = await stubExists(projectDir, variant.filename);

    if (exists && !yolo) {
      const action = await promptOverwrite(variant.filename);
      if (action === 'skip') {
        skipped++;
        continue;
      }
      if (action === 'rename') {
        variant.filename = variant.filename.replace('.sql', '_new.sql');
      }
    }

    await writeStub(projectDir, variant.filename, variant.sql);
    created++;
  }

  return { created, skipped };
}

export async function generate(
  projectDir: string,
  options: GenerateOptions
): Promise<GenerateResult> {
  const catalog = await loadCatalog(projectDir);

  if (!catalog) {
    return {
      success: false,
      error: 'catalog.json not found. Run `yamchart sync-dbt` first.',
      modelsProcessed: 0,
      filesCreated: 0,
      filesSkipped: 0,
    };
  }

  let models = catalog.models;

  if (options.model) {
    models = models.filter(m => m.name === options.model);
    if (models.length === 0) {
      return {
        success: false,
        error: `Model '${options.model}' not found in catalog`,
        modelsProcessed: 0,
        filesCreated: 0,
        filesSkipped: 0,
      };
    }
  }

  let totalCreated = 0;
  let totalSkipped = 0;

  for (const model of models) {
    const { created, skipped } = await processModel(
      projectDir,
      model,
      options.yolo ?? false
    );
    totalCreated += created;
    totalSkipped += skipped;
  }

  return {
    success: true,
    modelsProcessed: models.length,
    filesCreated: totalCreated,
    filesSkipped: totalSkipped,
  };
}
```

**Step 3: Run tests**

```bash
pnpm --filter @yamchart/cli test src/__tests__/generate/generate.test.ts
```

**Step 4: Commit**

```bash
git add apps/cli/src/commands/generate.ts apps/cli/src/__tests__/generate/generate.test.ts
git commit -m "feat(cli): add generate command handler"
```

---

## Task 6: Wire Up CLI

**Files:**
- Modify: `apps/cli/src/index.ts`

**Step 1: Add generate command to CLI**

Add after the sync-dbt command:

```typescript
program
  .command('generate')
  .description('Generate SQL model stubs from dbt catalog')
  .argument('[model]', 'Specific model to generate (optional)')
  .option('--yolo', 'Skip all prompts, use defaults for everything')
  .action(async (model: string | undefined, options: { yolo?: boolean }) => {
    const { generate } = await import('./commands/generate.js');

    const projectDir = await findProjectRoot(process.cwd());

    if (!projectDir) {
      output.error('yamchart.yaml not found');
      output.detail('Run this command from a yamchart project directory');
      process.exit(2);
    }

    const result = await generate(projectDir, {
      model,
      yolo: options.yolo,
    });

    if (!result.success) {
      output.error(result.error || 'Generate failed');
      process.exit(1);
    }

    output.success(`Generated ${result.filesCreated} model stubs`);
    if (result.filesSkipped > 0) {
      output.detail(`${result.filesSkipped} files skipped`);
    }
  });
```

**Step 2: Test manually**

```bash
cd examples && npx yamchart generate --yolo
```

**Step 3: Commit**

```bash
git add apps/cli/src/index.ts
git commit -m "feat(cli): wire up generate command"
```

---

## Task 7: Add Barrel Export

**Files:**
- Create: `apps/cli/src/generate/index.ts`

**Step 1: Create barrel export**

```typescript
// apps/cli/src/generate/index.ts
export * from './detector.js';
export * from './variants.js';
export * from './writer.js';
export * from './prompts.js';
```

**Step 2: Commit**

```bash
git add apps/cli/src/generate/index.ts
git commit -m "chore(cli): add generate module barrel export"
```

---

## Task 8: Update Documentation

**Files:**
- Modify: `docs/getting-started.md`
- Modify: `README.md`
- Modify: `docs/plans/STATUS.md`

**Step 1: Add generate section to getting-started.md**

Add after the dbt sync section:

```markdown
## Generating Model Stubs

After syncing dbt metadata, generate SQL model stubs to help AI tools write better charts:

\`\`\`bash
# Interactive wizard - walks through each model
yamchart generate

# Generate for a specific model
yamchart generate orders

# Skip prompts, use all defaults
yamchart generate --yolo
\`\`\`

This creates SQL files in `models/` with:
- Time series variants (`orders_over_time.sql`)
- Dimension breakdowns (`orders_by_category.sql`)
- KPI metrics (`orders_kpi.sql`)

Each stub includes `@generated` comments linking back to the dbt source.
```

**Step 2: Update README.md dbt section**

Add generate command example after sync-dbt.

**Step 3: Update STATUS.md**

Add new section for Generate Command.

**Step 4: Commit**

```bash
git add docs/getting-started.md README.md docs/plans/STATUS.md
git commit -m "docs: add generate command documentation"
```

---

## Task 9: Integration Test

**Files:**
- Create: `apps/cli/src/__tests__/generate-integration.test.ts`

**Step 1: Write integration test**

```typescript
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
    expect(sql).toContain('SUM(amount)');
  });

  it('generated SQL excludes primary and foreign keys', async () => {
    await generate(TEST_DIR, { yolo: true });

    const sql = await readFile(join(TEST_DIR, 'models', 'orders_kpi.sql'), 'utf-8');

    expect(sql).not.toContain('order_id');
    expect(sql).not.toContain('customer_id');
    expect(sql).toContain('amount');
  });
});
```

**Step 2: Run integration test**

```bash
pnpm --filter @yamchart/cli test src/__tests__/generate-integration.test.ts
```

**Step 3: Commit**

```bash
git add apps/cli/src/__tests__/generate-integration.test.ts
git commit -m "test(cli): add generate command integration tests"
```

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Column type detector |
| 2 | Variant generator |
| 3 | Stub file writer |
| 4 | Interactive prompts |
| 5 | Generate command handler |
| 6 | Wire up CLI |
| 7 | Barrel export |
| 8 | Documentation |
| 9 | Integration tests |

After completing all tasks, run full test suite:

```bash
pnpm --filter @yamchart/cli test
```
