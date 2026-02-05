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
