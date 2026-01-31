# Dashbook

Open-source, Git-native business intelligence dashboards defined entirely through code.

```yaml
# charts/revenue-trend.yaml
name: revenue-trend
title: Monthly Revenue
source:
  model: monthly_revenue
parameters:
  - name: date_range
    type: date_range
    default: last_12_months
chart:
  type: line
  x:
    field: period
    type: temporal
  y:
    field: revenue
    format: "$,.0f"
```

## Why Dashbook?

- **Git-native:** Dashboards are code. Review in PRs, version in Git, deploy via CI/CD.
- **No vendor lock-in:** Your analytics live in your repo, not a SaaS database.
- **AI-friendly:** YAML schema designed for LLM generation and modification.
- **Flexible:** Connect to Snowflake, BigQuery, Postgres, DuckDB, and more.

## Quick Start

```bash
# Install
npm install -g dashbook

# Create a new project
dashbook init my-analytics
cd my-analytics

# Start development server
dashbook dev
```

## Project Structure

```
my-analytics/
├── dashbook.yaml          # Project configuration
├── connections/           # Data source definitions
│   └── local-duckdb.yaml
├── models/                # SQL models with parameters
│   └── revenue.sql
├── charts/                # Chart definitions
│   └── revenue-trend.yaml
└── dashboards/            # Dashboard layouts
    └── executive.yaml
```

## Documentation

- [Technical Specification](./Dashbook%20Technical%20Spec.md)
- [MVP Architecture Design](./docs/plans/2026-01-31-mvp-architecture-design.md)

## Status

🚧 **Early Development** - Building the MVP. Contributions welcome!

## License

MIT
