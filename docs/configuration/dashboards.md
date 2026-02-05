# Dashboard Configuration Reference

Dashboards combine charts and text widgets into unified views.

## Basic Structure

```yaml
name: my-dashboard          # Unique identifier (required)
title: My Dashboard         # Display title (required)
description: Description    # Optional description

filters:                    # Global filter parameters
  - date_range

layout:
  gap: 16                   # Gap between widgets in pixels
  rows:
    - height: 200           # Row height in pixels
      widgets: []           # Widgets in this row
```

## Layout System

Dashboards use a 12-column grid. Each row has a fixed height and contains widgets that span columns.

```yaml
layout:
  gap: 16
  rows:
    - height: 200
      widgets:
        - type: chart
          ref: kpi-1
          cols: 3           # Spans 3 of 12 columns (25%)
        - type: chart
          ref: kpi-2
          cols: 3
        - type: chart
          ref: kpi-3
          cols: 3
        - type: chart
          ref: kpi-4
          cols: 3
    - height: 400
      widgets:
        - type: chart
          ref: main-chart
          cols: 8           # 66% width
        - type: text
          cols: 4           # 33% width
          content: |
            ## Notes
            Some text here
```

## Widget Types

### Chart Widget

Embeds an existing chart:

```yaml
- type: chart
  ref: revenue-trend      # Chart name from charts/ folder
  cols: 6
```

### Text Widget

Markdown content with optional KPI references:

```yaml
- type: text
  cols: 4
  content: |
    ## Summary

    Revenue this period: **{{revenue-kpi}}**

    Compared to last period: {{revenue-kpi@previous_month}}
```

## KPI References

Embed live values from KPI charts in text widgets:

| Syntax | Description |
|--------|-------------|
| `{{chart}}` | Default value from chart |
| `{{chart.field}}` | Specific field from chart data |
| `{{chart@preset}}` | Value with date preset override |
| `{{chart@2025-01-01..2025-12-31}}` | Value for custom date range |

### Date Presets

Available presets for KPI references:
- `last_7_days`, `last_30_days`, `last_90_days`
- `last_12_months`
- `year_to_date`, `month_to_date`, `quarter_to_date`
- `previous_month`, `previous_quarter`, `previous_year`

### Examples

```markdown
Current revenue: **{{revenue-kpi}}**

Last month: {{revenue-kpi@previous_month}}

YTD: {{revenue-kpi@year_to_date}}

Q1 2025: {{revenue-kpi@2025-01-01..2025-03-31}}
```

## Global Filters

Dashboard-level filters apply to all charts:

```yaml
filters:
  - date_range            # Adds date range picker
  - region                # Adds region selector (if charts have this param)
```

Charts inherit these filters unless overridden. Users can click the filter icon on individual charts to set chart-specific overrides.

## Full Example

```yaml
name: executive-overview
title: Executive Overview
description: Key business metrics for leadership

filters:
  - date_range

layout:
  gap: 16
  rows:
    # KPI row
    - height: 180
      widgets:
        - type: chart
          ref: revenue-kpi
          cols: 3
        - type: chart
          ref: orders-kpi
          cols: 3
        - type: chart
          ref: customers-kpi
          cols: 3
        - type: chart
          ref: avg-order-kpi
          cols: 3

    # Main chart row
    - height: 400
      widgets:
        - type: chart
          ref: revenue-trend
          cols: 8
        - type: text
          cols: 4
          content: |
            ## This Period

            - Revenue: **{{revenue-kpi}}**
            - Orders: **{{orders-kpi}}**
            - Customers: **{{customers-kpi}}**

            ## vs Last Period

            Revenue grew from {{revenue-kpi@previous_month}}
            to {{revenue-kpi}}.

    # Breakdown row
    - height: 350
      widgets:
        - type: chart
          ref: revenue-by-region
          cols: 6
        - type: chart
          ref: top-products
          cols: 6
```

## Edit Mode

In the web UI, click "Edit" to enter edit mode where you can:
- Drag widgets to reorder
- Resize widgets by dragging edges
- Add new widgets
- Edit text widget content
- Save or discard changes

Changes are saved back to the YAML file.
