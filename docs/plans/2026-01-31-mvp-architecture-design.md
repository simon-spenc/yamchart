# Dashbook MVP Architecture Design

**Date:** 2026-01-31
**Status:** Approved

---

## Overview

Dashbook is an open-source, Git-native framework for defining and deploying BI dashboards through code. This document describes the MVP architecture: a single interactive line chart with date filter, proving the full vertical from YAML config to rendered visualization.

### MVP Scope

- Single line chart (revenue trend)
- Date range filter
- DuckDB data source
- Local development server with hot reload

### Fast-Follows

1. Executive dashboard (KPI cards + grid layout)
2. Data exploration (table with sorting/filtering)

---

## Technology Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Monorepo | pnpm + Turborepo | Fast, shared code between apps |
| Language | TypeScript | Type safety, AI tooling support |
| API Server | Fastify | Fast, schema validation built-in |
| Frontend | React + Vite | Popular, excellent DX |
| Charts | ECharts | Feature-rich, handles all chart types |
| State | React Query + Zustand | Independent chart updates, simple |
| Templating | Nunjucks | Jinja-compatible for SQL |
| Validation | Zod | TypeScript-first schemas |
| Database | DuckDB (MVP) | Zero setup, fast analytics |
| Cache | In-memory (MVP) | Interface allows Redis swap |
| Testing | Vitest + Playwright | Fast unit tests, reliable E2E |

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────┐
│                    apps/web (React)                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │ FilterBar   │  │ ChartPanel  │  │ React Query     │  │
│  │ (Zustand)   │  │ (ECharts)   │  │ (data fetching) │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────┘
                           │ HTTP/REST
                           ▼
┌─────────────────────────────────────────────────────────┐
│                  apps/server (Fastify)                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │ Config      │  │ Query       │  │ Cache           │  │
│  │ Loader      │  │ Compiler    │  │ (in-memory)     │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────┘
                           │ SQL
                           ▼
┌─────────────────────────────────────────────────────────┐
│              Data Sources (DuckDB / Postgres)            │
└─────────────────────────────────────────────────────────┘
```

### Key Design Decisions

- **Stateless server**: Reads YAML/SQL from filesystem, no database required for MVP
- **Extension points**: Cache, config loader, query executor are interfaces—swap implementations for production
- **Independent chart updates**: Each chart is a React Query subscription; filter changes invalidate only affected queries

---

## Project Structure

```
dashbook/
├── apps/
│   ├── cli/                 # dashbook validate, dev, init
│   │   └── src/
│   ├── server/              # Fastify API
│   │   └── src/
│   │       ├── routes/      # /api/charts, /api/config
│   │       ├── services/    # config-loader, query-compiler, cache
│   │       └── index.ts
│   └── web/                 # React + Vite
│       └── src/
│           ├── components/  # Chart, FilterBar, Layout
│           ├── hooks/       # useChart, useFilters
│           └── stores/      # Zustand filter store
├── packages/
│   ├── schema/              # Zod schemas, TypeScript types
│   ├── query/               # SQL compilation, Nunjucks templating
│   └── config/              # Shared tsconfig, eslint
├── examples/                # Sample dashbook project
│   ├── dashbook.yaml
│   ├── connections/
│   ├── models/
│   ├── charts/
│   └── sample-data.duckdb
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

---

## Data Flow

### Startup (Server loads config)

```
dashbook.yaml → parse → validate (Zod) → in-memory config
charts/*.yaml → parse → validate → chart registry
models/*.sql → parse metadata → model registry
```

### Chart Render (Initial load)

```
React app loads → fetches /api/charts/revenue-trend →
Server returns chart config (axes, type, parameters) →
React Query calls /api/charts/revenue-trend/query →
Server: compile SQL (resolve refs, apply defaults) →
         execute against DuckDB →
         cache result (keyed by query hash + params) →
         return rows →
ECharts renders chart
```

### Filter Change

```
User picks "Last 30 days" →
Zustand updates filter state →
React Query invalidates queries with that filter →
Refetch /api/charts/revenue-trend/query?date_range=last_30_days →
Server checks cache (miss) → compile → execute → cache → return →
ECharts animates transition to new data
```

### Cache Key Structure

```
{chart_name}:{query_hash}:{param_hash}
revenue-trend:a3f2b1:date_range=last_30_days
```

---

## MVP Schemas

### dashbook.yaml

```yaml
version: "1.0"
name: my-analytics
defaults:
  connection: local-duckdb
```

### connections/local-duckdb.yaml

```yaml
name: local-duckdb
type: duckdb
config:
  path: ./sample-data.duckdb
```

### models/revenue.sql

```sql
-- @name: monthly_revenue
-- @param start_date: date = dateadd(month, -12, current_date())
-- @param end_date: date = current_date()

SELECT
  date_trunc('month', order_date) AS period,
  SUM(amount) AS revenue
FROM {{ ref('orders') }}
WHERE order_date BETWEEN '{{ start_date }}' AND '{{ end_date }}'
GROUP BY 1
ORDER BY 1
```

