# Dashbook Phase 5: Docker & Fly.io Deployment Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Containerize Dashbook and deploy to Fly.io with a production-ready setup including health checks, environment configuration, and the examples project.

**Architecture:** Multi-stage Docker build produces a slim production image. Server serves both API and static web assets. Fly.io handles TLS, load balancing, and auto-restart. Volume mount for DuckDB persistence.

**Tech Stack:** Docker, Fly.io, Node.js 22 Alpine

**Prerequisites:** Phase 0-4 complete (schema, query, server, web packages)

---

## Task 1: Create Production Build Script

**Files:**
- Update: `apps/server/package.json`
- Update: `apps/web/package.json`
- Update: `package.json` (root)

**Step 1: Update apps/server/package.json**

Add production start script:

```json
{
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "start:prod": "NODE_ENV=production node dist/index.js",
    "test": "vitest run",
    "clean": "rm -rf dist"
  }
}
```

**Step 2: Update apps/web/package.json**

Ensure build outputs to correct location:

```json
{
  "scripts": {
    "build": "tsc -b && vite build",
    "build:prod": "NODE_ENV=production vite build --outDir dist"
  }
}
```

**Step 3: Update root package.json**

Add production build and start scripts:

```json
{
  "scripts": {
    "build": "turbo build",
    "build:prod": "turbo build --filter=@dashbook/server --filter=@dashbook/web",
    "dev": "turbo dev",
    "start": "node apps/server/dist/index.js",
    "lint": "turbo lint",
    "test": "turbo test",
    "clean": "turbo clean && rm -rf node_modules"
  }
}
```

**Step 4: Commit**

```bash
git add package.json apps/server/package.json apps/web/package.json
git commit -m "chore: add production build scripts"
```

---

## Task 2: Update Server to Serve Static Files

**Files:**
- Update: `apps/server/src/server.ts`
- Update: `apps/server/package.json`

**Step 1: Add @fastify/static dependency**

Update `apps/server/package.json` dependencies:

```json
{
  "dependencies": {
    "@fastify/static": "^8.0.0"
  }
}
```

**Step 2: Update server.ts to serve static files in production**

Update `apps/server/src/server.ts`:

