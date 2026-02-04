// API Response Types

export interface Column {
  name: string;
  type: string;
}

export interface QueryMeta {
  cached: boolean;
  durationMs: number;
  rowCount: number;
  cacheKey: string;
}

export interface QueryResponse {
  columns: Column[];
  rows: Array<Record<string, unknown>>;
  meta: QueryMeta;
}

export interface ParameterSource {
  model: string;
  value_field: string;
  label_field: string;
}

export interface ChartParameter {
  name: string;
  type: 'date_range' | 'select' | 'multi_select' | 'dynamic_select' | 'text' | 'number';
  label?: string;
  default?: string | number | string[];
  options?: Array<string | { value: string; label: string }>;
  source?: ParameterSource;
}

export interface ParameterOption {
  value: string;
  label: string;
}

export interface ParameterOptionsResponse {
  options: ParameterOption[];
}

export interface AxisConfig {
  field: string;
  type: 'temporal' | 'quantitative' | 'ordinal' | 'nominal';
  format?: string;
  label?: string;
}

export interface ChartConfig {
  type: 'line' | 'bar' | 'area' | 'scatter' | 'pie' | 'table' | 'metric' | 'kpi';
  x?: AxisConfig;
  y?: AxisConfig;
  series?: Array<{
    field: string;
    name?: string;
    color?: string;
  }>;
  // KPI-specific fields
  value?: { field: string };
  format?: { type: string; currency?: string; decimals?: number };
  comparison?: {
    enabled: boolean;
    field: string;
    label?: string;
    type: 'percent_change' | 'absolute';
  };
}

export interface ChartDefinition {
  name: string;
  title: string;
  description?: string;
  parameters: ChartParameter[];
  chart: ChartConfig;
}

export interface ProjectConfig {
  name: string;
  version: string;
  description?: string;
  charts: Array<{
    name: string;
    title: string;
    description?: string;
    type: string;
  }>;
  connections: Array<{
    name: string;
    type: string;
    description?: string;
  }>;
}

export interface HealthResponse {
  status: 'ok' | 'error';
  version: string;
  project: string;
}

// Dashboard Types

export interface DashboardWidget {
  type: 'chart' | 'text';
  ref?: string;
  content?: string;
  cols: number;
}

export interface DashboardRow {
  height: number;
  widgets: DashboardWidget[];
}

export interface DashboardLayout {
  gap?: number;
  rows: DashboardRow[];
}

export interface DashboardSummary {
  name: string;
  title: string;
  description?: string;
}

export interface Dashboard extends DashboardSummary {
  filters?: string[];
  layout: DashboardLayout;
  branch: string;
}

export interface BranchesResponse {
  current: string;
  branches: string[];
}

export interface SaveDashboardResponse {
  success: boolean;
  commit?: string;
  branch?: string;
}
