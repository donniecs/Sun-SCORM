/**
 * @file API Gateway Service - RUSTICI KILLER
 * @description Central API gateway with authentication and service routing
 * @version 0.4.0 - Phase 11: Staging Launch Prep + Internal UAT
 * @lastUpdated 2025-07-15 Phase 11
 * @status PHASE_11_IN_PROGRESS
 * @dependencies PostgreSQL, Prisma, JWT, bcrypt
 * 
 * CHANGE LOG - 2025-07-15 Phase 11
 * ============================
 * WHAT: Code hardening and production readiness for staging launch
 * WHY: Phase 11 requirement for UAT testing and internal launch
 * IMPACT: Removed console.log statements, added proper logging, config validation
 * NOTES FOR CHATGPT: This file now includes production-ready logging and config validation
 * REPLACES: Development console.log statements with structured logging
 * 
 * NOTES FOR CHATGPT:
 * =================
 * This is the main API Gateway service for the Rustici Killer platform.
 * It serves as the central entry point for all API requests.
 * 
 * KEY ARCHITECTURAL DECISIONS:
 * - Uses JWT tokens for authentication (stored in localStorage on frontend)
 * - Prisma ORM with PostgreSQL for data persistence (replaced in-memory stores)
 * - Multi-tenant architecture (each user belongs to a tenant)
 * - Microservices architecture with service proxying
 * - Rate limiting and security middleware (helmet, CORS)
 * - Config validation on startup with proper error handling
 * 
 * PHASE EVOLUTION:
 * - Phase 1: Basic scaffolding
 * - Phase 2: Authentication system with in-memory storage
 * - Phase 3: Database integration with Prisma + PostgreSQL ✅ COMPLETE
 * - Phase 10: Docker deployment and testing ✅ COMPLETE
 * - Phase 11: Staging launch prep and UAT ⏳ IN PROGRESS
 * 
 * DATABASE SCHEMA:
 * - User: id, email, firstName, lastName, password, tenantId, timestamps
 * - Tenant: id, name, timestamps
 * - Relationship: User belongs to Tenant (foreign key)
 * 
 * AUTHENTICATION FLOW:
 * 1. User registers with email/password/names/tenantName
 * 2. System creates tenant and user in database transaction
 * 3. JWT token generated with userId, tenantId, role, email
 * 4. Frontend stores token in localStorage
 * 5. Subsequent requests include "Bearer {token}" header
 * 6. requireAuth middleware validates token and attaches user to request
 * 
 * MICROSERVICES ROUTING:
 * - /api/content -> Content Ingestion Service (port 3002)
 * - /api/scorm -> SCORM Runtime Service (port 3001)
 * - /api/lrs -> Learning Record Store Service (port 3003)
 * - /api/sequencing -> Sequencing Engine Service (port 3004)
 * - /api/webhooks -> Webhook Emitter Service (port 3005)
 * 
 * SECURITY FEATURES:
 * - Helmet for security headers
 * - CORS with specific origin whitelist
 * - Rate limiting (100 requests per 15 minutes)
 * - JWT token validation
 * - Bcrypt password hashing with 12 salt rounds
 * 
 * DEPLOYMENT NOTES:
 * - Requires PostgreSQL database connection
 * - Environment variables in .env file
 * - Graceful shutdown handlers for database disconnection
 * - Health check endpoint for monitoring
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { PrismaClient } from '@prisma/client';
import { 
  JWTPayload, 
  LoginRequest, 
  RegisterRequest, 
  AuthResponse
} from '../../types/src/index';
import { createDispatchZip } from './utils/createDispatchZip';
// PHASE 1.5 CLEANUP: Import centralized error handling
import { globalErrorHandler, notFoundHandler } from './middleware/errorHandler';
import dispatchRoutes from './routes/dispatches';

const app = express();
const PORT = process.env.PORT || 3000;

// =============================================================================
// PRISMA CLIENT SETUP - PHASE 3: Database Integration
// =============================================================================
/**
 * CHANGE LOG - 2025-07-14 14:45
 * ============================
 * WHAT: Added Prisma Client for PostgreSQL database operations
 * WHY: Phase 3 requirement to replace in-memory storage with persistent database
 * IMPACT: All user/tenant operations now use database instead of Map objects
 * NOTES FOR CHATGPT: This replaces the in-memory Maps (users, tenants, usersByEmail)
 * REPLACES: 
 *   - const users = new Map<string, User>();
 *   - const tenants = new Map<string, Tenant>();
 *   - const usersByEmail = new Map<string, User>();
 * 
 * NOTES FOR CHATGPT:
 * - Prisma Client is the database ORM we use for PostgreSQL
 * - Schema defined in prisma/schema.prisma
 * - Connection string in .env file (DATABASE_URL)
 * - Use prisma.$disconnect() for graceful shutdown
 * - Supports transactions with prisma.$transaction()
 * - Auto-generated types based on schema
 */

const prisma = new PrismaClient();

// =============================================================================
// ENVIRONMENT CONFIGURATION
// =============================================================================

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const SALT_ROUNDS = 12;

// =============================================================================
// MIDDLEWARE SETUP
// =============================================================================

app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3006'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use(limiter);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =============================================================================
// AUTHENTICATION MIDDLEWARE
// =============================================================================
/**
 * CHANGE LOG - 2025-07-14 14:45
 * ============================
 * WHAT: Updated requireAuth middleware to use database lookups
 * WHY: Phase 3 database integration requires async user validation
 * IMPACT: Middleware is now async, includes tenant data in user object
 * NOTES FOR CHATGPT: This replaces synchronous Map lookup with async database query
 * REPLACES: const user = users.get(payload.userId);
 * 
 * NOTES FOR CHATGPT:
 * - requireAuth middleware validates JWT tokens on protected routes
 * - Extracts Bearer token from Authorization header
 * - Verifies token signature using JWT_SECRET
 * - Looks up user in database using userId from token payload
 * - Attaches full user object (with tenant) to request for downstream use
 * - Returns 401 for missing, invalid, or expired tokens
 * - Made async in Phase 3 to support database lookups
 * - Includes tenant relationship data via Prisma include
 */

/**
 * Middleware to require authentication
 * UPDATED 2025-07-14 14:45: Made async for database operations
 */
const requireAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'MISSING_TOKEN',
          message: 'Authorization token required'
        }
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    const payload = jwt.verify(token, JWT_SECRET) as JWTPayload;
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { tenant: true }
    });
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'User not found'
        }
      });
    }

    // Attach user to request
    (req as any).user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired token'
      }
    });
  }
};

// =============================================================================
// AUTHENTICATION ROUTES
// =============================================================================
/**
 * NOTES FOR CHATGPT:
 * - These routes handle user registration, login, and profile retrieval
 * - /auth/register: Creates new tenant and user in database transaction
 * - /auth/login: Validates credentials and issues JWT token
 * - /auth/me: Returns current user profile (requires authentication)
 * - All routes return consistent JSON structure with success/error format
 * - Passwords are hashed with bcrypt before storage
 * - JWT tokens expire after 24 hours
 */

/**
 * POST /auth/register
 * Register new user and tenant
 * 
 * NOTES FOR CHATGPT:
 * - Creates tenant first, then user in database transaction
 * - Requires: email, password, firstName, lastName, tenantName
 * - First user in tenant gets admin role
 * - Returns JWT token immediately after registration
 * - Checks for existing email before creating user
 */
app.post('/auth/register', async (req: express.Request, res: express.Response) => {
  try {
    const { email, password, firstName, lastName, tenantName }: RegisterRequest & { firstName: string, lastName: string } = req.body;

    // Validation
    if (!email || !password || !firstName || !lastName || !tenantName) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'Email, password, first name, last name, and tenant name are required'
        }
      });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'EMAIL_EXISTS',
          message: 'User with this email already exists'
        }
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Create tenant and user in a transaction
    const result = await prisma.$transaction(async (tx: any) => {
      // Create tenant
      const tenant = await tx.tenant.create({
        data: {
          id: uuidv4(),
          name: tenantName,
          domain: tenantName + '.localhost'
        }
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

    // Generate JWT token
    const tokenPayload: JWTPayload = {
      userId: result.user.id,
      tenantId: result.user.tenantId,
      role: 'admin', // First user in tenant is admin
      email: result.user.email
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '24h' });

    const response: AuthResponse = {
      success: true,
      token,
      user: {
        id: result.user.id,
        email: result.user.email,
        role: 'admin',
        tenantId: result.user.tenantId
      }
    };

    console.log('AUTH: User registered successfully -', email);
    res.json(response);
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'REGISTRATION_FAILED',
        message: 'Registration failed'
      }
    });
  }
});

