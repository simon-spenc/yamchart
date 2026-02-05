# Connections Reference

Connections define how Yamchart connects to your data sources.

## Basic Structure

```yaml
name: my-connection         # Unique identifier (required)
type: duckdb               # Database type (required)
description: Description   # Optional description
# ... type-specific config
```

## DuckDB

Local analytics database, great for development and file-based data.

```yaml
name: local
type: duckdb
path: ./data/analytics.duckdb
```

| Field | Required | Description |
|-------|----------|-------------|
| `path` | Yes | Path to DuckDB file (relative to project root) |

### In-Memory DuckDB

```yaml
name: memory
type: duckdb
path: :memory:
```

## PostgreSQL

Connect to PostgreSQL and compatible databases (CockroachDB, TimescaleDB, etc.).

```yaml
name: warehouse
type: postgres
host: db.example.com
port: 5432
database: analytics
user: ${POSTGRES_USER}
password: ${POSTGRES_PASSWORD}
ssl: true
schema: public
```

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `host` | Yes | - | Database hostname |
| `port` | No | `5432` | Database port |
| `database` | Yes | - | Database name |
| `user` | Yes | - | Username |
| `password` | Yes | - | Password |
| `ssl` | No | `false` | Enable SSL/TLS |
| `schema` | No | `public` | Default schema |

### Environment Variables

Use `${VAR_NAME}` syntax to reference environment variables:

```yaml
name: production
type: postgres
host: ${DATABASE_HOST}
database: ${DATABASE_NAME}
user: ${DATABASE_USER}
password: ${DATABASE_PASSWORD}
ssl: true
```

Set variables in your environment or `.env` file:

```bash
DATABASE_HOST=db.example.com
DATABASE_NAME=analytics
DATABASE_USER=readonly
DATABASE_PASSWORD=secret123
```

### SSL Configuration

```yaml
# Simple SSL
ssl: true

# SSL with options (for self-signed certs)
ssl:
  rejectUnauthorized: false
```

### Connection Pooling

PostgreSQL connections use pooling by default:
- Pool size: 10 connections
- Idle timeout: 30 seconds

## MySQL

Connect to MySQL and compatible databases (MariaDB, PlanetScale, etc.).

```yaml
name: mysql-db
type: mysql

config:
  host: db.example.com
  port: 3306
  database: analytics
  ssl: true

auth:
  type: env
  user_var: MYSQL_USER
  password_var: MYSQL_PASSWORD
```

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `host` | Yes | - | Database hostname |
| `port` | No | `3306` | Database port |
| `database` | Yes | - | Database name |
| `ssl` | No | `false` | Enable SSL/TLS |

Without an `auth` block, uses `MYSQL_USER` and `MYSQL_PASSWORD` environment variables.

## SQLite

Lightweight file-based database, great for local development and small datasets.

```yaml
name: local-sqlite
type: sqlite

config:
  path: ./data/analytics.db
```

| Field | Required | Description |
|-------|----------|-------------|
| `path` | Yes | Path to SQLite file (relative to project root), or `:memory:` |

### In-Memory SQLite

```yaml
name: memory
type: sqlite

config:
  path: :memory:
```

## Snowflake

Connect to Snowflake data warehouse.

```yaml
name: snowflake-warehouse
type: snowflake

config:
  account: your-account.us-east-1
  warehouse: COMPUTE_WH
  database: ANALYTICS
  schema: PUBLIC
  role: ANALYST

auth:
  type: env
  user_var: SNOWFLAKE_USER
  password_var: SNOWFLAKE_PASSWORD
```

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `account` | Yes | - | Snowflake account identifier |
| `warehouse` | Yes | - | Compute warehouse name |
| `database` | Yes | - | Database name |
| `schema` | No | `PUBLIC` | Default schema |
| `role` | No | - | Role to use |

### Key Pair Authentication

For service accounts, use key pair authentication:

```yaml
auth:
  type: key_pair
  user_var: SNOWFLAKE_USER
  private_key_path: /path/to/rsa_key.p8
```

## Setting Default Connection

In `yamchart.yaml`, set the default connection:

```yaml
name: my-project
version: "1.0"
defaults:
  connection: warehouse    # Used when chart doesn't specify one
```

## Per-Chart Connection Override

Charts can override the default connection:

```yaml
# charts/external-data.yaml
name: external-data
source:
  model: external_metrics
  connection: external-db  # Uses this connection instead of default
```

## Multiple Connections

You can define multiple connections for different data sources:

```yaml
# connections/duckdb-local.yaml
name: local
type: duckdb
path: ./sample-data.duckdb
```

```yaml
# connections/postgres-prod.yaml
name: production
type: postgres
host: ${PROD_DB_HOST}
database: analytics
user: ${PROD_DB_USER}
password: ${PROD_DB_PASSWORD}
ssl: true
```

```yaml
# connections/postgres-staging.yaml
name: staging
type: postgres
host: ${STAGING_DB_HOST}
database: analytics
user: ${STAGING_DB_USER}
password: ${STAGING_DB_PASSWORD}
```

## Supported Connectors

| Database | Status |
|----------|--------|
| DuckDB | ✅ Supported |
| PostgreSQL | ✅ Supported |
| MySQL | ✅ Supported |
| SQLite | ✅ Supported |
| Snowflake | ✅ Supported |
| BigQuery | Planned |
| ClickHouse | Planned |

## Security Best Practices

1. **Never commit credentials** - Use environment variables
2. **Use read-only users** - Create dedicated analytics users with SELECT-only permissions
3. **Enable SSL** - Always use SSL for production connections
4. **Restrict IP access** - Use firewall rules to limit database access
5. **Rotate credentials** - Regularly update passwords and access keys
