-- @name: total_revenue
-- @description: Total revenue KPI with comparison to previous period
-- @owner: analytics-team
-- @tags: [kpi, revenue]
--
-- @param start_date: date = current_date() - interval '30 days'
-- @param end_date: date = current_date()
--
-- @returns:
--   - value: number -- Current period revenue
--   - previous_value: number -- Previous period revenue

WITH period_days AS (
    SELECT ('{{ end_date }}'::DATE - '{{ start_date }}'::DATE + 1)::INTEGER as days
),
current_period AS (
    SELECT COALESCE(SUM(amount), 0) as value
    FROM {{ ref('orders') }}
    WHERE order_date BETWEEN '{{ start_date }}' AND '{{ end_date }}'
),
previous_period AS (
    SELECT COALESCE(SUM(amount), 0) as previous_value
    FROM {{ ref('orders') }}, period_days
    WHERE order_date BETWEEN '{{ start_date }}'::DATE - period_days.days AND '{{ start_date }}'::DATE - 1
)
SELECT c.value, p.previous_value
FROM current_period c, previous_period p
