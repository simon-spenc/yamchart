# Yamchart

Open-source, Git-native business intelligence dashboards defined entirely through code.

```yaml
# charts/revenue.yaml
name: revenue
title: Daily Revenue
source:
  model: daily_revenue
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
- **dbt integration** - Sync your dbt project metadata for AI-assisted chart creation.
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

## dbt Integration

If you have an existing dbt project, sync your model metadata to help AI tools write better SQL:

```bash
# Sync dbt metadata from your project
npx yamchart sync-dbt --path ../my-dbt-project

# Filter to specific models
npx yamchart sync-dbt --path ../my-dbt-project --include "**/marts/**"

# Re-sync with saved configuration
npx yamchart sync-dbt --refresh
```

This creates `.yamchart/catalog.md` - a human and AI-readable catalog of your dbt models, columns, and relationships. When using Claude Code, Cursor, or other AI tools, they'll understand your data schema.

See [dbt Sync Configuration](./docs/configuration/dbt-sync.md) for details.

## Documentation

- [Getting Started](./docs/getting-started.md) - Full tutorial from zero to deployed dashboard
- [Chart Configuration](./docs/configuration/charts.md) - Chart types, parameters, and formatting
- [dbt Sync](./docs/configuration/dbt-sync.md) - Sync dbt project metadata for AI assistance

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

## Supported Chart Types

| Type | Description |
|------|-------------|
| `line` | Time series and trends |
| `bar` | Categorical comparisons |
| `area` | Filled line charts |
| `pie` | Part-to-whole |
| `donut` | Pie with center value/label |
| `scatter` | Correlations |
| `table` | Tabular data |
| `kpi` | Single metric with comparison |

### Donut Chart Example

```yaml
chart:
  type: donut
  x:
    field: category
    type: nominal
  y:
    field: value
    format: "$,.0f"
  centerValue:
    field: total      # 'total' sums all values
    label: Total Sales
    format: "$"
```

## Supported Databases

| Database | Status |
|----------|--------|
| DuckDB | Supported |
| PostgreSQL | Supported |
| Snowflake | Supported |
| MySQL | Supported |
| SQLite | Supported |
| BigQuery | Planned |

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
