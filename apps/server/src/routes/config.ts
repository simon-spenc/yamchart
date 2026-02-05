import type { FastifyInstance } from 'fastify';
import type { ConfigLoader } from '../services/config-loader.js';
import type { QueryService } from '../services/query-service.js';
import { testConnection } from '../services/connector-factory.js';

export interface ConfigRoutesOptions {
  configLoader: ConfigLoader;
  projectDir: string;
  queryService?: QueryService;
}

export async function configRoutes(
  fastify: FastifyInstance,
  options: ConfigRoutesOptions
) {
  const { configLoader } = options;

  // Get project config and available resources
  fastify.get('/api/config', async () => {
    const project = configLoader.getProject();
    const charts = configLoader.getCharts();
    const connections = configLoader.getConnections();

    return {
      name: project.name,
      version: project.version,
      description: project.description,
      defaults: project.defaults,
      charts: charts.map((c) => ({
        name: c.name,
        title: c.title,
        description: c.description,
        type: c.chart.type,
      })),
      connections: connections.map((c) => ({
        name: c.name,
        type: c.type,
        description: c.description,
      })),
    };
  });

  // Get all connections status
  fastify.get('/api/connections/status', async () => {
    const connections = configLoader.getConnections();
    const results = await Promise.all(
      connections.map((conn) => testConnection(conn, { projectDir: options.projectDir }))
    );
    return { connections: results };
  });

  // Get single connection status
  fastify.get<{ Params: { name: string } }>(
    '/api/connections/:name/status',
    async (request, reply) => {
      const { name } = request.params;
      const connection = configLoader.getConnectionByName(name);

      if (!connection) {
        return reply.status(404).send({ error: `Connection not found: ${name}` });
      }

      const result = await testConnection(connection, { projectDir: options.projectDir });
      return result;
    }
  );

  // Get cache statistics
  fastify.get('/api/cache/stats', async () => {
    if (!options.queryService) {
      return { error: 'Cache stats not available' };
    }

    const stats = options.queryService.getCacheStats();
    const hitRate = stats.hits + stats.misses > 0
      ? ((stats.hits / (stats.hits + stats.misses)) * 100).toFixed(1)
      : '0.0';

    return {
      size: stats.size,
      hits: stats.hits,
      misses: stats.misses,
      hitRate: `${hitRate}%`,
    };
  });

  // Clear cache
  fastify.post('/api/cache/clear', async () => {
    if (!options.queryService) {
      return { error: 'Cache not available' };
    }

    options.queryService.invalidateAll();
    return { success: true, message: 'Cache cleared' };
  });
}
