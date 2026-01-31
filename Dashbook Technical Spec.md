# Dashbook: Technical Specification

**Version:** 0.1.0 (Draft)  
**Date:** January 2026  
**Status:** RFC (Request for Comments)

---

## Executive Summary

Dashbook is an open-source framework for defining, versioning, and deploying business intelligence dashboards entirely through code. Inspired by Mintlify's approach to documentation, Dashbook enables teams to manage their analytics dashboards using Git-native workflows—making dashboards reviewable, testable, and deployable through standard CI/CD pipelines.

**Core Principle:** *If it's not in Git, it doesn't exist.*

### Key Differentiators

| Capability | Dashbook | Evidence.dev | Lightdash | Metabase |
|------------|----------|--------------|-----------|----------|
| Config format | YAML | Markdown+SQL | YAML (dbt) | GUI/JSON |
| dbt required | No | No | Yes | No |
| Git-native | Full | Full | Full | Export only |
| AI-optimized schema | Yes | No | No | No |
| Self-contained dashboards | Yes | Reports only | Yes | Yes |
| PR previews | Built-in | Manual | Manual | No |

---

## 1. Architecture Overview

### 1.1 System Components

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Git Repository                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │ dashbook.yaml│  │ connections/ │  │   models/    │  │ dashboards/ │ │
│  │ (project)    │  │ (data src)   │  │   (SQL)      │  │   (YAML)    │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Dashbook CLI                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │   validate   │  │     dev      │  │     test     │  │   deploy    │ │
│  │ (schema)     │  │ (local srv)  │  │ (query test) │  │ (publish)   │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        Dashbook Runtime                                 │
│  ┌───────────────────┐  ┌───────────────────┐  ┌─────────────────────┐ │
│  │    Query Engine   │  │   Chart Renderer  │  │   Auth & Sharing    │ │
│  │  (DuckDB/drivers) │  │   (ECharts/Vega)  │  │   (OIDC/RBAC)       │ │
│  └───────────────────┘  └───────────────────┘  └─────────────────────┘ │
│  ┌───────────────────┐  ┌───────────────────┐  ┌─────────────────────┐ │
│  │   Cache Layer     │  │  Scheduler        │  │   API Server        │ │
│  │   (Redis/SQLite)  │  │  (cron/refresh)   │  │   (REST/GraphQL)    │ │
│  └───────────────────┘  └───────────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Data Sources                                    │
│  Snowflake │ Databricks │ BigQuery │ Postgres │ DuckDB │ Redshift │ ...│
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Data Flow

```
1. Developer edits YAML/SQL files
2. `dashbook validate` checks schema + SQL syntax
3. `dashbook dev` starts local server with hot reload
4. Developer pushes to GitHub
5. CI runs `dashbook test` against staging data
6. PR generates preview URL
7. On merge, `dashbook deploy` publishes to production
8. Runtime serves dashboards, caches queries, handles auth
```

---

## 2. Project Structure

### 2.1 Directory Layout

```
my-analytics/
├── dashbook.yaml              # Project configuration
├── .dashbook/                 # Generated files (gitignored)
│   ├── cache/                 # Query cache
│   └── compiled/              # Compiled artifacts
├── connections/               # Data source definitions
│   ├── snowflake-prod.yaml
│   ├── postgres-replica.yaml
│   └── duckdb-local.yaml
├── models/                    # Reusable SQL models
│   ├── core/
│   │   ├── orders.sql
│   │   └── customers.sql
│   └── metrics/
│       ├── revenue.sql
│       └── retention.sql
├── charts/                    # Individual chart definitions
│   ├── revenue-trend.yaml
│   ├── customer-growth.yaml
│   └── top-products.yaml
├── dashboards/                # Dashboard compositions
│   ├── executive-summary.yaml
│   ├── sales-ops.yaml
│   └── product-analytics.yaml
├── themes/                    # Visual themes
│   └── brand.yaml
├── filters/                   # Reusable filter definitions
│   └── date-ranges.yaml
└── scripts/                   # Custom hooks
    ├── pre-deploy.sh
    └── post-refresh.py
```

### 2.2 Project Configuration (`dashbook.yaml`)

```yaml
# dashbook.yaml
version: "1.0"
name: acme-analytics
description: "ACME Corp Analytics Dashboards"

# Default settings
defaults:
  connection: snowflake-prod
  theme: brand
  timezone: America/New_York
  cache_ttl: 1h

# Environment configuration
environments:
  development:
    connection: duckdb-local
    base_url: http://localhost:3000
  staging:
    connection: snowflake-staging
    base_url: https://staging.dashbook.acme.com
  production:
    connection: snowflake-prod
    base_url: https://dashbook.acme.com

# Git integration
git:
  provider: github
  repo: acme-corp/analytics-dashboards
  branch: main
  preview_branches: true

# Authentication
auth:
  provider: oidc
  issuer: https://auth.acme.com
  client_id: ${DASHBOOK_CLIENT_ID}
  
# Global feature flags
features:
  enable_sql_editor: false
  enable_csv_export: true
  enable_scheduling: true
```