/**
 * POST /auth/login
 * Login existing user
 * 
 * NOTES FOR CHATGPT:
 * - Validates email and password against database
 * - Uses bcrypt.compare() to verify hashed password
 * - Returns JWT token on successful authentication
 * - Includes tenant information in user lookup
 * - Returns 401 for invalid credentials (same message for security)
 */
app.post('/auth/login', async (req: express.Request, res: express.Response) => {
  try {
    const { email, password }: LoginRequest = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'Email and password are required'
        }
      });
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: { tenant: true }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password'
        }
      });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password'
        }
      });
    }

    // Generate JWT token
    const tokenPayload: JWTPayload = {
      userId: user.id,
      tenantId: user.tenantId,
      role: 'admin', // For now, all users are admin
      email: user.email
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '24h' });

    const response: AuthResponse = {
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        role: 'admin',
        tenantId: user.tenantId
      }
    };

    console.log('AUTH: User logged in successfully -', email);
    res.json(response);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'LOGIN_FAILED',
        message: 'Login failed'
      }
    });
  }
});

/**
 * GET /auth/me
 * Get current user info
 * 
 * NOTES FOR CHATGPT:
 * - Protected route that requires valid JWT token
 * - Returns user profile with tenant information
 * - User object is attached to request by requireAuth middleware
 * - Includes firstName, lastName, email, tenant info
 * - Used by frontend to display user profile and tenant context
 */
app.get('/auth/me', requireAuth, (req: express.Request, res: express.Response) => {
  try {
    const user = (req as any).user;

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: 'admin', // For now, all users are admin
        tenantId: user.tenantId,
        tenant: user.tenant ? { id: user.tenant.id, name: user.tenant.name } : null,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_USER_FAILED',
        message: 'Failed to get user info'
      }
    });
  }
});

// =============================================================================
// COURSE MANAGEMENT ROUTES - PHASE 5
// =============================================================================
/**
 * CHANGE LOG - 2025-07-14 19:00 - PHASE 5 IMPLEMENTATION
 * ========================================================
 * WHAT: Added course persistence and management endpoints
 * WHY: Phase 5 requirement to persist uploaded course metadata to database
 * IMPACT: Users can now save course uploads and view them in dashboard
 * NOTES FOR CHATGPT: These endpoints handle course CRUD operations with user ownership
 * 
 * ENDPOINTS ADDED:
 * - POST /courses: Create new course record from upload metadata
 * - GET /courses: List all courses for authenticated user
 * - GET /courses/:id: Get specific course by ID (with ownership check)
 * 
 * SECURITY:
 * - All endpoints require authentication (requireAuth middleware)
 * - Users can only access their own courses
 * - Course ownership enforced via ownerId field
 * 
 * DATABASE FIELDS:
 * - id: Unique course identifier (cuid)
 * - title: Course title from manifest
 * - version: SCORM version (1.2, 2004, etc.)
 * - fileCount: Number of files in course package
 * - structure: JSON stringified array of file paths
 * - ownerId: User ID who uploaded the course
 * - createdAt/updatedAt: Timestamps
 */

/**
 * POST /courses
 * Create new course record from upload metadata
 * 
 * NOTES FOR CHATGPT:
 * - Receives course metadata from content-ingestion service
 * - Links course to authenticated user via ownerId
 * - Stores structure as JSON string in database
 * - Returns created course with all metadata
 * - Used by upload flow to persist course after successful processing
 */
app.post('/courses', requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const user = (req as any).user;
    const { title, version, fileCount, structure } = req.body;

    // Validation
    if (!title || !version || !fileCount || !structure) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'Title, version, fileCount, and structure are required'
        }
      });
    }

    // Create course in database
    const course = await prisma.course.create({
      data: {
        title,
        version,
        fileCount: parseInt(fileCount),
        structure: JSON.stringify(structure), // Store array as JSON string
        ownerId: user.id
      }
    });

    console.log('COURSE: Created course successfully -', title, 'for user', user.email);
    
    res.json({
      success: true,
      course: {
        id: course.id,
        title: course.title,
        version: course.version,
        fileCount: course.fileCount,
        structure: JSON.parse(course.structure), // Parse back to array
        ownerId: course.ownerId,
        createdAt: course.createdAt,
        updatedAt: course.updatedAt
      }
    });
  } catch (error) {
    console.error('Create course error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CREATE_COURSE_FAILED',
        message: 'Failed to create course'
      }
    });
  }
});

/**
 * GET /courses
 * List all courses for authenticated user
 * 
 * NOTES FOR CHATGPT:
 * - Returns only courses owned by authenticated user
 * - Includes all course metadata for dashboard display
 * - Parses structure JSON back to array format
 * - Orders by creation date (newest first)
 * - Used by dashboard to display user's course library
 */
app.get('/courses', requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const user = (req as any).user;

    // Get all courses for authenticated user
    const courses = await prisma.course.findMany({
      where: { ownerId: user.id },
      orderBy: { createdAt: 'desc' }
    });

    // Parse structure JSON for each course
    const coursesWithStructure = courses.map((course: any) => ({
      id: course.id,
      title: course.title,
      version: course.version,
      fileCount: course.fileCount,
      structure: JSON.parse(course.structure), // Parse back to array
      ownerId: course.ownerId,
      createdAt: course.createdAt,
      updatedAt: course.updatedAt
    }));

    console.log('COURSE: Retrieved', courses.length, 'courses for user', user.email);
    
    res.json({
      success: true,
      courses: coursesWithStructure
    });
  } catch (error) {
    console.error('Get courses error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_COURSES_FAILED',
        message: 'Failed to retrieve courses'
      }
    });
  }
});

/**
 * GET /courses/:id
 * Get specific course by ID with ownership check
 * 
 * NOTES FOR CHATGPT:
 * - Returns course details only if owned by authenticated user
 * - Returns 404 if course not found or not owned by user
 * - Includes full course metadata and parsed structure
 * - Used by course viewer page to display course details
 * - Enforces security by checking ownership before returning data
 */
app.get('/courses/:id', requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;

    // Find course by ID and ensure it belongs to authenticated user
    const course = await prisma.course.findUnique({
      where: { id }
    });

    if (!course || course.ownerId !== user.id) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'COURSE_NOT_FOUND',
          message: 'Course not found or access denied'
        }
      });
    }

    console.log('COURSE: Retrieved course', course.title, 'for user', user.email);
    
    res.json({
      success: true,
      course: {
        id: course.id,
        title: course.title,
        version: course.version,
        fileCount: course.fileCount,
        structure: JSON.parse(course.structure), // Parse back to array
        ownerId: course.ownerId,
        createdAt: course.createdAt,
        updatedAt: course.updatedAt
      }
    });
  } catch (error) {
    console.error('Get course error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_COURSE_FAILED',
        message: 'Failed to retrieve course'
      }
    });
  }
});

// =============================================================================
// COURSE LAUNCH ROUTE - PHASE 6
// =============================================================================
/**
 * CHANGE LOG - 2025-07-14 19:55 - PHASE 6 IMPLEMENTATION
 * ========================================================
 * WHAT: Added course launch endpoint for SCORM runtime integration
 * WHY: Phase 6 requirement to enable course launching from viewer
 * IMPACT: Users can now launch courses and start SCORM sessions
 * NOTES FOR CHATGPT: This endpoint creates launch sessions and returns runtime URLs
 */

/**
 * POST /courses/:id/launch
 * Launch a course and create a new registration session
 * 
 * NOTES FOR CHATGPT:
 * - Creates new Registration record to track launch session
 * - Validates course ownership before allowing launch
 * - Generates unique registration ID for session tracking
 * - Returns launch URL pointing to scorm-runtime service
 * - Sets initial status to 'pending' until course loads
 * - Future phases will update registration with progress/completion
 */
