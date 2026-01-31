-- @name: monthly_revenue
-- @description: Monthly revenue aggregated by date
-- @owner: analytics-team
-- @tags: [revenue, monthly, core]
--
-- @param start_date: date = dateadd(month, -12, current_date())
-- @param end_date: date = current_date()
--
-- @returns:
--   - period: date -- The month
--   - revenue: number -- Total revenue in USD
--   - order_count: integer -- Number of orders

SELECT
    date_trunc('month', order_date) AS period,
    SUM(amount) AS revenue,
    COUNT(*) AS order_count
FROM {{ ref('orders') }}
WHERE order_date BETWEEN '{{ start_date }}' AND '{{ end_date }}'
GROUP BY 1
ORDER BY 1
