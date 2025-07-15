# API Gateway - Production Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/api-gateway/package*.json ./packages/api-gateway/
COPY packages/types/package*.json ./packages/types/

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY packages/api-gateway/ ./packages/api-gateway/
COPY packages/types/ ./packages/types/

# Build the service
WORKDIR /app/packages/api-gateway
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

# Copy built application
COPY --from=builder /app/packages/api-gateway/dist ./dist
COPY --from=builder /app/packages/api-gateway/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S api-gateway -u 1001

# Change ownership
RUN chown -R api-gateway:nodejs /app

USER api-gateway

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["npm", "start"]
