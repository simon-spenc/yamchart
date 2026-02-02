# Dashbook CLI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the `dashbook` CLI with `dev` and `validate` commands for local development and CI/CD validation.

**Architecture:** Commander.js CLI that reuses `@dashbook/server` for dev mode and `@dashbook/schema` + `@dashbook/query` for validation. Bundled with tsup, includes pre-built web UI. Environment variable resolution via dotenv.

**Tech Stack:** Commander.js, tsup, dotenv, picocolors, ora (spinners)

**Prerequisites:** Design document at `docs/plans/2026-02-01-cli-design.md`

---

## Task 1: Create CLI Package Structure

**Files:**
- Create: `apps/cli/package.json`
- Create: `apps/cli/tsconfig.json`
- Create: `apps/cli/src/index.ts`
- Create: `apps/cli/bin/dashbook`

**Step 1: Create apps/cli/package.json**

```json
{
  "name": "dashbook",
  "version": "0.1.0",
  "description": "Git-native business intelligence dashboards",
  "type": "module",
  "bin": {
    "dashbook": "./bin/dashbook"
  },
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@dashbook/query": "workspace:*",
    "@dashbook/schema": "workspace:*",
    "@dashbook/server": "workspace:*",
    "commander": "^12.1.0",
    "dotenv": "^16.4.0",
    "ora": "^8.0.0",
    "picocolors": "^1.1.0"
  },
  "devDependencies": {
    "@dashbook/config": "workspace:*",
    "@types/node": "^22.0.0",
    "tsup": "^8.0.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.0"
  },
  "files": [
    "dist",
    "bin"
  ]
}
```

**Step 2: Create apps/cli/tsconfig.json**

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

**Step 3: Create apps/cli/tsup.config.ts**

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
});
```

**Step 4: Create apps/cli/bin/dashbook**

```bash
#!/usr/bin/env node
import('../dist/index.js');
```

**Step 5: Create apps/cli/src/index.ts**

```typescript
#!/usr/bin/env node
import { Command } from 'commander';

const program = new Command();

program
  .name('dashbook')
  .description('Git-native business intelligence dashboards')
  .version('0.1.0');

program.parse();
```

**Step 6: Install dependencies**

Run: `pnpm install`

**Step 7: Build and verify**

Run: `pnpm --filter dashbook build`

Expected: Build succeeds, `apps/cli/dist/index.js` created.

**Step 8: Test CLI runs**

Run: `node apps/cli/bin/dashbook --help`

Expected: Shows help text with name and description.

**Step 9: Commit**

```bash
git add apps/cli/
git commit -m "chore(cli): add CLI package structure with Commander.js"
```

---

## Task 2: Add Output Utilities

**Files:**
- Create: `apps/cli/src/utils/output.ts`

**Step 1: Create apps/cli/src/utils/output.ts**

```typescript
import pc from 'picocolors';
import ora, { type Ora } from 'ora';

export const symbols = {
  success: pc.green('✓'),
  error: pc.red('✗'),
  warning: pc.yellow('⚠'),
  info: pc.blue('ℹ'),
  arrow: pc.dim('→'),
};

export function success(message: string): void {
  console.log(`${symbols.success} ${message}`);
}

export function error(message: string): void {
  console.log(`${symbols.error} ${message}`);
}

export function warning(message: string): void {
  console.log(`${symbols.warning} ${message}`);
}

export function info(message: string): void {
  console.log(`${symbols.info} ${message}`);
}

export function detail(message: string): void {
  console.log(`  ${symbols.arrow} ${message}`);
}

export function newline(): void {
  console.log();
}

export function header(title: string): void {
  console.log(pc.bold(title));
  newline();
}

export function spinner(text: string): Ora {
  return ora({ text, color: 'cyan' }).start();
}

