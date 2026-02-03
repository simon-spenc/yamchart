export interface QueryResult {
  columns: Array<{
    name: string;
    type: string;
  }>;
  rows: Array<Record<string, unknown>>;
  rowCount: number;
  durationMs: number;
}

export interface Connector {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  execute(sql: string): Promise<QueryResult>;
  explain(sql: string): Promise<{ valid: boolean; error?: string }>;
  isConnected(): boolean;
}

export * from './duckdb.js';
export * from './postgres.js';
export * from './auth.js';
