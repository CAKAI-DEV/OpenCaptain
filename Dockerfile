# Build stage
FROM oven/bun:1.2-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install dependencies (all deps for build)
RUN bun install

# Copy source
COPY . .

# Build (Bun can run TS directly, but prebuild for production)
RUN bun build src/index.ts --target=bun --outdir=dist

# Production stage
FROM oven/bun:1.2-alpine AS runner

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S blockbot && \
    adduser -S blockbot -u 1001 -G blockbot

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/drizzle.config.ts ./
COPY --from=builder /app/src/db ./src/db

# Switch to non-root user
USER blockbot

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start application
CMD ["bun", "run", "dist/index.js"]