---

## 3. Schema Specifications

### 3.1 Connection Schema

Connections define how Dashbook connects to data sources. Credentials are never stored in config files—they reference environment variables or secret managers.

```yaml
# connections/snowflake-prod.yaml
name: snowflake-prod
type: snowflake
description: "Production Snowflake warehouse"

config:
  account: ${SNOWFLAKE_ACCOUNT}
  warehouse: ANALYTICS_WH
  database: PROD_DB
  schema: ANALYTICS
  role: ANALYTICS_READER

auth:
  # Option 1: Environment variables
  type: env
  user_var: SNOWFLAKE_USER
  password_var: SNOWFLAKE_PASSWORD
  
  # Option 2: Key pair
  # type: key_pair
  # user_var: SNOWFLAKE_USER
  # private_key_path: ${SNOWFLAKE_KEY_PATH}
  
  # Option 3: Secret manager
  # type: secret_manager
  # provider: aws_secrets_manager
  # secret_id: prod/snowflake/analytics

# Connection pooling
pool:
  min_connections: 1
  max_connections: 10
  idle_timeout: 300

# Query settings
query:
  timeout: 300
  max_rows: 1000000
```

**Supported Connection Types:**

| Type | Status | Notes |
|------|--------|-------|
| `snowflake` | GA | Full support |
| `databricks` | GA | Unity Catalog support |
| `bigquery` | GA | Service account auth |
| `postgres` | GA | SSL support |
| `redshift` | GA | IAM auth support |
| `duckdb` | GA | Local + MotherDuck |
| `mysql` | Beta | Read replicas |
| `clickhouse` | Beta | HTTP interface |
| `trino` | Planned | - |
| `athena` | Planned | - |

### 3.2 Model Schema

Models are reusable SQL queries that can be referenced by charts. They support parameters, documentation, and testing.

```sql
-- models/metrics/monthly_revenue.sql

-- @name: monthly_revenue
-- @description: Monthly revenue aggregated by product category
-- @owner: analytics-team
-- @tags: [revenue, monthly, core]
--
-- @param start_date: date = dateadd(month, -12, current_date())
-- @param end_date: date = current_date()
-- @param granularity: string = 'month' {day, week, month, quarter}
-- @param category: string[] = [] -- empty means all categories
--
-- @returns:
--   - period: date -- The time period
--   - category: string -- Product category
--   - revenue: number -- Total revenue in USD
--   - order_count: integer -- Number of orders
--
-- @tests:
--   - revenue >= 0
--   - order_count >= 0
--   - period is not null

SELECT 
    DATE_TRUNC('{{ granularity }}', o.order_date) AS period,
    p.category,
    SUM(o.total_amount) AS revenue,
    COUNT(DISTINCT o.order_id) AS order_count
FROM {{ ref('orders') }} o
JOIN {{ ref('products') }} p ON o.product_id = p.product_id
WHERE o.order_date BETWEEN '{{ start_date }}' AND '{{ end_date }}'
{% if category %}
    AND p.category IN ({{ category | join(', ') | quote }})
{% endif %}
GROUP BY 1, 2
ORDER BY 1 DESC, 3 DESC
```

**Model Features:**

- **Parameters:** Typed inputs with defaults and validation
- **References:** `{{ ref('model_name') }}` for model dependencies
- **Jinja templating:** Conditional logic, loops, macros
- **Tests:** Built-in assertions run during CI
- **Documentation:** Inline docs extracted for catalog

### 3.3 Chart Schema

Charts define individual visualizations. They reference models or inline SQL.

