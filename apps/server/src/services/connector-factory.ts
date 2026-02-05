import { DuckDBConnector, PostgresConnector, resolvePostgresAuth, type Connector } from '@yamchart/query';
import type { Connection, DuckDBConnection, PostgresConnection } from '@yamchart/schema';
import { join } from 'path';

export interface ConnectorFactoryOptions {
  projectDir: string;
}

/**
 * Create a connector from a connection config.
 * The connector is NOT connected - call connect() after creation.
 */
export function createConnectorFromConfig(
  connection: Connection,
  options: ConnectorFactoryOptions
): Connector {
  const { projectDir } = options;

  switch (connection.type) {
    case 'duckdb': {
      const duckdbConfig = connection as DuckDBConnection;
      // Resolve path relative to project directory
      const dbPath = duckdbConfig.config.path.startsWith('/')
        ? duckdbConfig.config.path
        : join(projectDir, duckdbConfig.config.path);
      return new DuckDBConnector({ path: dbPath });
    }

    case 'postgres': {
      const pgConnection = connection as PostgresConnection;
      const credentials = resolvePostgresAuth(pgConnection);

      return new PostgresConnector({
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
    }

    case 'snowflake':
      throw new Error('Snowflake connector not yet implemented');

    default:
      throw new Error(`Unsupported connection type: ${(connection as Connection).type}`);
  }
}

export interface ConnectionTestResult {
  name: string;
  type: string;
  status: 'healthy' | 'unhealthy';
  latencyMs: number;
  error?: string;
}

/**
 * Test a connection by connecting, running a simple query, and disconnecting.
 */
export async function testConnection(
  connection: Connection,
  options: ConnectorFactoryOptions
): Promise<ConnectionTestResult> {
  const start = performance.now();
  let connector: Connector | null = null;

  try {
    connector = createConnectorFromConfig(connection, options);
    await connector.connect();

    // Run a simple health check query
    const healthQuery = connection.type === 'duckdb' ? 'SELECT 1 AS health' : 'SELECT 1';
    await connector.execute(healthQuery);

    const latencyMs = performance.now() - start;

    return {
      name: connection.name,
      type: connection.type,
      status: 'healthy',
      latencyMs: Math.round(latencyMs),
    };
  } catch (err) {
    const latencyMs = performance.now() - start;

    // Handle errors - pg library may have empty message but error code
    let errorMessage = 'Unknown error';
    if (err instanceof Error) {
      const pgError = err as Error & { code?: string };
      errorMessage = err.message || pgError.code || 'Connection failed';
    } else {
      errorMessage = String(err);
    }

    return {
      name: connection.name,
      type: connection.type,
      status: 'unhealthy',
      latencyMs: Math.round(latencyMs),
      error: errorMessage,
    };
  } finally {
    if (connector) {
      try {
        await connector.disconnect();
      } catch {
        // Ignore disconnect errors
      }
    }
  }
}
