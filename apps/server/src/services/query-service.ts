import {
  QueryCompiler,
  type Connector,
  type QueryResult,
  type CompilerConfig,
} from '@dashbook/query';
import type { Chart } from '@dashbook/schema';
import type { CacheProvider, CachedQueryResult } from './cache.js';

export interface ChartQueryResult extends QueryResult {
  cached: boolean;
  cacheKey: string;
}

export interface QueryServiceConfig extends CompilerConfig {
  connector: Connector;
  cache: CacheProvider;
}

export class QueryService {
  private compiler: QueryCompiler;
  private connector: Connector;
  private cache: CacheProvider;

  constructor(config: QueryServiceConfig) {
    this.compiler = new QueryCompiler({
      models: config.models,
      refs: config.refs,
    });
    this.connector = config.connector;
    this.cache = config.cache;
  }

  async executeChart(
    chart: Chart,
    params: Record<string, unknown>
  ): Promise<ChartQueryResult> {
    // Compile the query
    const compiled = this.compiler.compile(chart, params);

    // Check cache
    const cached = await this.cache.get(compiled.cacheKey);
    if (cached) {
      return {
        columns: cached.columns,
        rows: cached.rows,
        rowCount: cached.rowCount,
        durationMs: cached.durationMs,
        cached: true,
        cacheKey: compiled.cacheKey,
      };
    }

    // Execute query
    const result = await this.connector.execute(compiled.sql);

    // Store in cache
    const cacheEntry: CachedQueryResult = {
      columns: result.columns,
      rows: result.rows,
      rowCount: result.rowCount,
      durationMs: result.durationMs,
      cachedAt: Date.now(),
    };
    await this.cache.set(compiled.cacheKey, cacheEntry);

    return {
      ...result,
      cached: false,
      cacheKey: compiled.cacheKey,
    };
  }

  invalidateChart(chartName: string): void {
    this.cache.invalidatePattern(`${chartName}:*`);
  }

  invalidateAll(): void {
    this.cache.clear();
  }

  getCacheStats() {
    return this.cache.getStats();
  }
}