```typescript
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { ConfigLoader } from './services/config-loader.js';
import { MemoryCache, parseTtl } from './services/cache.js';
import { QueryService } from './services/query-service.js';
import { configRoutes, chartRoutes } from './routes/index.js';
import { DuckDBConnector } from '@dashbook/query';
import type { DuckDBConnection } from '@dashbook/schema';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { access } from 'fs/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface ServerOptions {
  projectDir: string;
  port?: number;
  host?: string;
  watch?: boolean;
  serveStatic?: boolean;
  staticDir?: string;
}

export interface DashbookServer {
  fastify: FastifyInstance;
  configLoader: ConfigLoader;
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

export async function createServer(options: ServerOptions): Promise<DashbookServer> {
  const {
    projectDir,
    port = 3001,
    host = '0.0.0.0',
    watch = false,
    serveStatic = process.env.NODE_ENV === 'production',
    staticDir = join(__dirname, '../../web/dist'),
  } = options;

  // Initialize Fastify
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
  });

  // CORS only needed in development (when web is separate)
  if (!serveStatic) {
    await fastify.register(cors, { origin: true });
  }

  // Load config
  const configLoader = new ConfigLoader(projectDir);
  await configLoader.load();

  // Get default connection and create connector
  const defaultConnection = configLoader.getDefaultConnection();
  if (!defaultConnection) {
    throw new Error('No connection configured');
  }

  let connector;
  if (defaultConnection.type === 'duckdb') {
    const duckdbConfig = defaultConnection as DuckDBConnection;
    connector = new DuckDBConnector({ path: duckdbConfig.config.path });
    await connector.connect();
  } else {
    throw new Error(`Unsupported connection type: ${defaultConnection.type}`);
  }

  // Setup cache
  const project = configLoader.getProject();
  const cacheTtl = project.defaults?.cache_ttl
    ? parseTtl(project.defaults.cache_ttl)
    : 5 * 60 * 1000; // 5 minutes default

  const cache = new MemoryCache({
    maxSize: 1000,
    defaultTtlMs: cacheTtl,
  });

  // Build model refs
  const models: Record<string, { metadata: any; sql: string }> = {};
  const refs: Record<string, string> = {};

  for (const model of configLoader.getModels()) {
    models[model.metadata.name] = {
      metadata: model.metadata,
      sql: model.sql,
    };
    refs[model.metadata.name] = model.metadata.name;
  }

  // Add base table refs
  refs['orders'] = 'orders';
  refs['customers'] = 'customers';
  refs['products'] = 'products';

  // Create query service
  const queryService = new QueryService({
    connector,
    cache,
    models,
    refs,
  });

  // Register API routes
  fastify.get('/api/health', async () => ({
    status: 'ok',
    version: '0.1.0',
    project: project.name,
    environment: process.env.NODE_ENV || 'development',
  }));

  await fastify.register(configRoutes, { configLoader });
  await fastify.register(chartRoutes, { configLoader, queryService });

  // Serve static files in production
  if (serveStatic) {
    try {
      await access(staticDir);
      await fastify.register(fastifyStatic, {
        root: staticDir,
        prefix: '/',
        decorateReply: false,
      });

      // SPA fallback - serve index.html for non-API routes
      fastify.setNotFoundHandler(async (request, reply) => {
        if (request.url.startsWith('/api/')) {
          return reply.status(404).send({ error: 'Not found' });
        }
        return reply.sendFile('index.html');
      });

      fastify.log.info(`Serving static files from ${staticDir}`);
    } catch {
      fastify.log.warn(`Static directory not found: ${staticDir}`);
    }
  }

  // Setup file watching for hot reload
  if (watch) {
    configLoader.startWatching();
    configLoader.onChange(() => {
      fastify.log.info('Config reloaded');
      queryService.invalidateAll();
    });
  }

  return {
    fastify,
    configLoader,
    start: async () => {
      await fastify.listen({ port, host });
      console.log(`
  ┌─────────────────────────────────────────┐
  │                                         │
  │   Dashbook Server v0.1.0                │
  │                                         │
  │   URL:     http://${host}:${port}         │
  │   Project: ${project.name.padEnd(27)}│
  │   Mode:    ${(serveStatic ? 'Production' : 'Development').padEnd(27)}│
  │                                         │
  │   Charts:  ${String(configLoader.getCharts().length).padEnd(27)}│
  │   Models:  ${String(configLoader.getModels().length).padEnd(27)}│
  │                                         │
  └─────────────────────────────────────────┘
      `);
    },
    stop: async () => {
      await configLoader.stop();
      await connector.disconnect();
      await fastify.close();
    },
  };
}
```

**Step 3: Install dependency and commit**

```bash
pnpm install
git add apps/server/
git commit -m "feat(server): add static file serving for production"
```

---

## Task 3: Create Dockerfile

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`

**Step 1: Create Dockerfile**

```dockerfile
# ============================================
# Dashbook Production Dockerfile
# Multi-stage build for minimal image size
# ============================================

# Stage 1: Build
FROM node:22-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/
COPY packages/config/package.json ./packages/config/
COPY packages/schema/package.json ./packages/schema/
COPY packages/query/package.json ./packages/query/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source files
COPY turbo.json ./
COPY apps/ ./apps/
COPY packages/ ./packages/

# Build all packages
RUN pnpm build

# Stage 2: Production
FROM node:22-alpine AS production

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Create non-root user
RUN addgroup -g 1001 -S dashbook && \
    adduser -S dashbook -u 1001 -G dashbook

WORKDIR /app

# Copy package files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/server/package.json ./apps/server/
COPY packages/config/package.json ./packages/config/
COPY packages/schema/package.json ./packages/schema/
COPY packages/query/package.json ./packages/query/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built files from builder
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/web/dist ./apps/web/dist
COPY --from=builder /app/packages/schema/dist ./packages/schema/dist
COPY --from=builder /app/packages/query/dist ./packages/query/dist

# Copy examples (default project)
COPY examples/ ./examples/

# Create data directory for DuckDB
RUN mkdir -p /data && chown -R dashbook:dashbook /data

# Set ownership
RUN chown -R dashbook:dashbook /app

USER dashbook

# Environment variables
ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0
ENV DASHBOOK_PROJECT_DIR=/app/examples
ENV LOG_LEVEL=info

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/health || exit 1

