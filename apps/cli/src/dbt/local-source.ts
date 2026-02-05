import { readFile } from 'fs/promises';
import { join } from 'path';
import fg from 'fast-glob';
import { minimatch } from 'minimatch';
import { parseSchemaYml, parseProjectYml } from './parser.js';
import type {
  DbtSource,
  DbtProjectConfig,
  DbtModel,
  DbtModelSummary,
} from './types.js';

export interface ModelFilters {
  include?: string[];
  exclude?: string[];
  tags?: string[];
}

/**
 * LocalDbtSource reads dbt project metadata from a local filesystem.
 * It parses schema.yml files to extract model definitions, columns, and hints.
 */
export class LocalDbtSource implements DbtSource {
  readonly type = 'local' as const;
  private projectPath: string;
  private modelsCache: Map<string, DbtModel> | null = null;
  private configCache: DbtProjectConfig | null = null;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  /**
   * Read and parse dbt_project.yml
   */
  async getProjectConfig(): Promise<DbtProjectConfig> {
    if (this.configCache) {
      return this.configCache;
    }

    const configPath = join(this.projectPath, 'dbt_project.yml');
    const content = await readFile(configPath, 'utf-8');
    const parsed = parseProjectYml(content);

    this.configCache = {
      name: parsed.name,
      version: parsed.version,
      profile: parsed.profile,
      model_paths: parsed.modelPaths,
      target_path: 'target',
      vars: parsed.vars,
    };

    return this.configCache;
  }

  /**
   * Find all schema.yml files and parse models from them.
   * Returns summaries for model selection UI.
   */
  async listModels(): Promise<DbtModelSummary[]> {
    await this.loadModels();

    const summaries: DbtModelSummary[] = [];
    for (const model of this.modelsCache!.values()) {
      summaries.push({
        name: model.name,
        path: model.path,
        description: model.description || 'No description',
        tags: model.tags || [],
      });
    }

    return summaries;
  }

  /**
   * Get full model details by name.
   * @throws Error if model not found
   */
  async getModel(name: string): Promise<DbtModel> {
    await this.loadModels();

    const model = this.modelsCache!.get(name);
    if (!model) {
      throw new Error(`Model not found: ${name}`);
    }

    return model;
  }

  /**
   * Get multiple models by name.
   * @throws Error if any model not found
   */
  async getModels(names: string[]): Promise<DbtModel[]> {
    if (names.length === 0) {
      return [];
    }

    const models: DbtModel[] = [];
    for (const name of names) {
      models.push(await this.getModel(name));
    }

    return models;
  }

  /**
   * Load all models from schema.yml files into cache.
   */
  private async loadModels(): Promise<void> {
    if (this.modelsCache) {
      return;
    }

    const config = await this.getProjectConfig();
    this.modelsCache = new Map();

    // Find all schema.yml files in model paths
    for (const modelPath of config.model_paths) {
      const pattern = join(this.projectPath, modelPath, '**/*.yml');
      const files = await fg(pattern, {
        ignore: ['**/node_modules/**'],
      });

      for (const file of files) {
        const content = await readFile(file, 'utf-8');
        // Get relative path from project root
        const relativePath = file.slice(this.projectPath.length + 1);
        const models = parseSchemaYml(content, relativePath);

        for (const model of models) {
          this.modelsCache.set(model.name, model);
        }
      }
    }
  }

  /**
   * Filter models by include/exclude glob patterns and tags.
   * Patterns match against model paths.
   */
  static filterModels(
    models: DbtModelSummary[],
    filters: ModelFilters
  ): DbtModelSummary[] {
    let filtered = [...models];

    // Apply include patterns (match any)
    if (filters.include && filters.include.length > 0) {
      filtered = filtered.filter((model) =>
        filters.include!.some((pattern) => minimatch(model.path, pattern))
      );
    }

    // Apply exclude patterns (exclude any matches)
    if (filters.exclude && filters.exclude.length > 0) {
      filtered = filtered.filter(
        (model) =>
          !filters.exclude!.some((pattern) => minimatch(model.path, pattern))
      );
    }

    // Apply tag filters (match any)
    if (filters.tags && filters.tags.length > 0) {
      filtered = filtered.filter((model) =>
        filters.tags!.some((tag) => model.tags.includes(tag))
      );
    }

    return filtered;
  }

  /**
   * Get default filters that focus on marts/reporting models.
   * These are typically the models most useful for BI dashboards.
   */
  static getDefaultFilters(): Required<ModelFilters> {
    return {
      include: ['**/marts/**', '**/reporting/**'],
      exclude: ['**/staging/**', '**/intermediate/**'],
      tags: [],
    };
  }
}
