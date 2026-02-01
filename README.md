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

## Deployment

### Docker

```bash
# Build image
docker build -t dashbook:latest .

# Run locally
docker run -p 8080:8080 dashbook:latest

# Open http://localhost:8080
```

### Docker Compose

```bash
# Production-like
docker-compose up

# Development with hot reload
docker-compose -f docker-compose.dev.yml up
```

### Fly.io

1. Install the [Fly CLI](https://fly.io/docs/hands-on/install-flyctl/)

2. Login to Fly.io:
   ```bash
   fly auth login
   ```

3. Deploy:
   ```bash
   ./scripts/deploy.sh
   ```

   Or manually:
   ```bash
   fly apps create dashbook
   fly volumes create dashbook_data --region sjc --size 1
   fly deploy
   ```

4. Open your app:
   ```bash
   fly open
   ```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `8080` |
| `HOST` | Bind address | `0.0.0.0` |
| `NODE_ENV` | Environment | `development` |
| `DASHBOOK_PROJECT_DIR` | Path to dashbook project | `.` |
| `LOG_LEVEL` | Log level (debug, info, warn, error) | `info` |
| `DUCKDB_PATH` | Path to DuckDB database | `./sample-data.duckdb` |

## Development

```bash
# Install dependencies
pnpm install

# Start dev servers (API + Web)
pnpm dev

# Run tests
pnpm test

# Build for production
pnpm build
```

## Documentation

- [Technical Specification](./Dashbook%20Technical%20Spec.md)
- [MVP Architecture Design](./docs/plans/2026-01-31-mvp-architecture-design.md)

## Status

🚧 **Early Development** - Building the MVP. Contributions welcome!

## License

MIT
