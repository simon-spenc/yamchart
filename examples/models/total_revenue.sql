-- @name: total_revenue
-- @description: Total revenue KPI with comparison to previous period
-- @owner: analytics-team
-- @tags: [kpi, revenue]
--
-- @returns:
--   - value: number -- Current period revenue
--   - previous_value: number -- Previous period revenue

WITH current_period AS (
    SELECT SUM(amount) as value
    FROM orders
    WHERE order_date >= date_trunc('month', current_date())
),
previous_period AS (
    SELECT SUM(amount) as previous_value
    FROM orders
    WHERE order_date >= date_trunc('month', current_date() - interval '1 month')
      AND order_date < date_trunc('month', current_date())
)
SELECT
    COALESCE(c.value, 0) as value,
    COALESCE(p.previous_value, 0) as previous_value
FROM current_period c, previous_period p
