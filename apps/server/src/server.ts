import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { ConfigLoader } from './services/config-loader.js';
import { MemoryCache, parseTtl } from './services/cache.js';
import { QueryService } from './services/query-service.js';
import { configRoutes, chartRoutes, dashboardRoutes } from './routes/index.js';
import { GitService } from './services/git-service.js';
import { DuckDBConnector, type Connector } from '@dashbook/query';
import type { DuckDBConnection, ModelMetadata } from '@dashbook/schema';
import { initAuthServer, authMiddleware, orgMiddleware } from './middleware/index.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { access } from 'fs/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface AuthConfig {
  supabaseUrl: string;
  supabaseServiceKey: string;
}

export interface ServerOptions {
  projectDir: string;
  port?: number;
  host?: string;
  watch?: boolean;
  serveStatic?: boolean;
  staticDir?: string;
  auth?: AuthConfig;
}

export interface DashbookServer {
  fastify: FastifyInstance;
  configLoader: ConfigLoader;
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

export async function createServer(options: ServerOptions): Promise<DashbookServer> {
  const {
    projectDir,
    port = 3001,
    host = '0.0.0.0',
    watch = false,
    serveStatic = process.env.NODE_ENV === 'production',
    staticDir = join(__dirname, '../../web/dist'),
    auth,
  } = options;

  // Initialize auth if configured
  if (auth) {
    initAuthServer(auth.supabaseUrl, auth.supabaseServiceKey);
  }

  // Initialize Fastify
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
  });

  // CORS only needed in development (when web is separate)
  if (!serveStatic) {
    await fastify.register(cors, { origin: true });
  }

  // Load config
  const configLoader = new ConfigLoader(projectDir);
  await configLoader.load();

  // Initialize Git service
  const gitService = new GitService(projectDir);

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

  // Register API routes
  fastify.get('/api/health', async () => ({
    status: 'ok',
    version: '0.1.0',
    project: project.name,
    environment: process.env.NODE_ENV || 'development',
  }));

  // Config and chart routes
  // When auth is enabled, these can be wrapped in protected routes
  if (auth) {
    // Protected routes - require authentication and org membership
    await fastify.register(async (protectedRoutes) => {
      protectedRoutes.addHook('preHandler', authMiddleware);
      protectedRoutes.addHook('preHandler', orgMiddleware);

      await protectedRoutes.register(configRoutes, { configLoader });
      await protectedRoutes.register(chartRoutes, { configLoader, queryService });
      await protectedRoutes.register(dashboardRoutes, { configLoader, gitService, projectDir });
    });
  } else {
    // Public routes - no auth required (development/local mode)
    await fastify.register(configRoutes, { configLoader });
    await fastify.register(chartRoutes, { configLoader, queryService });
    await fastify.register(dashboardRoutes, { configLoader, gitService, projectDir });
  }

  // Serve static files in production
  if (serveStatic) {
    try {
      await access(staticDir);
      await fastify.register(fastifyStatic, {
        root: staticDir,
        prefix: '/',
        decorateReply: false,
      });

      // SPA fallback - serve index.html for non-API routes
      fastify.setNotFoundHandler(async (request, reply) => {
        if (request.url.startsWith('/api/')) {
          return reply.status(404).send({ error: 'Not found' });
        }
        return reply.sendFile('index.html');
      });

      fastify.log.info(`Serving static files from ${staticDir}`);
    } catch {
      fastify.log.warn(`Static directory not found: ${staticDir}`);
    }
  }

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
      const mode = serveStatic ? 'Production' : 'Development';
      console.log(`
  ┌─────────────────────────────────────────┐
  │                                         │
  │   Dashbook Server v0.1.0                │
  │                                         │
  │   URL:     http://${host}:${port}         │
  │   Project: ${project.name.padEnd(27)}│
  │   Mode:    ${mode.padEnd(27)}│
  │                                         │
  │   Charts:  ${String(configLoader.getCharts().length).padEnd(27)}│
  │   Models:  ${String(configLoader.getModels().length).padEnd(27)}│
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
