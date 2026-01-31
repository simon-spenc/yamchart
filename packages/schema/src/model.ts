import { z } from 'zod';

// Parameter type
const ParamTypeSchema = z.enum(['string', 'number', 'date', 'boolean', 'string[]', 'number[]']);

// Model parameter
const ModelParamSchema = z.object({
  name: z.string().min(1),
  type: ParamTypeSchema,
  default: z.string().optional(),
  options: z.array(z.string()).optional(), // For enum-like params
  description: z.string().optional(),
});

// Return column definition
const ReturnColumnSchema = z.object({
  name: z.string().min(1),
  type: z.string(),
  description: z.string().optional(),
});

// Model metadata (extracted from SQL comments)
export const ModelMetadataSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  owner: z.string().optional(),
  tags: z.array(z.string()).optional(),

  params: z.array(ModelParamSchema).optional(),
  returns: z.array(ReturnColumnSchema).optional(),
  tests: z.array(z.string()).optional(), // SQL assertions
});

// Full model (metadata + SQL)
export const ModelSchema = z.object({
  metadata: ModelMetadataSchema,
  sql: z.string().min(1),
  filePath: z.string().optional(),
});

export type ModelMetadata = z.infer<typeof ModelMetadataSchema>;
export type ModelParam = z.infer<typeof ModelParamSchema>;
export type ReturnColumn = z.infer<typeof ReturnColumnSchema>;
export type Model = z.infer<typeof ModelSchema>;
