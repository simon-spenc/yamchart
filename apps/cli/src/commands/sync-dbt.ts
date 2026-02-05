import { mkdir, writeFile, readFile, access } from 'fs/promises';
import { join } from 'path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { LocalDbtSource } from '../dbt/local-source.js';
import { scanYamchartModels } from '../dbt/scanner.js';
import { generateCatalogMd, generateCatalogJson, type CatalogData, type CatalogModel } from '../dbt/catalog.js';
import type { DbtSourceConfig } from '../dbt/types.js';

export interface SyncDbtOptions {
  source: 'local' | 'github' | 'dbt-cloud';
  path?: string;
  repo?: string;
  branch?: string;
  include: string[];
  exclude: string[];
  tags: string[];
  refresh?: boolean;
}

export interface SyncDbtResult {
  success: boolean;
  modelsIncluded: number;
  modelsExcluded: number;
  catalogPath: string;
  error?: string;
}

/**
 * Load saved sync config from .yamchart/dbt-source.yaml
 */
export async function loadSyncConfig(projectDir: string): Promise<DbtSourceConfig | null> {
  const configPath = join(projectDir, '.yamchart', 'dbt-source.yaml');

  try {
    await access(configPath);
    const content = await readFile(configPath, 'utf-8');
    return parseYaml(content) as DbtSourceConfig;
  } catch {
    return null;
  }
}

/**
 * Sync dbt project metadata to yamchart catalog.
 *
 * This function:
 * 1. Ensures .yamchart directory exists
 * 2. Handles refresh mode (load saved config)
 * 3. Validates source type (only 'local' supported for v1)
 * 4. Creates LocalDbtSource, lists models, applies filters
 * 5. Uses smart defaults if no filters specified
 * 6. Scans yamchart models for cross-references
 * 7. Generates catalog.md and catalog.json
 * 8. Saves sync config to dbt-source.yaml
 */
export async function syncDbt(
  projectDir: string,
  options: SyncDbtOptions
): Promise<SyncDbtResult> {
  const yamchartDir = join(projectDir, '.yamchart');
  const catalogPath = join(yamchartDir, 'catalog.md');

  try {
    // Step 1: Ensure .yamchart directory exists
    await mkdir(yamchartDir, { recursive: true });

    // Step 2: Handle refresh mode - load saved config
    let effectiveOptions = { ...options };
    if (options.refresh) {
      const savedConfig = await loadSyncConfig(projectDir);
      if (!savedConfig) {
        return {
          success: false,
          modelsIncluded: 0,
          modelsExcluded: 0,
          catalogPath,
          error: 'No saved sync config found. Run sync-dbt with --path first.',
        };
      }

      effectiveOptions = {
        source: savedConfig.source,
        path: savedConfig.path,
        repo: savedConfig.repo,
        branch: savedConfig.branch,
        include: savedConfig.filters.include,
        exclude: savedConfig.filters.exclude,
        tags: savedConfig.filters.tags,
      };
    }

    // Step 3: Validate source type (only 'local' supported for v1)
    if (effectiveOptions.source !== 'local') {
      return {
        success: false,
        modelsIncluded: 0,
        modelsExcluded: 0,
        catalogPath,
        error: `Source type "${effectiveOptions.source}" not yet supported. Only "local" is available.`,
      };
    }

    if (!effectiveOptions.path) {
      return {
        success: false,
        modelsIncluded: 0,
        modelsExcluded: 0,
        catalogPath,
        error: 'Path to dbt project is required for local source.',
      };
    }

    // Step 4: Create LocalDbtSource, list models
    const dbtSource = new LocalDbtSource(effectiveOptions.path);
    const allModels = await dbtSource.listModels();

    // Step 5: Apply filters or use smart defaults
    let hasFilters =
      effectiveOptions.include.length > 0 ||
      effectiveOptions.exclude.length > 0 ||
      effectiveOptions.tags.length > 0;

    let filteredModels;
    if (hasFilters) {
      filteredModels = LocalDbtSource.filterModels(allModels, {
        include: effectiveOptions.include,
        exclude: effectiveOptions.exclude,
        tags: effectiveOptions.tags,
      });
    } else {
      // Use smart defaults - prefer marts/reporting, exclude staging/intermediate
      const defaults = LocalDbtSource.getDefaultFilters();
      const withDefaults = LocalDbtSource.filterModels(allModels, defaults);

      // If defaults filter out everything, include all models
      filteredModels = withDefaults.length > 0 ? withDefaults : allModels;
    }

    const modelsExcluded = allModels.length - filteredModels.length;

    // Get full model details for included models
    const modelNames = filteredModels.map(m => m.name);
    const fullModels = await dbtSource.getModels(modelNames);

    // Step 6: Scan yamchart models for cross-references
    const yamchartModels = await scanYamchartModels(projectDir);

    // Build catalog models with cross-references
    const catalogModels: CatalogModel[] = fullModels.map(model => {
      // Find yamchart models that reference this dbt model
      const referencingModels = yamchartModels.filter(ym =>
        ym.source === model.name || ym.source === model.table
      );

      return {
        ...model,
        yamchartModels: referencingModels,
      };
    });

    // Step 7: Generate catalog files
    const catalogData: CatalogData = {
      syncedAt: new Date().toISOString(),
      source: {
        type: effectiveOptions.source,
        path: effectiveOptions.path,
        repo: effectiveOptions.repo,
      },
      stats: {
        modelsIncluded: filteredModels.length,
        modelsExcluded,
      },
      models: catalogModels,
    };

    const catalogMd = generateCatalogMd(catalogData);
    const catalogJson = generateCatalogJson(catalogData);

    await writeFile(catalogPath, catalogMd, 'utf-8');
    await writeFile(join(yamchartDir, 'catalog.json'), catalogJson, 'utf-8');

    // Step 8: Save sync config for re-sync
    const syncConfig: DbtSourceConfig = {
      source: effectiveOptions.source,
      path: effectiveOptions.path,
      repo: effectiveOptions.repo,
      branch: effectiveOptions.branch,
      lastSync: catalogData.syncedAt,
      filters: {
        include: effectiveOptions.include,
        exclude: effectiveOptions.exclude,
        tags: effectiveOptions.tags,
      },
      stats: {
        modelsIncluded: filteredModels.length,
        modelsExcluded,
      },
    };

    const configYaml = stringifyYaml(syncConfig);
    await writeFile(join(yamchartDir, 'dbt-source.yaml'), configYaml, 'utf-8');

    return {
      success: true,
      modelsIncluded: filteredModels.length,
      modelsExcluded,
      catalogPath,
    };
  } catch (err) {
    return {
      success: false,
      modelsIncluded: 0,
      modelsExcluded: 0,
      catalogPath,
      error: err instanceof Error ? err.message : 'Unknown error during sync',
    };
  }
}
