# Generate Command Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create `yamchart generate` command that generates SQL model stubs from dbt catalog, helping AI tools write better charts.

**Architecture:** Interactive CLI wizard that analyzes dbt catalog columns, infers patterns (time series, categorical, KPI), and generates multiple SQL stub variants per model. Smart defaults with quick confirm/override.

**Tech Stack:** Commander.js, prompts (inquirer-style), existing dbt catalog from sync-dbt

---

## Command Interface

```bash
yamchart generate              # Interactive wizard - loops through all dbt models
yamchart generate orders       # Single model - interactive prompts for just 'orders'
yamchart generate --yolo       # Full send - all models, all defaults, no prompts
```

## Wizard Flow

For each dbt model in `.yamchart/catalog.json`:

1. **Detect date column** → Show detected column, confirm or pick different
2. **Detect metric columns** → Show numeric columns, confirm aggregation type (sum/avg/count)
3. **Detect dimension columns** → Show categorical columns, confirm which to use for grouping
4. **Show variants to generate** → List proposed stubs, confirm or deselect some
5. **Write files** → Create SQL stubs in `models/`

### Detection Heuristics

| Column Pattern | Detection |
|----------------|-----------|
| Date column | Type contains 'date', 'time', 'timestamp', or name ends in '_at', '_date', '_time' |
| Metric column | Type is numeric (int, float, decimal, numeric) AND not a primary/foreign key |
| Dimension column | Type is string/varchar AND has limited cardinality hint, OR name contains 'category', 'type', 'status', 'region' |
| Primary key | Has 'primary_key' or 'unique' hint, or name is 'id' or ends in '_id' |
| Foreign key | Has 'fk:*' hint |

### Variant Generation

For each model, generate applicable variants:

| Variant | When Generated | Pattern |
|---------|----------------|---------|
| `{model}_over_time.sql` | Has date column + metric | GROUP BY date_trunc, SUM/AVG metric |
| `{model}_by_{dimension}.sql` | Has dimension + metric | GROUP BY dimension, SUM/AVG metric |
| `{model}_kpi.sql` | Has any metric | Single aggregated value for KPI charts |

## Output Format

### Generated SQL Stub

```sql
-- @generated: from dbt model 'orders' on 2026-02-04
-- @name: orders_over_time
-- @description: Orders aggregated over time
-- @source: analytics.marts.orders

SELECT
  date_trunc('{{ granularity }}', order_date) AS period,
  SUM(amount) AS total_amount,
  COUNT(*) AS order_count
FROM {{ ref('orders') }}
WHERE order_date >= '{{ start_date }}'
  AND order_date <= '{{ end_date }}'
GROUP BY 1
ORDER BY 1
```

### Stub Features

- `@generated` comment with source model and date
- `@name`, `@description`, `@source` metadata for AI context
- Jinja templating for parameters (`{{ granularity }}`, `{{ start_date }}`, etc.)
- `{{ ref('model') }}` syntax matching dbt conventions (resolves to table name)

## Interactive Prompts

### Date Column Confirmation

```
orders: Detected date column 'order_date'
? Use this for time series? (Y/n)
```

### Metric Columns

```
orders: Found numeric columns
? Select metrics to aggregate:
  [x] amount (sum)
  [x] quantity (sum)
  [ ] discount_pct (avg)
  [ ] id (skip - primary key)
```

### Dimension Columns

```
orders: Found categorical columns
? Select dimensions for grouping:
  [x] category
  [x] region
  [ ] customer_id (skip - foreign key)
```

### Variants to Generate

```
orders: Will generate:
  [x] orders_over_time.sql (time series by order_date)
  [x] orders_by_category.sql (grouped by category)
  [x] orders_by_region.sql (grouped by region)
  [x] orders_kpi.sql (total metrics)
? Confirm? (Y/n)
```

## YOLO Mode

`--yolo` skips all prompts:
- Uses all detected date columns
- Uses all numeric non-key columns as metrics (sum by default)
- Uses all detected dimension columns
- Generates all applicable variants
- Prints summary at end

```bash
$ yamchart generate --yolo
Generating from 12 dbt models...
  orders: 4 stubs (over_time, by_category, by_region, kpi)
  customers: 2 stubs (over_time, kpi)
  products: 3 stubs (by_category, by_brand, kpi)
  ...
Done! Created 28 model stubs in models/
```

## Error Handling

| Scenario | Behavior |
|----------|----------|
| No catalog.json | Error: "Run `yamchart sync-dbt` first" |
| Model not found | Error: "Model 'foo' not in catalog" |
| No metrics detected | Warning, skip model (or ask user to pick manually) |
| File already exists | Prompt to overwrite, skip, or rename |

## File Structure

```
apps/cli/src/
├── commands/
│   └── generate.ts          # Main command handler
├── generate/
│   ├── detector.ts          # Column type detection heuristics
│   ├── variants.ts          # Variant generation logic
│   ├── prompts.ts           # Interactive prompt helpers
│   └── writer.ts            # SQL stub file writer
```

## Dependencies

- `@inquirer/prompts` - Modern inquirer for interactive prompts
- Existing: `./dbt/catalog.ts`, `./dbt/types.ts`
