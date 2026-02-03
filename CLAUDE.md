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
│   ├── cli/        # CLI tool (yamchart validate, dev, init)
│   ├── server/     # Fastify API server
│   └── web/        # React + Vite dashboard viewer
├── packages/
│   ├── schema/     # Zod schemas, shared TypeScript types
│   ├── query/      # SQL compilation, Nunjucks templating
│   └── config/     # Shared tsconfig, eslint configs
└── examples/       # Sample yamchart project with DuckDB
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
- `dashboards/*.yaml` - layout compositions (post-MVP)

## Design Documents

- `docs/plans/2026-01-31-mvp-architecture-design.md` - Full MVP architecture design
- `Yamchart Technical Spec.md` - Complete product specification
