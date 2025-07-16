# Use Node.js 18 LTS Alpine image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    g++ \
    make \
    postgresql-client \
    python3

# Copy package files
COPY package*.json ./

# Install npm dependencies
RUN npm ci --only=production

# Copy application source
COPY dist/ ./dist/
COPY src/ ./src/

# Create logs directory, non-root user, and set permissions
RUN mkdir -p logs && \
    addgroup -g 1001 -S nodejs && \
    adduser -S analytics -u 1001 && \
    chown -R analytics:nodejs /app
USER analytics

# Expose port
EXPOSE 3002

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3002/health || exit 1

# Start the application
CMD ["node", "dist/index.js"]
