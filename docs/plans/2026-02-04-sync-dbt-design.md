# Design: yamchart sync-dbt Command

**Date:** 2026-02-04
**Status:** Approved

## Overview

Add a `yamchart sync-dbt` command that syncs dbt project metadata into AI-readable catalog files. This enables AI coding tools (Claude Code, Cursor, etc.) to understand available data models when helping users create yamchart charts and dashboards.

## Problem

Users with existing dbt projects want to use yamchart for BI dashboards. Their AI coding tools need context about available tables, columns, and descriptions to write correct SQL. Without this context, AI tools can't effectively assist with chart creation.

## Solution

A CLI command that:
1. Reads dbt project schema files
2. Extracts model and column metadata
3. Generates AI-readable catalog files in `.yamchart/`
4. Cross-references existing yamchart models

## Command Interface

```bash
# Interactive mode (first run)
$ yamchart sync-dbt

? Where is your dbt project?
❯ Local directory
  GitHub repository (coming soon)
  dbt Cloud (coming soon)

? Path to dbt project: ../analytics-dbt
? Select models to include:
  ◉ marts/orders
  ◉ marts/customers
  ◯ staging/stg_orders

✓ Synced 12 models to .yamchart/catalog.md

# Direct mode
$ yamchart sync-dbt --source local --path ../analytics-dbt

# Re-sync with saved config
$ yamchart sync-dbt --refresh
```

### Flags

| Flag | Description |
|------|-------------|
| `--source <type>` | Source type: local, github, dbt-cloud (v1: local only) |
| `--path <dir>` | Path to dbt project (for local source) |
| `--include <glob>` | Include paths, e.g., `models/marts/**` |
| `--exclude <glob>` | Exclude paths, e.g., `models/staging/**` |
| `--tag <tag>` | Only include models with this tag |
| `--refresh` | Re-run using saved config |

## Output Files

All generated files live in `.yamchart/` and should be committed to git.

### `.yamchart/dbt-source.yaml`

Saved sync configuration for re-runs:

```yaml
source: local
path: ../analytics-dbt
lastSync: 2026-02-04T10:30:00Z

filters:
  include:
    - models/marts/**
    - models/reporting/**
  exclude:
    - models/staging/**
    - models/intermediate/**
  tags: []

stats:
  modelsIncluded: 12
  modelsExcluded: 87
```

### `.yamchart/catalog.json`

Structured data for programmatic access:

```json
{
  "syncedAt": "2026-02-04T10:30:00Z",
  "source": { "type": "local", "path": "../analytics-dbt" },
  "models": [
    {
      "name": "orders",
      "description": "Daily order transactions. One row per order.",
      "table": "analytics.marts.orders",
      "tags": ["bi", "finance"],
      "columns": [
        {
          "name": "order_id",
          "type": "string",
          "description": "Unique order identifier",
          "hints": ["primary_key", "unique"]
        },
        {
          "name": "customer_id",
          "type": "string",
          "description": "FK to customers table",
          "hints": ["required", "fk:customers"]
        }
      ],
      "yamchartModels": ["revenue_by_region", "orders_by_status"]
    }
  ]
}
```

### `.yamchart/catalog.md`

AI-readable markdown:

```markdown
# Data Catalog

> Source: local:../analytics-dbt
> Last synced: 2026-02-04T10:30:00Z
> Models: 12 included, 87 filtered out

## Models

### orders

Daily order transactions. One row per order.

**Table:** `analytics.marts.orders`
**Tags:** `bi`, `finance`

| Column | Type | Description | Hints |
|--------|------|-------------|-------|
| order_id | string | Unique order identifier | primary_key, unique |
| customer_id | string | FK to customers table | required, fk:customers |
| order_date | date | Date order was placed | required |
| total_amount | numeric | Order total in USD | |
| region | string | Sales region | |

**Yamchart models:**
- [`revenue_by_region`](../models/revenue_by_region.sql) - Daily revenue by region
- [`orders_by_status`](../models/orders_by_status.sql) - Order counts by status

---

### customers

Customer dimension with lifetime metrics.
...
```

