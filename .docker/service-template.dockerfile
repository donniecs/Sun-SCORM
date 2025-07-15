# Service Production Dockerfile Template
# Replace {{SERVICE_NAME}} with actual service name
FROM node:18-alpine

WORKDIR /app

# Copy root package files and tsconfig
COPY package*.json tsconfig.json ./

# Copy all source code
COPY packages/ ./packages/
COPY apps/ ./apps/

# Install dependencies, build types and service, generate Prisma client, create user, and set permissions
RUN npm ci && \
    cd /app/packages/types && npm run build && \
    cd /app/packages/{{SERVICE_NAME}} && npm run build && \
    npx prisma generate && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

# Switch to service directory and user
WORKDIR /app/packages/{{SERVICE_NAME}}
USER nodejs

EXPOSE {{PORT}}

CMD ["npm", "start"]
