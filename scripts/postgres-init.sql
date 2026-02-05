-- Yamchart Test Data for PostgreSQL
-- This script creates the same schema and sample data as the DuckDB sample-data.duckdb

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    order_date DATE NOT NULL,
    customer_id INTEGER NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'completed'
);

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create products table
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    category VARCHAR(100)
);

-- Seed customers
INSERT INTO customers (id, name, email) VALUES
    (1, 'Alice Johnson', 'alice@example.com'),
    (2, 'Bob Smith', 'bob@example.com'),
    (3, 'Carol Williams', 'carol@example.com'),
    (4, 'David Brown', 'david@example.com'),
    (5, 'Emma Davis', 'emma@example.com'),
    (6, 'Frank Miller', 'frank@example.com'),
    (7, 'Grace Wilson', 'grace@example.com'),
    (8, 'Henry Taylor', 'henry@example.com'),
    (9, 'Ivy Anderson', 'ivy@example.com'),
    (10, 'Jack Thomas', 'jack@example.com');

-- Seed products
INSERT INTO products (id, name, price, category) VALUES
    (1, 'Widget Pro', 29.99, 'widgets'),
    (2, 'Widget Basic', 9.99, 'widgets'),
    (3, 'Gadget Plus', 49.99, 'gadgets'),
    (4, 'Gadget Mini', 19.99, 'gadgets'),
    (5, 'Service Plan', 99.99, 'services');

-- Generate orders for the past 24 months
-- This creates realistic time-series data for dashboard testing
DO $$
DECLARE
    month_offset INTEGER;
    day_offset INTEGER;
    orders_per_month INTEGER;
    order_amount DECIMAL(10, 2);
    customer INTEGER;
    order_day DATE;
BEGIN
    FOR month_offset IN 0..23 LOOP
        -- Increasing order volume over time (growth trend)
        orders_per_month := 50 + month_offset * 5 + (random() * 20)::int;

        FOR i IN 1..orders_per_month LOOP
            day_offset := (random() * 27)::int + 1;
            order_day := (CURRENT_DATE - (month_offset || ' months')::interval - (day_offset || ' days')::interval)::date;
            customer := (random() * 9)::int + 1;
            order_amount := (random() * 200 + 10)::decimal(10, 2);

            INSERT INTO orders (order_date, customer_id, amount, status)
            VALUES (order_day, customer, order_amount, 'completed');
        END LOOP;
    END LOOP;
END $$;

-- Add some recent orders in the current month for testing current period comparisons
INSERT INTO orders (order_date, customer_id, amount, status)
SELECT
    CURRENT_DATE - (random() * 10)::int,
    (random() * 9)::int + 1,
    (random() * 200 + 10)::decimal(10, 2),
    'completed'
FROM generate_series(1, 30);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(order_date);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
