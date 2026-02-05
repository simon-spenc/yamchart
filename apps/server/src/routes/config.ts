import type { FastifyInstance } from 'fastify';
import type { ConfigLoader } from '../services/config-loader.js';
import { testConnection } from '../services/connector-factory.js';

export interface ConfigRoutesOptions {
  configLoader: ConfigLoader;
  projectDir: string;
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
}