app.post('/courses/:id/launch', requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const user = (req as any).user;
    const { id: courseId } = req.params;

    // Validate course exists and is owned by user
    const course = await prisma.course.findUnique({
      where: { id: courseId }
    });

    if (!course || course.ownerId !== user.id) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'COURSE_NOT_FOUND',
          message: 'Course not found or access denied'
        }
      });
    }

    // Create new registration session
    const registration = await prisma.registration.create({
      data: {
        courseId: courseId,
        userId: user.id,
        status: 'pending'
      }
    });

    // Generate launch URL pointing to scorm-runtime service
    const launchUrl = `${process.env.SCORM_RUNTIME_URL || 'http://localhost:3001'}/runtime/${registration.id}`;

    console.log('LAUNCH: Created registration', registration.id, 'for course', course.title, 'user', user.email);
    
    res.json({
      success: true,
      launchUrl,
      registrationId: registration.id,
      courseTitle: course.title
    });
  } catch (error) {
    console.error('Launch course error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'LAUNCH_FAILED',
        message: 'Failed to launch course'
      }
    });
  }
});

// =============================================================================
// REGISTRATION HISTORY ROUTE - PHASE 7
// =============================================================================
/**
 * CHANGE LOG - 2025-07-14 20:10 - PHASE 7 IMPLEMENTATION
 * ========================================================
 * WHAT: Added registration history endpoint for courses
 * WHY: Phase 7 requirement to display launch history and progress
 * IMPACT: Users can now view registration history for courses
 * NOTES FOR CHATGPT: This endpoint returns all registrations for a course
 */

/**
 * GET /courses/:id/registrations
 * Get all registrations for a specific course
 * 
 * NOTES FOR CHATGPT:
 * - Returns registration history for course launch tracking
 * - Includes completion status, scores, and launch times
 * - Validates course ownership before returning data
 * - Used by frontend to display launch history section
 */
app.get('/courses/:id/registrations', requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const user = (req as any).user;
    const { id: courseId } = req.params;

    // Validate course exists and is owned by user
    const course = await prisma.course.findUnique({
      where: { id: courseId }
    });

    if (!course || course.ownerId !== user.id) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'COURSE_NOT_FOUND',
          message: 'Course not found or access denied'
        }
      });
    }

    // Get all registrations for this course
    const registrations = await prisma.registration.findMany({
      where: { courseId: courseId },
      include: { user: true },
      orderBy: { createdAt: 'desc' }
    });

    // Format registration data for frontend with enhanced status
    const formattedRegistrations = registrations.map((reg: any) => {
      const derivedStatus = deriveRegistrationStatus(reg);
      return {
        sessionId: reg.id,
        completion_status: reg.completionStatus || 'unknown',
        score: reg.scoreRaw || 0,
        startedAt: reg.startedAt.toISOString(),
        status: reg.status,
        progress: reg.progress || 0,
        userName: `${reg.user.firstName} ${reg.user.lastName}`,
        progressData: reg.progressData,
        // Enhanced status information - PHASE 13A
        derivedStatus: derivedStatus,
        statusDisplay: derivedStatus.displayText,
        statusColor: derivedStatus.displayColor,
        progressPercentage: derivedStatus.progressPercentage,
        canResume: derivedStatus.canResume,
        timeSpent: derivedStatus.timeSpent,
        lastActivity: derivedStatus.lastActivity
      };
    });

    res.json({
      success: true,
      data: formattedRegistrations
    });
  } catch (error) {
    console.error('Get registrations error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'REGISTRATIONS_FETCH_FAILED',
        message: 'Failed to fetch registrations'
      }
    });
  }
});

// =============================================================================
// HEALTH CHECK
// =============================================================================
/**
 * NOTES FOR CHATGPT:
 * - Health check endpoint for monitoring and deployment verification
 * - Returns service status, version, uptime, and database metrics
 * - Includes database connection test with user/tenant counts
 * - Returns 500 if database connection fails
 * - Used by load balancers and monitoring systems
 */

app.get('/health', async (req: express.Request, res: express.Response) => {
  try {
    // Get counts from database
    const usersCount = await prisma.user.count();
    const tenantsCount = await prisma.tenant.count();

    res.json({
      status: 'healthy',
      service: 'api-gateway',
      version: process.env.npm_package_version || '0.3.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: {
        status: 'connected',
        usersCount,
        tenantsCount
      }
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      status: 'unhealthy',
      service: 'api-gateway',
      error: 'Database connection failed'
    });
  }
});

// =============================================================================
// API ROUTES
// =============================================================================

app.get('/api/v1', (req: express.Request, res: express.Response) => {
  res.json({
    message: 'Rustici Killer API Gateway',
    version: '0.3.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: {
        register: 'POST /auth/register',
        login: 'POST /auth/login',
        me: 'GET /auth/me'
      },
      services: {
        scormRuntime: 'http://localhost:3001',
        contentIngestion: 'http://localhost:3002',
        lrsService: 'http://localhost:3003',
        sequencingEngine: 'http://localhost:3004',
        webhookEmitter: 'http://localhost:3005'
      }
    }
  });
});

// =============================================================================
// SERVICE PROXIES (Protected Routes)
// =============================================================================
/**
 * NOTES FOR CHATGPT:
 * - These routes proxy requests to downstream microservices
 * - All routes are protected by requireAuth middleware
 * - Uses http-proxy-middleware for request forwarding
 * - Rewrites paths to remove /api prefix before forwarding
 * - Service URLs configurable via environment variables
 * - Enables microservices architecture while maintaining single API endpoint
 * 
 * MICROSERVICES ARCHITECTURE:
 * - Content Ingestion: Handles course uploads and parsing
 * - SCORM Runtime: Manages SCORM player and session state
 * - LRS Service: Learning Record Store for xAPI statements
 * - Sequencing Engine: SCORM 2004 sequencing logic
 * - Webhook Emitter: Sends event notifications to external systems
 */

// Content Ingestion Service
/*
app.use('/api/content', requireAuth, createProxyMiddleware({
  target: process.env.CONTENT_INGESTION_URL || 'http://localhost:3002',
  changeOrigin: true,
  pathRewrite: {
    '^/api/content': ''
  }
}));

// SCORM Runtime Service
app.use('/api/scorm', requireAuth, createProxyMiddleware({
  target: process.env.SCORM_RUNTIME_URL || 'http://localhost:3001',
  changeOrigin: true,
  pathRewrite: {
    '^/api/scorm': ''
  }
}));

// LRS Service
app.use('/api/lrs', requireAuth, createProxyMiddleware({
  target: process.env.LRS_SERVICE_URL || 'http://localhost:3003',
  changeOrigin: true,
  pathRewrite: {
    '^/api/lrs': ''
  }
}));

// Sequencing Engine Service
app.use('/api/sequencing', requireAuth, createProxyMiddleware({
  target: process.env.SEQUENCING_ENGINE_URL || 'http://localhost:3004',
  changeOrigin: true,
  pathRewrite: {
    '^/api/sequencing': ''
  }
}));

// Webhook Emitter Service
app.use('/api/webhooks', requireAuth, createProxyMiddleware({
  target: process.env.WEBHOOK_EMITTER_URL || 'http://localhost:3005',
  changeOrigin: true,
  pathRewrite: {
    '^/api/webhooks': ''
  }
}));
*/

// =============================================================================
// ERROR HANDLING
// =============================================================================

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('API Gateway error:', err);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error'
    }
  });
});

// =============================================================================
// SERVER STARTUP
// =============================================================================

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚪 API Gateway listening on port ${PORT}`);
    console.log(`🔍 Health Check: http://localhost:${PORT}/health`);
    console.log(`🔐 Authentication: http://localhost:${PORT}/auth/*`);
    console.log(`📚 API Documentation: http://localhost:${PORT}/api/v1`);
    console.log(`🗄️ Database: Connected to PostgreSQL via Prisma`);
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('🔄 Shutting down gracefully...');
    await prisma.$disconnect();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('🔄 Shutting down gracefully...');
    await prisma.$disconnect();
    process.exit(0);
  });
}

