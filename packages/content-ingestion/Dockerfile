# Content Ingestion - Production Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/content-ingestion/package*.json ./packages/content-ingestion/
COPY packages/types/package*.json ./packages/types/

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY packages/content-ingestion/ ./packages/content-ingestion/
COPY packages/types/ ./packages/types/

# Build the service
WORKDIR /app/packages/content-ingestion
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

# Copy built application
COPY --from=builder /app/packages/content-ingestion/dist ./dist
COPY --from=builder /app/packages/content-ingestion/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

# Create non-root user and uploads directory
RUN addgroup -g 1001 -S nodejs && \
    adduser -S content-ingestion -u 1001 && \
    mkdir -p /app/uploads && \
    chown -R content-ingestion:nodejs /app

USER content-ingestion

# Expose port
EXPOSE 3002

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3002/health || exit 1

# Start the application
CMD ["npm", "start"]