```yaml
# charts/revenue-trend.yaml
name: revenue-trend
title: Monthly Revenue Trend
description: |
  Shows revenue trends over time with year-over-year comparison.
  Used in executive dashboards.

# Metadata
owner: analytics-team
tags: [revenue, trend, executive]
created: 2025-06-15
updated: 2026-01-20

# Data source
source:
  # Option 1: Reference a model
  model: monthly_revenue
  
  # Option 2: Inline SQL
  # sql: |
  #   SELECT date, SUM(revenue) as revenue
  #   FROM orders GROUP BY 1

# Parameters exposed to users
parameters:
  - name: date_range
    type: date_range
    label: Date Range
    default: last_12_months
    options:
      - last_30_days
      - last_90_days
      - last_12_months
      - year_to_date
      - custom
      
  - name: granularity
    type: select
    label: Group By
    default: month
    options:
      - value: day
        label: Daily
      - value: week
        label: Weekly
      - value: month
        label: Monthly
        
  - name: categories
    type: multi_select
    label: Categories
    default: []
    source:
      model: dim_categories
      value_field: category_id
      label_field: category_name

# Chart configuration
chart:
  type: line
  
  # Axes
  x:
    field: period
    type: temporal
    format: "%b %Y"
    label: Month
    
  y:
    field: revenue
    type: quantitative
    format: "$,.0f"
    label: Revenue
    
  # Series
  series:
    - field: revenue
      name: Revenue
      color: "#3B82F6"
      
    # Optional: Add comparison
    - field: revenue_ly
      name: Last Year
      color: "#9CA3AF"
      style: dashed
      
  # Annotations
  annotations:
    - type: line
      value: 1000000
      label: Monthly Target
      color: "#EF4444"
      style: dashed
      
    - type: band
      from: 800000
      to: 1200000
      label: Target Range
      color: "#10B98120"
      
  # Interactivity
  interactions:
    tooltip: true
    zoom: true
    brush: false

# Caching and refresh
refresh:
  schedule: "0 6 * * *"  # 6 AM daily
  timezone: America/New_York
  cache_ttl: 1h
  
# Access control (inherits from dashboard if not specified)
permissions:
  view: [all]
  export: [analysts, executives]
```

**Supported Chart Types:**

| Type | Description | Key Options |
|------|-------------|-------------|
| `line` | Time series, trends | `series`, `annotations`, `area_fill` |
| `bar` | Comparisons, rankings | `orientation`, `stacked`, `grouped` |
| `area` | Cumulative, composition | `stacked`, `normalized` |
| `scatter` | Correlations | `size_field`, `color_field`, `regression` |
| `pie` | Part-to-whole | `donut`, `labels` |
| `table` | Detailed data | `columns`, `pagination`, `sorting` |
| `metric` | Single KPI | `comparison`, `sparkline`, `trend` |
| `map` | Geographic | `geo_field`, `color_scale`, `zoom` |
| `heatmap` | Matrix density | `x_field`, `y_field`, `value_field` |
| `funnel` | Conversion flows | `stages`, `labels` |
| `sankey` | Flow visualization | `source`, `target`, `value` |
| `treemap` | Hierarchical | `path`, `value_field`, `color_field` |

### 3.4 Dashboard Schema

Dashboards compose charts into layouts with shared filters and theming.

```yaml
# dashboards/executive-summary.yaml
name: executive-summary
title: Executive Summary
description: High-level KPIs and trends for leadership team
slug: exec-summary  # URL: /dashboards/exec-summary

# Metadata
owner: analytics-team
tags: [executive, kpis, weekly-review]
created: 2025-03-01
updated: 2026-01-25

# Access control
permissions:
  view:
    - group: executives
    - group: analytics-team
    - user: ceo@acme.com
  edit:
    - group: analytics-team
  schedule:
    - group: analytics-team

# Theme override
theme: executive-dark

# Global filters (apply to all charts)
filters:
  - name: date_range
    type: date_range
    label: Reporting Period
    default: current_quarter
    position: header  # header, sidebar, or inline
    width: 300
    
  - name: region
    type: multi_select
    label: Region
    default: [all]
    source:
      model: dim_regions
      value_field: region_code
      label_field: region_name
    position: header
    width: 200
    
  - name: compare_period
    type: select
    label: Compare To
    default: previous_period
    options:
      - value: previous_period
        label: Previous Period
      - value: previous_year
        label: Same Period Last Year
      - value: none
        label: No Comparison
    position: header

# Layout (12-column grid)
layout:
  # Row 1: KPI cards
  - row:
      height: 120
      gap: 16
      items:
        - chart: kpi-revenue
          width: 3
        - chart: kpi-customers
          width: 3
        - chart: kpi-orders
          width: 3
        - chart: kpi-aov
          width: 3
          
  # Row 2: Main trend + breakdown
  - row:
      height: 400
      gap: 16
      items:
        - chart: revenue-trend
          width: 8
          title_override: Revenue Over Time
        - chart: revenue-by-category
          width: 4
          
  # Row 3: Tables
  - row:
      height: 350
      gap: 16
      items:
        - chart: top-customers
          width: 6
        - chart: top-products
          width: 6
          
  # Row 4: Geographic
  - row:
      height: 400
      items:
        - chart: revenue-map
          width: 12

# Dashboard-level settings
settings:
  auto_refresh: 5m
  show_last_updated: true
  allow_fullscreen: true
  allow_export: true
  export_formats: [pdf, png, csv]

# Scheduled reports
schedules:
  - name: weekly-executive-report
    frequency: weekly
    day: monday
    time: "08:00"
    timezone: America/New_York
    recipients:
      - channel: email
        addresses:
          - executives@acme.com
      - channel: slack
        webhook: ${SLACK_EXEC_WEBHOOK}
    format: pdf
    filters:
      date_range: last_7_days
```