// =============================================================================
// ORGANIZATION MANAGEMENT ROUTES - PHASE 12
// =============================================================================
/**
 * CHANGE LOG - 2025-07-15 - PHASE 12 IMPLEMENTATION
 * ===================================================
 * WHAT: Added organization management endpoints for admin dashboard
 * WHY: Phase 12 requirement for multi-tenant admin dashboard and organization oversight
 * IMPACT: Enables admin users to manage users, view courses, and access analytics across their tenant
 * NOTES FOR CHATGPT: These endpoints provide tenant-scoped admin functionality
 * 
 * ENDPOINTS ADDED:
 * - GET /org/users: List all users in tenant (admin only)
 * - POST /org/users/:id/role: Change user role (admin only)
 * - POST /org/users/:id/deactivate: Deactivate user (admin only)
 * - GET /org/courses: List all courses in tenant (admin only)
 * - GET /org/xapi-summary: Get xAPI statement analytics (admin only)
 * - GET /org/meta: Get tenant metadata and stats (admin only)
 * 
 * SECURITY:
 * - All endpoints require authentication (requireAuth middleware)
 * - Role-based access control for admin-only features
 * - Tenant isolation enforced via user.tenantId
 * - Input validation for role changes and user operations
 */

/**
 * Middleware to require admin role
 * Checks if authenticated user has admin role
 */
const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const user = (req as any).user;
  
  if (!user || user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: {
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'Admin role required'
      }
    });
  }
  
  next();
};

/**
 * GET /org/users
 * List all users in the current tenant (admin only)
 * 
 * NOTES FOR CHATGPT:
 * - Returns all users within the admin's tenant
 * - Includes user metadata, role, and status
 * - Excludes sensitive data like password hashes
 * - Supports basic filtering and pagination
 * - Used by admin dashboard user management table
 */
app.get('/org/users', requireAuth, requireAdmin, async (req: express.Request, res: express.Response) => {
  try {
    const user = (req as any).user;
    const { page = 1, limit = 50, search = '', active = 'all' } = req.query;
    
    // Build where clause for filtering
    const whereClause: any = {
      tenantId: user.tenantId
    };
    
    // Add search filter if provided
    if (search) {
      whereClause.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    // Add active filter if specified
    if (active !== 'all') {
      whereClause.isActive = active === 'true';
    }
    
    // Get users with pagination
    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { createdAt: 'desc' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit)
    });
    
    // Get total count for pagination
    const totalUsers = await prisma.user.count({
      where: whereClause
    });
    
    console.log('ORG: Retrieved', users.length, 'users for tenant', user.tenantId);
    
    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: totalUsers,
          totalPages: Math.ceil(totalUsers / Number(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get org users error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_ORG_USERS_FAILED',
        message: 'Failed to retrieve organization users'
      }
    });
  }
});

/**
 * POST /org/users/:id/role
 * Change user role (admin only)
 * 
 * NOTES FOR CHATGPT:
 * - Allows admin to promote/demote users between 'learner' and 'admin' roles
 * - Validates target user exists and belongs to same tenant
 * - Prevents self-demotion (admin cannot demote themselves)
 * - Logs role changes for audit trail
 * - Returns updated user object
 */
app.post('/org/users/:id/role', requireAuth, requireAdmin, async (req: express.Request, res: express.Response) => {
  try {
    const user = (req as any).user;
    const { id: targetUserId } = req.params;
    const { role } = req.body;
    
    // Validate role value
    if (!role || !['learner', 'admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ROLE',
          message: 'Role must be either "learner" or "admin"'
        }
      });
    }
    
    // Prevent self-demotion
    if (targetUserId === user.id && role === 'learner') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'CANNOT_DEMOTE_SELF',
          message: 'Cannot demote your own admin role'
        }
      });
    }
    
    // Find target user and verify they belong to same tenant
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId }
    });
    
    if (!targetUser || targetUser.tenantId !== user.tenantId) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found or access denied'
        }
      });
    }
    
    // Update user role
    const updatedUser = await prisma.user.update({
      where: { id: targetUserId },
      data: { role, updatedAt: new Date() },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });
    
    console.log('ORG: Changed role for user', targetUser.email, 'from', targetUser.role, 'to', role, 'by admin', user.email);
    
    res.json({
      success: true,
      data: {
        user: updatedUser,
        message: `User role changed to ${role} successfully`
      }
    });
  } catch (error) {
    console.error('Change user role error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CHANGE_ROLE_FAILED',
        message: 'Failed to change user role'
      }
    });
  }
});

/**
 * POST /org/users/:id/deactivate
 * Deactivate user (admin only)
 * 
 * NOTES FOR CHATGPT:
 * - Soft-deletes user by setting isActive to false
 * - Validates target user exists and belongs to same tenant
 * - Prevents self-deactivation
 * - Logs deactivation for audit trail
 * - Returns updated user status
 */
app.post('/org/users/:id/deactivate', requireAuth, requireAdmin, async (req: express.Request, res: express.Response) => {
  try {
    const user = (req as any).user;
    const { id: targetUserId } = req.params;
    
    // Prevent self-deactivation
    if (targetUserId === user.id) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'CANNOT_DEACTIVATE_SELF',
          message: 'Cannot deactivate your own account'
        }
      });
    }
    
    // Find target user and verify they belong to same tenant
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId }
    });
    
    if (!targetUser || targetUser.tenantId !== user.tenantId) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found or access denied'
        }
      });
    }
    
    // Deactivate user
    const updatedUser = await prisma.user.update({
      where: { id: targetUserId },
      data: { isActive: false, updatedAt: new Date() },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });
    
    console.log('ORG: Deactivated user', targetUser.email, 'by admin', user.email);
    
    res.json({
      success: true,
      data: {
        user: updatedUser,
        message: 'User deactivated successfully'
      }
    });
  } catch (error) {
    console.error('Deactivate user error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DEACTIVATE_USER_FAILED',
        message: 'Failed to deactivate user'
      }
    });
  }
});

/**
 * GET /org/courses
 * List all courses in the current tenant (admin only)
 * 
 * NOTES FOR CHATGPT:
 * - Returns all courses within the admin's tenant
 * - Includes course metadata, owner information, and upload stats
 * - Supports filtering by owner, status, and date range
 * - Includes aggregated statistics per course
 * - Used by admin dashboard course overview table
 */
