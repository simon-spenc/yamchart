-- @name: revenue_by_period
-- @description: Revenue aggregated by configurable time period
-- @owner: analytics-team
-- @tags: [revenue, trend, core]
--
-- @param start_date: date = dateadd(month, -12, current_date())
-- @param end_date: date = current_date()
-- @param granularity: string = 'month'
--
-- @returns:
--   - period: date -- The time period
--   - revenue: number -- Total revenue in USD
--   - order_count: integer -- Number of orders

SELECT
    date_trunc('{{ granularity }}', order_date) AS period,
    SUM(amount) AS revenue,
    COUNT(*) AS order_count
FROM {{ ref('orders') }}
WHERE order_date BETWEEN '{{ start_date }}' AND '{{ end_date }}'
GROUP BY 1
ORDER BY 1