### 3.5 Theme Schema

Themes define visual styling for charts and dashboards.

```yaml
# themes/brand.yaml
name: brand
description: ACME Corp brand theme

# Color palette
colors:
  # Primary colors
  primary: "#3B82F6"
  secondary: "#10B981"
  accent: "#F59E0B"
  
  # Semantic colors
  positive: "#10B981"
  negative: "#EF4444"
  neutral: "#6B7280"
  
  # Background
  background: "#FFFFFF"
  surface: "#F9FAFB"
  border: "#E5E7EB"
  
  # Text
  text_primary: "#111827"
  text_secondary: "#6B7280"
  text_muted: "#9CA3AF"
  
  # Chart palette (for series)
  chart_palette:
    - "#3B82F6"
    - "#10B981"
    - "#F59E0B"
    - "#EF4444"
    - "#8B5CF6"
    - "#EC4899"
    - "#06B6D4"
    - "#84CC16"

# Typography
typography:
  font_family: "Inter, system-ui, sans-serif"
  font_family_mono: "JetBrains Mono, monospace"
  
  # Scale
  heading_1: { size: 24, weight: 600, line_height: 1.2 }
  heading_2: { size: 20, weight: 600, line_height: 1.3 }
  heading_3: { size: 16, weight: 600, line_height: 1.4 }
  body: { size: 14, weight: 400, line_height: 1.5 }
  caption: { size: 12, weight: 400, line_height: 1.4 }
  metric: { size: 32, weight: 700, line_height: 1.1 }

# Chart defaults
chart:
  # Grid
  grid_color: "#E5E7EB"
  grid_style: dashed
  grid_opacity: 0.5
  
  # Axes
  axis_color: "#9CA3AF"
  axis_label_color: "#6B7280"
  axis_title_color: "#374151"
  
  # Legend
  legend_position: bottom
  legend_orientation: horizontal
  
  # Tooltip
  tooltip_background: "#1F2937"
  tooltip_text: "#FFFFFF"
  tooltip_border_radius: 6
  
  # Animation
  animation_duration: 300
  animation_easing: ease-out

# Component styling
components:
  # Cards
  card:
    background: "#FFFFFF"
    border: "1px solid #E5E7EB"
    border_radius: 8
    shadow: "0 1px 3px rgba(0,0,0,0.1)"
    padding: 16
    
  # Filters
  filter:
    background: "#F9FAFB"
    border: "1px solid #E5E7EB"
    border_radius: 6
    
  # Buttons
  button:
    primary_bg: "#3B82F6"
    primary_text: "#FFFFFF"
    secondary_bg: "#F3F4F6"
    secondary_text: "#374151"
    border_radius: 6

# Dark mode variant
dark:
  colors:
    background: "#111827"
    surface: "#1F2937"
    border: "#374151"
    text_primary: "#F9FAFB"
    text_secondary: "#D1D5DB"
    text_muted: "#9CA3AF"
  components:
    card:
      background: "#1F2937"
      border: "1px solid #374151"
```

---

## 4. CLI Specification

### 4.1 Command Reference

```bash
# Initialize a new project
dashbook init [directory]
  --template <name>          # Starter template (default, minimal, enterprise)
  --connection <type>        # Pre-configure connection type

# Validate configuration
dashbook validate [path]
  --strict                   # Treat warnings as errors
  --format <format>          # Output format (text, json, sarif)

# Start development server
dashbook dev
  --port <port>              # Server port (default: 3000)
  --host <host>              # Bind address (default: localhost)
  --open                     # Open browser automatically
  --env <environment>        # Environment to use (default: development)

# Run tests
dashbook test [pattern]
  --connection <name>        # Connection to test against
  --parallel <n>             # Parallel test execution
  --timeout <seconds>        # Query timeout
  --coverage                 # Generate coverage report

# Build static assets
dashbook build
  --env <environment>        # Target environment
  --output <directory>       # Output directory (default: .dashbook/dist)

# Deploy to production
dashbook deploy
  --env <environment>        # Target environment (default: production)
  --dry-run                  # Preview changes without applying
  --force                    # Skip confirmation prompts

# Generate preview for PR
dashbook preview
  --branch <branch>          # Branch to preview
  --ttl <duration>           # Preview lifetime (default: 7d)

# Manage connections
dashbook connection test <name>
dashbook connection list
dashbook connection sync       # Sync schema metadata

# Cache management
dashbook cache clear [pattern]
dashbook cache warm <dashboard>
dashbook cache status

# Schema introspection
dashbook schema <connection>
  --output <file>            # Write to file
  --format <format>          # json, yaml, or markdown

# Generate chart/dashboard from description (AI)
dashbook generate <type> <description>
  --model <llm>              # LLM to use (default: claude-sonnet)
  --output <file>            # Output file path
```

