import { z } from 'zod';

// Axis types
const AxisTypeSchema = z.enum(['temporal', 'quantitative', 'ordinal', 'nominal']);

// Axis configuration
const AxisSchema = z.object({
  field: z.string().min(1),
  type: AxisTypeSchema,
  format: z.string().optional(),
  label: z.string().optional(),
});

// Chart types supported
const ChartTypeSchema = z.enum([
  'line',
  'bar',
  'area',
  'scatter',
  'pie',
  'table',
  'metric',
  'map',
  'heatmap',
  'funnel',
  'sankey',
  'treemap',
]);

// Series configuration for multi-series charts
const SeriesSchema = z.object({
  field: z.string().min(1),
  name: z.string().optional(),
  color: z.string().optional(),
  style: z.enum(['solid', 'dashed', 'dotted']).optional(),
});

// Annotation configuration
const LineAnnotationSchema = z.object({
  type: z.literal('line'),
  value: z.number(),
  label: z.string().optional(),
  color: z.string().optional(),
  style: z.enum(['solid', 'dashed', 'dotted']).optional(),
});

const BandAnnotationSchema = z.object({
  type: z.literal('band'),
  from: z.number(),
  to: z.number(),
  label: z.string().optional(),
  color: z.string().optional(),
});

const AnnotationSchema = z.discriminatedUnion('type', [
  LineAnnotationSchema,
  BandAnnotationSchema,
]);

// Interactivity options
const InteractionsSchema = z.object({
  tooltip: z.boolean().default(true),
  zoom: z.boolean().default(false),
  brush: z.boolean().default(false),
});

// Chart visualization config
const ChartConfigSchema = z.object({
  type: ChartTypeSchema,
  x: AxisSchema,
  y: AxisSchema,
  series: z.array(SeriesSchema).optional(),
  annotations: z.array(AnnotationSchema).optional(),
  interactions: InteractionsSchema.optional(),
});

// Parameter types
const ParameterTypeSchema = z.enum([
  'date_range',
  'select',
  'multi_select',
  'text',
  'number',
]);

// Parameter option
const ParameterOptionSchema = z.union([
  z.string(),
  z.object({
    value: z.string(),
    label: z.string(),
  }),
]);

// Parameter source (for dynamic options)
const ParameterSourceSchema = z.object({
  model: z.string(),
  value_field: z.string(),
  label_field: z.string(),
});

// Parameter definition
const ParameterSchema = z.object({
  name: z.string().min(1),
  type: ParameterTypeSchema,
  label: z.string().optional(),
  default: z.union([z.string(), z.number(), z.array(z.string())]).optional(),
  options: z.array(ParameterOptionSchema).optional(),
  source: ParameterSourceSchema.optional(),
});

// Data source - either model reference or inline SQL
const SourceSchema = z.object({
  model: z.string().optional(),
  sql: z.string().optional(),
}).refine(
  (data) => data.model !== undefined || data.sql !== undefined,
  { message: 'Source must specify either model or sql' }
).refine(
  (data) => !(data.model !== undefined && data.sql !== undefined),
  { message: 'Source cannot specify both model and sql' }
);

// Refresh/cache configuration
const RefreshSchema = z.object({
  schedule: z.string().optional(), // cron expression
  timezone: z.string().optional(),
  cache_ttl: z.string().optional(), // e.g., "1h", "30m"
});

// Main chart schema
export const ChartSchema = z.object({
  // Identity
  name: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),

  // Metadata
  owner: z.string().optional(),
  tags: z.array(z.string()).optional(),
  created: z.string().optional(),
  updated: z.string().optional(),

  // Data
  source: SourceSchema,
  parameters: z.array(ParameterSchema).optional(),

  // Visualization
  chart: ChartConfigSchema,

  // Caching
  refresh: RefreshSchema.optional(),
});

export type Chart = z.infer<typeof ChartSchema>;
export type ChartConfig = z.infer<typeof ChartConfigSchema>;
export type ChartType = z.infer<typeof ChartTypeSchema>;
export type Parameter = z.infer<typeof ParameterSchema>;
export type Axis = z.infer<typeof AxisSchema>;
