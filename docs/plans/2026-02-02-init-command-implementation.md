# Dashbook Init Command Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `dashbook init` command with three modes: default (minimal working project), --example (full example), --empty (skeleton only).

**Architecture:** Templates stored in `apps/cli/src/templates/` as static files. Init command reads templates, replaces `{{name}}` placeholder, writes to target directory. For --example mode, copies from `examples/` folder (bundled at build time or copied at runtime).

**Tech Stack:** Node.js fs/promises, path resolution, existing CLI utilities (picocolors, output.ts)

**Prerequisites:** Design document at `docs/plans/2026-02-02-init-command-design.md`

---

## Task 1: Create Default Mode Templates

**Files:**
- Create: `apps/cli/src/templates/default/dashbook.yaml`
- Create: `apps/cli/src/templates/default/connections/local.yaml`
- Create: `apps/cli/src/templates/default/models/sample_orders.sql`
- Create: `apps/cli/src/templates/default/charts/revenue-by-day.yaml`

**Step 1: Create the templates directory structure**

```bash
mkdir -p apps/cli/src/templates/default/connections
mkdir -p apps/cli/src/templates/default/models
mkdir -p apps/cli/src/templates/default/charts
```

**Step 2: Create dashbook.yaml template**

Create `apps/cli/src/templates/default/dashbook.yaml`:
```yaml
name: {{name}}
version: "1.0"
default_connection: local

defaults:
  cache_ttl: 5m
```

**Step 3: Create connection template**

Create `apps/cli/src/templates/default/connections/local.yaml`:
```yaml
name: local
type: duckdb
config:
  path: ":memory:"
```

**Step 4: Create model template**

Create `apps/cli/src/templates/default/models/sample_orders.sql`:
```sql
-- @name: sample_orders
-- @description: Sample orders data for demo

SELECT * FROM (
  VALUES
    ('2024-01-01'::date, 'Electronics', 1200),
    ('2024-01-02'::date, 'Electronics', 850),
    ('2024-01-03'::date, 'Clothing', 430),
    ('2024-01-04'::date, 'Electronics', 1100),
    ('2024-01-05'::date, 'Clothing', 520)
) AS t(order_date, category, revenue)
```

**Step 5: Create chart template**

Create `apps/cli/src/templates/default/charts/revenue-by-day.yaml`:
```yaml
name: revenue-by-day
title: Daily Revenue
description: Sample chart showing daily revenue

source:
  model: sample_orders

chart:
  type: line
  x:
    field: order_date
    type: temporal
    label: Date
  y:
    field: revenue
    type: quantitative
    format: "$,.0f"
    label: Revenue
```

**Step 6: Commit**

```bash
git add apps/cli/src/templates/
git commit -m "feat(cli): add default mode templates for init command"
```

---

## Task 2: Create Empty Mode Template

**Files:**
- Create: `apps/cli/src/templates/empty/dashbook.yaml`

**Step 1: Create empty template directory**

```bash
mkdir -p apps/cli/src/templates/empty
```

**Step 2: Create empty dashbook.yaml template**

Create `apps/cli/src/templates/empty/dashbook.yaml`:
```yaml
name: {{name}}
version: "1.0"
# default_connection: <connection-name>

defaults:
  cache_ttl: 5m
```

**Step 3: Commit**

```bash
git add apps/cli/src/templates/empty/
git commit -m "feat(cli): add empty mode template for init command"
```

---

## Task 3: Write Init Command Tests

**Files:**
- Create: `apps/cli/src/__tests__/init.test.ts`

**Step 1: Create test file with all test cases**

