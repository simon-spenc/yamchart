import { z } from 'zod';

// Auth configuration for connections
const EnvAuthSchema = z.object({
  type: z.literal('env'),
  user_var: z.string(),
  password_var: z.string(),
});

const KeyPairAuthSchema = z.object({
  type: z.literal('key_pair'),
  user_var: z.string(),
  private_key_path: z.string(),
});

const SecretManagerAuthSchema = z.object({
  type: z.literal('secret_manager'),
  provider: z.enum(['aws_secrets_manager', 'gcp_secret_manager', 'vault']),
  secret_id: z.string(),
});

const AuthSchema = z.discriminatedUnion('type', [
  EnvAuthSchema,
  KeyPairAuthSchema,
  SecretManagerAuthSchema,
]);

// Connection pool configuration
const PoolConfigSchema = z.object({
  min_connections: z.number().int().positive().optional(),
  max_connections: z.number().int().positive().optional(),
  idle_timeout: z.number().int().positive().optional(),
});

// Query settings
const QueryConfigSchema = z.object({
  timeout: z.number().int().positive().optional(),
  max_rows: z.number().int().positive().optional(),
});

// DuckDB-specific config
const DuckDBConfigSchema = z.object({
  path: z.string(), // file path or :memory:
});

// Postgres-specific config
const PostgresConfigSchema = z.object({
  host: z.string(),
  port: z.number().int().positive().default(5432),
  database: z.string(),
  schema: z.string().optional(),
  ssl: z.boolean().optional(),
});

// Snowflake-specific config
const SnowflakeConfigSchema = z.object({
  account: z.string(),
  warehouse: z.string(),
  database: z.string(),
  schema: z.string().optional(),
  role: z.string().optional(),
});

// MySQL-specific config
const MySQLConfigSchema = z.object({
  host: z.string(),
  port: z.number().int().positive().default(3306),
  database: z.string(),
  ssl: z.boolean().optional(),
});

// SQLite-specific config
const SQLiteConfigSchema = z.object({
  path: z.string(), // file path or :memory:
});

// Base connection schema
const BaseConnectionSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  pool: PoolConfigSchema.optional(),
  query: QueryConfigSchema.optional(),
});

// Type-specific connection schemas
const DuckDBConnectionSchema = BaseConnectionSchema.extend({
  type: z.literal('duckdb'),
  config: DuckDBConfigSchema,
  auth: z.undefined().optional(),
});

const PostgresConnectionSchema = BaseConnectionSchema.extend({
  type: z.literal('postgres'),
  config: PostgresConfigSchema,
  auth: AuthSchema.optional(),
});

const SnowflakeConnectionSchema = BaseConnectionSchema.extend({
  type: z.literal('snowflake'),
  config: SnowflakeConfigSchema,
  auth: AuthSchema,
});

const MySQLConnectionSchema = BaseConnectionSchema.extend({
  type: z.literal('mysql'),
  config: MySQLConfigSchema,
  auth: AuthSchema.optional(),
});

const SQLiteConnectionSchema = BaseConnectionSchema.extend({
  type: z.literal('sqlite'),
  config: SQLiteConfigSchema,
  auth: z.undefined().optional(),
});

// Union of all connection types
export const ConnectionSchema = z.discriminatedUnion('type', [
  DuckDBConnectionSchema,
  PostgresConnectionSchema,
  SnowflakeConnectionSchema,
  MySQLConnectionSchema,
  SQLiteConnectionSchema,
]);

export type Connection = z.infer<typeof ConnectionSchema>;
export type DuckDBConnection = z.infer<typeof DuckDBConnectionSchema>;
export type PostgresConnection = z.infer<typeof PostgresConnectionSchema>;
export type SnowflakeConnection = z.infer<typeof SnowflakeConnectionSchema>;
export type MySQLConnection = z.infer<typeof MySQLConnectionSchema>;
export type SQLiteConnection = z.infer<typeof SQLiteConnectionSchema>;
