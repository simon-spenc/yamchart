import { z } from 'zod';

// Column extracted from dbt schema.yml
export const DbtColumnSchema = z.object({
  name: z.string(),
  description: z.string().optional().default(''),
  data_type: z.string().optional(),
  hints: z.array(z.string()).optional().default([]),
});

export type DbtColumn = z.infer<typeof DbtColumnSchema>;

// Model extracted from dbt schema.yml
export const DbtModelSchema = z.object({
  name: z.string(),
  path: z.string(), // relative path to .sql file
  description: z.string().optional().default('No description'),
  table: z.string().optional(), // fully qualified table name
  tags: z.array(z.string()).optional().default([]),
  meta: z.record(z.unknown()).optional().default({}),
  columns: z.array(DbtColumnSchema).optional().default([]),
});

export type DbtModel = z.infer<typeof DbtModelSchema>;

// Summary for listing (before full details loaded)
export interface DbtModelSummary {
  name: string;
  path: string;
  description: string;
  tags: string[];
}

// dbt_project.yml config
export const DbtProjectConfigSchema = z.object({
  name: z.string(),
  version: z.string().optional(),
  profile: z.string().optional(),
  model_paths: z.array(z.string()).optional().default(['models']),
  target_path: z.string().optional().default('target'),
  vars: z.record(z.unknown()).optional().default({}),
});

export type DbtProjectConfig = z.infer<typeof DbtProjectConfigSchema>;

// Interface for dbt sources (local, github, dbt-cloud)
export interface DbtSource {
  type: 'local' | 'github' | 'dbt-cloud';

  // Get project-level config
  getProjectConfig(): Promise<DbtProjectConfig>;

  // List all models (summaries for selection UI)
  listModels(): Promise<DbtModelSummary[]>;

  // Get full model details
  getModel(name: string): Promise<DbtModel>;

  // Get all models matching filter
  getModels(names: string[]): Promise<DbtModel[]>;
}

// Sync configuration saved to .yamchart/dbt-source.yaml
export const DbtSourceConfigSchema = z.object({
  source: z.enum(['local', 'github', 'dbt-cloud']),
  path: z.string().optional(), // for local
  repo: z.string().optional(), // for github
  branch: z.string().optional(), // for github
  lastSync: z.string(), // ISO timestamp
  filters: z.object({
    include: z.array(z.string()).default([]),
    exclude: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
  }),
  stats: z.object({
    modelsIncluded: z.number(),
    modelsExcluded: z.number(),
  }),
});

export type DbtSourceConfig = z.infer<typeof DbtSourceConfigSchema>;
