-- @name: sample_orders
-- @description: Sample orders data for demo

SELECT * FROM (
  VALUES
    ('2024-01-01'::date, 'Electronics', 1200),
    ('2024-01-02'::date, 'Electronics', 850),
    ('2024-01-03'::date, 'Clothing', 430),
    ('2024-01-04'::date, 'Electronics', 1100),
    ('2024-01-05'::date, 'Clothing', 520)
) AS t(order_date, category, revenue)
