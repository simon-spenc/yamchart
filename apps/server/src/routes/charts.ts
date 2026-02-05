import type { FastifyInstance } from 'fastify';
import type { ConfigLoader } from '../services/config-loader.js';
import type { QueryService } from '../services/query-service.js';

export interface ChartRoutesOptions {
  configLoader: ConfigLoader;
  queryService: QueryService;
}

export async function chartRoutes(
  fastify: FastifyInstance,
  options: ChartRoutesOptions
) {
  const { configLoader, queryService } = options;

  // Get chart definition
  fastify.get<{ Params: { name: string } }>(
    '/api/charts/:name',
    async (request, reply) => {
      const { name } = request.params;
      const chart = configLoader.getChartByName(name);

      if (!chart) {
        return reply.status(404).send({ error: `Chart not found: ${name}` });
      }

      return {
        name: chart.name,
        title: chart.title,
        description: chart.description,
        parameters: chart.parameters ?? [],
        chart: chart.chart,
      };
    }
  );

  // Execute chart query (with optional config inclusion)
  fastify.post<{
    Params: { name: string };
    Body: Record<string, unknown>;
    Querystring: { includeConfig?: string };
  }>('/api/charts/:name/query', async (request, reply) => {
    const { name } = request.params;
    const params = request.body ?? {};
    const includeConfig = request.query.includeConfig === 'true';

    const chart = configLoader.getChartByName(name);
    if (!chart) {
      return reply.status(404).send({ error: `Chart not found: ${name}` });
    }

    try {
      const result = await queryService.executeChart(chart, params);

      // Set cache headers
      reply.header('X-Cache', result.cached ? 'HIT' : 'MISS');
      reply.header('X-Query-Duration-Ms', result.durationMs.toFixed(0));

      const response: Record<string, unknown> = {
        columns: result.columns,
        rows: result.rows,
        meta: {
          cached: result.cached,
          durationMs: result.durationMs,
          rowCount: result.rowCount,
          cacheKey: result.cacheKey,
        },
      };

      // Include chart config if requested (reduces round trips)
      if (includeConfig) {
        response.config = {
          name: chart.name,
          title: chart.title,
          description: chart.description,
          parameters: chart.parameters ?? [],
          chart: chart.chart,
        };
      }

      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Query execution failed';
      return reply.status(500).send({ error: message });
    }
  });

  // Batch query multiple charts
  fastify.post<{
    Body: {
      charts: Array<{ name: string; params?: Record<string, unknown> }>;
      includeConfig?: boolean;
    };
  }>('/api/charts/batch', async (request, reply) => {
    const { charts, includeConfig } = request.body;

    if (!charts || !Array.isArray(charts)) {
      return reply.status(400).send({ error: 'charts array is required' });
    }

    const results = await Promise.all(
      charts.map(async ({ name, params = {} }) => {
        const chart = configLoader.getChartByName(name);
        if (!chart) {
          return { name, error: `Chart not found: ${name}` };
        }

        try {
          const result = await queryService.executeChart(chart, params);

          const response: Record<string, unknown> = {
            name,
            columns: result.columns,
            rows: result.rows,
            meta: {
              cached: result.cached,
              durationMs: result.durationMs,
              rowCount: result.rowCount,
            },
          };

          if (includeConfig) {
            response.config = {
              name: chart.name,
              title: chart.title,
              description: chart.description,
              parameters: chart.parameters ?? [],
              chart: chart.chart,
            };
          }

          return response;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Query failed';
          return { name, error: message };
        }
      })
    );

    return { results };
  });

  // Invalidate chart cache
  fastify.post<{ Params: { name: string } }>(
    '/api/charts/:name/invalidate',
    async (request, reply) => {
      const { name } = request.params;

      const chart = configLoader.getChartByName(name);
      if (!chart) {
        return reply.status(404).send({ error: `Chart not found: ${name}` });
      }

      queryService.invalidateChart(name);

      return { success: true, message: `Cache invalidated for chart: ${name}` };
    }
  );

  // Get dynamic parameter options
  fastify.get<{ Params: { chartName: string; paramName: string } }>(
    '/api/charts/:chartName/parameters/:paramName/options',
    async (request, reply) => {
      const { chartName, paramName } = request.params;

      const chart = configLoader.getChartByName(chartName);
      if (!chart) {
        return reply.status(404).send({ error: `Chart not found: ${chartName}` });
      }

      const param = chart.parameters?.find((p) => p.name === paramName);
      if (!param) {
        return reply.status(404).send({ error: `Parameter not found: ${paramName}` });
      }

      if (param.type !== 'dynamic_select' || !param.source) {
        return reply.status(400).send({
          error: `Parameter ${paramName} is not a dynamic_select type or has no source`,
        });
      }

      try {
        const result = await queryService.executeParameterOptions(
          param.source.model,
          param.source.value_field,
          param.source.label_field
        );

        return { options: result };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to fetch options';
        return reply.status(500).send({ error: message });
      }
    }
  );
}
