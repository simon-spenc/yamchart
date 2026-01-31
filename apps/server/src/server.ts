import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { ConfigLoader } from './services/config-loader.js';
import { MemoryCache, parseTtl } from './services/cache.js';
import { QueryService } from './services/query-service.js';
import { configRoutes, chartRoutes } from './routes/index.js';
import { DuckDBConnector, type Connector } from '@dashbook/query';
import type { DuckDBConnection, ModelMetadata } from '@dashbook/schema';

export interface ServerOptions {
  projectDir: string;
  port?: number;
  host?: string;
  watch?: boolean;
}

export interface DashbookServer {
  fastify: FastifyInstance;
  configLoader: ConfigLoader;
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

export async function createServer(options: ServerOptions): Promise<DashbookServer> {
  const { projectDir, port = 3001, host = '0.0.0.0', watch = false } = options;

  // Initialize Fastify
  const fastify = Fastify({ logger: true });
  await fastify.register(cors, { origin: true });

  // Load config
  const configLoader = new ConfigLoader(projectDir);
  await configLoader.load();

  // Get default connection and create connector
  const defaultConnection = configLoader.getDefaultConnection();
  if (!defaultConnection) {
    throw new Error('No connection configured');
  }

  let connector: Connector;
  if (defaultConnection.type === 'duckdb') {
    const duckdbConfig = defaultConnection as DuckDBConnection;
    connector = new DuckDBConnector({ path: duckdbConfig.config.path });
    await connector.connect();
  } else {
    throw new Error(`Unsupported connection type: ${defaultConnection.type}`);
  }

  // Setup cache
  const project = configLoader.getProject();
  const cacheTtl = project.defaults?.cache_ttl
    ? parseTtl(project.defaults.cache_ttl)
    : 5 * 60 * 1000; // 5 minutes default

  const cache = new MemoryCache({
    maxSize: 1000,
    defaultTtlMs: cacheTtl,
  });

  // Build model refs
  const models: Record<string, { metadata: ModelMetadata; sql: string }> = {};
  const refs: Record<string, string> = {};

  for (const model of configLoader.getModels()) {
    models[model.metadata.name] = {
      metadata: model.metadata,
      sql: model.sql,
    };
    // For MVP, ref resolves to table name directly
    refs[model.metadata.name] = model.metadata.name;
  }

  // Add base table refs (assume table names match for MVP)
  // In production, this would come from schema introspection
  refs['orders'] = 'orders';
  refs['customers'] = 'customers';
  refs['products'] = 'products';

  // Create query service
  const queryService = new QueryService({
    connector,
    cache,
    models,
    refs,
  });

  // Register routes
  fastify.get('/api/health', async () => ({
    status: 'ok',
    version: '0.1.0',
    project: project.name,
  }));

  await fastify.register(configRoutes, { configLoader });
  await fastify.register(chartRoutes, { configLoader, queryService });

  // Setup file watching for hot reload
  if (watch) {
    configLoader.startWatching();
    configLoader.onChange(() => {
      fastify.log.info('Config reloaded');
      // Invalidate all cache on config change
      queryService.invalidateAll();
    });
  }

  return {
    fastify,
    configLoader,
    start: async () => {
      await fastify.listen({ port, host });
      console.log(`
  ┌─────────────────────────────────────────┐
  │                                         │
  │   Dashbook Server v0.1.0                │
  │                                         │
  │   API:     http://localhost:${String(port).padEnd(13)}│
  │   Project: ${project.name.padEnd(27)}│
  │                                         │
  │   Charts:  ${String(configLoader.getCharts().length).padEnd(27)}│
  │   Models:  ${String(configLoader.getModels().length).padEnd(27)}│
  │   Connection: ${(defaultConnection.name + ' (' + defaultConnection.type + ')').padEnd(22)}│
  │                                         │
  └─────────────────────────────────────────┘
      `);
    },
    stop: async () => {
      await configLoader.stop();
      await connector.disconnect();
      await fastify.close();
    },
  };
}
