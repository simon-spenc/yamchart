# Yamchart Implementation Status

Last updated: 2026-02-04

## Summary

| Phase | Name | Status |
|-------|------|--------|
| 0-1 | Project Setup & Schema | ✅ Complete |
| 2 | Query Engine | ✅ Complete |
| 3 | API Server | ✅ Complete |
| 4 | Web App | ✅ Complete |
| 5 | Docker Deployment | ✅ Complete |
| 6 | Auth & Multitenancy | ⏸️ Deferred |
| 7 | Dashboard Layouts | ✅ Complete |
| - | CLI Design & Implementation | ✅ Complete |
| - | Init Command | ✅ Complete |
| - | Interactive Filters | ✅ Complete |
| - | PostgreSQL Connector | ✅ Complete |
| - | Connection Testing | ✅ Complete |
| - | NPM Publishing | ✅ Complete |
| - | Open Source Distribution | ✅ Complete |

---

## Phase Details

### Phase 0-1: Project Setup & Schema ✅
**Plan:** `2026-01-31-phase-0-1-implementation.md`

- [x] Monorepo structure with pnpm + Turborepo
- [x] Zod schemas for charts, models, connections
- [x] TypeScript configuration
- [x] ESLint + Prettier setup

### Phase 2: Query Engine ✅
**Plan:** `2026-01-31-phase-2-query-engine.md`

- [x] SQL templating with Nunjucks
- [x] Parameter resolution
- [x] Date preset handling
- [x] DuckDB connector
- [x] Query compilation pipeline

### Phase 3: API Server ✅
**Plan:** `2026-01-31-phase-3-api-server.md`

- [x] Fastify server setup
- [x] Config loader from YAML files
- [x] Query execution endpoints
- [x] Chart/model resolution
- [x] Error handling

### Phase 4: Web App ✅
**Plan:** `2026-01-31-phase-4-web-app.md`

- [x] React + Vite setup
- [x] ECharts integration
- [x] React Query for data fetching
- [x] Chart components (line, bar, area, pie, donut, scatter, table, metric, kpi)
- [x] Responsive layout

### Phase 5: Docker Deployment ✅
**Plan:** `2026-01-31-phase-5-docker-deployment.md`

- [x] Dockerfile for production build
- [x] Multi-stage build optimization
- [x] GitHub Actions CI workflow (`ci.yml`)
- [x] GitHub Actions deploy workflow (`deploy.yml`)
- [x] Release workflow with Docker push (`release.yml`)

### Phase 6: Auth & Multitenancy ⏸️ Deferred
**Plan:** `2026-01-31-phase-6-auth-multitenancy.md`

- [ ] Supabase authentication integration
- [ ] Multi-tenant project support
- [ ] User permissions

*Deferred - not needed for open source MVP*

### Phase 7: Dashboard Layouts ✅
**Plans:** `2026-01-31-phase-7-dashboard-layouts.md`, `2026-01-31-phase-7-dashboard-layouts-design.md`

- [x] Dashboard YAML schema
- [x] Dashboard config loader
- [x] Dashboard REST API routes
- [x] React Grid Layout integration
- [x] Drag-and-drop editing
- [x] Edit mode context
- [x] Widget types: Chart, KPI, Text
- [x] Add widget modal
- [x] Save/discard changes
- [x] Editable text widgets with markdown
- [x] KPI variable references in text (`{{chart}}`, `{{chart.field}}`, `{{chart@preset}}`)
- [x] Clickable KPI refs with smart popover (shows source, value, date context)

### CLI ✅
**Plans:** `2026-02-01-cli-design.md`, `2026-02-01-cli-implementation.md`

- [x] Commander.js CLI setup
- [x] `yamchart validate` command
- [x] `yamchart dev` command
- [x] `yamchart init` command
- [x] Error reporting with helpful messages

### Init Command ✅
**Plans:** `2026-02-02-init-command-design.md`, `2026-02-02-init-command-implementation.md`

- [x] Project scaffolding
- [x] Template modes: default, empty, example
- [x] `--force` flag for overwrites
- [x] Template bundling in build

### Interactive Filters ✅
**Plan:** `2026-02-03-interactive-filters-design.md`

