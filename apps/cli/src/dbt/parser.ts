import { parse as parseYaml } from 'yaml';
import { dirname, join } from 'path';
import type { DbtModel, DbtColumn } from './types.js';

interface RawSchemaYml {
  version: number;
  models?: RawModel[];
}

interface RawModel {
  name: string;
  description?: string;
  meta?: Record<string, unknown>;
  tags?: string[];
  columns?: RawColumn[];
}

interface RawColumn {
  name: string;
  description?: string;
  data_type?: string;
  tests?: (string | Record<string, unknown>)[];
}

/**
 * Extract hints from dbt column tests.
 * - unique → "unique"
 * - not_null → "required"
 * - relationships: { to: ref('X') } → "fk:X"
 */
export function extractHintsFromTests(tests: (string | Record<string, unknown>)[]): string[] {
  const hints: string[] = [];

  for (const test of tests) {
    if (typeof test === 'string') {
      if (test === 'unique') {
        hints.push('unique');
      } else if (test === 'not_null') {
        hints.push('required');
      } else if (test === 'primary_key') {
        hints.push('primary_key');
      }
    } else if (typeof test === 'object' && test !== null) {
      // Handle relationships test
      if ('relationships' in test) {
        const rel = test.relationships as { to?: string; field?: string };
        if (rel.to) {
          // Extract table name from ref('table_name')
          const match = rel.to.match(/ref\(['"]([^'"]+)['"]\)/);
          if (match) {
            hints.push(`fk:${match[1]}`);
          }
        }
      }
      // Handle dbt_constraints for primary key
      if ('dbt_constraints' in test) {
        const constraint = test.dbt_constraints as { type?: string };
        if (constraint.type === 'primary_key') {
          hints.push('primary_key');
        }
      }
    }
  }

  return hints;
}

/**
 * Parse a dbt schema.yml file and extract model definitions.
 * @param content - Raw YAML content
 * @param schemaPath - Path to the schema file (e.g., "models/marts/_schema.yml")
 * @returns Array of parsed models
 */
export function parseSchemaYml(content: string, schemaPath: string): DbtModel[] {
  const parsed = parseYaml(content) as RawSchemaYml;

  if (!parsed?.models || !Array.isArray(parsed.models)) {
    return [];
  }

  const schemaDir = dirname(schemaPath);

  return parsed.models.map((model): DbtModel => {
    const columns: DbtColumn[] = (model.columns || []).map((col) => ({
      name: col.name,
      description: col.description || '',
      data_type: col.data_type,
      hints: col.tests ? extractHintsFromTests(col.tests) : [],
    }));

    return {
      name: model.name,
      path: join(schemaDir, `${model.name}.sql`),
      description: model.description || 'No description',
      tags: model.tags || [],
      meta: model.meta || {},
      columns,
    };
  });
}

/**
 * Parse dbt_project.yml to get project-level config.
 */
export function parseProjectYml(content: string): {
  name: string;
  version?: string;
  profile?: string;
  modelPaths: string[];
  vars: Record<string, unknown>;
} {
  const parsed = parseYaml(content) as Record<string, unknown>;

  return {
    name: (parsed.name as string) || 'unknown',
    version: parsed.version as string | undefined,
    profile: parsed.profile as string | undefined,
    modelPaths: (parsed['model-paths'] as string[]) || (parsed.model_paths as string[]) || ['models'],
    vars: (parsed.vars as Record<string, unknown>) || {},
  };
}