### 4.2 Development Server

The `dashbook dev` command starts a local server with:

- **Hot reload:** Changes to YAML/SQL files trigger instant updates
- **Query proxy:** Executes queries against configured connections
- **Mock data:** Optional synthetic data for offline development
- **Debug panel:** Query timing, cache status, error details
- **Preview filters:** Test different filter combinations

```bash
$ dashbook dev

  ╔═══════════════════════════════════════════════════╗
  ║                                                   ║
  ║   Dashbook Dev Server                             ║
  ║                                                   ║
  ║   Local:    http://localhost:3000                 ║
  ║   Network:  http://192.168.1.100:3000             ║
  ║                                                   ║
  ║   Dashboards:  5 loaded                           ║
  ║   Charts:      23 loaded                          ║
  ║   Models:      12 loaded                          ║
  ║   Connection:  duckdb-local (healthy)             ║
  ║                                                   ║
  ║   Press Ctrl+C to stop                            ║
  ║                                                   ║
  ╚═══════════════════════════════════════════════════╝

[12:34:56] Watching for changes...
[12:35:02] Changed: charts/revenue-trend.yaml
[12:35:02] Reloaded: revenue-trend (142ms)
```

---

## 5. Query Engine

### 5.1 Query Compilation

Dashbook compiles chart definitions into optimized SQL queries:

```
Chart YAML → Parameter Resolution → Jinja Rendering → SQL Optimization → Execution
```

**Compilation Steps:**

1. **Parse chart definition** - Load YAML, validate schema
2. **Resolve model references** - Expand `{{ ref() }}` calls
3. **Apply filter values** - Inject user-selected filter values
4. **Render Jinja templates** - Process conditionals, loops
5. **Optimize query** - Push down filters, prune unused columns
6. **Generate cache key** - Hash query + parameters
7. **Execute or return cached** - Check cache before execution

### 5.2 Caching Strategy

```yaml
# Three-tier caching
cache:
  # L1: In-memory (per-instance)
  memory:
    max_size: 500MB
    ttl: 5m
    
  # L2: Shared cache (Redis/Valkey)
  shared:
    provider: redis
    url: ${REDIS_URL}
    ttl: 1h
    
  # L3: Pre-aggregated tables
  materialized:
    enabled: true
    schema: dashbook_cache
    refresh_schedule: "0 */4 * * *"
```

**Cache Invalidation:**

- **Time-based:** TTL expiration
- **Event-based:** Webhook triggers from data pipelines
- **Manual:** `dashbook cache clear` command
- **Smart:** Detect upstream data changes (optional)

### 5.3 Query Federation

Dashbook can join data across multiple connections:

```yaml
# charts/cross-source-analysis.yaml
source:
  federation:
    - alias: orders
      connection: snowflake-prod
      sql: SELECT * FROM orders WHERE date > '2025-01-01'
    - alias: support_tickets
      connection: postgres-support
      sql: SELECT * FROM tickets WHERE created_at > '2025-01-01'
  
  # Final query runs in DuckDB
  sql: |
    SELECT 
      o.customer_id,
      COUNT(DISTINCT o.order_id) as orders,
      COUNT(DISTINCT t.ticket_id) as tickets
    FROM orders o
    LEFT JOIN support_tickets t ON o.customer_id = t.customer_id
    GROUP BY 1
```

---

## 6. Runtime Architecture

### 6.1 Deployment Options

**Option 1: Managed Cloud (Dashbook Cloud)**
```yaml
# dashbook.yaml
deployment:
  provider: dashbook-cloud
  plan: team
  region: us-east-1
```

**Option 2: Self-Hosted (Docker)**
```bash
docker run -d \
  -p 3000:3000 \
  -v $(pwd):/app/config \
  -e DATABASE_URL=... \
  dashbook/server:latest
```

**Option 3: Self-Hosted (Kubernetes)**
```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: dashbook
spec:
  replicas: 3
  template:
    spec:
      containers:
        - name: dashbook
          image: dashbook/server:latest
          resources:
            requests:
              memory: "512Mi"
              cpu: "500m"
```

**Option 4: Static Export**
```bash
# Generate static site (limited interactivity)
dashbook build --static
# Deploy to Vercel/Netlify/S3
```

### 6.2 Runtime Components

```
┌─────────────────────────────────────────────────────────────────┐
│                      Load Balancer                              │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│   Web Server  │     │   Web Server  │     │   Web Server  │
│   (Node.js)   │     │   (Node.js)   │     │   (Node.js)   │
└───────────────┘     └───────────────┘     └───────────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│ Query Worker  │     │ Query Worker  │     │ Query Worker  │
│   (Python)    │     │   (Python)    │     │   (Python)    │
└───────────────┘     └───────────────┘     └───────────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        ┌──────────┐   ┌──────────┐   ┌──────────┐
        │  Redis   │   │ Postgres │   │   S3     │
        │ (cache)  │   │ (config) │   │ (assets) │
        └──────────┘   └──────────┘   └──────────┘
```