export function box(lines: string[]): void {
  const maxLength = Math.max(...lines.map((l) => l.length));
  const width = maxLength + 4;
  const border = '─'.repeat(width);

  console.log(`  ┌${border}┐`);
  for (const line of lines) {
    const padding = ' '.repeat(maxLength - line.length);
    console.log(`  │  ${line}${padding}  │`);
  }
  console.log(`  └${border}┘`);
}
```

**Step 2: Commit**

```bash
git add apps/cli/src/utils/
git commit -m "feat(cli): add output utilities with colors and spinners"
```

---

## Task 3: Add Config Resolution Utilities

**Files:**
- Create: `apps/cli/src/utils/config.ts`
- Create: `apps/cli/src/__tests__/config.test.ts`

**Step 1: Write failing test for config resolution**

Create `apps/cli/src/__tests__/config.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { findProjectRoot, resolveEnvVars } from '../utils/config.js';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('findProjectRoot', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `dashbook-cli-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('finds dashbook.yaml in current directory', async () => {
    await writeFile(join(testDir, 'dashbook.yaml'), 'version: "1.0"\nname: test');

    const result = await findProjectRoot(testDir);
    expect(result).toBe(testDir);
  });

  it('finds dashbook.yaml in parent directory', async () => {
    await writeFile(join(testDir, 'dashbook.yaml'), 'version: "1.0"\nname: test');
    const subDir = join(testDir, 'sub');
    await mkdir(subDir);

    const result = await findProjectRoot(subDir);
    expect(result).toBe(testDir);
  });

  it('returns null when no dashbook.yaml found', async () => {
    const result = await findProjectRoot(testDir);
    expect(result).toBeNull();
  });
});

describe('resolveEnvVars', () => {
  it('resolves ${VAR} syntax from environment', () => {
    process.env.TEST_VAR = 'resolved_value';
    const result = resolveEnvVars('prefix_${TEST_VAR}_suffix');
    expect(result).toBe('prefix_resolved_value_suffix');
    delete process.env.TEST_VAR;
  });

  it('resolves multiple variables', () => {
    process.env.VAR1 = 'one';
    process.env.VAR2 = 'two';
    const result = resolveEnvVars('${VAR1} and ${VAR2}');
    expect(result).toBe('one and two');
    delete process.env.VAR1;
    delete process.env.VAR2;
  });

  it('throws on undefined variable', () => {
    expect(() => resolveEnvVars('${UNDEFINED_VAR}')).toThrow('UNDEFINED_VAR');
  });

  it('returns string unchanged if no variables', () => {
    const result = resolveEnvVars('no variables here');
    expect(result).toBe('no variables here');
  });
});
```

**Step 2: Create vitest config**

Create `apps/cli/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
});
```

**Step 3: Run test to verify it fails**

Run: `pnpm --filter dashbook test`

Expected: FAIL - cannot find module '../utils/config.js'

**Step 4: Implement config utilities**

Create `apps/cli/src/utils/config.ts`:

```typescript
import { access } from 'fs/promises';
import { join, dirname, resolve } from 'path';
import { config as loadDotenv } from 'dotenv';

/**
 * Find the project root by looking for dashbook.yaml.
 * Searches current directory and parent directories.
 */
export async function findProjectRoot(startDir: string): Promise<string | null> {
  let currentDir = resolve(startDir);
  const root = dirname(currentDir);

  while (currentDir !== root) {
    const configPath = join(currentDir, 'dashbook.yaml');
    try {
      await access(configPath);
      return currentDir;
    } catch {
      currentDir = dirname(currentDir);
    }
  }

  // Check root directory too
  try {
    await access(join(root, 'dashbook.yaml'));
    return root;
  } catch {
    return null;
  }
}

/**
 * Load .env file from project directory.
 */
export function loadEnvFile(projectDir: string): void {
  loadDotenv({ path: join(projectDir, '.env') });
}

/**
 * Resolve ${VAR} syntax in a string from environment variables.
 */
export function resolveEnvVars(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (match, varName) => {
    const envValue = process.env[varName];
    if (envValue === undefined) {
      throw new Error(`Environment variable not found: ${varName}`);
    }
    return envValue;
  });
}

/**
 * Recursively resolve env vars in an object.
 */
export function resolveEnvVarsInObject<T>(obj: T): T {
  if (typeof obj === 'string') {
    return resolveEnvVars(obj) as T;
  }
  if (Array.isArray(obj)) {
    return obj.map(resolveEnvVarsInObject) as T;
  }
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = resolveEnvVarsInObject(value);
    }
    return result as T;
  }
  return obj;
}
```

**Step 5: Run tests to verify they pass**

Run: `pnpm --filter dashbook test`

Expected: All tests pass.

**Step 6: Commit**

```bash
git add apps/cli/
git commit -m "feat(cli): add config resolution utilities with env var support"
```

---

## Task 4: Implement Validate Command - Schema Phase

**Files:**
- Create: `apps/cli/src/commands/validate.ts`
- Create: `apps/cli/src/__tests__/validate.test.ts`
- Modify: `apps/cli/src/index.ts`

**Step 1: Write failing test for validate command**

Create `apps/cli/src/__tests__/validate.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { validateProject, type ValidationResult } from '../commands/validate.js';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('validateProject', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `dashbook-validate-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    await mkdir(join(testDir, 'connections'), { recursive: true });
    await mkdir(join(testDir, 'models'), { recursive: true });
    await mkdir(join(testDir, 'charts'), { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('passes with valid minimal config', async () => {
    await writeFile(
      join(testDir, 'dashbook.yaml'),
      'version: "1.0"\nname: test-project'
    );

    const result = await validateProject(testDir, { dryRun: false });

    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('fails when dashbook.yaml is missing', async () => {
    const result = await validateProject(testDir, { dryRun: false });

    expect(result.success).toBe(false);
    expect(result.errors[0].message).toContain('dashbook.yaml');
  });

  it('fails with invalid YAML syntax', async () => {
    await writeFile(
      join(testDir, 'dashbook.yaml'),
      'invalid: yaml: content:'
    );

    const result = await validateProject(testDir, { dryRun: false });

    expect(result.success).toBe(false);
  });

  it('fails when chart references non-existent model', async () => {
    await writeFile(
      join(testDir, 'dashbook.yaml'),
      'version: "1.0"\nname: test'
    );
    await writeFile(
      join(testDir, 'charts', 'bad-chart.yaml'),
      `
name: bad-chart
title: Bad Chart
source:
  model: nonexistent_model
chart:
  type: line
  x:
    field: date
    type: temporal
  y:
    field: value
    type: quantitative
`
    );

    const result = await validateProject(testDir, { dryRun: false });

    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.message.includes('nonexistent_model'))).toBe(true);
  });

  it('passes when chart references existing model', async () => {
    await writeFile(
      join(testDir, 'dashbook.yaml'),
      'version: "1.0"\nname: test'
    );
    await writeFile(
      join(testDir, 'models', 'revenue.sql'),
      `-- @name: monthly_revenue
SELECT * FROM orders`
    );
    await writeFile(
      join(testDir, 'charts', 'revenue-trend.yaml'),
      `
name: revenue-trend
title: Revenue Trend
source:
  model: monthly_revenue
chart:
  type: line
  x:
    field: date
    type: temporal
  y:
    field: value
    type: quantitative
`
    );

    const result = await validateProject(testDir, { dryRun: false });

    expect(result.success).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter dashbook test`

Expected: FAIL - cannot find module '../commands/validate.js'

**Step 3: Implement validate command**

Create `apps/cli/src/commands/validate.ts`:

```typescript
import { readFile, readdir, access } from 'fs/promises';
import { join, extname, relative } from 'path';
import { parse as parseYaml } from 'yaml';
import {
  ProjectSchema,
  ConnectionSchema,
  ChartSchema,
  DashboardSchema,
} from '@dashbook/schema';
import { parseModelMetadata } from '@dashbook/query';

export interface ValidationError {
  file: string;
  line?: number;
  message: string;
  suggestion?: string;
}

export interface ValidationResult {
  success: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  stats: {
    files: number;
    passed: number;
    failed: number;
  };
}

export interface ValidateOptions {
  dryRun: boolean;
  connection?: string;
}

interface LoadedConfig {
  project: { name: string; version: string; defaults?: { connection?: string } } | null;
  connections: Map<string, { name: string; type: string }>;
  models: Map<string, { name: string; sql: string }>;
  charts: Map<string, { name: string; source: { model?: string; sql?: string } }>;
  dashboards: Map<string, { name: string; layout: unknown }>;
}

export async function validateProject(
  projectDir: string,
  options: ValidateOptions
): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  let filesChecked = 0;
  let filesPassed = 0;

  const config: LoadedConfig = {
    project: null,
    connections: new Map(),
    models: new Map(),
    charts: new Map(),
    dashboards: new Map(),
  };

  // Phase 1: Schema validation

  // Validate dashbook.yaml
  const projectPath = join(projectDir, 'dashbook.yaml');
  try {
    await access(projectPath);
    filesChecked++;
    const content = await readFile(projectPath, 'utf-8');
    const parsed = parseYaml(content);
    const result = ProjectSchema.safeParse(parsed);

    if (result.success) {
      config.project = result.data;
      filesPassed++;
    } else {
      errors.push({
        file: 'dashbook.yaml',
        message: `Invalid schema: ${result.error.errors[0]?.message || 'Unknown error'}`,
      });
    }
  } catch {
    errors.push({
      file: 'dashbook.yaml',
      message: 'dashbook.yaml not found',
    });
    return {
      success: false,
      errors,
      warnings,
      stats: { files: filesChecked, passed: filesPassed, failed: filesChecked - filesPassed },
    };
  }

  // Validate connections
  const connectionsDir = join(projectDir, 'connections');
  try {
    await access(connectionsDir);
    const files = await readdir(connectionsDir);

    for (const file of files) {
      if (extname(file) !== '.yaml' && extname(file) !== '.yml') continue;
      filesChecked++;

      const filePath = join(connectionsDir, file);
      const content = await readFile(filePath, 'utf-8');
      const parsed = parseYaml(content);
      const result = ConnectionSchema.safeParse(parsed);

      if (result.success) {
        config.connections.set(result.data.name, result.data);
        filesPassed++;
      } else {
        errors.push({
          file: `connections/${file}`,
          message: `Invalid schema: ${result.error.errors[0]?.message || 'Unknown error'}`,
        });
      }
    }
  } catch {
    // No connections directory is ok
  }

  // Validate models
  const modelsDir = join(projectDir, 'models');
  try {
    await access(modelsDir);
    await validateModelsDir(modelsDir, projectDir, config, errors, { filesChecked, filesPassed });
  } catch {
    // No models directory is ok
  }

  // Validate charts
  const chartsDir = join(projectDir, 'charts');
  try {
    await access(chartsDir);
    const files = await readdir(chartsDir);

    for (const file of files) {
      if (extname(file) !== '.yaml' && extname(file) !== '.yml') continue;
      filesChecked++;

      const filePath = join(chartsDir, file);
      const content = await readFile(filePath, 'utf-8');
      const parsed = parseYaml(content);
      const result = ChartSchema.safeParse(parsed);

      if (result.success) {
        config.charts.set(result.data.name, result.data);
        filesPassed++;
      } else {
        errors.push({
          file: `charts/${file}`,
          message: `Invalid schema: ${result.error.errors[0]?.message || 'Unknown error'}`,
        });
      }
    }
  } catch {
    // No charts directory is ok
  }

  // Validate dashboards
  const dashboardsDir = join(projectDir, 'dashboards');
  try {
    await access(dashboardsDir);
    const files = await readdir(dashboardsDir);

    for (const file of files) {
      if (extname(file) !== '.yaml' && extname(file) !== '.yml') continue;
      filesChecked++;

      const filePath = join(dashboardsDir, file);
      const content = await readFile(filePath, 'utf-8');
      const parsed = parseYaml(content);
      const result = DashboardSchema.safeParse(parsed);

      if (result.success) {
        config.dashboards.set(result.data.name, result.data);
        filesPassed++;
      } else {
        errors.push({
          file: `dashboards/${file}`,
          message: `Invalid schema: ${result.error.errors[0]?.message || 'Unknown error'}`,
        });
      }
    }
  } catch {
    // No dashboards directory is ok
  }

  // Phase 2: Cross-reference validation
  crossReferenceValidation(config, errors, warnings);

  return {
    success: errors.length === 0,
    errors,
    warnings,
    stats: {
      files: filesChecked,
      passed: filesPassed,
      failed: filesChecked - filesPassed,
    },
  };
}

async function validateModelsDir(
  dir: string,
  projectDir: string,
  config: LoadedConfig,
  errors: ValidationError[],
  stats: { filesChecked: number; filesPassed: number }
): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      await validateModelsDir(fullPath, projectDir, config, errors, stats);
    } else if (extname(entry.name) === '.sql') {
      stats.filesChecked++;
      const relPath = relative(projectDir, fullPath);
      const content = await readFile(fullPath, 'utf-8');

      try {
        const parsed = parseModelMetadata(content);
        config.models.set(parsed.name, { name: parsed.name, sql: parsed.sql });
        stats.filesPassed++;
      } catch (err) {
        errors.push({
          file: relPath,
          message: err instanceof Error ? err.message : 'Failed to parse model',
        });
      }
    }
  }
}

function crossReferenceValidation(
  config: LoadedConfig,
  errors: ValidationError[],
  warnings: ValidationError[]
): void {
  // Check that charts reference existing models
  for (const [chartName, chart] of config.charts) {
    if (chart.source.model && !config.models.has(chart.source.model)) {
      const suggestion = findSimilar(chart.source.model, Array.from(config.models.keys()));
      errors.push({
        file: `charts/${chartName}.yaml`,
        message: `Unknown model reference "${chart.source.model}"`,
        suggestion: suggestion ? `Did you mean "${suggestion}"?` : undefined,
      });
    }
  }

  // Check that default connection exists
  if (config.project?.defaults?.connection) {
    const connName = config.project.defaults.connection;
    if (!config.connections.has(connName)) {
      const suggestion = findSimilar(connName, Array.from(config.connections.keys()));
      errors.push({
        file: 'dashbook.yaml',
        message: `Default connection "${connName}" not found`,
        suggestion: suggestion ? `Did you mean "${suggestion}"?` : undefined,
      });
    }
  }
}

function findSimilar(target: string, candidates: string[]): string | null {
  const threshold = 3; // Levenshtein distance threshold

  for (const candidate of candidates) {
    if (levenshtein(target.toLowerCase(), candidate.toLowerCase()) <= threshold) {
      return candidate;
    }
  }
  return null;
}

function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0]![j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i]![j] = matrix[i - 1]![j - 1]!;
      } else {
        matrix[i]![j] = Math.min(
          matrix[i - 1]![j - 1]! + 1,
          matrix[i]![j - 1]! + 1,
          matrix[i - 1]![j]! + 1
        );
      }
    }
  }

  return matrix[b.length]![a.length]!;
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm --filter dashbook test`

Expected: All tests pass.

**Step 5: Commit**

```bash
git add apps/cli/src/
git commit -m "feat(cli): add validate command with schema and cross-reference validation"
```

---

## Task 5: Wire Up Validate Command to CLI

**Files:**
- Modify: `apps/cli/src/index.ts`

**Step 1: Update index.ts to add validate command**

Update `apps/cli/src/index.ts`:

```typescript
#!/usr/bin/env node
import { Command } from 'commander';
import { resolve } from 'path';
import { validateProject } from './commands/validate.js';
import { findProjectRoot, loadEnvFile } from './utils/config.js';
import * as output from './utils/output.js';

