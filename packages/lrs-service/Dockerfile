# LRS Service - Production Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/lrs-service/package*.json ./packages/lrs-service/
COPY packages/types/package*.json ./packages/types/

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY packages/lrs-service/ ./packages/lrs-service/
COPY packages/types/ ./packages/types/

# Build the service
WORKDIR /app/packages/lrs-service
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

# Copy built application
COPY --from=builder /app/packages/lrs-service/dist ./dist
COPY --from=builder /app/packages/lrs-service/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S lrs-service -u 1001 && \
    chown -R lrs-service:nodejs /app

USER lrs-service

# Expose port
EXPOSE 3005

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3005/health || exit 1

# Start the application
CMD ["npm", "start"]
