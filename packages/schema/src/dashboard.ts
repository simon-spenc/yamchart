import { z } from 'zod';

// Widget types
const ChartWidgetSchema = z.object({
  type: z.literal('chart'),
  ref: z.string().min(1),
  cols: z.number().min(1).max(12),
});

const TextWidgetSchema = z.object({
  type: z.literal('text'),
  content: z.string().min(1),
  cols: z.number().min(1).max(12),
});

const WidgetSchema = z.discriminatedUnion('type', [
  ChartWidgetSchema,
  TextWidgetSchema,
]);

// Row configuration
const RowSchema = z.object({
  height: z.number().min(50),
  widgets: z.array(WidgetSchema).min(1),
});

// Layout configuration
const LayoutSchema = z.object({
  gap: z.number().min(0).default(16),
  rows: z.array(RowSchema).min(1),
});

// Main dashboard schema
export const DashboardSchema = z.object({
  // Identity
  name: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),

  // Filters inherited by all widgets
  filters: z.array(z.string()).optional(),

  // Layout definition
  layout: LayoutSchema,
});

export type Dashboard = z.infer<typeof DashboardSchema>;
export type DashboardLayout = z.infer<typeof LayoutSchema>;
export type DashboardRow = z.infer<typeof RowSchema>;
export type DashboardWidget = z.infer<typeof WidgetSchema>;
export type ChartWidget = z.infer<typeof ChartWidgetSchema>;
export type TextWidget = z.infer<typeof TextWidgetSchema>;
