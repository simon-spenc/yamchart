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
  dryRunStats?: {
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
  const modelStats = { filesChecked: 0, filesPassed: 0 };
  try {
    await access(modelsDir);
    await validateModelsDir(modelsDir, projectDir, config, errors, modelStats);
    filesChecked += modelStats.filesChecked;
    filesPassed += modelStats.filesPassed;
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

  // Phase 3: Dry-run query validation (if enabled)
  let dryRunStats: { passed: number; failed: number } | undefined;
  if (options.dryRun) {
    dryRunStats = await dryRunValidation(projectDir, config, options.connection, errors);
  }

  return {
    success: errors.length === 0,
    errors,
    warnings,
    stats: {
      files: filesChecked,
      passed: filesPassed,
      failed: filesChecked - filesPassed,
    },
    dryRunStats,
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

async function dryRunValidation(
  projectDir: string,
  config: LoadedConfig,
  connectionName: string | undefined,
  errors: ValidationError[]
): Promise<{ passed: number; failed: number }> {
  const { DuckDBConnector } = await import('@dashbook/query');

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