# Start server
CMD ["node", "apps/server/dist/index.js"]
```

**Step 2: Create .dockerignore**

```
# Dependencies
node_modules/
.pnpm-store/

# Build outputs (we build in Docker)
dist/
.turbo/
*.tsbuildinfo

# Development
.git/
.gitignore
.env*
*.log

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Test
coverage/
*.test.ts
*.spec.ts
__tests__/

# Docs (not needed in image)
docs/
*.md
!README.md

# Local data
examples/sample-data.duckdb
.dashbook/
```

**Step 3: Commit**

```bash
git add Dockerfile .dockerignore
git commit -m "feat: add multi-stage Dockerfile for production"
```

---

## Task 4: Create Fly.io Configuration

**Files:**
- Create: `fly.toml`

**Step 1: Create fly.toml**

```toml
# Fly.io configuration for Dashbook
# https://fly.io/docs/reference/configuration/

app = "dashbook"
primary_region = "sjc"

[build]
  dockerfile = "Dockerfile"

[env]
  NODE_ENV = "production"
  PORT = "8080"
  HOST = "0.0.0.0"
  DASHBOOK_PROJECT_DIR = "/app/examples"
  LOG_LEVEL = "info"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 0
  processes = ["app"]

  [http_service.concurrency]
    type = "requests"
    hard_limit = 250
    soft_limit = 200

[[http_service.checks]]
  grace_period = "10s"
  interval = "30s"
  method = "GET"
  timeout = "5s"
  path = "/api/health"

[[vm]]
  memory = "512mb"
  cpu_kind = "shared"
  cpus = 1

# Volume for persistent DuckDB storage
[[mounts]]
  source = "dashbook_data"
  destination = "/data"

# Metrics endpoint for monitoring
[metrics]
  port = 9091
  path = "/metrics"
```

**Step 2: Commit**

```bash
git add fly.toml
git commit -m "feat: add Fly.io configuration"
```

---

## Task 5: Create Docker Compose for Local Development

**Files:**
- Create: `docker-compose.yml`
- Create: `docker-compose.dev.yml`

**Step 1: Create docker-compose.yml (production-like)**

```yaml
version: "3.9"

services:
  dashbook:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=production
      - PORT=8080
      - HOST=0.0.0.0
      - DASHBOOK_PROJECT_DIR=/app/examples
      - LOG_LEVEL=info
    volumes:
      - dashbook_data:/data
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:8080/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
    restart: unless-stopped

volumes:
  dashbook_data:
```

**Step 2: Create docker-compose.dev.yml (development)**

```yaml
version: "3.9"

services:
  dashbook-server:
    build:
      context: .
      dockerfile: Dockerfile
      target: builder
    command: pnpm --filter @dashbook/server dev
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=development
      - PORT=3001
      - HOST=0.0.0.0
      - DASHBOOK_PROJECT_DIR=/app/examples
    volumes:
      - ./apps/server/src:/app/apps/server/src
      - ./packages:/app/packages
      - ./examples:/app/examples
    working_dir: /app

  dashbook-web:
    build:
      context: .
      dockerfile: Dockerfile
      target: builder
    command: pnpm --filter @dashbook/web dev --host
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
    volumes:
      - ./apps/web/src:/app/apps/web/src
    working_dir: /app
    depends_on:
      - dashbook-server
```

**Step 3: Commit**

```bash
git add docker-compose.yml docker-compose.dev.yml
git commit -m "feat: add Docker Compose configurations"
```

---

## Task 6: Create Deployment Scripts

**Files:**
- Create: `scripts/deploy.sh`
- Create: `scripts/docker-build.sh`

**Step 1: Create scripts/deploy.sh**

```bash
#!/bin/bash
set -e

echo "🚀 Deploying Dashbook to Fly.io..."

# Check if fly CLI is installed
if ! command -v fly &> /dev/null; then
    echo "❌ Fly CLI not found. Install it: https://fly.io/docs/hands-on/install-flyctl/"
    exit 1
fi

# Check if logged in
if ! fly auth whoami &> /dev/null; then
    echo "❌ Not logged in to Fly.io. Run: fly auth login"
    exit 1
fi