### charts/revenue-trend.yaml

```yaml
name: revenue-trend
title: Monthly Revenue
source:
  model: monthly_revenue
parameters:
  - name: date_range
    type: date_range
    label: Date Range
    default: last_12_months
chart:
  type: line
  x:
    field: period
    type: temporal
  y:
    field: revenue
    type: quantitative
    format: "$,.0f"
```

---

## API Endpoints

```
GET  /api/health
     → { status: "ok", version: "0.1.0" }

GET  /api/config
     → { name, defaultConnection, charts: [...] }

GET  /api/charts/:name
     → { name, title, chart, parameters }

POST /api/charts/:name/query
     Body: { date_range: "last_30_days" }
     → { columns: [...], rows: [...], meta: { cached, duration_ms } }

GET  /api/connections/:name/status
     → { name, type, status: "healthy", latency_ms }
```

### Query Response Format

```json
{
  "columns": [
    { "name": "period", "type": "date" },
    { "name": "revenue", "type": "number" }
  ],
  "rows": [
    { "period": "2025-01-01", "revenue": 125000 },
    { "period": "2025-02-01", "revenue": 142000 }
  ],
  "meta": {
    "cached": false,
    "duration_ms": 142,
    "row_count": 12
  }
}
```

---

## Frontend Components

### Component Tree

```
<App>
  <QueryClientProvider>
    <DashbookProvider>
      <Header />
      <FilterBar />
      <ChartContainer>
        <Chart />
      </ChartContainer>
    </DashbookProvider>
  </QueryClientProvider>
</App>
```

### Key Components

**`<Chart />`** - Generic chart renderer
- Maps Dashbook chart schema → ECharts options
- Handles resize, animations, tooltips

**`<ChartContainer />`** - Data fetching wrapper
- Uses `useQuery` to fetch chart data
- Shows loading skeleton / error state

**`<FilterBar />`** - Parameter controls
- Renders date picker based on chart config
- Updates Zustand store on change

### Zustand Store

```typescript
interface FilterStore {
  globalFilters: Record<string, unknown>;
  chartFilters: Record<string, Record<string, unknown>>;
  setGlobalFilter: (name: string, value: unknown) => void;
  setChartFilter: (chart: string, name: string, value: unknown) => void;
  resetFilters: () => void;
}
```

### React Query Hook

```typescript
const useChartData = (chartName: string) => {
  const filters = useFilterStore(s => s.globalFilters);
  return useQuery({
    queryKey: ['chart', chartName, filters],
    queryFn: () => fetchChartData(chartName, filters),
  });
};
```

### Multi-Chart Extension

```
<Dashboard>
  <FilterBar filters={globalFilters} />
  <GridLayout>
    <ChartContainer chartName="kpi-revenue" />
    <ChartContainer chartName="revenue-trend" />
  </GridLayout>
</Dashboard>
```

Each `<ChartContainer>` independently subscribes to filters and manages its own loading state.

---

## Query Compilation Engine

Located in `packages/query`:

### Pipeline

```
chart.yaml → resolve model → parse params → apply presets → render template → SQL
```

### Model Parsing

Extract metadata from SQL comments:

```typescript
{
  name: "monthly_revenue",
  params: [
    { name: "start_date", type: "date", default: "..." },
    { name: "end_date", type: "date", default: "..." }
  ],
  sql: "SELECT ..."
}
```

### Reference Resolution

```typescript
resolveRef("orders") → "orders"
resolveRef("monthly_revenue") → "(SELECT ... FROM orders) AS monthly_revenue"
```

### Template Rendering

Using Nunjucks (Jinja-compatible):

```typescript
const compiled = nunjucks.renderString(sql, {
  start_date: "2025-01-01",
  end_date: "2025-12-31",
  ref: (name) => resolveRef(name),
});
```

### Date Presets

```typescript
const datePresets = {
  last_30_days: () => ({ start: subDays(now, 30), end: now }),
  last_12_months: () => ({ start: subMonths(now, 12), end: now }),
  year_to_date: () => ({ start: startOfYear(now), end: now }),
};
```

---

## Cache Layer

### MVP Implementation

```typescript
interface CacheProvider {
  get(key: string): Promise<CachedResult | null>;
  set(key: string, value: CachedResult, ttl?: number): Promise<void>;
  invalidate(pattern: string): Promise<void>;
}

class MemoryCache implements CacheProvider {
  private store = new Map<string, { value: CachedResult; expires: number }>();
}
```

### Cache Key Generation

```typescript
const cacheKey = createCacheKey({
  chart: "revenue-trend",
  queryHash: hash(compiledSQL),
  params: { date_range: "last_30_days" },
});
// → "revenue-trend:a3f2c1:7b8e9d"
```

---

## Production Evolution

### Phase 1: MVP (Single Instance)

