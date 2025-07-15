# Database Integration Guide - Phase 3

## Overview

This document explains the database integration implemented in Phase 3 of the Rustici Killer project. We migrated from in-memory storage to PostgreSQL with Prisma ORM.

## What Changed from Phase 2 to Phase 3

### Before (Phase 2)
- Used JavaScript `Map` objects for data storage
- Data lost on server restart
- No data persistence
- Simple in-memory lookups

```typescript
// Phase 2 - In-memory storage
const users = new Map<string, User>();
const tenants = new Map<string, Tenant>();
const usersByEmail = new Map<string, User>();

// Example usage
users.set(userId, user);
const user = usersByEmail.get(email);
```

### After (Phase 3)
- PostgreSQL database with Prisma ORM
- Persistent data storage
- Database transactions
- Proper foreign key relationships

```typescript
// Phase 3 - Database with Prisma
const prisma = new PrismaClient();

// Example usage
const user = await prisma.user.findUnique({
  where: { email },
  include: { tenant: true }
});
```

## Database Schema

### User Model
```prisma
model User {
  id        String   @id @default(cuid())  // Primary key
  email     String   @unique               // Unique constraint
  firstName String                         // User's first name
  lastName  String                         // User's last name
  password  String                         // Bcrypt hashed password
  tenantId  String                         // Foreign key to tenant
  createdAt DateTime @default(now())       // Auto timestamp
  updatedAt DateTime @updatedAt            // Auto updated timestamp
  
  // Relationship
  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  
  @@map("users")  // Table name in database
}
```

### Tenant Model
```prisma
model Tenant {
  id        String   @id @default(cuid())  // Primary key
  name      String                         // Organization name
  createdAt DateTime @default(now())       // Auto timestamp
  updatedAt DateTime @updatedAt            // Auto updated timestamp
  
  // Relationship
  users User[]  // One-to-many relationship
  
  @@map("tenants")  // Table name in database
}
```

## Key Changes in Code

### 1. Authentication Middleware
```typescript
// Before (Phase 2)
const requireAuth = (req, res, next) => {
  const payload = jwt.verify(token, JWT_SECRET);
  const user = users.get(payload.userId);  // In-memory lookup
  (req as any).user = user;
  next();
};

// After (Phase 3)
const requireAuth = async (req, res, next) => {
  const payload = jwt.verify(token, JWT_SECRET);
  const user = await prisma.user.findUnique({  // Database lookup
    where: { id: payload.userId },
    include: { tenant: true }
  });
  (req as any).user = user;
  next();
};
```

### 2. User Registration
```typescript
// Before (Phase 2)
app.post('/auth/register', async (req, res) => {
  // Create tenant
  const tenant = { id: uuidv4(), name: tenantName };
  tenants.set(tenantId, tenant);
  
  // Create user
  const user = { id: uuidv4(), email, passwordHash, tenantId };
  users.set(userId, user);
  usersByEmail.set(email, user);
});

// After (Phase 3)
app.post('/auth/register', async (req, res) => {
  const result = await prisma.$transaction(async (tx) => {
    // Create tenant
    const tenant = await tx.tenant.create({
      data: { id: uuidv4(), name: tenantName }
    });
    
    // Create user
    const user = await tx.user.create({
      data: {
        id: uuidv4(),
        email,
        firstName,
        lastName,
        password: passwordHash,
        tenantId: tenant.id
      }
    });
    
    return { user, tenant };
  });
});
```

### 3. User Login
```typescript
// Before (Phase 2)
app.post('/auth/login', async (req, res) => {
  const user = usersByEmail.get(email);  // In-memory lookup
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  
  const isValid = await bcrypt.compare(password, user.passwordHash);
  // ... rest of login logic
});

// After (Phase 3)
app.post('/auth/login', async (req, res) => {
  const user = await prisma.user.findUnique({  // Database lookup
    where: { email },
    include: { tenant: true }
  });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  
  const isValid = await bcrypt.compare(password, user.password);
  // ... rest of login logic
});
```

