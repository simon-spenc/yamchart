# Generate Command

Generate SQL model stubs from your dbt catalog to accelerate chart development.

## Why Generate Stubs?

After syncing dbt metadata with `sync-dbt`, the `generate` command creates SQL model templates that:

- **Save time** - Pre-built patterns for common chart types
- **Guide AI tools** - Stubs provide context for Claude Code, Cursor, etc.
- **Follow best practices** - Proper date filtering, aggregations, and Jinja templating

## Quick Start

```bash
# First, sync your dbt metadata
yamchart sync-dbt --path ../my-dbt-project

# Then generate model stubs
yamchart generate
```

## Command Options

```
yamchart generate [model] [options]

Arguments:
  model                 Specific model to generate (optional)

Options:
  --yolo               Skip all prompts, use defaults for everything
```

## Usage Modes

### Interactive Wizard (Default)

```bash
yamchart generate
```

Walks through each dbt model in your catalog, asking you to confirm:

1. **Date column** - Which column to use for time series grouping
2. **Metric columns** - Which numeric columns to aggregate (sum/avg/count)
3. **Dimension columns** - Which categorical columns to group by
4. **Variants to generate** - Which stub types to create

Example session:
```
orders: Use 'order_date' for time series? (Y/n)
orders: Select metrics to aggregate:
  [x] amount (sum)
  [x] quantity (sum)
  [ ] discount_pct (avg)
orders: Select dimensions for grouping:
  [x] category
  [x] region
orders: Generate these stubs?
  [x] orders_over_time.sql
  [x] orders_by_category.sql
  [x] orders_by_region.sql
  [x] orders_kpi.sql
```

### Single Model

```bash
yamchart generate orders
```

Same interactive flow, but only for the specified model.

### Batch Mode (--yolo)

```bash
yamchart generate --yolo
```

Generates all stubs for all models using smart defaults:
- First detected date column for time series
- All numeric non-key columns as metrics (sum aggregation)
- All string columns as dimensions
- All applicable variants

## Generated Stub Types

### Time Series (`{model}_over_time.sql`)

For trending data over time. Generated when a date column exists.

```sql
-- @generated: from dbt model 'orders' on 2026-02-04
-- @name: orders_over_time
-- @description: orders aggregated over time
-- @source: analytics.marts.orders

SELECT
  date_trunc('{{ granularity }}', "order_date") AS period,
  SUM("amount") AS "sum_amount",
  SUM("quantity") AS "sum_quantity"
FROM analytics.marts.orders
WHERE "order_date" >= '{{ start_date }}'
  AND "order_date" <= '{{ end_date }}'
GROUP BY 1
ORDER BY 1
```

### Dimensional (`{model}_by_{dimension}.sql`)

For categorical breakdowns. One stub per dimension column.

```sql
-- @generated: from dbt model 'orders' on 2026-02-04
-- @name: orders_by_category
-- @description: orders grouped by category
-- @source: analytics.marts.orders

SELECT
  "category",
  SUM("amount") AS "sum_amount",
  SUM("quantity") AS "sum_quantity"
FROM analytics.marts.orders
WHERE "order_date" >= '{{ start_date }}'
  AND "order_date" <= '{{ end_date }}'
GROUP BY 1
ORDER BY 2 DESC
```

### KPI (`{model}_kpi.sql`)

For single-value metrics. No grouping, just aggregated totals.

```sql
-- @generated: from dbt model 'orders' on 2026-02-04
-- @name: orders_kpi
-- @description: orders summary metrics
-- @source: analytics.marts.orders

SELECT
  SUM("amount") AS "sum_amount",
  SUM("quantity") AS "sum_quantity"
FROM analytics.marts.orders
WHERE "order_date" >= '{{ start_date }}'
  AND "order_date" <= '{{ end_date }}'
```

## Column Detection

The generator automatically detects column types:

| Type | Detection Logic |
|------|-----------------|
| **Date** | Type contains `date`, `timestamp`, `datetime`, OR name ends with `_at`, `_date`, `_time` |
| **Metric** | Numeric type (`int`, `numeric`, `float`, etc.) AND not a primary/foreign key |
| **Dimension** | String type (`varchar`, `text`, etc.) AND not a foreign key |
| **Primary Key** | Has `primary_key` or `unique` hint, OR name is exactly `id` |
| **Foreign Key** | Has hint starting with `fk:` |

Primary and foreign keys are excluded from metrics and dimensions to avoid nonsensical aggregations.

## Generated Metadata

Each stub includes metadata comments for AI context:

```sql
-- @generated: from dbt model 'orders' on 2026-02-04
-- @name: orders_over_time
-- @description: orders aggregated over time
-- @source: analytics.marts.orders
```

- `@generated` - Indicates this is a generated stub with source model and date
- `@name` - Model name referenced by charts
- `@description` - Human-readable description
- `@source` - Original dbt table for cross-reference

## Customizing Stubs

Generated stubs are starting points. Common customizations:

1. **Add filters** - Add Jinja conditionals for optional parameters
2. **Change aggregations** - Switch from `SUM` to `AVG`, `COUNT`, etc.
3. **Add joins** - Combine with other tables
4. **Rename columns** - Use business-friendly names
5. **Remove @generated** - Once customized, remove the marker

Example customization:
```sql
-- @name: orders_over_time
-- @description: Daily revenue with optional category filter

SELECT
  date_trunc('{{ granularity }}', "order_date") AS period,
  SUM("amount") AS revenue,
  COUNT(*) AS order_count
FROM analytics.marts.orders
WHERE "order_date" >= '{{ start_date }}'
  AND "order_date" <= '{{ end_date }}'
{% if category %}
  AND "category" = '{{ category }}'
{% endif %}
GROUP BY 1
ORDER BY 1
```

## File Conflicts

When a stub file already exists:

- **Interactive mode** - Prompts to overwrite, skip, or rename
- **Yolo mode** - Overwrites existing files

## Troubleshooting

### "catalog.json not found"

Run `yamchart sync-dbt` first to create the catalog.

### No Stubs Generated

Check that your dbt models have:
- At least one numeric column (for metrics)
- Column type information in schema.yml

### Wrong Column Detection

Use interactive mode (`yamchart generate` without `--yolo`) to manually select the correct columns.