Create `apps/cli/src/__tests__/init.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, readFile, access } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { initProject, InitOptions } from '../commands/init.js';

describe('initProject', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `dashbook-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('default mode', () => {
    it('creates all default files', async () => {
      const projectDir = join(testDir, 'my-project');

      const result = await initProject(projectDir, {});

      expect(result.success).toBe(true);
      expect(result.files).toContain('dashbook.yaml');
      expect(result.files).toContain('connections/local.yaml');
      expect(result.files).toContain('models/sample_orders.sql');
      expect(result.files).toContain('charts/revenue-by-day.yaml');
    });

    it('replaces {{name}} with project name', async () => {
      const projectDir = join(testDir, 'my-project');

      await initProject(projectDir, {});

      const content = await readFile(join(projectDir, 'dashbook.yaml'), 'utf-8');
      expect(content).toContain('name: my-project');
      expect(content).not.toContain('{{name}}');
    });

    it('creates directory if it does not exist', async () => {
      const projectDir = join(testDir, 'new-project');

      await initProject(projectDir, {});

      await expect(access(projectDir)).resolves.toBeUndefined();
    });
  });

  describe('--empty mode', () => {
    it('creates only dashbook.yaml', async () => {
      const projectDir = join(testDir, 'empty-project');

      const result = await initProject(projectDir, { empty: true });

      expect(result.success).toBe(true);
      expect(result.files).toEqual(['dashbook.yaml']);
    });

    it('includes commented connection placeholder', async () => {
      const projectDir = join(testDir, 'empty-project');

      await initProject(projectDir, { empty: true });

      const content = await readFile(join(projectDir, 'dashbook.yaml'), 'utf-8');
      expect(content).toContain('# default_connection:');
    });
  });

  describe('--example mode', () => {
    it('copies example project files', async () => {
      const projectDir = join(testDir, 'example-project');

      const result = await initProject(projectDir, { example: true });

      expect(result.success).toBe(true);
      expect(result.files).toContain('dashbook.yaml');
      expect(result.files).toContain('sample-data.duckdb');
    });
  });

  describe('error handling', () => {
    it('fails if dashbook.yaml already exists', async () => {
      const projectDir = join(testDir, 'existing-project');
      await mkdir(projectDir, { recursive: true });
      await writeFile(join(projectDir, 'dashbook.yaml'), 'existing');

      const result = await initProject(projectDir, {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });

    it('succeeds with --force even if dashbook.yaml exists', async () => {
      const projectDir = join(testDir, 'existing-project');
      await mkdir(projectDir, { recursive: true });
      await writeFile(join(projectDir, 'dashbook.yaml'), 'existing');

      const result = await initProject(projectDir, { force: true });

      expect(result.success).toBe(true);
    });
  });
});

// Helper for tests
import { writeFile } from 'fs/promises';
```

**Step 2: Run tests to verify they fail**

```bash
cd apps/cli && pnpm test src/__tests__/init.test.ts
```

Expected: FAIL with "Cannot find module '../commands/init.js'"

**Step 3: Commit**

```bash
git add apps/cli/src/__tests__/init.test.ts
git commit -m "test(cli): add init command tests"
```

---

## Task 4: Implement Init Command Core Logic

**Files:**
- Create: `apps/cli/src/commands/init.ts`

**Step 1: Create init command implementation**

Create `apps/cli/src/commands/init.ts`:
```typescript
import { mkdir, readFile, writeFile, access, readdir, copyFile, stat } from 'fs/promises';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface InitOptions {
  empty?: boolean;
  example?: boolean;
  force?: boolean;
}

export interface InitResult {
  success: boolean;
  files: string[];
  error?: string;
}

export async function initProject(projectDir: string, options: InitOptions): Promise<InitResult> {
  const projectName = basename(projectDir);
  const files: string[] = [];

  // Check if dashbook.yaml already exists
  const dashbookYamlPath = join(projectDir, 'dashbook.yaml');
  try {
    await access(dashbookYamlPath);
    if (!options.force) {
      return {
        success: false,
        files: [],
        error: `${dashbookYamlPath} already exists. Use --force to overwrite.`,
      };
    }
  } catch {
    // File doesn't exist, continue
  }

  // Create project directory
  await mkdir(projectDir, { recursive: true });

  if (options.example) {
    // Copy example project
    const examplesDir = join(__dirname, '../../../examples');
    await copyDirectory(examplesDir, projectDir, files, projectName);
  } else if (options.empty) {
    // Empty mode - only dashbook.yaml
    const templateDir = join(__dirname, '../templates/empty');
    await copyTemplate(templateDir, projectDir, files, projectName);
  } else {
    // Default mode - minimal working project
    const templateDir = join(__dirname, '../templates/default');
    await copyTemplate(templateDir, projectDir, files, projectName);
  }

  return { success: true, files };
}

