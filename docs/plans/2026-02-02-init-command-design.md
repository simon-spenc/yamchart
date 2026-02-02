# Dashbook Init Command Design

**Date:** 2026-02-02
**Status:** Approved

---

## Overview

The `dashbook init` command scaffolds new Dashbook projects with sensible defaults. It provides three modes to suit different user needs: a minimal working starter (default), a full example project, or an empty skeleton.

### Target Workflow

1. Analyst runs `dashbook init my-project`
2. Project created with inline sample data - works immediately
3. `cd my-project && dashbook dev` - preview dashboard
4. Replace sample files with real connections/models/charts

---

## Command Interface

```
dashbook init [directory] [options]

Arguments:
  directory          Target directory (default: current directory)

Options:
  --example          Create full example project with sample database
  --empty            Create only dashbook.yaml (no connections, models, or charts)
  --force            Overwrite existing files
```

**Behavior:**
- If `directory` doesn't exist, create it
- If `dashbook.yaml` already exists, exit with error (unless `--force`)
- Project name defaults to directory name
- No prompts - everything determined by flags

**Exit codes:**
- `0` - Success
- `1` - Directory already contains dashbook.yaml
- `2` - Write error

---

## Default Mode

Creates 4 files with inline sample data (zero external dependencies):

**dashbook.yaml**
```yaml
name: <directory-name>
version: "1.0"
default_connection: local

defaults:
  cache_ttl: 5m
```

**connections/local.yaml**
```yaml
name: local
type: duckdb
config:
  path: ":memory:"
```

**models/sample_orders.sql**
```sql
-- name: sample_orders
-- description: Sample orders data for demo

SELECT * FROM (
  VALUES
    ('2024-01-01'::date, 'Electronics', 1200),
    ('2024-01-02'::date, 'Electronics', 850),
    ('2024-01-03'::date, 'Clothing', 430),
    ('2024-01-04'::date, 'Electronics', 1100),
    ('2024-01-05'::date, 'Clothing', 520)
) AS t(order_date, category, revenue)
```

**charts/revenue-by-day.yaml**
```yaml
name: revenue-by-day
title: Daily Revenue
model: sample_orders
type: line
config:
  x: order_date
  y: revenue
```

---

## --example Mode

Copies full example project structure:

```
<directory>/
├── dashbook.yaml
├── connections/
│   └── local-duckdb.yaml
├── models/
│   ├── monthly_revenue.sql
│   ├── orders_by_category.sql
│   └── customer_metrics.sql
├── charts/
│   ├── revenue-trend.yaml
│   ├── orders-by-category.yaml
│   └── customer-kpis.yaml
└── sample-data.duckdb
```

Sample DuckDB file bundled with CLI package.

---

## --empty Mode

Creates only:

```
<directory>/
└── dashbook.yaml
```

With placeholder content:
```yaml
name: <directory-name>
version: "1.0"
# default_connection: <connection-name>

defaults:
  cache_ttl: 5m
```

---

## Implementation

**New files in `apps/cli/`:**
```
src/
├── commands/
│   └── init.ts
├── templates/
│   ├── default/
│   │   ├── dashbook.yaml.tpl
│   │   ├── connections/local.yaml
│   │   ├── models/sample_orders.sql
│   │   └── charts/revenue-by-day.yaml
│   └── empty/
│       └── dashbook.yaml.tpl
```

**For --example mode:**
- Bundle `examples/` folder contents at build time via tsup
- Copy files to target directory, update project name in dashbook.yaml

**Template approach:**
- `.tpl` files use simple `{{name}}` placeholder (not Nunjucks)
- Non-template files copied as-is

**Output:**
```
$ dashbook init my-project

Created my-project/
  ├── dashbook.yaml
  ├── connections/local.yaml
  ├── models/sample_orders.sql
  └── charts/revenue-by-day.yaml

Run `cd my-project && dashbook dev` to start.
```

---

## Error Handling

**Directory exists with dashbook.yaml:**
```
$ dashbook init existing-project

Error: existing-project/dashbook.yaml already exists
Use --force to overwrite
```

**Directory exists without dashbook.yaml:**
- Proceeds normally, creates files alongside existing content

**No write permission:**
```
$ dashbook init /root/project

Error: Cannot write to /root/project
Check directory permissions
```

**--example with missing bundled assets:**
```
$ dashbook init --example my-project

Error: Example assets not found
Reinstall dashbook or use default mode
```