## Database Operations

### Common Prisma Operations

#### Create with Relationship
```typescript
// Create user with tenant
const user = await prisma.user.create({
  data: {
    email: "user@example.com",
    firstName: "John",
    lastName: "Doe",
    password: hashedPassword,
    tenantId: tenantId
  }
});
```

#### Find with Include
```typescript
// Find user with tenant data
const user = await prisma.user.findUnique({
  where: { email: "user@example.com" },
  include: { tenant: true }
});
```

#### Transaction
```typescript
// Atomic operations
const result = await prisma.$transaction(async (tx) => {
  const tenant = await tx.tenant.create({ data: { name: "Company" } });
  const user = await tx.user.create({ 
    data: { 
      email: "user@example.com", 
      tenantId: tenant.id 
    } 
  });
  return { user, tenant };
});
```

### Database Queries
```typescript
// Count records
const userCount = await prisma.user.count();

// Find many with filter
const users = await prisma.user.findMany({
  where: { tenantId: "tenant_123" },
  include: { tenant: true }
});

// Update
const user = await prisma.user.update({
  where: { id: "user_123" },
  data: { firstName: "Updated Name" }
});

// Delete
await prisma.user.delete({
  where: { id: "user_123" }
});
```

## Environment Setup

### Required Environment Variables
```env
DATABASE_URL="postgresql://username:password@localhost:5432/rustici_killer?schema=public"
JWT_SECRET="your-super-secret-jwt-key"
```

### Development Workflow
1. **Make Schema Changes**: Edit `prisma/schema.prisma`
2. **Generate Client**: Run `npm run db:generate`
3. **Create Migration**: Run `npm run db:migrate`
4. **Test Changes**: Start server with `npm run dev`

### Useful Commands
```bash
# Generate Prisma client
npm run db:generate

# Create and apply migration
npm run db:migrate

# Reset database (dev only)
npm run db:reset

# Push schema without migration
npm run db:push

# Open database browser
npm run db:studio
```

## Error Handling

### Database Connection Errors
```typescript
// Health check with database test
app.get('/health', async (req, res) => {
  try {
    const usersCount = await prisma.user.count();
    res.json({ status: 'healthy', database: { usersCount } });
  } catch (error) {
    res.status(500).json({ status: 'unhealthy', error: 'Database connection failed' });
  }
});
```

### Graceful Shutdown
```typescript
// Disconnect Prisma on shutdown
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
```

## Benefits of Phase 3 Changes

### Reliability
- Data persists across server restarts
- Database transactions ensure data consistency
- Foreign key constraints prevent orphaned records

### Scalability
- Database can handle more concurrent users
- Proper indexing improves query performance
- Can scale database separately from application

### Security
- Proper data validation at database level
- Prepared statements prevent SQL injection
- Row-level security possible with future enhancements

### Development
- Type-safe database operations with Prisma
- Automatic migration generation
- Database schema versioning
- Rich query capabilities

## Future Enhancements

1. **Connection Pooling**: Implement database connection pooling
2. **Read Replicas**: Add read-only database replicas
3. **Caching**: Add Redis caching layer
4. **Monitoring**: Add database performance monitoring
5. **Backup Strategy**: Implement automated backups
6. **Audit Logging**: Track all database changes
7. **Multi-Region**: Support multiple database regions

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check PostgreSQL is running
   - Verify DATABASE_URL is correct
   - Ensure database exists

2. **Migration Errors**
   - Check for schema conflicts
   - Verify database permissions
   - Review migration files in `prisma/migrations/`

3. **Type Errors**
   - Regenerate Prisma client: `npm run db:generate`
   - Check schema matches expected types
   - Restart TypeScript server

### Debug Mode
```bash
# Enable Prisma debug logging
DEBUG=prisma:* npm run dev
```

This completes the Phase 3 database integration. The system now has proper data persistence, relationships, and transaction support while maintaining the same API surface for the frontend.
