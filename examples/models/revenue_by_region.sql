-- @name: revenue_by_region
-- @description: Revenue breakdown by customer region
-- @owner: analytics-team
-- @tags: [revenue, region, breakdown]
--
-- @param start_date: date = dateadd(month, -12, current_date())
-- @param end_date: date = current_date()
--
-- @returns:
--   - region: string -- Customer region
--   - revenue: number -- Total revenue

SELECT
    c.region,
    SUM(o.amount) AS revenue
FROM {{ ref('orders') }} o
JOIN {{ ref('customers') }} c ON o.customer_id = c.id
WHERE o.order_date BETWEEN '{{ start_date }}' AND '{{ end_date }}'
GROUP BY c.region
ORDER BY revenue DESC
