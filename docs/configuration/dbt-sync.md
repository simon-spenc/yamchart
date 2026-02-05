# dbt Sync

Yamchart can sync metadata from your dbt project to help AI tools understand your data models when generating charts and dashboards.

## Why Sync dbt Metadata?

When using AI coding tools like Claude Code or Cursor to create yamchart charts, they need context about your available tables, columns, and relationships. By syncing your dbt project metadata, you provide:

- **Table names and descriptions** - AI knows what data is available
- **Column details** - Types, descriptions, and constraints
- **Relationships** - Foreign key hints from dbt tests
- **Semantic hints** - Required fields, unique constraints, primary keys

## Quick Start

```bash
# From your yamchart project directory
yamchart sync-dbt --path ../my-dbt-project
```

This creates `.yamchart/catalog.md` - a markdown file that AI tools can read to understand your schema.

## Command Options

```
yamchart sync-dbt [options]

Options:
  -s, --source <type>     Source type: local, github, dbt-cloud (default: "local")
  -p, --path <dir>        Path to dbt project (for local source)
  --include <patterns>    Include glob patterns (e.g., "**/marts/**")
  --exclude <patterns>    Exclude glob patterns (e.g., "**/staging/**")
  --tag <tags>            Filter by dbt model tags
  --refresh               Re-sync using saved configuration
```

## Examples

### Sync All Models

```bash
yamchart sync-dbt --path ../analytics-dbt
```

### Sync Only Marts and Reporting

```bash
yamchart sync-dbt --path ../analytics-dbt \
  --include "**/marts/**" "**/reporting/**"
```

### Exclude Staging Models

```bash
yamchart sync-dbt --path ../analytics-dbt \
  --exclude "**/staging/**" "**/intermediate/**"
```

### Filter by dbt Tags

```bash
yamchart sync-dbt --path ../analytics-dbt --tag bi-ready
```

### Re-sync with Saved Config

After the first sync, re-run with the same settings:

```bash
yamchart sync-dbt --refresh
```

## Smart Defaults

When no filters are specified, yamchart uses smart defaults:

- **Includes**: `**/marts/**`, `**/reporting/**`, `**/analytics/**`
- **Excludes**: `**/staging/**`, `**/intermediate/**`, `**/base/**`

This prioritizes production-ready models over raw/staging data.

## Output Files

The sync creates three files in `.yamchart/`:

### `catalog.md`

Human and AI-readable markdown catalog:

```markdown
# Data Catalog

> Source: local:../analytics-dbt
> Last synced: 2026-02-04
> Models: 12 included, 87 filtered out

## Models

### orders

Daily order transactions. One row per order.

**Table:** `analytics.marts.orders`
**Tags:** `bi`, `finance`

| Column | Type | Description | Hints |
|--------|------|-------------|-------|
| order_id | string | Unique order identifier | primary_key, unique |
| customer_id | string | FK to customers | required, fk:customers |
| total_amount | numeric | Order total in USD | |

**Yamchart models:**
- [`revenue_by_region`](../models/revenue_by_region.sql) - Revenue by region

---
```

### `catalog.json`

Structured JSON for programmatic access:

```json
{
  "syncedAt": "2026-02-04T10:30:00Z",
  "source": { "type": "local", "path": "../analytics-dbt" },
  "models": [
    {
      "name": "orders",
      "description": "Daily order transactions",
      "table": "analytics.marts.orders",
      "columns": [...]
    }
  ]
}
```

### `dbt-source.yaml`

Saved sync configuration for `--refresh`:

```yaml
source: local
path: ../analytics-dbt
lastSync: 2026-02-04T10:30:00Z
filters:
  include:
    - "**/marts/**"
  exclude: []
  tags: []
stats:
  modelsIncluded: 12
  modelsExcluded: 87
```

## How It Works

### Parsing dbt Schema Files

Yamchart reads your dbt `schema.yml` files (not `manifest.json`) to extract:

- Model names and descriptions
- Column names, types, and descriptions
- Tags and meta fields
- Test definitions (converted to hints)

### Test to Hint Conversion

| dbt Test | Hint |
|----------|------|
| `unique` | `unique` |
| `not_null` | `required` |
| `relationships` | `fk:table_name` |
| `primary_key` | `primary_key` |

### Cross-References

If you have yamchart models that reference dbt tables, the catalog shows these relationships:

```sql
-- models/revenue_by_region.sql
-- @name: revenue_by_region
-- @source: marts.orders

SELECT region, sum(amount) FROM orders GROUP BY 1
```

The catalog will show `revenue_by_region` as a yamchart model using the `orders` dbt table.

## Keeping in Sync

### Manual Re-sync

```bash
yamchart sync-dbt --refresh
```

### Git Workflow

Commit `.yamchart/catalog.md` to your repo so all team members have access without needing the dbt project locally.

### CI/CD

Add a sync step to your dbt CI:

```yaml
# .github/workflows/dbt.yml
- name: Sync to yamchart
  run: |
    cd ../yamchart-dashboards
    npx yamchart sync-dbt --path ../dbt-project
    git add .yamchart/
    git commit -m "chore: sync dbt catalog"
    git push
```

## Future Sources

Currently, only local dbt projects are supported. Coming soon:

- **GitHub** - Sync directly from a GitHub repository
- **dbt Cloud** - Sync from dbt Cloud API

## Troubleshooting

### "dbt_project.yml not found"

Ensure the `--path` points to your dbt project root (the directory containing `dbt_project.yml`).

### No Models Found

Check that your dbt project has `schema.yml` files with model definitions. Models defined only in SQL files without corresponding YAML entries won't be synced.

### Models Not Appearing

Check your filter patterns. Use `--include` and `--exclude` to adjust which models are synced. Run without filters first to see all available models.
