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

  // Execute chart query
  fastify.post<{
    Params: { name: string };
    Body: Record<string, unknown>;
  }>('/api/charts/:name/query', async (request, reply) => {
    const { name } = request.params;
    const params = request.body ?? {};

    const chart = configLoader.getChartByName(name);
    if (!chart) {
      return reply.status(404).send({ error: `Chart not found: ${name}` });
    }

    try {
      const result = await queryService.executeChart(chart, params);

      return {
        columns: result.columns,
        rows: result.rows,
        meta: {
          cached: result.cached,
          durationMs: result.durationMs,
          rowCount: result.rowCount,
          cacheKey: result.cacheKey,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Query execution failed';
      return reply.status(500).send({ error: message });
    }
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
}
