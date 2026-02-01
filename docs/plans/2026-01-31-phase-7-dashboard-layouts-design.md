# Dashboard Layouts - Design Document

**Date:** 2026-01-31
**Status:** Approved
**Phase:** 7 (Fast-Follow)

---

## Overview

Dashboard Layouts extends the MVP single-chart view to support multi-widget dashboards with KPI cards, charts, and text blocks arranged in a responsive grid. Users can edit layouts visually in the browser and push changes directly to Git.

### Goals

- Define dashboard layouts in YAML (Git-native)
- 12-column responsive grid system
- Drag-and-drop editing with edit mode toggle
- Save & Push commits changes to Git
- Branch-aware previews for staging changes

---

## Dashboard Schema

Dashboards live in `dashboards/*.yaml`:

```yaml
# dashboards/executive.yaml
name: Executive Overview
description: Key business metrics at a glance
filters:
  - date_range  # inherited by all widgets

layout:
  gap: 16  # pixels between widgets
  rows:
    - height: 120
      widgets:
        - type: chart
          ref: revenue-kpi
          cols: 3
        - type: chart
          ref: users-kpi
          cols: 3
        - type: chart
          ref: orders-kpi
          cols: 3
        - type: chart
          ref: conversion-kpi
          cols: 3
    - height: 400
      widgets:
        - type: chart
          ref: revenue-trend
          cols: 8
        - type: text
          content: |
            ## Notes
            Revenue tracking **excludes** refunds.
          cols: 4
```

### Schema Rules

- `cols` specifies width (1-12), widgets in a row must sum to 12
- `height` is row height in pixels (auto-adjusts on mobile)
- `type: chart` references existing chart YAML files by `ref`
- `type: text` renders inline Markdown
- Dashboard-level `filters` apply to all charts unless overridden

---

## KPI Chart Type

KPIs use the existing chart infrastructure with `type: kpi`:

```yaml
# charts/revenue-kpi.yaml
name: Total Revenue
type: kpi
model: total_revenue
parameters:
  - name: date_range
    type: date_range
    default: this_month

format:
  type: currency
  currency: USD

comparison:
  enabled: true
  label: vs last period
  type: percent_change  # or 'absolute'
```

### KPI Model Structure

Models return a single row with `value` and optional `previous_value`:

```sql
-- models/total_revenue.sql
-- @name total_revenue
-- @param date_range date_range
-- @returns value, previous_value

SELECT
  SUM(CASE WHEN date >= {{ date_range.start }} THEN amount END) as value,
  SUM(CASE WHEN date < {{ date_range.start }} THEN amount END) as previous_value
FROM orders
WHERE date >= {{ date_range.comparison_start }}
  AND date < {{ date_range.end }}
```

### KPI Rendering

- Large primary value (formatted per `format` spec)
- Smaller comparison badge: "+12.5%" in green or "-3.2%" in red
- Subtitle with comparison label

---

## Edit Mode & Drag-and-Drop

### View Mode (Default)

```
┌─────────────────────────────────────────────────────────┐
│  Executive Overview              [Edit Layout] [Export] │
├─────────────────────────────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │
│  │ $1.2M   │ │ 45.2K   │ │ 8,432   │ │ 3.2%    │       │
│  │ Revenue │ │ Users   │ │ Orders  │ │ Convert │       │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘       │
│  ┌─────────────────────────────────────┐ ┌───────────┐ │
│  │                                     │ │  Notes    │ │
│  │         Revenue Trend Chart         │ │  ------   │ │
│  │                                     │ │  Markdown │ │
│  └─────────────────────────────────────┘ └───────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Edit Mode

- Toggle via "Edit Layout" button
- Widgets show drag handles and resize grips
- Grid overlay appears showing 12 columns
- Drag widgets to reorder within/across rows
- Resize by dragging column boundaries (snaps to grid)
- "Save & Push" commits to Git, "Cancel" reverts changes

### Library

Use `react-grid-layout`:
- Battle-tested drag/drop/resize
- Grid snapping built-in
- Responsive breakpoints support

---

## Branch-Aware Persistence

### Git-Native Save Flow

```
┌─────────────────────────────────────────────────────────┐
│  Executive Overview    [branch: feature/new-kpis ▼]     │
│                        [Save & Push] [Discard Changes]  │
└─────────────────────────────────────────────────────────┘
```

1. **Save & Push clicked** - UI sends layout JSON to server
2. Server writes `dashboards/executive.yaml` with updated layout
3. Server runs: `git add . && git commit -m "Update executive dashboard" && git push`
4. UI shows success toast with commit SHA

### Branch Selector

- Dropdown shows available branches from remote
- Switching branches reloads dashboard from that branch's YAML
- New branch can be created from UI: "Create branch from main"
- Server runs: `git checkout -b feature/new-layout && git push -u origin feature/new-layout`

### Branch Workflow

- Main branch = production dashboards
- Feature branches = preview/staging
- Standard Git merge workflow to promote changes
- Preview URLs include branch: `/dashboards/executive?branch=feature/new-kpis`

### Local Dev vs SaaS

| Aspect | Local Dev | Managed SaaS |
|--------|-----------|--------------|
| Git repo | Local filesystem | Cloned per-tenant |
| Branch switch | `git checkout` | Worktrees or sparse checkout |
| Push target | User's remote | User's GitHub |
| Auth | User's git config | GitHub App / OAuth |

---

## Frontend Components

### Component Structure

```
src/components/
├── dashboard/
│   ├── Dashboard.tsx         # Main container, loads layout
│   ├── DashboardGrid.tsx     # react-grid-layout wrapper
│   ├── DashboardToolbar.tsx  # Branch selector, edit/save buttons
│   ├── EditModeContext.tsx   # Edit state provider
│   └── widgets/
│       ├── WidgetWrapper.tsx # Drag handle, resize grips
│       ├── ChartWidget.tsx   # Renders chart by ref
│       ├── KpiWidget.tsx     # KPI card display
│       └── TextWidget.tsx    # Markdown renderer
```

### Data Flow

```
Dashboard.tsx
  │
  ├─ useQuery('/api/dashboards/:id?branch=xxx')
  │    → returns layout + widget configs
  │
  ├─ DashboardToolbar
  │    ├─ useBranches() → branch list
  │    └─ useSaveDashboard() → POST layout, triggers git push
  │
  └─ DashboardGrid (react-grid-layout)
       │
       └─ WidgetWrapper (per widget)
            │
            ├─ ChartWidget → useChartData(ref, filters)
            ├─ KpiWidget → useChartData(ref, filters) + formatting
            └─ TextWidget → ReactMarkdown
