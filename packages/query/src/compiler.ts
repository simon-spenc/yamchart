import type { Chart, ModelMetadata } from '@yamchart/schema';
import { renderTemplate, createTemplateContext, type ModelRefs } from './template.js';
import { expandDatePreset, isDatePreset, isCustomDateRange, expandCustomDateRange } from './presets.js';
import { createHash } from 'node:crypto';

export interface CompiledQuery {
  sql: string;
  params: Record<string, unknown>;
  cacheKey: string;
  chartName: string;
}

export interface CompilerConfig {
  models: Record<string, { metadata: ModelMetadata; sql: string }>;
  refs: ModelRefs;
}

export class QueryCompiler {
  private models: Map<string, { metadata: ModelMetadata; sql: string }>;
  private refs: ModelRefs;

  constructor(config: CompilerConfig) {
    this.models = new Map(Object.entries(config.models));
    this.refs = config.refs;
  }

  /**
   * Compile a chart definition into an executable SQL query.
   */
  compile(chart: Chart, inputParams: Record<string, unknown>): CompiledQuery {
    // Get SQL template
    const { sql, modelParams } = this.getSQL(chart);

    // Merge parameters: model defaults < chart defaults < input params
    const params = this.resolveParams(chart, modelParams, inputParams);

    // Expand date presets
    const expandedParams = this.expandPresets(params);

    // Create template context with params and refs
    const context = createTemplateContext(expandedParams, this.refs);

    // Render template
    const renderedSQL = renderTemplate(sql, context);

    // Generate cache key
    const cacheKey = this.generateCacheKey(chart.name, renderedSQL, expandedParams);

    return {
      sql: renderedSQL,
      params: expandedParams,
      cacheKey,
      chartName: chart.name,
    };
  }

  private getSQL(chart: Chart): { sql: string; modelParams: ModelMetadata['params'] } {
    if (chart.source.sql) {
      return { sql: chart.source.sql, modelParams: undefined };
    }

    if (chart.source.model) {
      const model = this.models.get(chart.source.model);
      if (!model) {
        throw new Error(`Unknown model: ${chart.source.model}`);
      }
      return { sql: model.sql, modelParams: model.metadata.params };
    }

    throw new Error('Chart source must specify either model or sql');
  }

  private resolveParams(
    chart: Chart,
    modelParams: ModelMetadata['params'],
    inputParams: Record<string, unknown>
  ): Record<string, unknown> {
    const params: Record<string, unknown> = {};

    // Apply model parameter defaults
    if (modelParams) {
      for (const param of modelParams) {
        if (param.default !== undefined) {
          params[param.name] = param.default;
        }
      }
    }

    // Apply chart parameter defaults
    if (chart.parameters) {
      for (const param of chart.parameters) {
        if (param.default !== undefined) {
          params[param.name] = param.default;
        }
      }
    }

    // Apply input params (overrides defaults)
    Object.assign(params, inputParams);

    return params;
  }

  private expandPresets(params: Record<string, unknown>): Record<string, unknown> {
    const expanded: Record<string, unknown> = { ...params };

    // Check for date_range and expand it (preset string or custom range object)
    if (isCustomDateRange(params.date_range)) {
      const dateRange = expandCustomDateRange(params.date_range);
      expanded.start_date = dateRange.start_date;
      expanded.end_date = dateRange.end_date;
    } else if (typeof params.date_range === 'string' && isDatePreset(params.date_range)) {
      const dateRange = expandDatePreset(params.date_range);
      if (dateRange) {
        expanded.start_date = dateRange.start_date;
        expanded.end_date = dateRange.end_date;
      }
    }

    return expanded;
  }

  private generateCacheKey(
    chartName: string,
    sql: string,
    params: Record<string, unknown>
  ): string {
    const sqlHash = createHash('sha256').update(sql).digest('hex').slice(0, 8);
    const paramsHash = createHash('sha256')
      .update(JSON.stringify(params, Object.keys(params).sort()))
      .digest('hex')
      .slice(0, 8);

    return `${chartName}:${sqlHash}:${paramsHash}`;
  }

  /**
   * Add or update a model in the compiler.
   */
  addModel(name: string, metadata: ModelMetadata, sql: string): void {
    this.models.set(name, { metadata, sql });
  }

  /**
   * Add or update a ref mapping.
   */
  addRef(name: string, target: string): void {
    this.refs[name] = target;
  }
}