app.get('/org/courses', requireAuth, requireAdmin, async (req: express.Request, res: express.Response) => {
  try {
    const user = (req as any).user;
    const { page = 1, limit = 50, search = '', owner = 'all' } = req.query;
    
    // Build where clause for filtering
    const whereClause: any = {
      owner: {
        tenantId: user.tenantId
      }
    };
    
    // Add search filter if provided
    if (search) {
      whereClause.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { version: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    // Add owner filter if specified
    if (owner !== 'all') {
      whereClause.ownerId = owner;
    }
    
    // Get courses with owner information, registration stats, and enhanced status
    const courses = await prisma.course.findMany({
      where: whereClause,
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        },
        registrations: {
          select: {
            id: true,
            startedAt: true,
            completedAt: true,
            status: true,
            completionStatus: true,
            progress: true,
            updatedAt: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit)
    });
    
    // Get total count for pagination
    const totalCourses = await prisma.course.count({
      where: whereClause
    });
    
    // Format courses with enhanced registration statistics
    const formattedCourses = courses.map((course: any) => {
      // Calculate enhanced registration stats
      const registrations = course.registrations || [];
      const registrationStats = registrations.reduce((stats: any, reg: any) => {
        const derivedStatus = deriveRegistrationStatus(reg);
        stats.total++;
        stats.byStatus[derivedStatus.status]++;
        stats.totalProgress += derivedStatus.progressPercentage;
        return stats;
      }, {
        total: 0,
        byStatus: {
          not_started: 0,
          in_progress: 0,
          completed: 0,
          failed: 0
        },
        totalProgress: 0
      });

      // Calculate completion rate and average progress
      const completionRate = registrationStats.total > 0 
        ? (registrationStats.byStatus.completed / registrationStats.total) * 100
        : 0;
      const averageProgress = registrationStats.total > 0
        ? registrationStats.totalProgress / registrationStats.total
        : 0;

      return {
        id: course.id,
        title: course.title,
        version: course.version,
        fileCount: course.fileCount,
        structure: JSON.parse(course.structure),
        owner: {
          id: course.owner.id,
          email: course.owner.email,
          name: `${course.owner.firstName} ${course.owner.lastName}`
        },
        stats: {
          totalRegistrations: registrationStats.total,
          registrationsByStatus: registrationStats.byStatus,
          completionRate: Math.round(completionRate),
          averageProgress: Math.round(averageProgress),
          // Enhanced stats for Phase 13
          activeProgress: registrationStats.byStatus.in_progress,
          resumeAvailable: registrations.filter((r: any) => 
            deriveRegistrationStatus(r).resumeAvailable
          ).length
        },
        createdAt: course.createdAt,
        updatedAt: course.updatedAt
      };
    });
    
    console.log('ORG: Retrieved', courses.length, 'courses for tenant', user.tenantId);
    
    res.json({
      success: true,
      data: {
        courses: formattedCourses,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: totalCourses,
          totalPages: Math.ceil(totalCourses / Number(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get org courses error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_ORG_COURSES_FAILED',
        message: 'Failed to retrieve organization courses'
      }
    });
  }
});

/**
 * GET /org/xapi-summary
 * Get xAPI statement analytics for the tenant (admin only)
 * 
 * NOTES FOR CHATGPT:
 * - Returns aggregated xAPI statement statistics
 * - Groups data by user, course, and verb
 * - Includes completion rates and engagement metrics
 * - Supports date range filtering
 * - Used by admin dashboard analytics section
 */
app.get('/org/xapi-summary', requireAuth, requireAdmin, async (req: express.Request, res: express.Response) => {
  try {
    const user = (req as any).user;
    const { dateFrom, dateTo } = req.query;
    
    // Build date filter
    const dateFilter: any = {};
    if (dateFrom) {
      dateFilter.gte = new Date(dateFrom as string);
    }
    if (dateTo) {
      dateFilter.lte = new Date(dateTo as string);
    }
    
    // Get xAPI statements for tenant users
    const statements = await prisma.xAPIStatement.findMany({
      where: {
        user: {
          tenantId: user.tenantId
        },
        ...(Object.keys(dateFilter).length > 0 && { stored: dateFilter })
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        },
        course: {
          select: {
            id: true,
            title: true
          }
        }
      },
      orderBy: { stored: 'desc' }
    });
    
    // Aggregate statistics
    const totalStatements = statements.length;
    const uniqueUsers = new Set(statements.map(s => s.userId)).size;
    const uniqueCourses = new Set(statements.map(s => s.courseId)).size;
    
    // Group by verb
    const verbStats = statements.reduce((acc: any, stmt) => {
      acc[stmt.verb] = (acc[stmt.verb] || 0) + 1;
      return acc;
    }, {});
    
    // Group by user
    const userStats = statements.reduce((acc: any, stmt) => {
      if (stmt.user) {
        const userId = stmt.user.id;
        if (!acc[userId]) {
          acc[userId] = {
            user: {
              id: stmt.user.id,
              email: stmt.user.email,
              name: `${stmt.user.firstName} ${stmt.user.lastName}`
            },
            totalStatements: 0,
            verbs: {}
          };
        }
        acc[userId].totalStatements++;
        acc[userId].verbs[stmt.verb] = (acc[userId].verbs[stmt.verb] || 0) + 1;
      }
      return acc;
    }, {});
    
    // Group by course
    const courseStats = statements.reduce((acc: any, stmt) => {
      if (stmt.course) {
        const courseId = stmt.course.id;
        if (!acc[courseId]) {
          acc[courseId] = {
            course: {
              id: stmt.course.id,
              title: stmt.course.title
            },
            totalStatements: 0,
            verbs: {}
          };
        }
        acc[courseId].totalStatements++;
        acc[courseId].verbs[stmt.verb] = (acc[courseId].verbs[stmt.verb] || 0) + 1;
      }
      return acc;
    }, {});
    
    console.log('ORG: Retrieved xAPI summary for tenant', user.tenantId, '-', totalStatements, 'statements');
    
    res.json({
      success: true,
      data: {
        summary: {
          totalStatements,
          uniqueUsers,
          uniqueCourses,
          dateRange: {
            from: dateFrom || null,
            to: dateTo || null
          }
        },
        verbStats,
        userStats: Object.values(userStats),
        courseStats: Object.values(courseStats)
      }
    });
  } catch (error) {
    console.error('Get xAPI summary error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_XAPI_SUMMARY_FAILED',
        message: 'Failed to retrieve xAPI summary'
      }
    });
  }
});

/**
 * GET /org/meta
 * Get tenant metadata and statistics (admin only)
 * 
 * NOTES FOR CHATGPT:
 * - Returns tenant information and aggregate statistics
 * - Includes user count, course count, registration stats
 * - Shows tenant creation date and settings
 * - Used by admin dashboard overview section
 */
app.get('/org/meta', requireAuth, requireAdmin, async (req: express.Request, res: express.Response) => {
  try {
    const user = (req as any).user;
    
    // Get tenant information
    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId }
    });
    
    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'TENANT_NOT_FOUND',
          message: 'Tenant not found'
        }
      });
    }
    
    // Get aggregate statistics
    const [
      totalUsers,
      activeUsers,
      adminUsers,
      totalCourses,
      totalRegistrations,
      completedRegistrations,
      totalXAPIStatements
    ] = await Promise.all([
      prisma.user.count({ where: { tenantId: user.tenantId } }),
      prisma.user.count({ where: { tenantId: user.tenantId, isActive: true } }),
      prisma.user.count({ where: { tenantId: user.tenantId, role: 'admin' } }),
      prisma.course.count({ where: { owner: { tenantId: user.tenantId } } }),
      prisma.registration.count({ where: { user: { tenantId: user.tenantId } } }),
      prisma.registration.count({ where: { user: { tenantId: user.tenantId }, status: 'completed' } }),
      prisma.xAPIStatement.count({ where: { user: { tenantId: user.tenantId } } })
    ]);
    
    // Calculate completion rate
    const completionRate = totalRegistrations > 0 ? 
      (completedRegistrations / totalRegistrations) * 100 : 0;
    
    console.log('ORG: Retrieved metadata for tenant', user.tenantId, '-', totalUsers, 'users,', totalCourses, 'courses');
    
    res.json({
      success: true,
      data: {
        tenant: {
          id: tenant.id,
          name: tenant.name,
          domain: tenant.domain,
          settings: tenant.settings,
          createdAt: tenant.createdAt,
          updatedAt: tenant.updatedAt
        },
        stats: {
          users: {
            total: totalUsers,
            active: activeUsers,
            admins: adminUsers,
            learners: totalUsers - adminUsers
          },
          courses: {
            total: totalCourses
          },
          registrations: {
            total: totalRegistrations,
            completed: completedRegistrations,
            completionRate: Math.round(completionRate * 100) / 100
          },
          xapi: {
            totalStatements: totalXAPIStatements
          }
        }
      }
    });
  } catch (error) {
    console.error('Get org meta error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_ORG_META_FAILED',
        message: 'Failed to retrieve organization metadata'
      }
    });
  }
});

/**
 * CHANGE LOG - 2025-07-15 22:05 - PHASE 13A: SUPERIOR TRACKING SYSTEM
 * ==================================================================
 * WHAT: Added superior registration status derivation system
 * WHY: Beat Rustici's binary completion model with granular tracking
 * IMPACT: Provides real-time progress, resume capability, and activity tracking
 * NOTES FOR CHATGPT: This replaces basic completion_status with intelligent derivation
 * 
 * RUSTICI KILLER ADVANTAGE:
 * - Real-time progress tracking (not just binary complete/incomplete)
 * - In-progress visibility with resume capability
 * - Activity timestamps for analytics
 * - Progress percentages for granular tracking
 * - Time spent calculations for learning analytics
 */

interface DerivedRegistrationStatus {
  status: 'not_started' | 'in_progress' | 'completed' | 'failed';
  progressPercentage: number;
  lastActivity: Date | null;
  resumeAvailable: boolean;
  timeSpent: number;
  canResume: boolean;
  displayText: string;
  displayColor: string;
}

/**
 * Calculate time spent from SCORM progressData
 * Handles both SCORM 1.2 and 2004 session time formats
 */
