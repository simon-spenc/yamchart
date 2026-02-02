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