# Check if app exists, create if not
if ! fly apps list | grep -q "dashbook"; then
    echo "📦 Creating Fly.io app..."
    fly apps create dashbook

    # Create volume for DuckDB persistence
    echo "💾 Creating persistent volume..."
    fly volumes create dashbook_data --region sjc --size 1
fi

# Deploy
echo "🏗️  Building and deploying..."
fly deploy

echo "✅ Deployment complete!"
echo "🌐 Visit: https://dashbook.fly.dev"
```

**Step 2: Create scripts/docker-build.sh**

```bash
#!/bin/bash
set -e

echo "🐳 Building Dashbook Docker image..."

# Build image
docker build -t dashbook:latest .

echo "✅ Build complete!"
echo ""
echo "Run locally:"
echo "  docker run -p 8080:8080 dashbook:latest"
echo ""
echo "Or with docker-compose:"
echo "  docker-compose up"
```

**Step 3: Make scripts executable and commit**

```bash
chmod +x scripts/deploy.sh scripts/docker-build.sh
git add scripts/
git commit -m "feat: add deployment and build scripts"
```

---

## Task 7: Update Examples for Production

**Files:**
- Update: `examples/connections/local-duckdb.yaml`
- Create: `examples/connections/production-duckdb.yaml`

**Step 1: Update examples/connections/local-duckdb.yaml**

```yaml
name: local-duckdb
type: duckdb
description: "Local DuckDB for development"

config:
  # Use environment variable with fallback
  path: ${DUCKDB_PATH:-./sample-data.duckdb}
```

**Step 2: Create examples/connections/production-duckdb.yaml**

```yaml
name: production-duckdb
type: duckdb
description: "Production DuckDB with persistent storage"

config:
  # Stored on Fly.io volume
  path: /data/dashbook.duckdb
```

**Step 3: Update examples/dashbook.yaml**

```yaml
version: "1.0"
name: dashbook-examples
description: "Example Dashbook project"

defaults:
  connection: ${DASHBOOK_CONNECTION:-local-duckdb}
  timezone: UTC
  cache_ttl: 5m

environments:
  development:
    connection: local-duckdb
  production:
    connection: production-duckdb
```

**Step 4: Commit**

```bash
git add examples/
git commit -m "feat: add production connection config for examples"
```

---

## Task 8: Create Seed Script for Production Database

**Files:**
- Update: `examples/scripts/seed-data.ts`

**Step 1: Update examples/scripts/seed-data.ts**

Add support for custom output path:

```typescript
import * as duckdb from 'duckdb';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Support custom path via env var or argument
const dbPath = process.env.DUCKDB_PATH
  || process.argv[2]
  || join(__dirname, '..', 'sample-data.duckdb');

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

// Verify and close
conn.all('SELECT COUNT(*) as count FROM customers', (err, rows) => {
  console.log(`Customers: ${(rows as any)[0].count}`);
});

conn.all('SELECT COUNT(*) as count FROM orders', (err, rows) => {
  console.log(`Orders: ${(rows as any)[0].count}`);
});

conn.all('SELECT COUNT(*) as count FROM products', (err, rows) => {
  console.log(`Products: ${(rows as any)[0].count}`);

  conn.close(() => {
    db.close(() => {
      console.log('\n✅ Database created successfully!');
    });
  });
});
```

**Step 2: Add seed script to examples package.json**

```json
{
  "scripts": {
    "seed": "tsx scripts/seed-data.ts",
    "seed:prod": "DUCKDB_PATH=/data/dashbook.duckdb tsx scripts/seed-data.ts"
  }
}
```

**Step 3: Commit**

```bash
git add examples/
git commit -m "feat: add production database seeding support"
```

---

## Task 9: Create GitHub Actions Workflow

**Files:**
- Create: `.github/workflows/deploy.yml`
- Create: `.github/workflows/ci.yml`

**Step 1: Create .github/workflows/ci.yml**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build
        run: pnpm build

      - name: Test
        run: pnpm test

  docker:
    runs-on: ubuntu-latest
    needs: test

    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Build Docker image
        uses: docker/build-push-action@v6
        with:
          context: .
          push: false
          tags: dashbook:test
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

**Step 2: Create .github/workflows/deploy.yml**

```yaml
name: Deploy to Fly.io

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    # Only deploy on main branch
    if: github.ref == 'refs/heads/main'

    steps:
      - uses: actions/checkout@v4

      - name: Setup Fly.io
        uses: superfly/flyctl-actions/setup-flyctl@master

      - name: Deploy to Fly.io
        run: flyctl deploy --remote-only
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