```
Web App → Server (in-memory cache) → DuckDB
```

### Phase 2: Scalable (Multi-Instance)

```
Web App → Load Balancer → Server (x3) → Redis (shared cache) → Data Sources
```

### Phase 3: Full Production

```
Web App → API Server → BullMQ (Redis) → Workers → Data Sources
                              ↓
                         Postgres (config, audit logs)
```

### Production Interfaces

```typescript
interface ConfigLoader {
  load(tenantId?: string): Promise<DashbookConfig>;
  watchChanges(callback: () => void): void;
}
// MVP: FileSystemConfigLoader
// Prod: GitConfigLoader, DatabaseConfigLoader

interface QueryExecutor {
  execute(sql: string, connection: string): Promise<QueryResult>;
}
// MVP: DirectQueryExecutor
// Prod: QueuedQueryExecutor

interface CacheProvider { ... }
// MVP: MemoryCache
// Prod: RedisCache, TieredCache

interface AuthProvider {
  validate(token: string): Promise<User | null>;
  getPermissions(user: User): Promise<Permissions>;
}
// MVP: NoAuthProvider
// Prod: OIDCAuthProvider
```

---

## Managed SaaS Architecture

For future multi-tenant cloud offering:

```
┌─────────────────────────────────────────────────────────┐
│                    Control Plane                         │
│   Auth/Billing │ Tenant Mgmt │ GitHub App (webhooks)    │
└─────────────────────────────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
   Tenant: Acme      Tenant: Globex    Tenant: Initech
   (Config, Workers, Cache)
         │                 │                 │
         ▼                 ▼                 ▼
    Customer DBs      Customer DBs     Customer DBs
```

### Key Additions

| Component | Purpose |
|-----------|---------|
| Tenant registry | Track orgs, users, repos |
| GitHub App | Receive webhooks, clone repos |
| Custom domains | `acme.dashbook.io` |
| Secrets vault | Customer DB credentials |
| Usage metering | Billing integration |

---

## CLI Commands

### MVP

```bash
dashbook init [directory]   # Scaffold new project
dashbook validate [path]    # Validate config
dashbook dev                # Start dev server with hot reload
```

### Dev Server Output

```
$ dashbook dev

  ┌─────────────────────────────────────────┐
  │   Dashbook Dev Server v0.1.0            │
  │                                         │
  │   Local:   http://localhost:3000        │
  │   API:     http://localhost:3001        │
  │                                         │
  │   Charts:  1 loaded                     │
  │   Models:  1 loaded                     │
  │   Connection: local-duckdb (healthy)    │
  └─────────────────────────────────────────┘
```

### Hot Reload Flow

```
File change → Validate → Update config → WebSocket notify →
React Query invalidates → Charts refetch
```

---

## Testing Strategy

### Test Pyramid

- **Unit (Vitest)**: Query compilation, schema validation, cache logic
- **Integration**: API routes with real DuckDB
- **E2E (Playwright)**: Full flow—load dashboard, change filter, verify chart

### Test Fixtures

```
examples/
├── dashbook.yaml
├── connections/test-duckdb.yaml
├── models/revenue.sql
├── charts/revenue-trend.yaml
└── test-data.duckdb
```

---

## Implementation Phases

### Phase 0: Project Setup
- Initialize monorepo (pnpm, Turborepo)
- Configure TypeScript, ESLint, Prettier
- Set up package structure
- Add Vitest, Playwright configs

### Phase 1: Schema & Validation
- Zod schemas for MVP configs
- Config loader
- CLI `dashbook validate`

### Phase 2: Query Engine
- Model parser
- Template renderer (Nunjucks)
- Ref resolution, date presets
- DuckDB connector

### Phase 3: API Server
- Fastify server
- Routes: config, charts, query
- In-memory cache

### Phase 4: Web App (MVP Complete)
- React + Vite setup
- React Query + Zustand
- Chart, FilterBar, ChartContainer components
- E2E tests

### Phase 5: Dev Experience
- CLI `dashbook dev`
- File watcher, hot reload
- `dashbook init`

### Phase 6: Docker & Docs
- Dockerfile
- Docker Compose
- README, example project

---

## Fast-Follow Phases

### Phase 7: Dashboard Layouts
- Dashboard schema, grid layout
- Multiple charts per page
- Global filters

### Phase 8: More Chart Types
- KPI/metric cards
- Bar charts
- Table with sorting/pagination

### Phase 9: Additional Connectors
- Postgres, Snowflake
- Connection pooling

---

## Summary

| Decision | Choice |
|----------|--------|
| Architecture | TypeScript monorepo |
| API Framework | Fastify |
| Frontend | React + Vite |
| Charts | ECharts |
| State | React Query + Zustand |
| Templating | Nunjucks |
| Validation | Zod |
| Database (MVP) | DuckDB |
| Cache (MVP) | In-memory with interface |
| Testing | Vitest + Playwright |
