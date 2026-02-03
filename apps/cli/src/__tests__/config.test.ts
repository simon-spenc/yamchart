import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { findProjectRoot, resolveEnvVars } from '../utils/config.js';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('findProjectRoot', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `yamchart-cli-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('finds yamchart.yaml in current directory', async () => {
    await writeFile(join(testDir, 'yamchart.yaml'), 'version: "1.0"\nname: test');

    const result = await findProjectRoot(testDir);
    expect(result).toBe(testDir);
  });

  it('finds yamchart.yaml in parent directory', async () => {
    await writeFile(join(testDir, 'yamchart.yaml'), 'version: "1.0"\nname: test');
    const subDir = join(testDir, 'sub');
    await mkdir(subDir);

    const result = await findProjectRoot(subDir);
    expect(result).toBe(testDir);
  });

  it('returns null when no yamchart.yaml found', async () => {
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
