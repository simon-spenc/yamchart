# ============================================
# Dashbook Production Dockerfile
# Multi-stage build for minimal image size
# ============================================

# Stage 1: Build
FROM node:22-slim AS builder

# Install required build tools
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/
# Copy entire config package (contains static tsconfig files needed at install time)
COPY packages/config/ ./packages/config/
COPY packages/schema/package.json ./packages/schema/
COPY packages/query/package.json ./packages/query/
COPY packages/auth/package.json ./packages/auth/
COPY packages/billing/package.json ./packages/billing/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source files
COPY turbo.json ./
COPY apps/ ./apps/
COPY packages/ ./packages/

# Build all packages
RUN pnpm build

# Stage 2: Production
FROM node:22-slim AS production

# Install curl for healthcheck
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Create non-root user
RUN groupadd -g 1001 dashbook && \
    useradd -u 1001 -g dashbook -m dashbook

WORKDIR /app

# Copy package files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/server/package.json ./apps/server/
COPY packages/config/package.json ./packages/config/
COPY packages/schema/package.json ./packages/schema/
COPY packages/query/package.json ./packages/query/
COPY packages/auth/package.json ./packages/auth/
COPY packages/billing/package.json ./packages/billing/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built files from builder
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/web/dist ./apps/web/dist
COPY --from=builder /app/packages/schema/dist ./packages/schema/dist
COPY --from=builder /app/packages/query/dist ./packages/query/dist
COPY --from=builder /app/packages/auth/dist ./packages/auth/dist
COPY --from=builder /app/packages/billing/dist ./packages/billing/dist

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
  CMD curl -f http://localhost:8080/api/health || exit 1

# Start server
CMD ["node", "apps/server/dist/index.js"]
