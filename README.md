# Yamchart

Open-source, Git-native business intelligence dashboards defined entirely through code.

```yaml
# charts/revenue.yaml
name: revenue
title: Daily Revenue
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

## Why Yamchart?

- **Git-native** - Dashboards are code. Review in PRs, version in Git, deploy via CI/CD.
- **No vendor lock-in** - Your analytics live in your repo, not a SaaS database.
- **AI-friendly** - YAML schema designed for LLM generation and modification.
- **Self-hostable** - Deploy anywhere with Docker. Put it behind your firewall.

## Quick Start

```bash
# Create a new project with sample data
npx yamchart init my-analytics
cd my-analytics

# Start development server
npx yamchart dev

# Open http://localhost:3001
```

See the [Getting Started Guide](./docs/getting-started.md) for a full tutorial.

## Documentation

- [Getting Started](./docs/getting-started.md) - Full tutorial from zero to deployed dashboard
- [Chart Configuration](./docs/configuration/charts.md) - Chart types, parameters, and formatting

## Project Structure

```
my-analytics/
├── yamchart.yaml          # Project configuration
├── connections/           # Database connections
│   └── local.yaml
├── models/                # SQL with Jinja templating
│   └── daily_revenue.sql
└── charts/                # Chart definitions
    └── revenue.yaml
```

## Deployment

### Docker (Recommended)

```bash
docker run -p 8080:8080 \
  -v $(pwd):/app/project \
  ghcr.io/simon-spenc/yamchart:latest
```

### Fly.io

```bash
fly launch
fly deploy
```

See [deployment docs](./docs/getting-started.md#deploy-with-docker) for more options.

## Supported Databases

| Database | Status |
|----------|--------|
| DuckDB | Supported |
| PostgreSQL | Supported |
| BigQuery | Planned |
| Snowflake | Planned |

## Development

```bash
# Clone and install
git clone https://github.com/simon-spenc/yamchart.git
cd yamchart
pnpm install

# Start dev servers
pnpm dev

# Run tests
pnpm test
```

## Contributing

Contributions welcome! See [development setup](./docs/getting-started.md#development) for details.

## License

MIT