### 6.3 API Endpoints

```
# Dashboard API
GET    /api/dashboards                    # List dashboards
GET    /api/dashboards/:slug              # Get dashboard config
GET    /api/dashboards/:slug/data         # Get dashboard data
POST   /api/dashboards/:slug/refresh      # Force refresh

# Chart API
GET    /api/charts/:name                  # Get chart config
POST   /api/charts/:name/query            # Execute chart query
GET    /api/charts/:name/export/:format   # Export chart (png, svg, csv)

# Filter API
GET    /api/filters/:name/options         # Get filter options
POST   /api/filters/validate              # Validate filter values

# Admin API
GET    /api/health                        # Health check
GET    /api/metrics                       # Prometheus metrics
POST   /api/cache/clear                   # Clear cache
POST   /api/deploy                        # Trigger deployment
```

---

## 7. GitHub Integration

### 7.1 GitHub Actions Workflow

```yaml
# .github/workflows/dashbook.yml
name: Dashbook CI/CD

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Dashbook
        uses: dashbook/setup-action@v1
        with:
          version: latest
          
      - name: Validate Configuration
        run: dashbook validate --strict
        
      - name: Run Tests
        run: dashbook test --connection staging
        env:
          SNOWFLAKE_ACCOUNT: ${{ secrets.SNOWFLAKE_ACCOUNT }}
          SNOWFLAKE_USER: ${{ secrets.SNOWFLAKE_USER }}
          SNOWFLAKE_PASSWORD: ${{ secrets.SNOWFLAKE_PASSWORD }}

  preview:
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    needs: validate
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Dashbook
        uses: dashbook/setup-action@v1
        
      - name: Generate Preview
        id: preview
        run: |
          URL=$(dashbook preview --branch ${{ github.head_ref }})
          echo "preview_url=$URL" >> $GITHUB_OUTPUT
          
      - name: Comment PR
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `## 📊 Dashboard Preview\n\n` +
                    `Preview URL: ${{ steps.preview.outputs.preview_url }}\n\n` +
                    `This preview will expire in 7 days.`
            })

  deploy:
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    needs: validate
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Dashbook
        uses: dashbook/setup-action@v1
        
      - name: Deploy to Production
        run: dashbook deploy --env production
        env:
          DASHBOOK_API_KEY: ${{ secrets.DASHBOOK_API_KEY }}
```

### 7.2 PR Preview Flow

```
1. Developer opens PR with dashboard changes
2. CI validates configuration
3. CI deploys to ephemeral preview environment
4. Bot comments on PR with preview URL
5. Reviewers can interact with live preview
6. Preview auto-expires after 7 days or PR close
```

---

## 8. AI Integration

### 8.1 AI-Optimized Schema Design

Dashbook's YAML schema is designed for LLM generation:

- **Flat structure:** Avoid deep nesting where possible
- **Explicit types:** All fields have clear types and constraints
- **Enum values:** Closed sets instead of free-form strings
- **Documentation:** Every field has description and examples
- **Validation messages:** Clear error messages for fixing issues

### 8.2 Claude Code Integration

Example workflow for AI-assisted dashboard development:

```
User: "Add a chart showing customer churn rate over time to the 
       executive dashboard"

Claude Code:
1. Reads dashboards/executive-summary.yaml
2. Checks available models in models/
3. Creates models/metrics/churn_rate.sql if needed
4. Creates charts/churn-rate-trend.yaml
5. Updates dashboards/executive-summary.yaml layout
6. Runs dashbook validate
7. Commits changes to feature branch
8. Opens PR
```

### 8.3 Natural Language to Dashboard

```bash
# Generate chart from description
$ dashbook generate chart "monthly revenue by product category as a stacked bar chart"

Generated: charts/monthly-revenue-by-category.yaml

# Generate dashboard from description  
$ dashbook generate dashboard "sales performance dashboard with revenue KPIs, 
  trend chart, top products table, and geographic breakdown"

Generated: dashboards/sales-performance.yaml
           charts/kpi-revenue.yaml
           charts/kpi-growth.yaml
           charts/revenue-trend.yaml
           charts/top-products.yaml
           charts/revenue-map.yaml
```

---

## 9. Security

### 9.1 Authentication

```yaml
# dashbook.yaml
auth:
  # OIDC (recommended)
  provider: oidc
  issuer: https://auth.example.com
  client_id: ${OIDC_CLIENT_ID}
  client_secret: ${OIDC_CLIENT_SECRET}
  scopes: [openid, profile, email, groups]
  
  # Or: SAML
  # provider: saml
  # metadata_url: https://idp.example.com/metadata
  
  # Or: API Key (for programmatic access)
  # provider: api_key
  # header: X-API-Key
