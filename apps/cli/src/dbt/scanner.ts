import { readFile, access, readdir } from 'fs/promises';
import { join, extname, relative } from 'path';

export interface YamchartModel {
  name: string;
  description: string;
  path: string; // relative to project
  source?: string; // dbt table this queries
}

/**
 * Scan yamchart models directory and extract metadata.
 * Used to cross-reference which yamchart models use which dbt tables.
 */
export async function scanYamchartModels(projectDir: string): Promise<YamchartModel[]> {
  const modelsDir = join(projectDir, 'models');
  const models: YamchartModel[] = [];

  try {
    await access(modelsDir);
  } catch {
    return [];
  }

  await scanModelsRecursive(modelsDir, projectDir, models);
  return models;
}

async function scanModelsRecursive(
  dir: string,
  projectDir: string,
  models: YamchartModel[]
): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      await scanModelsRecursive(fullPath, projectDir, models);
    } else if (extname(entry.name) === '.sql') {
      const content = await readFile(fullPath, 'utf-8');
      const metadata = parseModelMetadata(content);

      if (metadata.name) {
        models.push({
          name: metadata.name,
          description: metadata.description || '',
          path: relative(projectDir, fullPath),
          source: metadata.source || extractSourceFromSql(content),
        });
      }
    }
  }
}

interface ModelMetadata {
  name?: string;
  description?: string;
  source?: string;
}

/**
 * Parse yamchart model metadata from SQL comments.
 */
function parseModelMetadata(content: string): ModelMetadata {
  const metadata: ModelMetadata = {};

  // Match @name: value
  const nameMatch = content.match(/--\s*@name:\s*(.+)/);
  if (nameMatch) {
    metadata.name = nameMatch[1].trim();
  }

  // Match @description: value
  const descMatch = content.match(/--\s*@description:\s*(.+)/);
  if (descMatch) {
    metadata.description = descMatch[1].trim();
  }

  // Match @source: value (explicit dbt table reference)
  const sourceMatch = content.match(/--\s*@source:\s*(.+)/);
  if (sourceMatch) {
    metadata.source = sourceMatch[1].trim();
  }

  return metadata;
}

/**
 * Extract the primary table name from SQL FROM clause.
 * This is a best-effort extraction for cross-referencing.
 */
function extractSourceFromSql(sql: string): string | undefined {
  // Remove comments
  const noComments = sql.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

  // Match FROM table_name (handles schema.table and database.schema.table)
  const fromMatch = noComments.match(/\bFROM\s+(\{\{\s*ref\(['"]([^'"]+)['"]\)\s*\}\}|[\w.]+)/i);

  if (fromMatch) {
    // If it's a Jinja ref(), extract the table name
    if (fromMatch[2]) {
      return fromMatch[2];
    }
    // Otherwise return the raw table name
    return fromMatch[1];
  }

  return undefined;
}
