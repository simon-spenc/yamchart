# Getting Started with Yamchart

Yamchart is a Git-native framework for building BI dashboards through code. Define your charts in YAML, write SQL models, and deploy anywhere with Docker.

## Prerequisites

- Node.js 20 or later
- npm, pnpm, or yarn

## Create Your First Project

```bash
npx yamchart init my-analytics
cd my-analytics
```

This creates a project with sample data and a working chart:

```
my-analytics/
├── yamchart.yaml           # Project configuration
├── connections/
│   └── local.yaml          # DuckDB connection (sample data)
├── models/
│   └── daily_revenue.sql   # SQL model with Jinja templating
├── charts/
│   └── revenue.yaml        # Chart definition
└── sample-data.duckdb      # Sample DuckDB database
```

## Start the Development Server

```bash
npx yamchart dev
```

Open [http://localhost:3001](http://localhost:3001) to see your dashboard.

## Understanding the Project

### Project Configuration (`yamchart.yaml`)

```yaml
name: my-analytics
version: "1.0"
description: My analytics dashboard
defaults:
  connection: local
```

The `defaults.connection` specifies which database connection to use when a chart doesn't specify one.

### Connections (`connections/local.yaml`)

```yaml
name: local
type: duckdb
path: ./sample-data.duckdb
```

Yamchart supports multiple database types:
- `duckdb` - Local analytics database (great for development)
- `postgres` - PostgreSQL and compatible databases
- More coming soon (BigQuery, Snowflake)

### Models (`models/daily_revenue.sql`)

Models are SQL files with Jinja templating for dynamic parameters:

```sql
-- @name: daily_revenue
-- @description: Daily revenue with date filtering

SELECT
  date,
  revenue,
  category
FROM sales
WHERE date >= '{{ start_date }}'
  AND date <= '{{ end_date }}'
{% if category %}
  AND category = '{{ category }}'
{% endif %}
ORDER BY date
```

The `-- @name` comment defines the model name referenced by charts.

### Charts (`charts/revenue.yaml`)

```yaml
name: revenue
title: Daily Revenue
description: Revenue trends over time
source:
  model: daily_revenue
parameters:
  - name: date_range
    type: date_range
    default: last_30_days
chart:
  type: line
  x:
    field: date
    type: temporal
  y:
    field: revenue
    format: "$,.0f"
```

## Create Your Own Chart

Let's add a chart showing revenue by category.

### Step 1: Create a Model

Create `models/revenue_by_category.sql`:

```sql
-- @name: revenue_by_category
-- @description: Total revenue grouped by category

SELECT
  category,
  SUM(revenue) as total_revenue
FROM sales
WHERE date >= '{{ start_date }}'
  AND date <= '{{ end_date }}'
GROUP BY category
ORDER BY total_revenue DESC
```

### Step 2: Create a Chart

Create `charts/category-breakdown.yaml`:

```yaml
name: category-breakdown
title: Revenue by Category
description: Total revenue breakdown by category
source:
  model: revenue_by_category
parameters:
  - name: date_range
    type: date_range
    default: last_30_days
chart:
  type: bar
  x:
    field: category
    type: ordinal
  y:
    field: total_revenue
    format: "$,.0f"
```

### Step 3: See It Live

The dev server auto-reloads. Navigate to your new chart in the dashboard.

## Working with Parameters

Parameters make your charts interactive. Yamchart supports:

### Date Range Parameters

```yaml
parameters:
  - name: date_range
    type: date_range
    default: last_30_days  # or last_7_days, last_90_days, this_month, etc.
```

This injects `start_date` and `end_date` variables into your SQL.

### Select Parameters

```yaml
parameters:
  - name: category
    type: select
    options:
      - Electronics
      - Clothing
      - Food
    default: Electronics
```

### Using Parameters in SQL

```sql
SELECT *
FROM sales
WHERE date >= '{{ start_date }}'
  AND date <= '{{ end_date }}'
{% if category %}
  AND category = '{{ category }}'
{% endif %}
```

The Jinja templating lets you conditionally include filters.

## Chart Types

| Type | Use Case |
|------|----------|
| `line` | Trends over time |
| `bar` | Comparing categories |
| `area` | Volume over time |
| `pie` | Part-to-whole relationships |
| `donut` | Part-to-whole with center metric |
| `kpi` | Single metric with comparison |

### Line/Bar/Area Charts

```yaml
chart:
  type: line  # or bar, area
  x:
    field: date
    type: temporal
    label: Date
  y:
    field: revenue
    format: "$,.0f"
    label: Revenue
```

### Pie Chart

```yaml
chart:
  type: pie
  x:
    field: category
    type: nominal
  y:
    field: amount
    format: "$,.0f"
```

### Donut Chart

Donut charts display a metric in the center:

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
    field: total    # 'total' sums all values
    label: Total Revenue
    format: "$"
```

### KPI Chart

Single metric with period-over-period comparison:

```yaml
chart:
  type: kpi
  value:
    field: value
  format:
    type: currency
    currency: USD
  comparison:
    enabled: true
    field: previous_value
    label: vs previous period
    type: percent_change  # or 'absolute'
```

## Granularity Selector

Add a granularity parameter to let users switch between daily/weekly/monthly/quarterly views:

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
  - name: date_range
    type: date_range
    default: last_12_months
```

Then use it in your SQL model:

```sql
SELECT
  date_trunc('{{ granularity }}', order_date) AS period,
  SUM(amount) AS revenue
FROM orders
WHERE order_date BETWEEN '{{ start_date }}' AND '{{ end_date }}'
GROUP BY 1
ORDER BY 1
```

The x-axis labels automatically format based on granularity (e.g., "Q1 '25" for quarters).

## Dashboards

Create dashboard layouts that combine multiple charts and text widgets.

### Create a Dashboard

Create `dashboards/overview.yaml`:

```yaml
name: overview
title: Executive Overview
description: Key business metrics

filters:
  - date_range

layout:
  gap: 16
  rows:
    - height: 200
      widgets:
        - type: chart
          ref: revenue-kpi
          cols: 3
        - type: chart
          ref: orders-kpi
          cols: 3
    - height: 400
      widgets:
        - type: chart
          ref: revenue-trend
          cols: 8
        - type: text
          cols: 4
          content: |
            ## Summary
            Total revenue: {{revenue-kpi}}
            Orders: {{orders-kpi}}
```

### KPI References in Text

Embed live KPI values in markdown using `{{chartName}}` syntax:

| Syntax | Description |
|--------|-------------|
| `{{chart}}` | Current value from chart |
| `{{chart.field}}` | Specific field from chart data |
| `{{chart@preset}}` | Value with specific date preset |
| `{{chart@2025-01-01..2025-12-31}}` | Value for custom date range |

Example:
```markdown
Revenue is **{{revenue-kpi}}** ({{revenue-kpi@previous_year}} last year).
```

### Filter Overrides

On dashboards, hover over a chart and click the filter icon to set chart-specific filters that override the dashboard's global filters. Click "Reset to dashboard" to sync back.

## Deploy with Docker

### Build the Image

In your project directory, create a `Dockerfile`:

```dockerfile
FROM ghcr.io/simon-spenc/yamchart:latest

# Copy your project files
COPY . /app/project

ENV YAMCHART_PROJECT_DIR=/app/project
```

Build and run:

```bash
docker build -t my-analytics .
docker run -p 8080:8080 my-analytics
```

Open [http://localhost:8080](http://localhost:8080).

### Using the Pre-built Image

You can also mount your project directly:

```bash
docker run -p 8080:8080 \
  -v $(pwd):/app/project \
  ghcr.io/simon-spenc/yamchart:latest
```

### Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'
services:
  yamchart:
    image: ghcr.io/simon-spenc/yamchart:latest
    ports:
      - "8080:8080"
    volumes:
      - .:/app/project
    environment:
      - YAMCHART_PROJECT_DIR=/app/project
      - LOG_LEVEL=info
```

Run with:

```bash
docker-compose up
```

## Connecting to Real Databases

### PostgreSQL

Create `connections/postgres.yaml`:

```yaml
name: warehouse
type: postgres
host: your-db-host.com
port: 5432
database: analytics
user: ${POSTGRES_USER}
password: ${POSTGRES_PASSWORD}
ssl: true
```

Environment variables (prefixed with `$`) are resolved at runtime.

Set your defaults:

```yaml
# yamchart.yaml
defaults:
  connection: warehouse
```

## Working with dbt Projects

If you have an existing dbt project, yamchart can sync your model metadata to help AI tools understand your schema:

```bash
# Sync dbt metadata
yamchart sync-dbt --path ../my-dbt-project
```

This creates `.yamchart/catalog.md` with your table names, column descriptions, and relationships. AI tools like Claude Code and Cursor can read this to generate accurate SQL for your charts.

See [dbt Sync Configuration](./configuration/dbt-sync.md) for filtering options and advanced usage.

## Generating Model Stubs

After syncing dbt metadata, generate SQL model stubs to help AI tools write better charts:

```bash
# Interactive wizard - walks through each model
yamchart generate

# Generate for a specific model
yamchart generate orders

# Skip prompts, use all defaults
yamchart generate --yolo
```

This creates SQL files in `models/` with:
- Time series variants (`orders_over_time.sql`)
- Dimension breakdowns (`orders_by_category.sql`)
- KPI metrics (`orders_kpi.sql`)

Each stub includes `@generated` comments linking back to the dbt source, helping AI tools understand the data context.

## Next Steps

- [Chart Configuration Reference](./configuration/charts.md) - All chart types and options
- [Dashboard Configuration](./configuration/dashboards.md) - Layout, widgets, KPI references
- [SQL Models Reference](./configuration/models.md) - Jinja templating, parameters
- [Connections Reference](./configuration/connections.md) - Database configuration
- [dbt Sync](./configuration/dbt-sync.md) - Sync dbt metadata for AI assistance
- [Generate Command](./configuration/generate.md) - Generate SQL model stubs from catalog

## Getting Help

- [GitHub Issues](https://github.com/simon-spenc/yamchart/issues) - Bug reports and feature requests
- [Technical Specification](../Yamchart%20Technical%20Spec.md) - Deep dive into architecture