```

### 9.2 Authorization (RBAC)

```yaml
# permissions.yaml
roles:
  viewer:
    description: Can view dashboards
    permissions:
      - dashboards:read
      - charts:read
      - filters:read
      
  analyst:
    description: Can view and export
    extends: viewer
    permissions:
      - dashboards:export
      - charts:export
      - sql_editor:read
      
  editor:
    description: Can modify dashboards
    extends: analyst
    permissions:
      - dashboards:write
      - charts:write
      - models:write
      
  admin:
    description: Full access
    permissions:
      - "*"

# Role assignments
assignments:
  - role: viewer
    groups: [all-employees]
    
  - role: analyst
    groups: [data-team, product-team]
    
  - role: editor
    groups: [analytics-team]
    users: [alice@example.com]
    
  - role: admin
    groups: [platform-team]
```

### 9.3 Row-Level Security

```yaml
# models/orders.sql
-- @rls:
--   field: region
--   claim: user.region
--   default: [] # No access if claim missing

SELECT * FROM orders
WHERE region IN ({{ user.region | default([]) | join(', ') | quote }})
```

### 9.4 Data Masking

```yaml
# models/customers.sql
-- @masking:
--   - field: email
--     roles: [viewer]
--     mask: email # john@example.com → j***@e***.com
--   - field: phone
--     roles: [viewer, analyst]  
--     mask: phone # 555-123-4567 → ***-***-4567
--   - field: ssn
--     roles: [viewer, analyst, editor]
--     mask: redact # → [REDACTED]
```

---

## 10. Extensibility

### 10.1 Custom Chart Types

```typescript
// plugins/charts/gauge.ts
import { ChartPlugin, ChartConfig, RenderContext } from '@dashbook/sdk';

export const gaugeChart: ChartPlugin = {
  name: 'gauge',
  displayName: 'Gauge Chart',
  description: 'Display a single metric as a gauge',
  
  // JSON Schema for chart.options
  schema: {
    type: 'object',
    properties: {
      min: { type: 'number', default: 0 },
      max: { type: 'number', default: 100 },
      thresholds: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            value: { type: 'number' },
            color: { type: 'string' }
          }
        }
      }
    }
  },
  
  // Render function
  render: (config: ChartConfig, data: any[], ctx: RenderContext) => {
    const value = data[0]?.[config.y.field] ?? 0;
    return {
      type: 'echarts',
      options: {
        series: [{
          type: 'gauge',
          data: [{ value }],
          min: config.options.min,
          max: config.options.max,
          // ... gauge config
        }]
      }
    };
  }
};
```

### 10.2 Custom Connectors

```python
# plugins/connectors/custom_api.py
from dashbook.connectors import Connector, ConnectionConfig, QueryResult

class CustomAPIConnector(Connector):
    """Connect to a custom REST API as a data source."""
    
    name = "custom_api"
    
    config_schema = {
        "type": "object",
        "properties": {
            "base_url": {"type": "string"},
            "auth_header": {"type": "string"},
        },
        "required": ["base_url"]
    }
    
    def connect(self, config: ConnectionConfig) -> None:
        self.base_url = config["base_url"]
        self.headers = {"Authorization": config.get("auth_header", "")}
    
    def execute(self, query: str) -> QueryResult:
        # Parse query as endpoint + params
        endpoint, params = self._parse_query(query)
        response = requests.get(
            f"{self.base_url}/{endpoint}",
            params=params,
            headers=self.headers
        )
        return QueryResult(
            columns=[...],
            rows=response.json()["data"]
        )
    
    def get_schema(self) -> dict:
        # Return available endpoints as "tables"
        return {...}
```

### 10.3 Lifecycle Hooks

```yaml
# dashbook.yaml
hooks:
  # Before deploying
  pre_deploy:
    - script: scripts/validate-data.py
    - script: scripts/notify-slack.sh
    
  # After deploying
  post_deploy:
    - script: scripts/warm-cache.py
    - script: scripts/update-catalog.py
    
  # Before each query
  pre_query:
    - script: scripts/log-query.py
    
  # After data refresh
  post_refresh:
    - script: scripts/check-anomalies.py
```

---

## 11. Observability

### 11.1 Metrics (Prometheus)

```
# Query performance
dashbook_query_duration_seconds{chart, connection, status}
dashbook_query_rows_returned{chart, connection}
dashbook_cache_hit_ratio{chart}

# System health
dashbook_active_connections{connection}
dashbook_memory_usage_bytes
dashbook_cpu_usage_percent

