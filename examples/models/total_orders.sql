-- @name: total_orders
-- @description: Total orders KPI with comparison to previous period
-- @owner: analytics-team
-- @tags: [kpi, orders]
--
-- @returns:
--   - value: number -- Current period order count
--   - previous_value: number -- Previous period order count

WITH current_period AS (
    SELECT COUNT(*) as value
    FROM orders
    WHERE order_date >= date_trunc('month', current_date())
),
previous_period AS (
    SELECT COUNT(*) as previous_value
    FROM orders
    WHERE order_date >= date_trunc('month', current_date() - interval '1 month')
      AND order_date < date_trunc('month', current_date())
)
SELECT
    COALESCE(c.value, 0) as value,
    COALESCE(p.previous_value, 0) as previous_value
FROM current_period c, previous_period p
