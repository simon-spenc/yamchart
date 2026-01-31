import duckdb from 'duckdb';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, '..', 'sample-data.duckdb');

console.log(`Creating sample database at: ${dbPath}`);

const db = new duckdb.Database(dbPath);
const conn = db.connect();

// Create tables
conn.run(`
  CREATE OR REPLACE TABLE customers (
    id INTEGER PRIMARY KEY,
    name VARCHAR,
    email VARCHAR,
    region VARCHAR,
    created_at DATE
  )
`);

conn.run(`
  CREATE OR REPLACE TABLE orders (
    id INTEGER PRIMARY KEY,
    customer_id INTEGER,
    amount DECIMAL(10,2),
    status VARCHAR,
    order_date DATE
  )
`);

conn.run(`
  CREATE OR REPLACE TABLE products (
    id INTEGER PRIMARY KEY,
    name VARCHAR,
    category VARCHAR,
    price DECIMAL(10,2)
  )
`);

// Seed customers
const regions = ['North America', 'Europe', 'Asia Pacific', 'Latin America'];
for (let i = 1; i <= 100; i++) {
  const region = regions[Math.floor(Math.random() * regions.length)];
  const createdAt = new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1);
  conn.run(`
    INSERT INTO customers VALUES (
      ${i},
      'Customer ${i}',
      'customer${i}@example.com',
      '${region}',
      '${createdAt.toISOString().split('T')[0]}'
    )
  `);
}

// Seed products
const categories = ['Electronics', 'Clothing', 'Home & Garden', 'Sports', 'Books'];
for (let i = 1; i <= 50; i++) {
  const category = categories[Math.floor(Math.random() * categories.length)];
  const price = (Math.random() * 500 + 10).toFixed(2);
  conn.run(`
    INSERT INTO products VALUES (
      ${i},
      'Product ${i}',
      '${category}',
      ${price}
    )
  `);
}

// Seed orders (2 years of data)
const statuses = ['pending', 'shipped', 'delivered', 'cancelled'];
let orderId = 1;
const startDate = new Date(2024, 0, 1);
const endDate = new Date(2026, 0, 31);

for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
  // Random number of orders per day (5-20)
  const ordersPerDay = Math.floor(Math.random() * 16) + 5;

  for (let i = 0; i < ordersPerDay; i++) {
    const customerId = Math.floor(Math.random() * 100) + 1;
    const amount = (Math.random() * 1000 + 20).toFixed(2);
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const orderDate = d.toISOString().split('T')[0];

    conn.run(`
      INSERT INTO orders VALUES (
        ${orderId++},
        ${customerId},
        ${amount},
        '${status}',
        '${orderDate}'
      )
    `);
  }
}

console.log(`Seeded ${orderId - 1} orders`);

// Verify data
conn.all('SELECT COUNT(*) as count FROM customers', (err, rows) => {
  console.log(`Customers: ${(rows as any)[0].count}`);
});

conn.all('SELECT COUNT(*) as count FROM orders', (err, rows) => {
  console.log(`Orders: ${(rows as any)[0].count}`);
});

conn.all('SELECT COUNT(*) as count FROM products', (err, rows) => {
  console.log(`Products: ${(rows as any)[0].count}`);
});

conn.all(`
  SELECT
    date_trunc('month', order_date) as month,
    SUM(amount) as revenue
  FROM orders
  WHERE order_date >= '2025-01-01'
  GROUP BY 1
  ORDER BY 1
  LIMIT 5
`, (err, rows) => {
  console.log('\nSample revenue data:');
  console.table(rows);

  conn.close(() => {
    db.close(() => {
      console.log('\nDatabase created successfully!');
    });
  });
});
