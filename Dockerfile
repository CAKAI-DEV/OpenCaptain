# Build stage
FROM oven/bun:1.2-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install all dependencies (need drizzle-kit for migrations)
RUN bun install --frozen-lockfile --ignore-scripts

# Production stage
FROM oven/bun:1.2-alpine AS runner

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S blockbot && \
    adduser -S blockbot -u 1001 -G blockbot

# Copy node_modules from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy source and config files
COPY package.json ./
COPY drizzle.config.ts ./
COPY src ./src
COPY docker/entrypoint.sh /entrypoint.sh

# Make entrypoint executable
RUN chmod +x /entrypoint.sh

# Switch to non-root user
USER blockbot

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start application with migrations
ENTRYPOINT ["/entrypoint.sh"]
