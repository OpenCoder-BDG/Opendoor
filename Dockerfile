# Multi-stage build for optimized MCP Server
# Build Stage
FROM node:18-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    && npm install -g pnpm

# Copy package files
COPY mcp-server/package*.json ./
COPY mcp-server/tsconfig.json ./

# Install dependencies with cache optimization
RUN pnpm install --no-frozen-lockfile --prod=false

# Copy source code
COPY mcp-server/src ./src

# Build the application
RUN pnpm run build && \
    pnpm prune --prod && \
    pnpm store prune

# Production Stage
FROM node:18-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache \
    dumb-init \
    curl \
    && addgroup -g 1001 -S nodejs \
    && adduser -S nodejs -u 1001

# Install Docker CLI for container management
RUN apk add --no-cache docker-cli

WORKDIR /app

# Create necessary directories
RUN mkdir -p /app/sessions /app/logs /app/tmp && \
    chown -R nodejs:nodejs /app

# Copy built application and dependencies
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json

# Copy startup script
COPY --chown=nodejs:nodejs scripts/docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    LOG_LEVEL=info \
    REDIS_HOST=redis \
    REDIS_PORT=6379 \
    DOCKER_SOCKET=/var/run/docker.sock \
    MAX_CONCURRENT_EXECUTIONS=10 \
    RATE_LIMIT_POINTS=100 \
    SESSION_TIMEOUT_HOURS=24

# Expose ports
EXPOSE 3000

# Switch to non-root user
USER nodejs

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["docker-entrypoint.sh"]
