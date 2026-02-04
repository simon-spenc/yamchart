# Interactive Filters & Dashboard Navigation - Design

**Date:** 2026-02-03
**Status:** Implemented (Date Picker, Dynamic Filters)

---

## Overview

Three interconnected features to make Yamchart dashboards more interactive:

1. **Date picker with custom ranges** - Calendar UI for picking exact dates
2. **Dynamic filter options** - Options populated from database queries
3. **Dashboard navigation** - Sidebar to switch between dashboards

---

## 1. Date Picker with Custom Range

### Current State

DateRangeFilter shows a dropdown of presets (last_7_days, last_30_days, etc.).

### Design

Add a "Custom" option that opens a date picker popover:

```
┌─────────────────────────────────────┐
│ Date Range: [Last 30 days    ▼]    │
└─────────────────────────────────────┘

When "Custom" selected:
┌─────────────────────────────────────┐
│ Date Range: [Custom          ▼]    │
│ ┌─────────────────────────────────┐│
│ │ Start: [2024-01-01] 📅          ││
│ │ End:   [2024-01-31] 📅          ││
│ │              [Apply] [Cancel]   ││
│ └─────────────────────────────────┘│
└─────────────────────────────────────┘
```

### Implementation

1. Add "Custom" to DATE_PRESETS
2. When "Custom" selected, show popover with two date inputs
3. Store custom range as `{ type: 'custom', start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' }`
4. Update filter store to handle both preset strings and custom objects
5. Update query engine to resolve custom ranges

### Schema Changes

```typescript
// Filter value can be preset string or custom range
type DateRangeValue =
  | string  // preset like 'last_30_days'
  | { type: 'custom'; start: string; end: string };
```

---

## 2. Dynamic Filter Options

### Current State

SelectFilter options are hardcoded in chart YAML:

```yaml
parameters:
  - name: category
    type: select
    options:
      - Electronics
      - Clothing
      - Food
```

### Design

New parameter type `dynamic_select` that fetches options from a model:

```yaml
parameters:
  - name: category
    type: dynamic_select
    source:
      model: category_options  # SQL model that returns options
      value_field: category_id
      label_field: category_name
    default: all
```

The model returns rows used as options:

```sql
-- models/category_options.sql
-- @name: category_options

SELECT DISTINCT
  category_id,
  category_name
FROM products
ORDER BY category_name
```

### Implementation

1. Add `dynamic_select` parameter type to schema
2. Create API endpoint: `GET /api/parameters/:name/options`
3. Create `useDynamicOptions` hook to fetch options
4. Create `DynamicSelectFilter` component
5. Cache options (they don't change frequently)

### API

```
GET /api/charts/:chartName/parameters/:paramName/options
Response: {
  options: [
    { value: "1", label: "Electronics" },
    { value: "2", label: "Clothing" }
  ]
}
```

---

## 3. Dashboard Navigation

### Current State

App auto-loads first dashboard. No way to switch.

### Design

Add a sidebar with dashboard list:

```
┌──────────────────────────────────────────────────────┐
│ ┌─────────┐                                          │
│ │         │  Executive Overview           [Edit]     │
│ │ Sales   │  ─────────────────────────────────────   │
│ │ ───────>│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐       │
│ │ Ops     │  │ KPI │ │ KPI │ │ KPI │ │ KPI │       │
│ │         │  └─────┘ └─────┘ └─────┘ └─────┘       │
│ │ Finance │  ┌─────────────────────┐ ┌───────────┐  │
│ │         │  │                     │ │           │  │
│ │ ─────── │  │   Revenue Chart     │ │  Notes    │  │
│ │ Charts  │  │                     │ │           │  │
│ │         │  └─────────────────────┘ └───────────┘  │
│ └─────────┘                                          │
└──────────────────────────────────────────────────────┘
```

Features:
- Collapsible sidebar
- Dashboard list with active indicator
- "Charts" section shows individual charts (fallback when no dashboards)
- Persist sidebar collapsed state in localStorage

### Implementation

1. Create `Sidebar` component with dashboard/chart list
2. Create `AppLayout` component that wraps content with sidebar
3. Add routing (hash-based): `#/dashboards/executive`, `#/charts/revenue`
4. Store selected view in URL + Zustand

---

## Component Structure

```
src/components/
├── layout/
│   ├── AppLayout.tsx       # Main layout with sidebar
│   ├── Sidebar.tsx         # Navigation sidebar
│   └── SidebarItem.tsx     # Individual nav item
├── filters/
│   ├── DateRangeFilter.tsx # Updated with custom picker
│   ├── DatePicker.tsx      # Calendar popover (new)
│   ├── SelectFilter.tsx    # Static options
│   └── DynamicSelectFilter.tsx  # Dynamic options (new)
└── dashboard/
    └── ... (existing)
```

---

## Dependencies

| Package | Purpose | Size |
|---------|---------|------|
| `react-day-picker` | Date picker calendar | ~15kb |

No new dependencies for dynamic filters or navigation.

---

## Implementation Order

1. **Dashboard navigation** - Foundational, enables testing other features
2. **Date picker** - Self-contained enhancement
3. **Dynamic filters** - Requires backend + frontend changes

---

## Files to Create/Modify

### New Files
- `apps/web/src/components/layout/AppLayout.tsx`
- `apps/web/src/components/layout/Sidebar.tsx`
- `apps/web/src/components/filters/DatePicker.tsx`
- `apps/web/src/components/filters/DynamicSelectFilter.tsx`
- `apps/server/src/routes/parameters.ts`

### Modified Files
- `apps/web/src/App.tsx` - Use AppLayout, add routing
- `apps/web/src/components/filters/DateRangeFilter.tsx` - Add custom option
- `apps/web/src/stores/filterStore.ts` - Handle custom date ranges
- `packages/schema/src/chart.ts` - Add dynamic_select type
- `packages/query/src/presets.ts` - Handle custom date ranges