# User activity
dashbook_dashboard_views_total{dashboard, user_group}
dashbook_filter_usage_total{filter, value}
dashbook_export_requests_total{format}
```

### 11.2 Logging

```json
{
  "timestamp": "2026-01-25T12:34:56Z",
  "level": "info",
  "service": "dashbook",
  "event": "query_executed",
  "chart": "revenue-trend",
  "connection": "snowflake-prod",
  "duration_ms": 1234,
  "rows_returned": 365,
  "cache_hit": false,
  "user_id": "user_abc123",
  "filters": {
    "date_range": "last_12_months",
    "region": ["NA", "EU"]
  }
}
```

### 11.3 Tracing (OpenTelemetry)

```
[dashbook.api] POST /api/charts/revenue-trend/query (1.5s)
  └─ [dashbook.auth] validate_token (12ms)
  └─ [dashbook.cache] check_cache (3ms) MISS
  └─ [dashbook.query] compile_sql (45ms)
  └─ [dashbook.query] execute (1.2s)
  │    └─ [snowflake] query (1.1s)
  └─ [dashbook.cache] store_result (8ms)
  └─ [dashbook.render] format_response (15ms)
```

---

## 12. Migration Guide

### 12.1 From Metabase

```bash
# Export Metabase dashboards
dashbook migrate metabase \
  --host https://metabase.example.com \
  --api-key $METABASE_API_KEY \
  --output ./migrated/

# Review and adjust generated files
# Run validation
dashbook validate ./migrated/
```

### 12.2 From Looker

```bash
# Export LookML + dashboards
dashbook migrate looker \
  --project my-project \
  --credentials $LOOKER_CREDENTIALS \
  --output ./migrated/
```

### 12.3 From Tableau

```bash
# Export workbooks
dashbook migrate tableau \
  --server https://tableau.example.com \
  --site my-site \
  --workbook "Sales Dashboard" \
  --output ./migrated/
```

---

## 13. Roadmap

### Phase 1: Foundation (v0.1 - v0.3)
- [x] Core YAML schema
- [x] CLI (validate, dev, deploy)
- [x] Basic chart types (line, bar, table, metric)
- [x] Snowflake, Postgres, DuckDB connectors
- [x] Local development server
- [ ] GitHub Actions integration

### Phase 2: Production Ready (v0.4 - v0.6)
- [ ] All major chart types
- [ ] PR preview environments
- [ ] OIDC authentication
- [ ] Row-level security
- [ ] Scheduled reports
- [ ] BigQuery, Databricks, Redshift connectors

### Phase 3: Scale (v0.7 - v0.9)
- [ ] Query federation
- [ ] Materialized caching
- [ ] Embedding SDK
- [ ] Custom chart plugins
- [ ] Alerting

### Phase 4: Enterprise (v1.0+)
- [ ] Audit logging
- [ ] SSO/SAML
- [ ] Multi-tenant deployment
- [ ] Semantic layer integration
- [ ] AI-powered anomaly detection

---

## Appendix A: JSON Schema

The complete JSON Schema for all Dashbook configuration files is available at:

- `schemas/dashbook.schema.json` - Project config
- `schemas/connection.schema.json` - Connection definitions
- `schemas/model.schema.json` - SQL model metadata
- `schemas/chart.schema.json` - Chart definitions
- `schemas/dashboard.schema.json` - Dashboard compositions
- `schemas/theme.schema.json` - Theme definitions

---

## Appendix B: Example Repository

A complete example repository is available at:

**https://github.com/dashbook/example-analytics**

```
example-analytics/
├── dashbook.yaml
├── connections/
│   └── duckdb-sample.yaml
├── models/
│   ├── core/
│   │   ├── orders.sql
│   │   └── customers.sql
│   └── metrics/
│       └── revenue.sql
├── charts/
│   ├── kpi-revenue.yaml
│   ├── revenue-trend.yaml
│   └── top-products.yaml
├── dashboards/
│   └── sample-dashboard.yaml
├── themes/
│   └── default.yaml
└── .github/
    └── workflows/
        └── dashbook.yml
```

---

## Appendix C: Comparison Matrix

| Feature | Dashbook | Evidence | Lightdash | Looker | Metabase |
|---------|----------|----------|-----------|--------|----------|
| Open Source | ✅ | ✅ | ✅ | ❌ | ✅ (AGPL) |
| Git-Native | ✅ | ✅ | ✅ | Partial | ❌ |
| dbt Required | ❌ | ❌ | ✅ | ❌ | ❌ |
| PR Previews | ✅ | Manual | Manual | ❌ | ❌ |
| AI Schema | ✅ | ❌ | ❌ | ❌ | ❌ |
| Self-Hosted | ✅ | ✅ | ✅ | ❌ | ✅ |
| Semantic Layer | Optional | ❌ | dbt | LookML | ❌ |
| Embedded Analytics | ✅ | Partial | ✅ | ✅ | ✅ |
| Learning Curve | Low | Low | Medium | High | Low |

---

*This specification is a living document. Submit feedback and proposals via GitHub Issues.*