- [x] Date picker component
- [x] Date range filter
- [x] Date presets (today, last 7 days, etc.)
- [x] Dynamic filters from chart config
- [x] Filter state management

### PostgreSQL Connector ✅
**Plan:** `2026-02-03-postgres-connector-implementation.md`

- [x] PostgreSQL connector class
- [x] Connection pooling with `pg`
- [x] Schema support
- [x] SSL configuration
- [x] Type mapping (OID to JS types)
- [x] Query execution with timing
- [x] EXPLAIN validation
- [x] Unit tests

### Connection Testing ✅

- [x] `GET /api/connections/status` - Test all connections
- [x] `GET /api/connections/:name/status` - Test single connection
- [x] Returns health status, latency, and error messages
- [x] Proper error handling for pg library errors (ECONNREFUSED, EAGAIN, etc.)
- [x] Tested with DuckDB and PostgreSQL connections

### NPM Publishing ✅
**Plan:** `2026-02-03-npm-publishing.md`

- [x] LICENSE file (MIT)
- [x] Package metadata (author, repository, keywords)
- [x] GitHub Actions release workflow
- [x] npm publish automation on tags
- [x] Docker image publish to GHCR

### Open Source Distribution ✅
**Plans:** `2026-02-03-open-source-distribution-design.md`, `2026-02-03-open-source-distribution-implementation.md`

- [x] README documentation
- [x] Examples directory
- [x] Getting started guide
- [x] MIT license

---

## What's Next?

### Potential Future Work

1. **More Database Connectors** - MySQL, SQLite, BigQuery, Snowflake

2. **More Chart Types** - Heatmap, gauge, funnel, sankey, treemap

3. **Export Features** - PDF export, PNG export, CSV data export

4. **Scheduled Refreshes** - Auto-refresh dashboards on interval

5. **Embedding** - Embed dashboards in external sites

6. **Auth (Phase 6)** - If multi-user support is needed

---

## Recent Changes (2026-02-04)

### v0.1.3 - Chart Enhancements
- **Donut chart type** with configurable center value/label display
  - `centerValue.field`: Use `'total'` for sum, or specific field name
  - `centerValue.label`: Label displayed below value
  - `centerValue.format`: Format string (`$`, `%`, etc.)
- **Granularity selector** for time series charts (daily/weekly/monthly/quarterly)
  - Dynamic x-axis labels based on granularity
  - Smart date formatting (e.g., "Q1 '25" for quarters)
- **Filter override controls** on dashboard chart widgets
  - Click filter icon to set chart-specific filters
  - "Filtered" badge shows when chart has custom filters
  - "Reset to dashboard" button to clear overrides
- **Copy Reference button** on standalone chart pages
  - Copies `{{chartName}}` for use in markdown widgets
- **Date range filters** on all standalone chart pages
- Example: Revenue by Region donut chart

### Connection Testing
- `GET /api/connections/status` - Test all database connections
- `GET /api/connections/:name/status` - Test single connection
- Returns health status, latency (ms), and error messages
- Proper error handling for pg errors (ECONNREFUSED, EAGAIN, etc.)

### Bug Fixes (v0.1.3)
- Fixed y-axis label spacing on line/bar charts
- Added x-axis labels to line/bar/area charts
- Fixed sample data date range to include current year

### KPI References in Markdown
- Clickable KPI values with smart popover showing source details
- Syntax: `{{chart}}`, `{{chart.field}}`, `{{chart@preset}}`, `{{chart@start..end}}`
- Locked references for fixed date ranges independent of filter
- Smart popover positioning (flips above when near viewport bottom)
- Blue styling with dashed underline to indicate interactive data

### Bug Fixes (earlier)
- Fixed KPI charts showing $0 (models now use correct date range from filters)
- Fixed server not hot-reloading model changes (added `updateCompiler` method)
- Fixed date filter not setting default value in store on mount

### Earlier Today
- Editable markdown widgets with KPI variable references
- Smart list continuation in text editor
- Improved edit mode UI (smaller, semi-transparent drag handles)
- Fixed widget movement bugs with stable content-based IDs