const program = new Command();

program
  .name('dashbook')
  .description('Git-native business intelligence dashboards')
  .version('0.1.0');

program
  .command('validate')
  .description('Validate configuration files')
  .argument('[path]', 'Path to dashbook project', '.')
  .option('--dry-run', 'Connect to database and test queries with EXPLAIN')
  .option('-c, --connection <name>', 'Connection to use for dry-run')
  .option('--json', 'Output as JSON')
  .action(async (path: string, options: { dryRun?: boolean; connection?: string; json?: boolean }) => {
    const startPath = resolve(path);
    const projectDir = await findProjectRoot(startPath);

    if (!projectDir) {
      if (options.json) {
        console.log(JSON.stringify({ success: false, error: 'dashbook.yaml not found' }));
      } else {
        output.error('dashbook.yaml not found');
        output.detail('Run this command from a dashbook project directory');
      }
      process.exit(2);
    }

    // Load .env file
    loadEnvFile(projectDir);

    if (!options.json) {
      output.header('Validating dashbook project...');
    }

    const result = await validateProject(projectDir, {
      dryRun: options.dryRun ?? false,
      connection: options.connection,
    });

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      // Print results
      for (const error of result.errors) {
        output.error(error.file);
        output.detail(error.message);
        if (error.suggestion) {
          output.detail(error.suggestion);
        }
      }

      for (const warning of result.warnings) {
        output.warning(warning.file);
        output.detail(warning.message);
      }

      output.newline();

      if (result.success) {
        output.success(`Schema: ${result.stats.passed} passed`);
      } else {
        output.error(`Schema: ${result.stats.passed} passed, ${result.stats.failed} failed`);
      }

      output.newline();

      if (result.success) {
        output.success('Validation passed');
      } else {
        output.error(`Validation failed with ${result.errors.length} error(s)`);
      }
    }

    process.exit(result.success ? 0 : 1);
  });