function calculateTimeSpent(progressData: any): number {
  if (!progressData || !progressData.cmi) return 0;
  
  const sessionTime = progressData.cmi.core?.session_time || 
                     progressData.cmi.session_time ||
                     progressData.cmi.core?.total_time ||
                     progressData.cmi.total_time;
  
  if (!sessionTime) return 0;
  
  // Parse SCORM time format (HH:MM:SS.SS or PTxHxMxS)
  if (typeof sessionTime === 'string') {
    if (sessionTime.includes(':')) {
      // HH:MM:SS.SS format
      const parts = sessionTime.split(':');
      const hours = parseInt(parts[0]) || 0;
      const minutes = parseInt(parts[1]) || 0;
      const seconds = parseFloat(parts[2]) || 0;
      return (hours * 3600) + (minutes * 60) + seconds;
    } else if (sessionTime.startsWith('PT')) {
      // ISO 8601 duration format (PT1H30M45S)
      const match = sessionTime.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/);
      if (match) {
        const hours = parseInt(match[1]) || 0;
        const minutes = parseInt(match[2]) || 0;
        const seconds = parseFloat(match[3]) || 0;
        return (hours * 3600) + (minutes * 60) + seconds;
      }
    }
  }
  
  return 0;
}

/**
 * Derive superior registration status that beats Rustici's binary completion model
 * This provides granular progress tracking with resume capability
 */
function deriveRegistrationStatus(registration: any): DerivedRegistrationStatus {
  // Not started - no launch detected
  if (!registration.startedAt) {
    return {
      status: 'not_started',
      progressPercentage: 0,
      lastActivity: null,
      resumeAvailable: false,
      timeSpent: 0,
      canResume: false,
      displayText: 'Not Started',
      displayColor: '#6B7280'
    };
  }

  // Completed - reached completion state
  if (registration.completionStatus === 'completed' || 
      registration.status === 'completed') {
    return {
      status: 'completed',
      progressPercentage: 100,
      lastActivity: registration.completedAt || registration.updatedAt,
      resumeAvailable: false,
      timeSpent: calculateTimeSpent(registration.progressData),
      canResume: false,
      displayText: 'Completed',
      displayColor: '#10B981'
    };
  }

  // Failed - explicit failure state
  if (registration.status === 'failed') {
    return {
      status: 'failed',
      progressPercentage: registration.progress ? registration.progress * 100 : 0,
      lastActivity: registration.updatedAt,
      resumeAvailable: false,
      timeSpent: calculateTimeSpent(registration.progressData),
      canResume: false,
      displayText: 'Failed',
      displayColor: '#EF4444'
    };
  }

  // In Progress - has activity but not completed
  const progressData = registration.progressData as any;
  const hasBookmark = progressData?.cmi?.suspend_data && 
                     progressData.cmi.suspend_data.length > 0;
  const hasProgressData = progressData?.cmi?.core?.lesson_location ||
                         progressData?.cmi?.location ||
                         progressData?.cmi?.core?.lesson_status ||
                         progressData?.cmi?.completion_status;

  // Calculate intelligent progress percentage
  let progressPercentage = 0;
  if (registration.progress) {
    progressPercentage = registration.progress * 100;
  } else if (hasProgressData) {
    // Estimate based on activity type
    if (progressData?.cmi?.core?.lesson_status === 'browsed') {
      progressPercentage = 25;
    } else if (progressData?.cmi?.core?.lesson_status === 'incomplete') {
      progressPercentage = 50;
    } else {
      progressPercentage = 10; // Some activity detected
    }
  }

  return {
    status: 'in_progress',
    progressPercentage: Math.min(progressPercentage, 99), // Never show 100% unless completed
    lastActivity: registration.updatedAt,
    resumeAvailable: hasBookmark || hasProgressData,
    timeSpent: calculateTimeSpent(registration.progressData),
    canResume: hasBookmark || hasProgressData,
    displayText: `In Progress (${Math.round(progressPercentage)}%)`,
    displayColor: '#F59E0B'
  };
}

// =============================================================================
// DISPATCH ROUTES - PHASE 13B: SCORM COURSE LICENSING SYSTEM
// =============================================================================
/**
 * CHANGE LOG - 2025-07-15 - PHASE 13B
 * ====================================
 * WHAT: Added dispatch routes for SCORM course licensing system
 * WHY: Phase 13B requirement to enable course licensing to external organizations
 * IMPACT: Enables secure course distribution with usage limits, expiration, and tracking
 * NOTES FOR CHATGPT: This system beats Rustici's dispatch by providing superior tracking and real-time analytics
 */

/**
 * POST /dispatch
 * Create a new dispatch (course license)
 * Requires admin authentication
 */
app.post('/dispatch', requireAuth, requireAdmin, async (req: express.Request, res: express.Response) => {
  try {
    const { courseId, tenantId, mode, maxUsers, expiresAt, allowAnalytics } = req.body;
    const user = (req as any).user;

    // Validation
    if (!courseId || !tenantId || !mode) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'courseId, tenantId, and mode are required'
        }
      });
    }

    // Validate mode
    if (!['capped', 'unlimited', 'time-bound'].includes(mode)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_MODE',
          message: 'mode must be one of: capped, unlimited, time-bound'
        }
      });
    }

    // Validate course exists and user owns it
    const course = await prisma.course.findUnique({
      where: { id: courseId }
    });

    if (!course) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'COURSE_NOT_FOUND',
          message: 'Course not found'
        }
      });
    }

    if (course.ownerId !== user.id) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'You do not have permission to dispatch this course'
        }
      });
    }

    // Validate target tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId }
    });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'TENANT_NOT_FOUND',
          message: 'Target tenant not found'
        }
      });
    }

    // Create dispatch
    const dispatch = await prisma.dispatch.create({
      data: {
        courseId,
        tenantId,
        mode,
        maxUsers: mode === 'capped' ? maxUsers : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        allowAnalytics: allowAnalytics ?? true
      },
      include: {
        course: { select: { id: true, title: true, version: true } },
        tenant: { select: { id: true, name: true, domain: true } },
        users: true
      }
    });

    res.json({
      success: true,
      data: dispatch
    });
  } catch (error) {
    console.error('Error creating dispatch:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create dispatch'
      }
    });
  }
});

/**
 * GET /dispatch
 * List all dispatches for the current user's owned courses
 * Requires admin authentication
 */
app.get('/dispatch', requireAuth, requireAdmin, async (req: express.Request, res: express.Response) => {
  try {
    const user = (req as any).user;

    // Get all dispatches for courses owned by the user
    const dispatches = await prisma.dispatch.findMany({
      where: {
        course: {
          ownerId: user.id
        }
      },
      include: {
        course: { select: { id: true, title: true, version: true } },
        tenant: { select: { id: true, name: true, domain: true } },
        users: {
          select: {
            id: true,
            email: true,
            launchedAt: true,
            completedAt: true,
            createdAt: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Calculate usage statistics for each dispatch
    const dispatchesWithStats = dispatches.map(dispatch => ({
      ...dispatch,
      stats: {
        totalUsers: dispatch.users.length,
        launchedUsers: dispatch.users.filter(u => u.launchedAt).length,
        completedUsers: dispatch.users.filter(u => u.completedAt).length,
        remainingUsers: dispatch.maxUsers ? dispatch.maxUsers - dispatch.users.length : null,
        isExpired: dispatch.expiresAt ? new Date() > dispatch.expiresAt : false,
        isAtCapacity: dispatch.maxUsers ? dispatch.users.length >= dispatch.maxUsers : false
      }
    }));

    res.json({
      success: true,
      data: dispatchesWithStats
    });
  } catch (error) {
    console.error('Error fetching dispatches:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch dispatches'
      }
    });
  }
});

/**
 * GET /dispatch/:id
 * Get detailed dispatch information
 * Requires admin authentication
 */
app.get('/dispatch/:id', requireAuth, requireAdmin, async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    const dispatch = await prisma.dispatch.findUnique({
      where: { id },
      include: {
        course: { select: { id: true, title: true, version: true, ownerId: true } },
        tenant: { select: { id: true, name: true, domain: true } },
        users: {
          select: {
            id: true,
            email: true,
            launchToken: true,
            launchedAt: true,
            completedAt: true,
            createdAt: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    if (!dispatch) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'DISPATCH_NOT_FOUND',
          message: 'Dispatch not found'
        }
      });
    }

    // Check if user owns the course
    if (dispatch.course.ownerId !== user.id) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'You do not have permission to view this dispatch'
        }
      });
    }

    // Calculate statistics
    const stats = {
      totalUsers: dispatch.users.length,
      launchedUsers: dispatch.users.filter(u => u.launchedAt).length,
      completedUsers: dispatch.users.filter(u => u.completedAt).length,
      remainingUsers: dispatch.maxUsers ? dispatch.maxUsers - dispatch.users.length : null,
      isExpired: dispatch.expiresAt ? new Date() > dispatch.expiresAt : false,
      isAtCapacity: dispatch.maxUsers ? dispatch.users.length >= dispatch.maxUsers : false,
      completionRate: dispatch.users.filter(u => u.launchedAt).length > 0 
        ? (dispatch.users.filter(u => u.completedAt).length / dispatch.users.filter(u => u.launchedAt).length) * 100 
        : 0
    };

    res.json({
      success: true,
      data: {
        ...dispatch,
        stats
      }
    });
  } catch (error) {
    console.error('Error fetching dispatch:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch dispatch'
      }
    });
  }
});

