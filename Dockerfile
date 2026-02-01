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