**Step 3: Commit**

```bash
mkdir -p .github/workflows
git add .github/
git commit -m "feat: add GitHub Actions for CI and Fly.io deployment"
```

---

## Task 10: Update README with Deployment Instructions

**Files:**
- Update: `README.md`

**Step 1: Update README.md**

Add deployment section:

```markdown
# Dashbook

Open-source, Git-native business intelligence dashboards defined entirely through code.

... (existing content) ...

## Deployment

### Docker

```bash
# Build image
docker build -t dashbook:latest .

# Run locally
docker run -p 8080:8080 dashbook:latest

# Open http://localhost:8080
```

### Docker Compose

```bash
# Production-like
docker-compose up

# Development with hot reload
docker-compose -f docker-compose.dev.yml up
```

### Fly.io

1. Install the [Fly CLI](https://fly.io/docs/hands-on/install-flyctl/)

2. Login to Fly.io:
   ```bash
   fly auth login
   ```

3. Deploy:
   ```bash
   ./scripts/deploy.sh
   ```

   Or manually:
   ```bash
   fly apps create dashbook
   fly volumes create dashbook_data --region sjc --size 1
   fly deploy
   ```

4. Open your app:
   ```bash
   fly open
   ```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `8080` |
| `HOST` | Bind address | `0.0.0.0` |
| `NODE_ENV` | Environment | `development` |
| `DASHBOOK_PROJECT_DIR` | Path to dashbook project | `.` |
| `LOG_LEVEL` | Log level (debug, info, warn, error) | `info` |
| `DUCKDB_PATH` | Path to DuckDB database | `./sample-data.duckdb` |

## Development

```bash
# Install dependencies
pnpm install

# Start dev servers (API + Web)
pnpm dev

# Run tests
pnpm test

# Build for production
pnpm build
```

## License

MIT
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add deployment instructions to README"
```

---

## Task 11: Test Docker Build Locally

**Step 1: Build Docker image**

```bash
./scripts/docker-build.sh
```

Expected: Image builds successfully.

**Step 2: Run container**

```bash
docker run -p 8080:8080 dashbook:latest
```

**Step 3: Test endpoints**

```bash
curl http://localhost:8080/api/health
curl http://localhost:8080/api/config
```

Expected: API responds correctly.

**Step 4: Open in browser**

Navigate to: `http://localhost:8080`

Expected: Dashbook UI loads with chart.

---

## Task 12: Deploy to Fly.io

**Step 1: Login to Fly.io (if not already)**

```bash
fly auth login
```

**Step 2: Run deploy script**

```bash
./scripts/deploy.sh
```

Or manually:
```bash
fly apps create dashbook
fly volumes create dashbook_data --region sjc --size 1
fly deploy
```

**Step 3: Verify deployment**

```bash
fly status
fly logs
```

**Step 4: Open app**

```bash
fly open
```

Expected: Dashbook running at `https://dashbook.fly.dev`

---

## Task 13: Final Push

**Step 1: Push all changes**

```bash
git push origin main
```

---

## Summary

After completing these tasks, you will have:

1. **Production Docker image**:
   - Multi-stage build (~150MB final image)
   - Non-root user for security
   - Health checks
   - Static file serving

2. **Fly.io deployment**:
   - Auto-scaling
   - Persistent volume for DuckDB
   - HTTPS with automatic certificates
   - Health monitoring

3. **Docker Compose**:
   - Production-like local testing
   - Development with hot reload

4. **CI/CD Pipeline**:
   - GitHub Actions for testing
   - Automatic deployment on main branch

5. **Deployment scripts**:
   - `./scripts/deploy.sh` - One-command Fly.io deploy
   - `./scripts/docker-build.sh` - Local Docker build

**Deployment URLs:**
- Local Docker: `http://localhost:8080`
- Fly.io: `https://dashbook.fly.dev` (or your custom domain)

**To deploy updates:**
```bash
git push origin main  # Triggers automatic deployment
# Or manually:
fly deploy
```
