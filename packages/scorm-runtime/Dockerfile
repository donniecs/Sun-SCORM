# SCORM Runtime - Production Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/scorm-runtime/package*.json ./packages/scorm-runtime/
COPY packages/types/package*.json ./packages/types/

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY packages/scorm-runtime/ ./packages/scorm-runtime/
COPY packages/types/ ./packages/types/

# Build the service
WORKDIR /app/packages/scorm-runtime
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

# Copy built application
COPY --from=builder /app/packages/scorm-runtime/dist ./dist
COPY --from=builder /app/packages/scorm-runtime/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S scorm-runtime -u 1001 && \
    chown -R scorm-runtime:nodejs /app

USER scorm-runtime

# Expose port
EXPOSE 3003

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3003/health || exit 1

# Start the application
CMD ["npm", "start"]
