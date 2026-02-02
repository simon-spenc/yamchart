# Dashbook CLI Design

**Date:** 2026-02-01
**Status:** Approved

---

## Overview

The Dashbook CLI provides two commands for local development and CI/CD validation:

- `dashbook dev` - Start local dev server with dashboard preview
- `dashbook validate` - Validate configs and optionally test queries against database

### Target Workflow

1. Analyst writes DBT models → `dbt run` → tables exist in Snowflake dev
2. Analyst writes Dashbook YAML → `dashbook dev` → preview locally against those tables
3. `dashbook validate --dry-run` → verify queries work
4. Push → CI runs `dbt run` then `dashbook validate --dry-run`

---

## Commands

### `dashbook dev [path]`

Start development server with dashboard preview.

**Options:**
```
--port, -p        API port (default: 3001)
--api-only        Don't serve web UI, API only
--no-open         Don't open browser automatically
```

**Behavior:**
1. Find `dashbook.yaml` in path (or current dir)
2. Run schema validation; exit on errors
3. Start server via `createServer()` from `@dashbook/server`
4. Serve bundled web UI (unless `--api-only`)
5. Open browser (unless `--no-open`)
6. Watch for file changes, reload config, clear cache

**Output:**
```
$ dashbook dev

  ┌─────────────────────────────────────────┐
  │   Dashbook v0.1.0                       │
  │                                         │
  │   Dashboard:  http://localhost:3001     │
  │   API:        http://localhost:3001/api │
  │                                         │
  │   Project:    my-analytics              │
  │   Connection: snowflake-dev (healthy)   │
  │   Charts:     5 loaded                  │
  │   Models:     8 loaded                  │
  │                                         │
  │   Watching for changes...               │
  └─────────────────────────────────────────┘

[12:34:56] Config reloaded (charts/revenue.yaml changed)
```

### `dashbook validate [path]`

Validate configuration files and optionally test queries.

**Options:**
```
--dry-run         Connect to DB and run EXPLAIN on queries
--connection, -c  Connection to use for dry-run (default: from dashbook.yaml)
--json            Output as JSON
```

**Phase 1 - Schema Validation (always runs, offline):**
- Load and validate all YAML/SQL with Zod schemas
- Cross-reference validation (charts→models, dashboards→charts)
- Report errors with file:line and suggestions

**Phase 2 - Dry-run Queries (only with `--dry-run`):**
- Connect to database
- Run `EXPLAIN` on each compiled query
- Verify columns exist

**Output:**
```
$ dashbook validate

Validating dashbook project...

✓ dashbook.yaml
✓ connections/snowflake.yaml
✓ models/monthly_revenue.sql
✗ charts/revenue-trend.yaml
  → Line 12: Unknown model reference "monthly_revnue" (did you mean "monthly_revenue"?)

✓ charts/orders-kpi.yaml

Schema: 4 passed, 1 failed

Running dry-run queries...
✓ monthly_revenue (EXPLAIN OK)
✗ daily_orders
  → Column "oder_date" not found in table "orders" (did you mean "order_date"?)

Queries: 1 passed, 1 failed

Validation failed with 2 errors.
```

**Exit codes:**
- `0` - All validations passed
- `1` - Validation errors found
- `2` - Configuration error (can't find dashbook.yaml, can't connect)

### Global Options

```
--version, -v     Show version
--help, -h        Show help
--quiet, -q       Suppress non-error output
```

---

## Architecture

### Package Structure

```
apps/cli/
├── package.json
├── tsup.config.ts        # Bundle config
├── src/
│   ├── index.ts          # Entry point, command parser
│   ├── commands/
│   │   ├── dev.ts        # Dev server command
│   │   └── validate.ts   # Validation command
│   └── utils/
│       ├── output.ts     # Colored output, spinners, formatting
│       └── config.ts     # Find dashbook.yaml, resolve paths
└── bin/
    └── dashbook          # Executable shim
```

### Dependencies

**Internal packages:**
- `@dashbook/schema` - Zod schemas for validation
- `@dashbook/query` - Model parser, connectors for dry-run
- `@dashbook/server` - `createServer()` for dev command

**External dependencies:**
- `commander` - CLI framework
- `dotenv` - Load .env files
- `picocolors` - Terminal colors
- `ora` - Spinners

### Build

- Bundle with `tsup` to single executable
- Include pre-built web UI from `@dashbook/web/dist`
- Publish as `dashbook` on npm

### Installation

```bash
npm install -g dashbook
# or
npx dashbook dev
```

---

## Connection & Credentials

### Connection Definition

```yaml
# connections/snowflake-dev.yaml
name: snowflake-dev
type: snowflake
description: "Development Snowflake warehouse"

config:
  account: ${SNOWFLAKE_ACCOUNT}
  warehouse: ${SNOWFLAKE_WAREHOUSE}
  database: ${SNOWFLAKE_DATABASE}
  schema: analytics

auth:
  type: env
  user_var: SNOWFLAKE_USER
  password_var: SNOWFLAKE_PASSWORD
```

### Variable Resolution

`${VAR}` syntax resolved in order:
1. Environment variables
2. `.env` file in project root
3. Error if not found

### Security

- Credentials never stored in YAML (always env vars)
- `.env` files should be gitignored
- CLI warns if hardcoded credentials detected

---

## Implementation Scope

### To Build

| Component | Effort | Notes |
|-----------|--------|-------|
| CLI package setup | Small | Commander.js, tsup build |
| `validate` - schema phase | Small | Reuses existing Zod schemas |
| `validate` - cross-reference checks | Medium | New logic for ref validation |
| `validate` - dry-run queries | Medium | EXPLAIN support per connector |
| `dev` command | Small | Wraps existing `createServer()` |
| Bundled web UI | Small | Copy `@dashbook/web/dist` at build |
| Environment variable resolution | Small | Parse `${VAR}` in YAML |
| Snowflake connector | Medium | New connector (DuckDB exists) |

### Already Exists

- Zod schemas for all config types
- Config loader with file watching
- Server with API routes
- Web UI
- DuckDB connector

### Out of Scope (v1)

- `dashbook init` - Project scaffolding
- `dashbook build` - Static export
- Remote git repo pulling - SaaS feature

---

## Future Considerations

### SaaS Mode

The `--api-only` flag enables SaaS deployment where:
- Server deployed to Fly/Cloudflare
- Web UI hosted separately (CDN, custom domain)
- Points to git repo for config files

### Additional Commands (Future)

```bash
dashbook init [directory]   # Scaffold new project
dashbook build              # Build static dashboard site
dashbook push               # Push config to remote Dashbook instance
```
