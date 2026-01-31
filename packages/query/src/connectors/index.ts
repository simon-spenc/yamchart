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
  isConnected(): boolean;
}

export * from './duckdb.js';