async function copyTemplate(
  templateDir: string,
  targetDir: string,
  files: string[],
  projectName: string
): Promise<void> {
  const entries = await readdir(templateDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(templateDir, entry.name);
    const destPath = join(targetDir, entry.name);

    if (entry.isDirectory()) {
      await mkdir(destPath, { recursive: true });
      await copyTemplate(srcPath, destPath, files, projectName);
    } else {
      let content = await readFile(srcPath, 'utf-8');
      content = content.replace(/\{\{name\}\}/g, projectName);
      await writeFile(destPath, content, 'utf-8');

      // Track relative path
      const relativePath = destPath.replace(targetDir + '/', '');
      files.push(relativePath);
    }
  }
}

async function copyDirectory(
  srcDir: string,
  destDir: string,
  files: string[],
  projectName: string
): Promise<void> {
  const entries = await readdir(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    // Skip node_modules and lock files
    if (entry.name === 'node_modules' || entry.name === 'pnpm-lock.yaml') {
      continue;
    }

    const srcPath = join(srcDir, entry.name);
    const destPath = join(destDir, entry.name);

    if (entry.isDirectory()) {
      await mkdir(destPath, { recursive: true });
      await copyDirectory(srcPath, destPath, files, projectName);
    } else {
      const srcStat = await stat(srcPath);

      // For binary files (like .duckdb), copy directly
      if (entry.name.endsWith('.duckdb')) {
        await copyFile(srcPath, destPath);
      } else {
        // For text files, replace project name in dashbook.yaml
        let content = await readFile(srcPath, 'utf-8');
        if (entry.name === 'dashbook.yaml') {
          content = content.replace(/name:\s*\S+/, `name: ${projectName}`);
        }
        await writeFile(destPath, content, 'utf-8');
      }

      const relativePath = destPath.replace(destDir + '/', '');
      files.push(relativePath);
    }
  }
}
```

**Step 2: Run tests**

```bash
cd apps/cli && pnpm test src/__tests__/init.test.ts
```

Expected: Most tests PASS, example mode may need adjustment

**Step 3: Commit**

```bash
git add apps/cli/src/commands/init.ts
git commit -m "feat(cli): implement init command core logic"
```

---

## Task 5: Wire Init Command to CLI

**Files:**
- Modify: `apps/cli/src/index.ts`

**Step 1: Add init command to CLI**

Add the following to `apps/cli/src/index.ts` after the `dev` command (before `program.parse()`):

```typescript
program
  .command('init')
  .description('Create a new dashbook project')
  .argument('[directory]', 'Target directory', '.')
  .option('--example', 'Create full example project with sample database')
  .option('--empty', 'Create only dashbook.yaml (no connections, models, or charts)')
  .option('--force', 'Overwrite existing files')
  .action(async (directory: string, options: { example?: boolean; empty?: boolean; force?: boolean }) => {
    const { initProject } = await import('./commands/init.js');
    const targetDir = resolve(directory);

    const result = await initProject(targetDir, options);

    if (!result.success) {
      output.error(result.error || 'Failed to create project');
      process.exit(1);
    }

    output.newline();
    output.success(`Created ${directory}/`);
    for (const file of result.files.slice(0, 10)) {
      output.detail(file);
    }
    if (result.files.length > 10) {
      output.detail(`... and ${result.files.length - 10} more files`);
    }
    output.newline();
    output.info(`Run \`cd ${directory} && dashbook dev\` to start.`);
  });
```

**Step 2: Verify import is added**

Ensure `resolve` is imported at the top (it should already be there from existing code).

**Step 3: Test manually**

```bash
cd apps/cli && pnpm build
node dist/index.js init --help
```

Expected output:
```
Usage: dashbook init [options] [directory]

Create a new dashbook project

Arguments:
  directory    Target directory (default: ".")

Options:
  --example    Create full example project with sample database
  --empty      Create only dashbook.yaml (no connections, models, or charts)
  --force      Overwrite existing files
  -h, --help   display help for command
