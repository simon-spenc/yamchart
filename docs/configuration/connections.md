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

## Planned Connectors

| Database | Status |
|----------|--------|
| BigQuery | Planned |
| Snowflake | Planned |
| MySQL | Planned |
| SQLite | Planned |
| ClickHouse | Planned |

## Security Best Practices

1. **Never commit credentials** - Use environment variables
2. **Use read-only users** - Create dedicated analytics users with SELECT-only permissions
3. **Enable SSL** - Always use SSL for production connections
4. **Restrict IP access** - Use firewall rules to limit database access
5. **Rotate credentials** - Regularly update passwords and access keys
