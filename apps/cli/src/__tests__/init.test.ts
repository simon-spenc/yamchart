import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, readFile, access, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { initProject } from '../commands/init.js';

describe('initProject', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `dashbook-init-test-${Date.now()}`);
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

    it('creates connection file with correct content', async () => {
      const projectDir = join(testDir, 'my-project');

      await initProject(projectDir, {});

      const content = await readFile(join(projectDir, 'connections/local.yaml'), 'utf-8');
      expect(content).toContain('name: local');
      expect(content).toContain('type: duckdb');
      expect(content).toContain('path: ":memory:"');
    });

    it('creates model file with SQL content', async () => {
      const projectDir = join(testDir, 'my-project');

      await initProject(projectDir, {});

      const content = await readFile(join(projectDir, 'models/sample_orders.sql'), 'utf-8');
      expect(content).toContain('@name: sample_orders');
      expect(content).toContain('SELECT * FROM');
    });

    it('creates chart file with correct structure', async () => {
      const projectDir = join(testDir, 'my-project');

      await initProject(projectDir, {});

      const content = await readFile(join(projectDir, 'charts/revenue-by-day.yaml'), 'utf-8');
      expect(content).toContain('name: revenue-by-day');
      expect(content).toContain('model: sample_orders');
      expect(content).toContain('type: line');
    });
  });

  describe('--empty mode', () => {
    it('creates only dashbook.yaml', async () => {
      const projectDir = join(testDir, 'empty-project');

      const result = await initProject(projectDir, { empty: true });

      expect(result.success).toBe(true);
      expect(result.files).toEqual(['dashbook.yaml']);
    });

    it('replaces {{name}} with project name', async () => {
      const projectDir = join(testDir, 'empty-project');

      await initProject(projectDir, { empty: true });

      const content = await readFile(join(projectDir, 'dashbook.yaml'), 'utf-8');
      expect(content).toContain('name: empty-project');
      expect(content).not.toContain('{{name}}');
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
      // Example project should have models, charts, connections
      expect(result.files.some(f => f.startsWith('models/'))).toBe(true);
      expect(result.files.some(f => f.startsWith('charts/'))).toBe(true);
      expect(result.files.some(f => f.startsWith('connections/'))).toBe(true);
    });

    it('updates project name in dashbook.yaml', async () => {
      const projectDir = join(testDir, 'my-example');

      await initProject(projectDir, { example: true });

      const content = await readFile(join(projectDir, 'dashbook.yaml'), 'utf-8');
      expect(content).toContain('name: my-example');
    });

    it('excludes node_modules and lock files', async () => {
      const projectDir = join(testDir, 'example-project');

      const result = await initProject(projectDir, { example: true });

      expect(result.files).not.toContain('node_modules');
      expect(result.files).not.toContain('pnpm-lock.yaml');
      expect(result.files).not.toContain('package.json');
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

    it('overwrites existing files with --force', async () => {
      const projectDir = join(testDir, 'existing-project');
      await mkdir(projectDir, { recursive: true });
      await writeFile(join(projectDir, 'dashbook.yaml'), 'old content');

      await initProject(projectDir, { force: true });

      const content = await readFile(join(projectDir, 'dashbook.yaml'), 'utf-8');
      expect(content).toContain('name: existing-project');
      expect(content).not.toContain('old content');
    });
  });
});