```

**Step 4: Commit**

```bash
git add apps/cli/src/index.ts
git commit -m "feat(cli): wire init command to CLI"
```

---

## Task 6: Integration Test

**Files:**
- Test manually in a temp directory

**Step 1: Build CLI**

```bash
cd apps/cli && pnpm build
```

**Step 2: Test default mode**

```bash
cd /tmp
rm -rf test-project
node /Users/simonspencer/Documents/Projects/dashbook/apps/cli/dist/index.js init test-project
ls -la test-project/
cat test-project/dashbook.yaml
```

Expected:
- Directory created with 4 files
- dashbook.yaml has `name: test-project`

**Step 3: Test empty mode**

```bash
cd /tmp
rm -rf test-empty
node /Users/simonspencer/Documents/Projects/dashbook/apps/cli/dist/index.js init test-empty --empty
ls -la test-empty/
```

Expected: Only dashbook.yaml exists

**Step 4: Test example mode**

```bash
cd /tmp
rm -rf test-example
node /Users/simonspencer/Documents/Projects/dashbook/apps/cli/dist/index.js init test-example --example
ls -la test-example/
```

Expected: Full example project with sample-data.duckdb

**Step 5: Test error case**

```bash
cd /tmp
node /Users/simonspencer/Documents/Projects/dashbook/apps/cli/dist/index.js init test-project
```

Expected: Error "already exists"

**Step 6: Test --force**

```bash
node /Users/simonspencer/Documents/Projects/dashbook/apps/cli/dist/index.js init test-project --force
```

Expected: Success, files overwritten

**Step 7: Run full test suite**

```bash
cd apps/cli && pnpm test
```

Expected: All tests pass

**Step 8: Commit**

```bash
git add -A
git commit -m "test(cli): verify init command integration"
```

---

## Task 7: Update tsup Config for Templates

**Files:**
- Modify: `apps/cli/tsup.config.ts` (if exists) or `apps/cli/package.json`

**Step 1: Check current build config**

```bash
cat apps/cli/tsup.config.ts 2>/dev/null || echo "No tsup config, uses defaults"
```

**Step 2: Ensure templates are copied to dist**

If `tsup.config.ts` exists, add:
```typescript
import { defineConfig } from 'tsup';
import { cp } from 'fs/promises';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  onSuccess: async () => {
    // Copy templates to dist
    await cp('src/templates', 'dist/templates', { recursive: true });
  },
});
```

If no tsup config, create `apps/cli/tsup.config.ts`:
```typescript
import { defineConfig } from 'tsup';
import { cp } from 'fs/promises';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  onSuccess: async () => {
    await cp('src/templates', 'dist/templates', { recursive: true });
  },
});
```

**Step 3: Update init.ts to use correct path**

In `apps/cli/src/commands/init.ts`, update the template path resolution:
```typescript
// At the top of the file, update __dirname calculation for dist
const __dirname = dirname(fileURLToPath(import.meta.url));

// Templates are in dist/templates when built, src/templates in dev
const getTemplatesDir = () => {
  const distTemplates = join(__dirname, '../templates');
  const srcTemplates = join(__dirname, '../../src/templates');
  // Try dist first (production), fall back to src (development)
  return distTemplates;
};
```

**Step 4: Rebuild and test**

```bash
cd apps/cli && pnpm build
ls dist/templates/
```

Expected: templates/default/ and templates/empty/ exist in dist/

**Step 5: Commit**

```bash
git add apps/cli/tsup.config.ts apps/cli/src/commands/init.ts
git commit -m "build(cli): ensure templates are bundled in dist"
```

---

## Task 8: Final Verification and Cleanup

**Files:**
- Review all changes

**Step 1: Run all CLI tests**

```bash
cd apps/cli && pnpm test
```

Expected: All tests pass

**Step 2: Run full monorepo tests**

```bash
cd /Users/simonspencer/Documents/Projects/dashbook && pnpm test
```

Expected: All tests pass

**Step 3: Test end-to-end with dashbook dev**

```bash
cd /tmp
rm -rf final-test
node /Users/simonspencer/Documents/Projects/dashbook/apps/cli/dist/index.js init final-test
cd final-test
node /Users/simonspencer/Documents/Projects/dashbook/apps/cli/dist/index.js dev --no-open
```

Expected: Server starts successfully with sample data

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat(cli): complete dashbook init command

Adds \`dashbook init\` with three modes:
- Default: minimal working project with inline sample data
- --example: full example project with DuckDB file
- --empty: just dashbook.yaml for power users

Closes #XX (if applicable)"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Create default mode templates | 4 template files |
| 2 | Create empty mode template | 1 template file |
| 3 | Write init command tests | init.test.ts |
| 4 | Implement init command logic | init.ts |
| 5 | Wire to CLI | index.ts |
| 6 | Integration test | manual testing |
| 7 | Bundle templates in build | tsup.config.ts |
| 8 | Final verification | full test suite |