```

### Key Points

- Each widget fetches its own data via React Query (independent updates)
- Edit mode context controls whether drag/resize is enabled
- Layout changes tracked in local state until Save & Push

---

## API Endpoints

### Dashboard Routes

```typescript
// apps/server/src/routes/dashboards.ts

// Get dashboard layout and config
GET /api/dashboards/:id
  Query: ?branch=feature/new-kpis (optional, defaults to current)
  Response: {
    id: "executive",
    name: "Executive Overview",
    branch: "feature/new-kpis",
    layout: { gap: 16, rows: [...] },
    filters: ["date_range"]
  }

// List all dashboards
GET /api/dashboards
  Query: ?branch=main
  Response: [{ id, name, description }]

// Save and push dashboard layout
POST /api/dashboards/:id
  Body: { layout: {...}, message?: "Updated KPI positions" }
  Response: { success: true, commit: "abc123", branch: "feature/new-kpis" }
```

### Git Routes

```typescript
// apps/server/src/routes/git.ts

GET  /api/git/branches        → ["main", "feature/new-kpis", ...]
POST /api/git/branches        → { name: "feature/new-layout", from: "main" }
POST /api/git/checkout        → { branch: "feature/new-kpis" }
```

### Git Service Layer

- Wraps `simple-git` library for Node.js git operations
- Handles commit, push, branch, checkout
- Returns structured errors (conflict, auth failure, etc.)

---

## Error Handling

| Error | User Sees | Recovery |
|-------|-----------|----------|
| Push conflict | "Changes conflict with remote. Pull latest?" | Button to pull & retry |
| Auth failure | "GitHub authentication expired" | Re-auth flow |
| Branch not found | "Branch was deleted" | Switch to main |
| Uncommitted changes | "Discard local changes to switch branch?" | Confirm dialog |

---

## Responsive Breakpoints

Using `react-grid-layout` responsive mode:

```typescript
breakpoints: { lg: 1200, md: 996, sm: 768, xs: 480 }
cols: { lg: 12, md: 8, sm: 4, xs: 2 }
```

| Breakpoint | Columns | Behavior |
|------------|---------|----------|
| Desktop (lg) | 12 | Full grid as designed |
| Tablet (md) | 8 | Widgets reflow |
| Mobile (sm/xs) | 2-4 | Stack, KPIs become 2-up |

### Widget Min Sizes

- KPI card: 2 columns min
- Chart: 4 columns min
- Text: 2 columns min

Widgets below min-width at current breakpoint auto-expand to min.

---

## New Files

| Location | Purpose |
|----------|---------|
| `packages/schema/src/dashboard.ts` | Zod schema for dashboard YAML |
| `apps/server/src/routes/dashboards.ts` | Dashboard CRUD + layout save |
| `apps/server/src/routes/git.ts` | Branch operations |
| `apps/server/src/services/git.ts` | Git wrapper (simple-git) |
| `apps/web/src/components/dashboard/*` | Grid, widgets, toolbar |

---

## Future Enhancements

Not included in this phase:

- **Tabs within dashboards** - Multiple pages per dashboard file
- **Embed widgets** - iframes for external content
- **Real-time updates** - WebSocket/SSE for live refresh

---

## Dependencies

| Package | Purpose |
|---------|---------|
| `react-grid-layout` | Drag-and-drop grid |
| `react-markdown` | Text widget rendering |
| `simple-git` | Node.js Git operations |