## Filtering Strategy

Priority order:

1. **Smart path defaults** - Auto-include `models/marts/**`, `models/reporting/**`; exclude `staging/`, `intermediate/`
2. **Interactive fallback** - If no models match defaults, prompt user to select
3. **Tag-based (power users)** - Filter by `meta.yamchart: true` or similar tags in dbt schema

## dbt Schema Parsing

Parse `schema.yml` files (not `manifest.json` which isn't usually committed):

```yaml
# models/marts/_schema.yml
version: 2
models:
  - name: orders
    description: "Daily orders..."
    meta:
      yamchart: true          # → for tag-based filtering
    columns:
      - name: order_id
        description: "Unique ID"
        data_type: string
        tests:
          - unique            # → hint: "unique"
          - not_null          # → hint: "required"
      - name: customer_id
        tests:
          - relationships:    # → hint: "fk:customers"
              to: ref('customers')
              field: customer_id
```

Fully qualified table names derived from:
- `dbt_project.yml` default database/schema
- Model-level config overrides
- Fallback: `{schema}.{model_name}`

## Code Architecture

```
apps/cli/src/
├── commands/
│   └── sync-dbt.ts          # Command handler, interactive prompts
├── sources/
│   ├── types.ts             # DbtSource interface, model types
│   ├── local.ts             # LocalDbtSource implementation
│   ├── github.ts            # (future) GitHubDbtSource
│   └── dbt-cloud.ts         # (future) DbtCloudSource
├── catalog/
│   ├── generator.ts         # Creates catalog.md and catalog.json
│   ├── scanner.ts           # Scans yamchart models for cross-refs
│   └── templates.ts         # Markdown templates
└── utils/
    └── dbt-parser.ts        # Parses schema.yml, dbt_project.yml
```

### Key Interface

```typescript
interface DbtSource {
  type: 'local' | 'github' | 'dbt-cloud';
  listModels(): Promise<DbtModelSummary[]>;
  getModel(name: string): Promise<DbtModel>;
  getProjectConfig(): Promise<DbtProjectConfig>;
}
```

## Error Handling

| Scenario | Behavior |
|----------|----------|
| dbt project path doesn't exist | Error with clear message |
| No schema.yml files found | Warning, generate empty catalog |
| Model has no description | Include model, show "No description" |
| Column has no type | Show "unknown" or omit |
| No models match filters | Warning, prompt to adjust |
| Can't detect marts/reporting | Fall back to interactive selection |
| yamchart model refs missing dbt table | Note in catalog as warning |

## Future Work

### `yamchart generate` Command

Separate command for guided creation of yamchart model stubs:

```bash
$ yamchart generate

? What would you like to create?
❯ Model (SQL query)
  Chart
  Dashboard

? Which dbt model does this query? marts.orders
? Describe what you want: "daily revenue by region"

Generated: models/revenue_by_region.sql

-- model: revenue_by_region
-- description: Daily revenue aggregated by region
-- source: marts.orders
SELECT ...
```

This is intentionally separate from sync - sync is passive (get context), generate is active (create files with human confirmation).

### Additional Sources

- **GitHub/GitLab** - Fetch and parse dbt repo directly
- **dbt Cloud API** - Pull compiled manifest with full metadata
- **Webhooks** - Auto-sync when dbt repo updates (hosted service feature)

## Dependencies

New npm packages needed:
- `@inquirer/prompts` - Interactive CLI prompts (or use existing ora + readline)
- `glob` - File pattern matching (may already be available)
- `yaml` - Already in package.json

## Testing Strategy

1. **Unit tests** - dbt schema parser, catalog generator
2. **Integration tests** - Full sync against fixture dbt project
3. **Fixture project** - Small dbt project in `apps/cli/src/__fixtures__/dbt-project/`