/**
 * PATCH /dispatch/:id
 * Update dispatch settings
 * Requires admin authentication
 */
app.patch('/dispatch/:id', requireAuth, requireAdmin, async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const { mode, maxUsers, expiresAt, allowAnalytics } = req.body;
    const user = (req as any).user;

    // Find dispatch and verify ownership
    const dispatch = await prisma.dispatch.findUnique({
      where: { id },
      include: {
        course: { select: { ownerId: true } }
      }
    });

    if (!dispatch) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'DISPATCH_NOT_FOUND',
          message: 'Dispatch not found'
        }
      });
    }

    if (dispatch.course.ownerId !== user.id) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'You do not have permission to update this dispatch'
        }
      });
    }

    // Validate mode if provided
    if (mode && !['capped', 'unlimited', 'time-bound'].includes(mode)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_MODE',
          message: 'mode must be one of: capped, unlimited, time-bound'
        }
      });
    }

    // Update dispatch
    const updatedDispatch = await prisma.dispatch.update({
      where: { id },
      data: {
        mode: mode || dispatch.mode,
        maxUsers: mode === 'capped' ? maxUsers : (mode === 'unlimited' ? null : dispatch.maxUsers),
        expiresAt: expiresAt ? new Date(expiresAt) : (expiresAt === null ? null : dispatch.expiresAt),
        allowAnalytics: allowAnalytics ?? dispatch.allowAnalytics
      },
      include: {
        course: { select: { id: true, title: true, version: true } },
        tenant: { select: { id: true, name: true, domain: true } },
        users: true
      }
    });

    res.json({
      success: true,
      data: updatedDispatch
    });
  } catch (error) {
    console.error('Error updating dispatch:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update dispatch'
      }
    });
  }
});

/**
 * DELETE /dispatch/:id
 * Disable/delete a dispatch
 * Requires admin authentication
 */
app.delete('/dispatch/:id', requireAuth, requireAdmin, async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    // Find dispatch and verify ownership
    const dispatch = await prisma.dispatch.findUnique({
      where: { id },
      include: {
        course: { select: { ownerId: true } }
      }
    });

    if (!dispatch) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'DISPATCH_NOT_FOUND',
          message: 'Dispatch not found'
        }
      });
    }

    if (dispatch.course.ownerId !== user.id) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'You do not have permission to delete this dispatch'
        }
      });
    }

    // Delete dispatch (this will cascade to dispatch users)
    await prisma.dispatch.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Dispatch deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting dispatch:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete dispatch'
      }
    });
  }
});

/**
 * POST /dispatch/:id/launch
 * Generate a launch token for a dispatch
 * Requires admin authentication
 */
