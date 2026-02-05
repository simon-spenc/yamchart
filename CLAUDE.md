# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Yamchart is an open-source, Git-native framework for defining and deploying BI dashboards through code. Users write YAML configs and SQL models; Yamchart compiles, executes, and renders interactive dashboards.

**Core principle:** If it's not in Git, it doesn't exist.

## Architecture

TypeScript monorepo with pnpm + Turborepo:

```
yamchart/
├── apps/
│   ├── cli/        # CLI tool (validate, dev, init, sync-dbt, generate)
│   ├── server/     # Fastify API server
│   └── web/        # React + Vite dashboard viewer
├── packages/
│   ├── schema/     # Zod schemas, shared TypeScript types
│   ├── query/      # SQL compilation, Nunjucks templating
│   ├── config/     # Shared tsconfig, eslint configs
│   ├── auth/       # Authentication (Supabase)
│   └── billing/    # Billing (Stripe)
└── examples/       # Sample yamchart project with DuckDB
```

## Commands

```bash
pnpm install          # Install dependencies
pnpm dev              # Start all apps in dev mode (server + web)
pnpm build            # Build all packages and apps
pnpm test             # Run all tests
pnpm lint             # Lint all packages
pnpm clean            # Remove dist folders and node_modules
```

**Individual apps:**
```bash
pnpm --filter @yamchart/server dev    # Server only (port 3001)
pnpm --filter @yamchart/web dev       # Web only (port 5173)
pnpm --filter @yamchart/server test   # Run server tests
```

**dbt integration:**
```bash
yamchart sync-dbt --path ../dbt-project  # Sync dbt metadata to .yamchart/catalog.md
yamchart sync-dbt --refresh              # Re-sync with saved config
yamchart generate                        # Interactive wizard to create model stubs
yamchart generate --yolo                 # Batch generate all stubs with defaults
```

## Technology Stack

- **API:** Fastify
- **Frontend:** React + Vite + ECharts
- **State:** React Query (server data) + Zustand (UI state)
- **SQL Templating:** Nunjucks (Jinja-compatible)
- **Validation:** Zod schemas
- **Database (MVP):** DuckDB
- **Testing:** Vitest (unit/integration) + Playwright (E2E)

## Key Patterns

**Independent chart updates:** Each chart is a React Query subscription. Filter changes invalidate only affected queries—charts update independently without full page refresh.

**Stateless server:** Reads YAML/SQL from filesystem, executes queries, returns data. No database required. Cache, config loader, and query executor are interfaces that can be swapped for production implementations (Redis, database-backed config, queue-based execution).

**Query compilation pipeline:**
```
chart.yaml → resolve model → parse params → apply date presets → render Nunjucks template → SQL
```

## User Config Files

Users create these files in their yamchart projects:
- `yamchart.yaml` - project config, default connection
- `connections/*.yaml` - data source definitions
- `models/*.sql` - SQL with Jinja templating and metadata in comments
- `charts/*.yaml` - chart definitions referencing models
- `dashboards/*.yaml` - layout compositions

## Supported Chart Types

- `line`, `bar`, `area` - Time series with granularity selector (day/week/month/quarter)
- `pie`, `donut` - Part-to-whole (donut supports center value/label)
- `scatter` - Correlations
- `table` - Tabular data display
- `kpi` - Single metric with period comparison
- `metric` - Simple value display

## Key Features

- **Granularity selector** - Time series charts support dynamic grouping (daily/weekly/monthly/quarterly) with automatic x-axis label formatting
- **Filter overrides** - Dashboard charts can have independent filter settings
- **KPI references** - Embed live values in markdown: `{{chartName}}`, `{{chart.field}}`, `{{chart@preset}}`
- **Copy reference** - Standalone chart pages have button to copy markdown embed syntax

## Environment Setup

Copy `.env.example` to `.env` and configure:

```bash
YAMCHART_PROJECT_DIR=./examples  # Path to yamchart project with YAML/SQL files
PORT=3001                         # Server port
```

Optional (for auth/billing features):
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` - Supabase authentication
- `STRIPE_SECRET_KEY` - Billing integration

## Documentation

**Reference docs (in `docs/configuration/`):**
- `charts.md` - Chart types, parameters, granularity, formatting
- `dashboards.md` - Layout, widgets, KPI references, filter overrides
- `models.md` - SQL with Jinja templating, date patterns
- `connections.md` - DuckDB/PostgreSQL configuration
- `dbt-sync.md` - Sync dbt project metadata for AI assistance

**Design documents:**
- `docs/plans/2026-01-31-mvp-architecture-design.md` - Full MVP architecture design
- `Yamchart Technical Spec.md` - Complete product specification

## Frontend Patterns

**ECharts configuration:** Charts use ECharts with consistent patterns:
- Grid margins: `{ left: '3%', right: '4%', bottom: '10%', containLabel: true }`
- Y-axis nameGap: 80 for proper label spacing
- Granularity-based date formatting with quarter format (`Q1 '25`)

**Filter state:** Zustand store (`useFilterStore`) manages:
- Global filters applied to all charts
- Per-chart filter overrides on dashboards
- Granularity selection for time series

**Chart components:** Located in `apps/web/src/components/charts/`:
- `LineChart.tsx`, `BarChart.tsx`, `AreaChart.tsx` - Time series with granularity
- `PieChart.tsx`, `DonutChart.tsx` - Part-to-whole (donut uses series label for center)
- `KPIChart.tsx` - Single metric with comparison
