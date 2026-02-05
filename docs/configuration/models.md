# SQL Models Reference

Models are SQL files with Jinja templating that define the data for charts.

## Basic Structure

```sql
-- @name: model_name
-- @description: What this model does
-- @owner: team-name
-- @tags: [tag1, tag2]
--
-- @param start_date: date = current_date() - interval '30 days'
-- @param end_date: date = current_date()
--
-- @returns:
--   - column1: type -- Description
--   - column2: type -- Description

SELECT
  column1,
  column2
FROM {{ ref('table_name') }}
WHERE date BETWEEN '{{ start_date }}' AND '{{ end_date }}'
```

## Metadata Comments

Model metadata is defined in SQL comments at the top of the file:

| Tag | Required | Description |
|-----|----------|-------------|
| `@name` | Yes | Unique identifier referenced by charts |
| `@description` | No | Human-readable description |
| `@owner` | No | Team or person responsible |
| `@tags` | No | Array of tags for organization |
| `@param` | No | Parameter definitions |
| `@returns` | No | Output column documentation |

### Parameter Definition

```sql
-- @param name: type = default_value
```

Types: `string`, `number`, `date`, `boolean`

Examples:
```sql
-- @param start_date: date = current_date() - interval '30 days'
-- @param end_date: date = current_date()
-- @param category: string = 'All'
-- @param limit: number = 100
```

## Jinja Templating

### Variable Substitution

```sql
WHERE date >= '{{ start_date }}'
  AND date <= '{{ end_date }}'
  AND category = '{{ category }}'
```

### Conditionals

```sql
WHERE date >= '{{ start_date }}'
{% if category and category != 'All' %}
  AND category = '{{ category }}'
{% endif %}
```

### Loops

```sql
WHERE category IN (
  {% for cat in categories %}
    '{{ cat }}'{% if not loop.last %},{% endif %}
  {% endfor %}
)
```

## Table References

Use `{{ ref('table_name') }}` to reference tables. This allows the query engine to track dependencies and resolve table names across connections.

```sql
SELECT *
FROM {{ ref('orders') }} o
JOIN {{ ref('customers') }} c ON o.customer_id = c.id
```

## Date Parameters

When a chart has a `date_range` parameter, the model receives `start_date` and `end_date`:

```sql
-- Chart parameter:
-- - name: date_range
--   type: date_range
--   default: last_30_days

-- Model receives:
-- start_date: '2025-01-05'
-- end_date: '2025-02-04'

SELECT *
FROM orders
WHERE order_date BETWEEN '{{ start_date }}' AND '{{ end_date }}'
```

## Granularity Pattern

For time series with configurable granularity:

```sql
-- @param granularity: string = 'month'

SELECT
  date_trunc('{{ granularity }}', order_date) AS period,
  SUM(amount) AS revenue,
  COUNT(*) AS order_count
FROM {{ ref('orders') }}
WHERE order_date BETWEEN '{{ start_date }}' AND '{{ end_date }}'
GROUP BY 1
ORDER BY 1
```

## KPI Pattern

For KPI charts with period comparison:

```sql
-- @param start_date: date
-- @param end_date: date

WITH period_days AS (
  SELECT ('{{ end_date }}'::DATE - '{{ start_date }}'::DATE + 1)::INTEGER as days
),
current_period AS (
  SELECT SUM(amount) as value
  FROM {{ ref('orders') }}
  WHERE order_date BETWEEN '{{ start_date }}' AND '{{ end_date }}'
),
previous_period AS (
  SELECT SUM(amount) as previous_value
  FROM {{ ref('orders') }}, period_days
  WHERE order_date BETWEEN
    '{{ start_date }}'::DATE - period_days.days
    AND '{{ start_date }}'::DATE - 1
)
SELECT c.value, p.previous_value
FROM current_period c, previous_period p
```

## Database-Specific Syntax

### DuckDB

```sql
-- Date arithmetic
date_trunc('month', order_date)
order_date + INTERVAL '7 days'
CURRENT_DATE - INTERVAL '30 days'

-- Type casting
column::DATE
column::INTEGER
```

### PostgreSQL

```sql
-- Date arithmetic
date_trunc('month', order_date)
order_date + INTERVAL '7 days'
CURRENT_DATE - INTERVAL '30 days'

-- Type casting
column::DATE
column::INTEGER
CAST(column AS DATE)
```

## Best Practices

1. **Use `ref()`** for all table references
2. **Document parameters** with `@param` comments
3. **Handle nulls** with `COALESCE()`
4. **Quote parameter values** in SQL: `'{{ param }}'`
5. **Use conditionals** for optional filters
6. **Order results** explicitly with `ORDER BY`
