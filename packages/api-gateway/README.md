# API Gateway - Rustici Killer

## Overview

The API Gateway is the central entry point for all API requests in the Rustici Killer platform. It handles authentication, request routing, and acts as a proxy to downstream microservices.

## Architecture Notes for ChatGPT

### Phase Evolution
- **Phase 1**: Basic scaffolding and project structure
- **Phase 2**: Authentication system with in-memory storage (JWT tokens, bcrypt)
- **Phase 3**: Database integration with PostgreSQL and Prisma ORM
- **Phase 4**: (Future) Content ingestion and SCORM runtime integration

### Key Components

#### Authentication System
- **JWT Tokens**: Stateless authentication with 24-hour expiration
- **Password Security**: Bcrypt hashing with 12 salt rounds
- **Multi-tenant**: Each user belongs to a tenant (organization)
- **Role-based**: Admin role for first user in tenant

#### Database Schema (Prisma)
```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  firstName String
  lastName  String
  password  String   // bcrypt hashed
  tenantId  String   // foreign key to tenant
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Tenant {
  id        String   @id @default(cuid())
  name      String
  users     User[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

#### Request Flow
1. **Authentication**: Extract Bearer token from Authorization header
2. **Validation**: Verify JWT signature and lookup user in database
3. **Authorization**: Attach user object to request for downstream services
4. **Routing**: Proxy authenticated requests to appropriate microservices

### Microservices Architecture

The API Gateway routes requests to these downstream services:

| Route | Service | Port | Purpose |
|-------|---------|------|---------|
| `/api/content` | Content Ingestion | 3002 | Course uploads and parsing |
| `/api/scorm` | SCORM Runtime | 3001 | SCORM player and session management |
| `/api/lrs` | Learning Record Store | 3003 | xAPI statements and analytics |
| `/api/sequencing` | Sequencing Engine | 3004 | SCORM 2004 sequencing logic |
| `/api/webhooks` | Webhook Emitter | 3005 | Event notifications |

### Security Features
- **Helmet**: Security headers (XSS protection, HSTS, etc.)
- **CORS**: Cross-origin requests from whitelisted frontend domains
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **JWT Authentication**: Stateless token-based auth
- **Input Validation**: Request body validation and sanitization

## API Endpoints

### Authentication Routes

#### POST /auth/register
Register new user and create tenant.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "firstName": "John",
  "lastName": "Doe",
  "tenantName": "My Organization"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "role": "admin",
    "tenantId": "tenant_456"
  }
}
```

#### POST /auth/login
Authenticate existing user.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "role": "admin",
    "tenantId": "tenant_456"
  }
}
```

#### GET /auth/me
Get current user profile (requires authentication).

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "admin",
    "tenantId": "tenant_456",
    "tenant": {
      "id": "tenant_456",
      "name": "My Organization"
    },
    "createdAt": "2025-07-14T10:30:00Z"
  }
}
```

### Health Check

#### GET /health
Service health status and metrics.

**Response:**
```json
{
  "status": "healthy",
  "service": "api-gateway",
  "version": "0.3.0",
  "timestamp": "2025-07-14T10:30:00Z",
  "uptime": 3600,
  "database": {
    "status": "connected",
    "usersCount": 42,
    "tenantsCount": 15
  }
}
```

## Development Setup

### Prerequisites
- Node.js 18+
- PostgreSQL 12+
- npm or yarn

### Environment Variables
Create `.env` file:
```env
DATABASE_URL="postgresql://username:password@localhost:5432/rustici_killer?schema=public"
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
ALLOWED_ORIGINS="http://localhost:3006,http://localhost:3000"
```

### Database Setup
```bash
# Install dependencies
npm install

# Generate Prisma client
npm run db:generate

# Run database migrations
npm run db:migrate

# Start development server
npm run dev
```

### Available Scripts
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run db:generate` - Generate Prisma client
- `npm run db:migrate` - Run database migrations
- `npm run db:reset` - Reset database (dev only)
- `npm run db:studio` - Open Prisma Studio
- `npm run db:push` - Push schema changes to database

## Testing

### Manual Testing
1. Start PostgreSQL database
2. Run migrations: `npm run db:migrate`
3. Start server: `npm run dev`
4. Test endpoints with curl or Postman

### Example curl commands:
```bash
# Register new user
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "firstName": "Test",
    "lastName": "User",
    "tenantName": "Test Organization"
  }'

# Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'

# Get user profile (replace TOKEN with actual JWT)
curl -X GET http://localhost:3000/auth/me \
  -H "Authorization: Bearer TOKEN"
```

## Error Handling

All endpoints return consistent error format:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message"
  }
}
```

Common error codes:
- `MISSING_TOKEN` - Authorization header missing
- `INVALID_TOKEN` - JWT token invalid or expired
- `MISSING_FIELDS` - Required fields missing in request
- `EMAIL_EXISTS` - Email already registered
- `INVALID_CREDENTIALS` - Wrong email or password
- `REGISTRATION_FAILED` - Registration process failed
- `LOGIN_FAILED` - Login process failed

## Deployment Notes

### Production Considerations
1. Use strong JWT_SECRET (32+ characters)
2. Configure CORS for production domains
3. Set up database connection pooling
4. Use HTTPS in production
5. Monitor health check endpoint
6. Set up log aggregation
7. Configure rate limiting per environment

### Database Migrations
- Always run `npm run db:migrate` before deploying
- Use `npm run db:push` for development schema changes
- Database schema is versioned in `prisma/migrations/`

### Monitoring
- Health check: `GET /health`
- Database connection status included in health response
- Application metrics available via health endpoint
- Graceful shutdown handlers disconnect database properly

## Future Enhancements

1. **Role-based Authorization**: Implement granular permissions
2. **API Key Authentication**: Support for server-to-server authentication
3. **Refresh Tokens**: Implement token refresh mechanism
4. **Audit Logging**: Track user actions and API usage
5. **Request Validation**: Add comprehensive input validation
6. **API Versioning**: Support multiple API versions
7. **Caching**: Implement Redis caching for frequently accessed data
8. **Circuit Breakers**: Add resilience patterns for service calls
