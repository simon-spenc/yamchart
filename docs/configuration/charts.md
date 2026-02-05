# Chart Configuration Reference

Charts are defined in YAML files in the `charts/` directory.

## Basic Structure

```yaml
name: my-chart              # Unique identifier (required)
title: My Chart             # Display title (required)
description: Description    # Optional description
source:
  model: model_name         # SQL model to use
  connection: my-conn       # Override default connection (optional)
parameters: []              # Interactive parameters (optional)
chart:
  type: line                # Chart type (required)
  # ... type-specific config
```

## Chart Types

### Line Chart

Best for showing trends over time.

```yaml
chart:
  type: line
  x:
    field: date           # Column for x-axis
    type: temporal        # temporal, ordinal, or quantitative
  y:
    field: value          # Column for y-axis
    format: "$,.0f"       # Number format (optional)
  series:
    field: category       # Group into multiple lines (optional)
```

### Bar Chart

Best for comparing categories.

```yaml
chart:
  type: bar
  x:
    field: category
    type: ordinal
  y:
    field: value
    format: ",.0f"
  color:
    field: segment        # Color by field (optional)
```

### Area Chart

Best for showing volume over time.

```yaml
chart:
  type: area
  x:
    field: date
    type: temporal
  y:
    field: value
  stacked: true           # Stack multiple series (optional)
  series:
    field: category
```

### Pie Chart

Best for part-to-whole relationships.

```yaml
chart:
  type: pie
  x:
    field: segment        # Category/label field
    type: nominal
  y:
    field: amount         # Numeric field for slice size
    format: "$,.0f"
```

### Donut Chart

Pie chart with a center value display.

```yaml
chart:
  type: donut
  x:
    field: region
    type: nominal
  y:
    field: revenue
    format: "$,.0f"
  centerValue:
    field: total          # 'total' sums all values, or use specific field
    label: Total Revenue  # Label below the value
    format: "$"           # Format for center value
```

### KPI Chart

Single metric with optional period comparison.

```yaml
chart:
  type: kpi
  value:
    field: value          # Field containing the metric
  format:
    type: currency        # number, currency, or percent
    currency: USD         # For currency type
    decimals: 0           # Decimal places
  comparison:
    enabled: true
    field: previous_value # Field with comparison value
    label: vs last period # Comparison label
    type: percent_change  # percent_change or absolute
```

The SQL model should return both current and previous values:

```sql
SELECT
  current_value as value,
  previous_value as previous_value
FROM metrics
```

## Axis Types

| Type | Use Case | Example |
|------|----------|---------|
| `temporal` | Dates and times | `2024-01-15` |
| `ordinal` | Categories | `Electronics`, `Clothing` |
| `quantitative` | Numeric values | `100`, `250.5` |

## Number Formats

Uses [d3-format](https://github.com/d3/d3-format) syntax:

| Format | Example Output | Use Case |
|--------|---------------|----------|
| `$,.0f` | $1,234 | Currency, no decimals |
| `$,.2f` | $1,234.56 | Currency with decimals |
| `,.0f` | 1,234 | Numbers with commas |
| `.2%` | 12.34% | Percentages |
| `.2s` | 1.2M | SI prefix (K, M, B) |

## Parameters

Parameters make charts interactive.

### Date Range

```yaml
parameters:
  - name: date_range
    type: date_range
    default: last_30_days
```

Available presets:
- `today`, `yesterday`
- `last_7_days`, `last_30_days`, `last_90_days`, `last_365_days`
- `this_week`, `last_week`
- `this_month`, `last_month`
- `this_quarter`, `last_quarter`
- `this_year`, `last_year`

Users can also select "Custom range..." to pick specific dates using a calendar picker.

Injects `start_date` and `end_date` into your SQL model.

### Select

```yaml
parameters:
  - name: region
    type: select
    label: Region           # Display label (optional)
    options:
      - North
      - South
      - East
      - West
    default: North
    required: false         # Allow empty selection (optional)
```

### Multi-Select

```yaml
parameters:
  - name: categories
    type: multi_select
    options:
      - Electronics
      - Clothing
      - Food
    default:
      - Electronics
      - Clothing
```

### Granularity Select

Let users switch between time aggregations:

```yaml
parameters:
  - name: granularity
    type: select
    label: Group By
    default: month
    options:
      - { value: day, label: Daily }
      - { value: week, label: Weekly }
      - { value: month, label: Monthly }
      - { value: quarter, label: Quarterly }
```

Use in SQL with `date_trunc`:

```sql
SELECT
  date_trunc('{{ granularity }}', order_date) AS period,
  SUM(amount) AS revenue
FROM orders
GROUP BY 1
```

The chart automatically formats x-axis labels based on granularity (e.g., "Q1 '25" for quarters).

### Dynamic Select

Populate options from a database query:

```yaml
parameters:
  - name: category
    type: dynamic_select
    label: Category
    source:
      model: category_options    # SQL model that returns options
      value_field: category_id   # Column for option value
      label_field: category_name # Column for option label
    default: ""                  # Empty = "All"
```

The model returns rows used as options:

```sql
-- models/category_options.sql
-- @name: category_options

SELECT DISTINCT
  category_id,
  category_name
FROM products
ORDER BY category_name
```

## Full Example

```yaml
name: sales-by-region
title: Sales by Region
description: Monthly sales breakdown by geographic region
source:
  model: regional_sales
parameters:
  - name: date_range
    type: date_range
    default: last_90_days
  - name: product_category
    type: select
    label: Product Category
    options:
      - All
      - Electronics
      - Clothing
      - Home & Garden
    default: All
chart:
  type: bar
  x:
    field: region
    type: ordinal
  y:
    field: total_sales
    format: "$,.0f"
  color:
    field: region
```

With corresponding SQL model:

```sql
-- @name: regional_sales

SELECT
  region,
  SUM(sales_amount) as total_sales
FROM orders
WHERE order_date >= '{{ start_date }}'
  AND order_date <= '{{ end_date }}'
{% if product_category and product_category != 'All' %}
  AND category = '{{ product_category }}'
{% endif %}
GROUP BY region
ORDER BY total_sales DESC
```
