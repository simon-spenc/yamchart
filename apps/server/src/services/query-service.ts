import {
  QueryCompiler,
  type Connector,
  type QueryResult,
  type CompilerConfig,
  renderTemplate,
  createTemplateContext,
} from '@yamchart/query';
import type { Chart, ModelMetadata } from '@yamchart/schema';
import type { CacheProvider, CachedQueryResult } from './cache.js';

export interface ParameterOption {
  value: string;
  label: string;
}

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
  private models: Map<string, { metadata: ModelMetadata; sql: string }>;
  private refs: Record<string, string>;

  constructor(config: QueryServiceConfig) {
    this.compiler = new QueryCompiler({
      models: config.models,
      refs: config.refs,
    });
    this.connector = config.connector;
    this.cache = config.cache;
    this.models = new Map(Object.entries(config.models));
    this.refs = config.refs;
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

  /**
   * Update the compiler with new models and refs.
   * Called when config is reloaded.
   */
  updateCompiler(config: { models: Record<string, { metadata: ModelMetadata; sql: string }>; refs: Record<string, string> }): void {
    this.compiler = new QueryCompiler({
      models: config.models,
      refs: config.refs,
    });
    this.models = new Map(Object.entries(config.models));
    this.refs = config.refs;
  }

  getCacheStats() {
    return this.cache.getStats();
  }

  async executeParameterOptions(
    modelName: string,
    valueField: string,
    labelField: string
  ): Promise<ParameterOption[]> {
    const model = this.models.get(modelName);
    if (!model) {
      throw new Error(`Unknown model: ${modelName}`);
    }

    // Render the template with refs (no params needed for options queries)
    const context = createTemplateContext({}, this.refs);
    const sql = renderTemplate(model.sql, context);

    // Execute query
    const result = await this.connector.execute(sql);

    // Extract value and label from rows
    return result.rows.map((row) => ({
      value: String(row[valueField] ?? ''),
      label: String(row[labelField] ?? row[valueField] ?? ''),
    }));
  }
}
