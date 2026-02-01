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

export interface ChartParameter {
  name: string;
  type: 'date_range' | 'select' | 'multi_select' | 'text' | 'number';
  label?: string;
  default?: string | number | string[];
  options?: Array<string | { value: string; label: string }>;
}

export interface AxisConfig {
  field: string;
  type: 'temporal' | 'quantitative' | 'ordinal' | 'nominal';
  format?: string;
  label?: string;
}

export interface ChartConfig {
  type: 'line' | 'bar' | 'area' | 'scatter' | 'pie' | 'table' | 'metric';
  x: AxisConfig;
  y: AxisConfig;
  series?: Array<{
    field: string;
    name?: string;
    color?: string;
  }>;
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
