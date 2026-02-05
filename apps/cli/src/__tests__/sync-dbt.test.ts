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
