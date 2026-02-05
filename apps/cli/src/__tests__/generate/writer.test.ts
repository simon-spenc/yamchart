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