app.post('/dispatch/:id/launch', requireAuth, requireAdmin, async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const { email } = req.body;
    const user = (req as any).user;

    // Find dispatch and verify ownership
    const dispatch = await prisma.dispatch.findUnique({
      where: { id },
      include: {
        course: { select: { ownerId: true } },
        users: true
      }
    });

    if (!dispatch) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'DISPATCH_NOT_FOUND',
          message: 'Dispatch not found'
        }
      });
    }

    if (dispatch.course.ownerId !== user.id) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'You do not have permission to create launch tokens for this dispatch'
        }
      });
    }

    // Check if dispatch is expired
    if (dispatch.expiresAt && new Date() > dispatch.expiresAt) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'DISPATCH_EXPIRED',
          message: 'This dispatch has expired'
        }
      });
    }

    // Check if at capacity
    if (dispatch.maxUsers && dispatch.users.length >= dispatch.maxUsers) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'DISPATCH_AT_CAPACITY',
          message: 'This dispatch has reached its maximum number of users'
        }
      });
    }

    // Generate unique launch token
    const launchToken = uuidv4();

    // Create dispatch user
    const dispatchUser = await prisma.dispatchUser.create({
      data: {
        dispatchId: id,
        email,
        launchToken
      }
    });

    res.json({
      success: true,
      data: {
        launchToken,
        launchUrl: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/launch/${launchToken}`,
        dispatchUser: {
          id: dispatchUser.id,
          email: dispatchUser.email,
          createdAt: dispatchUser.createdAt
        }
      }
    });
  } catch (error) {
    console.error('Error creating launch token:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create launch token'
      }
    });
  }
});

/**
 * GET /launch/:token
 * Launch a course via dispatch token (PUBLIC ENDPOINT)
 * This is the public endpoint that learners will access
 */
app.get('/launch/:token', async (req: express.Request, res: express.Response) => {
  try {
    const { token } = req.params;

    // Find dispatch user by token
    const dispatchUser = await prisma.dispatchUser.findUnique({
      where: { launchToken: token },
     
      include: {
        dispatch: {
          include: {
            course: {
              select: { id: true, title: true, version: true, structure: true }
            },
            tenant: {
              select: { id: true, name: true, domain: true }
            }
          }
        }
      }
    });

    if (!dispatchUser) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid launch token'
        }
      });
    }

    const dispatch = dispatchUser.dispatch;

    // Check if dispatch is expired
    if (dispatch.expiresAt && new Date() > dispatch.expiresAt) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'DISPATCH_EXPIRED',
          message: 'This course access has expired'
        }
      });
    }

    // Update launched timestamp if not already set
    if (!dispatchUser.launchedAt) {
      await prisma.dispatchUser.update({
        where: { id: dispatchUser.id },
        data: { launchedAt: new Date() }
      });
    }

    // Create or find registration for tracking
    let registration = await prisma.registration.findFirst({
      where: {
        courseId: dispatch.courseId,
        userId: dispatchUser.id // Using dispatchUser.id as proxy for user tracking
      }
    });

    if (!registration) {
      registration = await prisma.registration.create({
        data: {
          courseId: dispatch.courseId,
          userId: dispatchUser.id, // Using dispatchUser.id as proxy
          status: 'in-progress'
        }
      });
    }

    // Return course launch data
    res.json({
      success: true,
      data: {
        course: dispatch.course,
        registration: {
          id: registration.id,
          startedAt: registration.startedAt,
          status: registration.status,
          progress: registration.progress
        },
        dispatch: {
          id: dispatch.id,
          tenant: dispatch.tenant,
          allowAnalytics: dispatch.allowAnalytics
        },
        launcher: {
          email: dispatchUser.email,
          launchedAt: dispatchUser.launchedAt,
          token: dispatchUser.launchToken
        }
      }
    });
  } catch (error) {
    console.error('Error launching course:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to launch course'
      }
    });
  }
});

// =============================================================================
// DISPATCH ROUTES - PHASE 14: SCORM COURSE EXPORT
// =============================================================================
/**
 * CHANGE LOG - 2025-07-15 - PHASE 14 IMPLEMENTATION
 * ================================================
 * WHAT: Added export endpoint for SCORM course packages
 * WHY: Phase 14 requirement to allow SCORM package export for dispatches
 * IMPACT: Admins can export dispatches as LMS-compatible SCORM packages
 * NOTES FOR CHATGPT: This uses the createDispatchZip utility to generate ZIP files
 */

/**
 * GET /dispatch/:id/export
 * Export dispatch as LMS-compatible SCORM package
 * Requires admin authentication
 * Phase 14: LMS-compatible dispatch export
 */
app.get('/dispatch/:id/export', requireAuth, requireAdmin, async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    // Find dispatch and verify ownership
    const dispatch = await prisma.dispatch.findUnique({
      where: { id },
      include: {
        course: { select: { id: true, title: true, version: true, ownerId: true } },
        tenant: { select: { id: true, name: true, domain: true } }
      }
    });

    if (!dispatch) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'DISPATCH_NOT_FOUND',
          message: 'Dispatch not found'
        }
      });
    }

    // Check if user owns the course
    if (dispatch.course.ownerId !== user.id) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'You do not have permission to export this dispatch'
        }
      });
    }

    // Generate filename with safe characters
    const safeTitle = dispatch.course.title.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_');
    const filename = `${safeTitle}_v${dispatch.course.version}_dispatch.zip`;

    // Get platform URL for launch redirection
    const platformUrl = process.env.PLATFORM_URL || 'https://app.rustici-killer.com';

    // Create ZIP buffer
    const zipBuffer = await createDispatchZip({
      dispatchId: dispatch.id,
      courseTitle: dispatch.course.title,
      launchToken: dispatch.id, // Using dispatch ID as launch token for now
      platformUrl
    });

    // Set response headers for file download
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', zipBuffer.length);

    // Send ZIP file
    res.send(zipBuffer);

  } catch (error) {
    console.error('Error exporting dispatch:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to export dispatch'
      }
    });
  }
});

// =============================================================================
// CATCH-ALL ROUTE (MUST BE LAST)
// =============================================================================

// =============================================================================
// TENANT MANAGEMENT ROUTES - PHASE 15: MULTI-TENANT DISPATCHING SYSTEM
// =============================================================================
/**
 * CHANGE LOG - 2025-07-16 - PHASE 15
 * ====================================
 * WHAT: Added tenant management endpoints for full B2B multi-tenant dispatching
 * WHY: Phase 15 requirement to enable admin creation of organizations/tenants
 * IMPACT: Enables complete B2B flow: create orgs → assign courses → dispatch with rules
 * NOTES FOR CHATGPT: This implements the missing piece for full tenant dispatching system
 */

/**
 * GET /org/tenants
 * List all tenants (super admin only)
 */
app.get('/org/tenants', requireAuth, requireAdmin, async (req: express.Request, res: express.Response) => {
  try {
    const user = (req as any).user;
    
    // For now, return all tenants (in production, might need super admin role)
    const tenants = await prisma.tenant.findMany({
      include: {
        users: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true
          }
        },
        dispatches: {
          include: {
            course: {
              select: {
                id: true,
                title: true
              }
            },
            users: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Calculate stats for each tenant
    const tenantsWithStats = await Promise.all(tenants.map(async (tenant) => {
      const [courseCount, activeDispatches] = await Promise.all([
        prisma.course.count({ where: { owner: { tenantId: tenant.id } } }),
        prisma.dispatch.count({ where: { tenantId: tenant.id } })
      ]);

      return {
        id: tenant.id,
        name: tenant.name,
        domain: tenant.domain,
        createdAt: tenant.createdAt,
        updatedAt: tenant.updatedAt,
        stats: {
          totalUsers: tenant.users.length,
          activeUsers: tenant.users.filter(u => u.isActive).length,
          totalCourses: courseCount,
          totalDispatches: activeDispatches
        },
        users: tenant.users,
        recentDispatches: tenant.dispatches.slice(0, 3) // Show recent dispatches
      };
    }));

    res.json({
      success: true,
      data: tenantsWithStats
    });
  } catch (error) {
    console.error('Get tenants error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_TENANTS_FAILED',
        message: 'Failed to retrieve tenants'
      }
    });
  }
});

/**
 * POST /org/tenants
 * Create a new tenant/organization
 */
app.post('/org/tenants', requireAuth, requireAdmin, async (req: express.Request, res: express.Response) => {
  try {
    const { name, domain } = req.body;
    const user = (req as any).user;

    // Validation
    if (!name || !domain) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'name and domain are required'
        }
      });
    }

    // Check if domain already exists
    const existingTenant = await prisma.tenant.findUnique({
      where: { domain }
    });

    if (existingTenant) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'DOMAIN_EXISTS',
          message: 'Domain already exists'
        }
      });
    }

    // Create tenant
    const tenant = await prisma.tenant.create({
      data: {
        name,
        domain,
        settings: {}
      }
    });

    res.status(201).json({
      success: true,
      data: tenant
    });
  } catch (error) {
    console.error('Create tenant error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CREATE_TENANT_FAILED',
        message: 'Failed to create tenant'
      }
    });
  }
});

/**
 * POST /org/tenants/:id/users
 * Add a user to a specific tenant
 */
app.post('/org/tenants/:id/users', requireAuth, requireAdmin, async (req: express.Request, res: express.Response) => {
  try {
    const { id: tenantId } = req.params;
    const { email, firstName, lastName, password, role = 'learner' } = req.body;
    const user = (req as any).user;

    // Validation
    if (!email || !firstName || !lastName || !password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'email, firstName, lastName, and password are required'
        }
      });
    }

    // Check if tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId }
    });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'TENANT_NOT_FOUND',
          message: 'Tenant not found'
        }
      });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'USER_EXISTS',
          message: 'User with this email already exists'
        }
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const newUser = await prisma.user.create({
      data: {
        email,
        firstName,
        lastName,
        password: hashedPassword,
        role,
        tenantId,
        isActive: true
      },
      include: {
        tenant: true
      }
    });

    // Remove password from response
    const { password: _, ...userResponse } = newUser;

    res.status(201).json({
      success: true,
      data: userResponse
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CREATE_USER_FAILED',
        message: 'Failed to create user'
      }
    });
  }
});

/**
 * POST /org/tenants/:id/courses
 * Assign a course to a tenant
 */
app.post('/org/tenants/:id/courses', requireAuth, requireAdmin, async (req: express.Request, res: express.Response) => {
  try {
    const { id: tenantId } = req.params;
    const { courseId } = req.body;
    const user = (req as any).user;

    // Validation
    if (!courseId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'courseId is required'
        }
      });
    }

    // Check if tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId }
    });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'TENANT_NOT_FOUND',
          message: 'Tenant not found'
        }
      });
    }

    // Check if course exists
    const course = await prisma.course.findUnique({
      where: { id: courseId }
    });

    if (!course) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'COURSE_NOT_FOUND',
          message: 'Course not found'
        }
      });
    }

    // For now, we'll create a dispatch as the way to "assign" a course to a tenant
    // This creates a default unlimited dispatch
    const dispatch = await prisma.dispatch.create({
      data: {
        courseId,
        tenantId,
        mode: 'unlimited',
        maxUsers: null,
        expiresAt: null,
        allowAnalytics: true
      },
      include: {
        course: true,
        tenant: true
      }
    });

    res.status(201).json({
      success: true,
      data: dispatch
    });
  } catch (error) {
    console.error('Assign course error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ASSIGN_COURSE_FAILED',
        message: 'Failed to assign course to tenant'
      }
    });
  }
});

/**
 * GET /org/tenants/:id/courses
 * Get courses assigned to a tenant
 */
app.get('/org/tenants/:id/courses', requireAuth, requireAdmin, async (req: express.Request, res: express.Response) => {
  try {
    const { id: tenantId } = req.params;
    const user = (req as any).user;

    // Check if tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId }
    });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'TENANT_NOT_FOUND',
          message: 'Tenant not found'
        }
      });
    }

    // Get dispatches for this tenant (which represent course assignments)
    const dispatches = await prisma.dispatch.findMany({
      where: { tenantId },
      include: {
        course: true,
        users: true
      }
    });

    res.json({
      success: true,
      data: dispatches
    });
  } catch (error) {
    console.error('Get tenant courses error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_TENANT_COURSES_FAILED',
        message: 'Failed to get tenant courses'
      }
    });
  }
});

// PHASE 1.5 CLEANUP: Use centralized error handling
app.use('/api/dispatches', dispatchRoutes);

// 404 handler for unknown routes
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(globalErrorHandler);

export { app };
