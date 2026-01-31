import { z } from 'zod';

// Default settings
const DefaultsSchema = z.object({
  connection: z.string().optional(),
  theme: z.string().optional(),
  timezone: z.string().optional(),
  cache_ttl: z.string().optional(),
});

// Environment-specific settings
const EnvironmentSchema = z.object({
  connection: z.string().optional(),
  base_url: z.string().url().optional(),
});

// Git integration settings
const GitSchema = z.object({
  provider: z.enum(['github', 'gitlab', 'bitbucket']).optional(),
  repo: z.string().optional(),
  branch: z.string().optional(),
  preview_branches: z.boolean().optional(),
});

// Authentication settings
const AuthSchema = z.object({
  provider: z.enum(['oidc', 'saml', 'api_key']).optional(),
  issuer: z.string().optional(),
  client_id: z.string().optional(),
});

// Feature flags
const FeaturesSchema = z.object({
  enable_sql_editor: z.boolean().optional(),
  enable_csv_export: z.boolean().optional(),
  enable_scheduling: z.boolean().optional(),
});

// Main project schema
export const ProjectSchema = z.object({
  version: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),

  defaults: DefaultsSchema.optional(),

  environments: z.record(z.string(), EnvironmentSchema).optional(),

  git: GitSchema.optional(),
  auth: AuthSchema.optional(),
  features: FeaturesSchema.optional(),
});

export type Project = z.infer<typeof ProjectSchema>;
export type Defaults = z.infer<typeof DefaultsSchema>;
export type Environment = z.infer<typeof EnvironmentSchema>;