program.parse();
```

**Step 2: Build and test manually**

Run: `pnpm --filter dashbook build && node apps/cli/bin/dashbook validate examples/`

Expected: Shows validation results for examples project.

**Step 3: Commit**

```bash
git add apps/cli/src/index.ts
git commit -m "feat(cli): wire validate command to CLI"
```

---

## Task 6: Implement Dev Command

**Files:**
- Create: `apps/cli/src/commands/dev.ts`
- Modify: `apps/cli/src/index.ts`

**Step 1: Create dev command**

Create `apps/cli/src/commands/dev.ts`:

```typescript
import { createServer, type DashbookServer } from '@dashbook/server';
import * as output from '../utils/output.js';
import { validateProject } from './validate.js';
import { loadEnvFile } from '../utils/config.js';

export interface DevOptions {
  port: number;
  apiOnly: boolean;
  open: boolean;
}

export async function runDevServer(
  projectDir: string,
  options: DevOptions
): Promise<void> {
  // Load .env file
  loadEnvFile(projectDir);

  // Validate first
  output.header('Validating configuration...');

  const validation = await validateProject(projectDir, { dryRun: false });

  if (!validation.success) {
    for (const error of validation.errors) {
      output.error(error.file);
      output.detail(error.message);
      if (error.suggestion) {
        output.detail(error.suggestion);
      }
    }
    output.newline();
    output.error(`Validation failed with ${validation.errors.length} error(s)`);
    process.exit(1);
  }

  output.success(`Validation passed (${validation.stats.passed} files)`);
  output.newline();

  // Start server
  const spinner = output.spinner('Starting server...');

  let server: DashbookServer;

  try {
    server = await createServer({
      projectDir,
      port: options.port,
      watch: true,
      serveStatic: !options.apiOnly,
    });

    await server.start();
    spinner.stop();
  } catch (err) {
    spinner.fail('Failed to start server');
    output.error(err instanceof Error ? err.message : 'Unknown error');
    process.exit(1);
  }

  // Print status
  const project = server.configLoader.getProject();
  const charts = server.configLoader.getCharts();
  const models = server.configLoader.getModels();

  output.newline();
  output.box([
    `Dashbook v0.1.0`,
    ``,
    `Dashboard:  http://localhost:${options.port}`,
    `API:        http://localhost:${options.port}/api`,
    ``,
    `Project:    ${project.name}`,
    `Charts:     ${charts.length} loaded`,
    `Models:     ${models.length} loaded`,
    ``,
    `Watching for changes...`,
  ]);
  output.newline();

  // Open browser
  if (options.open && !options.apiOnly) {
    const url = `http://localhost:${options.port}`;
    const { exec } = await import('child_process');
    const command = process.platform === 'darwin' ? 'open' :
                    process.platform === 'win32' ? 'start' : 'xdg-open';
    exec(`${command} ${url}`);
  }

  // Handle shutdown
  const shutdown = async () => {
    output.newline();
    output.info('Shutting down...');
    await server.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
```

**Step 2: Add dev command to CLI**

Update `apps/cli/src/index.ts` to add before `program.parse()`:

```typescript
program
  .command('dev')
  .description('Start development server with hot reload')
  .argument('[path]', 'Path to dashbook project', '.')
  .option('-p, --port <number>', 'Port to listen on', '3001')
  .option('--api-only', 'Only serve API, no web UI')
  .option('--no-open', 'Do not open browser automatically')
  .action(async (path: string, options: { port: string; apiOnly?: boolean; open: boolean }) => {
    const startPath = resolve(path);
    const projectDir = await findProjectRoot(startPath);

    if (!projectDir) {
      output.error('dashbook.yaml not found');
      output.detail('Run this command from a dashbook project directory');
      process.exit(2);
    }

    const { runDevServer } = await import('./commands/dev.js');

    await runDevServer(projectDir, {
      port: parseInt(options.port, 10),
      apiOnly: options.apiOnly ?? false,
      open: options.open,
    });
  });
```

Also add the import at the top:

```typescript
import { resolve } from 'path';
```

**Step 3: Build and test manually**

Run: `pnpm --filter dashbook build && node apps/cli/bin/dashbook dev examples/`

Expected: Server starts, shows status box, watches for changes.

**Step 4: Commit**

```bash
git add apps/cli/src/
git commit -m "feat(cli): add dev command with hot reload"
```

---

## Task 7: Add Dry-Run Query Validation

**Files:**
- Modify: `apps/cli/src/commands/validate.ts`
- Modify: `packages/query/src/connectors/index.ts`

**Step 1: Add explain method to Connector interface**

Update `packages/query/src/connectors/index.ts`:

```typescript
export interface QueryResult {
  columns: Array<{
    name: string;
    type: string;
  }>;
  rows: Array<Record<string, unknown>>;
  rowCount: number;
  durationMs: number;
}

export interface Connector {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  execute(sql: string): Promise<QueryResult>;
  explain(sql: string): Promise<{ valid: boolean; error?: string }>;
  isConnected(): boolean;
}

export * from './duckdb.js';
```

**Step 2: Implement explain in DuckDB connector**

Update `packages/query/src/connectors/duckdb.ts` to add the explain method after the execute method:

```typescript
  async explain(sql: string): Promise<{ valid: boolean; error?: string }> {
    if (!this.connection) {
      throw new Error('Not connected to database');
    }

    return new Promise((resolve) => {
      this.connection!.all(`EXPLAIN ${sql}`, (err) => {
        if (err) {
          resolve({ valid: false, error: err.message });
        } else {
          resolve({ valid: true });
        }
      });
    });
  }
```

**Step 3: Add dry-run phase to validate command**

Update `apps/cli/src/commands/validate.ts` to add dry-run support. Add this function after `crossReferenceValidation`:

```typescript
async function dryRunValidation(
  projectDir: string,
  config: LoadedConfig,
  connectionName: string | undefined,
  errors: ValidationError[]
): Promise<{ passed: number; failed: number }> {
  const { DuckDBConnector } = await import('@dashbook/query');
  const { readFile } = await import('fs/promises');
  const { join } = await import('path');
  const { parse: parseYaml } = await import('yaml');

  let passed = 0;
  let failed = 0;

  // Determine which connection to use
  const connName = connectionName || config.project?.defaults?.connection;
  if (!connName) {
    errors.push({
      file: 'dashbook.yaml',
      message: 'No connection specified for dry-run (use --connection or set defaults.connection)',
    });
    return { passed, failed: 1 };
  }

  const connection = config.connections.get(connName);
  if (!connection) {
    errors.push({
      file: 'dashbook.yaml',
      message: `Connection "${connName}" not found`,
    });
    return { passed, failed: 1 };
  }

  // Only DuckDB supported for now
  if (connection.type !== 'duckdb') {
    errors.push({
      file: `connections/${connName}.yaml`,
      message: `Dry-run not yet supported for connection type "${connection.type}"`,
    });
    return { passed, failed: 1 };
  }

  // Load full connection config to get path
  const connPath = join(projectDir, 'connections', `${connName}.yaml`);
  const connContent = await readFile(connPath, 'utf-8');
  const connConfig = parseYaml(connContent) as { config: { path: string } };

  // Resolve path relative to project
  const dbPath = connConfig.config.path.startsWith('/')
    ? connConfig.config.path
    : join(projectDir, connConfig.config.path);

  const connector = new DuckDBConnector({ path: dbPath });

  try {
    await connector.connect();

    for (const [modelName, model] of config.models) {
      const result = await connector.explain(model.sql);

      if (result.valid) {
        passed++;
      } else {
        failed++;
        errors.push({
          file: `models/${modelName}.sql`,
          message: result.error || 'Query validation failed',
        });
      }
    }
  } finally {
    await connector.disconnect();
  }

  return { passed, failed };
}
```

Update the `validateProject` function to call dry-run when enabled. Add this before the return statement:

```typescript
  // Phase 3: Dry-run query validation (if enabled)
  let dryRunStats = { passed: 0, failed: 0 };
  if (options.dryRun) {
    dryRunStats = await dryRunValidation(projectDir, config, options.connection, errors);
  }
```

Update the return to include dry-run stats:

```typescript
  return {
    success: errors.length === 0,
    errors,
    warnings,
    stats: {
      files: filesChecked,
      passed: filesPassed,
      failed: filesChecked - filesPassed,
    },
    dryRunStats: options.dryRun ? dryRunStats : undefined,
  };
```

Update the `ValidationResult` interface:

```typescript
export interface ValidationResult {
  success: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  stats: {
    files: number;
    passed: number;
    failed: number;
  };
  dryRunStats?: {
    passed: number;
    failed: number;
  };
}
```

**Step 4: Update CLI output for dry-run**

Update `apps/cli/src/index.ts` validate action to show dry-run results:

```typescript
      if (result.dryRunStats) {
        output.newline();
        if (result.dryRunStats.failed === 0) {
          output.success(`Queries: ${result.dryRunStats.passed} passed (EXPLAIN OK)`);
        } else {
          output.error(`Queries: ${result.dryRunStats.passed} passed, ${result.dryRunStats.failed} failed`);
        }
      }
```

**Step 5: Build and test**

Run: `pnpm build && node apps/cli/bin/dashbook validate examples/ --dry-run`

Expected: Shows schema validation + query dry-run results.

**Step 6: Commit**

```bash
git add apps/cli/src/ packages/query/src/
git commit -m "feat(cli): add dry-run query validation with EXPLAIN"
```

---

## Task 8: Final Build and Integration Test

**Step 1: Run full build**

Run: `pnpm build`

Expected: All packages build successfully.

**Step 2: Run all tests**

Run: `pnpm test`

Expected: All tests pass.

**Step 3: Test CLI end-to-end**

```bash
# Test validate
node apps/cli/bin/dashbook validate examples/
node apps/cli/bin/dashbook validate examples/ --dry-run
node apps/cli/bin/dashbook validate examples/ --json

# Test dev
node apps/cli/bin/dashbook dev examples/
# Ctrl+C to stop
```

**Step 4: Commit**

```bash
git add -A
git commit -m "feat(cli): complete CLI implementation with dev and validate commands"
```

---

## Summary

After completing these tasks, you will have:

1. **CLI package** (`apps/cli`) published as `dashbook`:
   - `dashbook validate [path]` - Schema + cross-reference validation
   - `dashbook validate --dry-run` - Query validation with EXPLAIN
   - `dashbook dev [path]` - Development server with hot reload

2. **Features**:
   - Environment variable resolution (`${VAR}` syntax)
   - `.env` file support
   - Colored output with spinners
   - JSON output for CI
   - "Did you mean?" suggestions for typos
   - Browser auto-open

3. **Integration**:
   - Reuses `@dashbook/server` for dev mode
   - Reuses `@dashbook/schema` for validation
   - Reuses `@dashbook/query` for dry-run

**Future additions** (not in this plan):
- `dashbook init` - Project scaffolding
- Snowflake connector for dry-run
- Bundled web UI (currently uses server's static serving)
