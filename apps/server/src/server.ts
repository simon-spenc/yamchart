import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { ConfigLoader } from './services/config-loader.js';
import { MemoryCache, parseTtl } from './services/cache.js';
import { QueryService } from './services/query-service.js';
import { configRoutes, chartRoutes, dashboardRoutes } from './routes/index.js';
import { GitService } from './services/git-service.js';
import { DuckDBConnector, PostgresConnector, resolvePostgresAuth, type Connector } from '@yamchart/query';
import type { DuckDBConnection, PostgresConnection, ModelMetadata } from '@yamchart/schema';
import { initAuthServer, authMiddleware, orgMiddleware } from './middleware/index.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { access, readFile } from 'fs/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Read version from package.json
const packageJsonPath = join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));
const VERSION = packageJson.version;

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
    staticDir = join(__dirname, 'public'),
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
    // Resolve path relative to project directory
    const dbPath = duckdbConfig.config.path.startsWith('/')
      ? duckdbConfig.config.path
      : join(projectDir, duckdbConfig.config.path);
    connector = new DuckDBConnector({ path: dbPath });
    await connector.connect();
  } else if (defaultConnection.type === 'postgres') {
    const pgConnection = defaultConnection as PostgresConnection;
    const credentials = resolvePostgresAuth(pgConnection);

    connector = new PostgresConnector({
      host: pgConnection.config.host,
      port: pgConnection.config.port,
      database: pgConnection.config.database,
      schema: pgConnection.config.schema,
      ssl: pgConnection.config.ssl,
      user: credentials.user,
      password: credentials.password,
      min: pgConnection.pool?.min_connections,
      max: pgConnection.pool?.max_connections,
      idleTimeoutMillis: pgConnection.pool?.idle_timeout,
      statementTimeout: pgConnection.query?.timeout,
    });
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

  // Build connection info for health endpoint (excluding sensitive data)
  const connectionInfo = {
    name: defaultConnection.name,
    type: defaultConnection.type,
    ...(defaultConnection.type === 'duckdb' && {
      path: (defaultConnection as DuckDBConnection).config.path,
    }),
    ...(defaultConnection.type === 'postgres' && {
      host: (defaultConnection as PostgresConnection).config.host,
      port: (defaultConnection as PostgresConnection).config.port,
      database: (defaultConnection as PostgresConnection).config.database,
      schema: (defaultConnection as PostgresConnection).config.schema,
    }),
  };

  // Register API routes
  fastify.get('/api/health', async () => ({
    status: 'ok',
    version: VERSION,
    project: project.name,
    environment: process.env.NODE_ENV || 'development',
    connection: connectionInfo,
  }));

  // Config and chart routes
  // When auth is enabled, these can be wrapped in protected routes
  if (auth) {
    // Protected routes - require authentication and org membership
    await fastify.register(async (protectedRoutes) => {
      protectedRoutes.addHook('preHandler', authMiddleware);
      protectedRoutes.addHook('preHandler', orgMiddleware);

      await protectedRoutes.register(configRoutes, { configLoader, projectDir, queryService });
      await protectedRoutes.register(chartRoutes, { configLoader, queryService });
      await protectedRoutes.register(dashboardRoutes, { configLoader, gitService, projectDir, queryService });
    });
  } else {
    // Public routes - no auth required (development/local mode)
    await fastify.register(configRoutes, { configLoader, projectDir, queryService });
    await fastify.register(chartRoutes, { configLoader, queryService });
    await fastify.register(dashboardRoutes, { configLoader, gitService, projectDir, queryService });
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

  // Helper to build models and refs from configLoader
  function buildModelsAndRefs() {
    const models: Record<string, { metadata: ModelMetadata; sql: string }> = {};
    const refs: Record<string, string> = {};

    for (const model of configLoader.getModels()) {
      models[model.metadata.name] = {
        metadata: model.metadata,
        sql: model.sql,
      };
      refs[model.metadata.name] = model.metadata.name;
    }

    // Add base table refs
    refs['orders'] = 'orders';
    refs['customers'] = 'customers';
    refs['products'] = 'products';

    return { models, refs };
  }

  // Setup file watching for hot reload
  if (watch) {
    configLoader.startWatching();
    configLoader.onChange(() => {
      fastify.log.info('Config reloaded');
      // Update the compiler with new models
      const { models: newModels, refs: newRefs } = buildModelsAndRefs();
      queryService.updateCompiler({ models: newModels, refs: newRefs });
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
  │   Yamchart Server v0.1.0                │
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
