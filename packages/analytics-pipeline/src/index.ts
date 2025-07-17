/**
 * Statement Forwarder/Transformer Service
 * 
 * This service acts as a middleware between SCORM content and the Yet Analytics SQL LRS.
 * It receives xAPI statements from the SCORM-to-xAPI wrapper, performs validation,
 * transformation, and forwards them to the SQL LRS for storage and analysis.
 * 
 * Key Features:
 * - Statement validation against xAPI specification
 * - Tenant-based statement isolation and security
 * - Batch processing for high-volume scenarios
 * - Real-time statement forwarding to SQL LRS
 * - Comprehensive logging and monitoring
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';
import Joi from 'joi';
import dotenv from 'dotenv';
import { RateLimiterMemory } from 'rate-limiter-flexible';

// Load environment variables
dotenv.config();

// Logger configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Database connection pool
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'lrsql',
  user: process.env.DB_USER || 'lrsql',
  password: process.env.DB_PASSWORD || 'lrsql_password',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Rate limiter
const rateLimiter = new RateLimiterMemory({
  keyPrefix: 'statement_forwarder',
  points: parseInt(process.env.RATE_LIMIT_MAX || '1000'),
  duration: parseInt(process.env.RATE_LIMIT_WINDOW || '900'), // 15 minutes
});

// Express app
const app = express();
const PORT = process.env.PORT || 3006;

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3001'],
  credentials: true
}));
app.use(morgan('combined', { stream: { write: (message: string) => logger.info(message.trim()) } }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// xAPI Statement Schema Validation
const xapiActorSchema = Joi.object({
  name: Joi.string().required(),
  mbox: Joi.string().email().optional(),
  account: Joi.object({
    homePage: Joi.string().uri().required(),
    name: Joi.string().required()
  }).optional()
}).xor('mbox', 'account');

const xapiVerbSchema = Joi.object({
  id: Joi.string().uri().required(),
  display: Joi.object().pattern(Joi.string(), Joi.string()).optional()
});

const xapiObjectSchema = Joi.object({
  id: Joi.string().uri().required(),
  definition: Joi.object({
    type: Joi.string().uri().optional(),
    name: Joi.object().pattern(Joi.string(), Joi.string()).optional(),
    description: Joi.object().pattern(Joi.string(), Joi.string()).optional(),
    interactionType: Joi.string().optional()
  }).optional()
});

const xapiResultSchema = Joi.object({
  completion: Joi.boolean().optional(),
  success: Joi.boolean().optional(),
  score: Joi.object({
    raw: Joi.number().optional(),
    min: Joi.number().optional(),
    max: Joi.number().optional(),
    scaled: Joi.number().min(-1).max(1).optional()
  }).optional(),
  response: Joi.string().optional(),
  duration: Joi.string().optional()
});

const xapiContextSchema = Joi.object({
  registration: Joi.string().uuid().optional(),
  contextActivities: Joi.object({
    parent: Joi.array().items(xapiObjectSchema).optional(),
    grouping: Joi.array().items(xapiObjectSchema).optional(),
    category: Joi.array().items(xapiObjectSchema).optional(),
    other: Joi.array().items(xapiObjectSchema).optional()
  }).optional(),
  instructor: xapiActorSchema.optional(),
  team: xapiActorSchema.optional(),
  platform: Joi.string().optional(),
  language: Joi.string().optional()
});

const xapiStatementSchema = Joi.object({
  id: Joi.string().uuid().optional(),
  actor: xapiActorSchema.required(),
  verb: xapiVerbSchema.required(),
  object: xapiObjectSchema.required(),
  result: xapiResultSchema.optional(),
  context: xapiContextSchema.optional(),
  timestamp: Joi.string().isoDate().optional(),
  stored: Joi.string().isoDate().optional(),
  authority: xapiActorSchema.optional()
});

// Statement Transformer Class
class StatementTransformer {
  /**
   * Transform and validate xAPI statement
   */
  static async transform(statement: any): Promise<any> {
    // Validate against xAPI schema
    const { error, value } = xapiStatementSchema.validate(statement);
    if (error) {
      throw new Error(`Invalid xAPI statement: ${error.details[0].message}`);
    }

    // Add required fields if missing
    if (!value.id) {
      value.id = uuidv4();
    }
    if (!value.timestamp) {
      value.timestamp = new Date().toISOString();
    }

    // Normalize verb display
    if (!value.verb.display) {
      const verbId = value.verb.id;
      const verbName = verbId.split('/').pop() || verbId;
      value.verb.display = { 'en-US': verbName };
    }

    // Ensure object definition exists
    if (!value.object.definition) {
      value.object.definition = {
        type: 'http://adlnet.gov/expapi/activities/interaction'
      };
    }

    return value;
  }

  /**
   * Extract tenant information from statement
   */
  static extractTenantInfo(statement: any): { tenantId: string; dispatchId: string } {
    const context = statement.context;
    if (!context?.contextActivities?.grouping) {
      throw new Error('Statement missing tenant context information');
    }

    const grouping = context.contextActivities.grouping;
    const tenantActivity = grouping.find((activity: any) => 
      activity.id?.startsWith('tenant:')
    );

    if (!tenantActivity) {
      throw new Error('Statement missing tenant activity in context');
    }

    const tenantId = tenantActivity.id.replace('tenant:', '');
    const dispatchId = context.registration;

    if (!dispatchId) {
      throw new Error('Statement missing dispatch registration');
    }

    return { tenantId, dispatchId };
  }
}

// Statement Forwarder Class
class StatementForwarder {
  private readonly lrsEndpoint: string;
  private readonly lrsAuth: string;

  constructor() {
    this.lrsEndpoint = process.env.LRS_ENDPOINT || 'http://localhost:8080/xapi';
    const username = process.env.LRS_USERNAME || 'admin';
    const password = process.env.LRS_PASSWORD || 'admin_password';
    this.lrsAuth = Buffer.from(`${username}:${password}`).toString('base64');
  }

  /**
   * Forward statement to Yet Analytics SQL LRS
   */
  async forwardStatement(statement: any): Promise<void> {
    try {
      const response = await fetch(`${this.lrsEndpoint}/statements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${this.lrsAuth}`,
          'X-Experience-API-Version': '1.0.3'
        },
        body: JSON.stringify(statement)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LRS rejected statement: ${response.status} ${response.statusText} - ${errorText}`);
      }

      logger.info('Statement forwarded to LRS successfully', {
        statementId: statement.id,
        actor: statement.actor.name,
        verb: statement.verb.id
      });
    } catch (error) {
      logger.error('Failed to forward statement to LRS', {
        error: error instanceof Error ? error.message : 'Unknown error',
        statementId: statement.id
      });
      throw error;
    }
  }

  /**
   * Store statement metadata in local database
   */
  async storeStatementMetadata(statement: any, tenantId: string, dispatchId: string): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query(`
        INSERT INTO statement_metadata (
          statement_id, tenant_id, dispatch_id, actor_name, verb_id, 
          object_id, timestamp, processed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (statement_id) DO UPDATE SET
          processed_at = EXCLUDED.processed_at
      `, [
        statement.id,
        tenantId,
        dispatchId,
        statement.actor.name,
        statement.verb.id,
        statement.object.id,
        statement.timestamp,
        new Date().toISOString()
      ]);

      logger.debug('Statement metadata stored', {
        statementId: statement.id,
        tenantId,
        dispatchId
      });
    } catch (error) {
      logger.error('Failed to store statement metadata', {
        error: error instanceof Error ? error.message : 'Unknown error',
        statementId: statement.id
      });
      throw error;
    } finally {
      client.release();
    }
  }
}

// Initialize services
const statementForwarder = new StatementForwarder();

// Middleware: Rate limiting
/**
 * Middleware to apply rate limiting to incoming requests based on IP address.
 * @example
 * sync(req, res, next)
 * No return value, proceeds with the next middleware or sends a 429 error response if rate limit is exceeded.
 * @param {express.Request} req - Express request object containing details of the incoming request.
 * @param {express.Response} res - Express response object used to send responses back to the client.
 * @param {express.NextFunction} next - Express next function to proceed to the next middleware.
 * @returns {void} No return value, used as a middleware function.
 * @description
 *   - Utilizes `rateLimiter` to track request consumption based on IP.
 *   - Sends a JSON response with status 429 if the rate limit is exceeded.
 *   - Logs a warning with the IP address and remaining points when rate limit is exceeded.
 */
const rateLimitMiddleware = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const key = req.ip || 'unknown';
    await rateLimiter.consume(key);
    next();
  } catch (rejRes: any) {
    logger.warn('Rate limit exceeded', { ip: req.ip, resRemainingPoints: rejRes.remainingPoints });
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.'
    });
  }
};

// Middleware: Tenant validation
/**
* Middleware function to validate tenant and dispatch credentials from request headers.
* @example
* sync(req, res, next)
* // If valid headers are present, calls next(), otherwise responds with error status.
* @param {express.Request} req - The request object containing headers for validation.
* @param {express.Response} res - The response object used for sending error messages.
* @param {express.NextFunction} next - The next middleware function in the stack to be called if validation passes.
* @returns {void} No return value. It directly modifies the request object or sends a response.
* @description
*   - Checks for the presence of 'x-tenant-id' and 'x-dispatch-id' headers.
*   - Verifies tenant and dispatch validity using a database query.
*   - Adds tenantId and dispatchId to the request object if validation is successful.
*   - Logs errors and handles different error states by sending appropriate HTTP response codes and messages.
*/
const tenantValidationMiddleware = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string;
    const dispatchId = req.headers['x-dispatch-id'] as string;

    if (!tenantId || !dispatchId) {
      return res.status(400).json({
        error: 'Missing Headers',
        message: 'x-tenant-id and x-dispatch-id headers are required'
      });
    }

    // Validate tenant/dispatch in database
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT 1 FROM dispatches WHERE id = $1 AND tenant_id = $2 AND status = $3',
        [dispatchId, tenantId, 'active']
      );

      if (result.rows.length === 0) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Invalid tenant or dispatch credentials'
        });
      }
    } finally {
      client.release();
    }

    req.tenantId = tenantId;
    req.dispatchId = dispatchId;
    next();
  } catch (error) {
    logger.error('Tenant validation failed', { error: error instanceof Error ? error.message : 'Unknown error' });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to validate tenant credentials'
    });
  }
};

// Routes

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'statement-forwarder',
    version: '1.0.0'
  });
});

// Statement forwarding endpoint
app.post('/statements', rateLimitMiddleware, tenantValidationMiddleware, async (req, res) => {
  try {
    const statement = req.body;
    
    // Transform and validate statement
    const transformedStatement = await StatementTransformer.transform(statement);
    
    // Extract tenant information
    const { tenantId, dispatchId } = StatementTransformer.extractTenantInfo(transformedStatement);
    
    // Verify tenant matches headers
    if (tenantId !== req.tenantId || dispatchId !== req.dispatchId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Statement tenant/dispatch mismatch with headers'
      });
    }

    // Forward to LRS
    await statementForwarder.forwardStatement(transformedStatement);
    
    // Store metadata
    await statementForwarder.storeStatementMetadata(transformedStatement, tenantId, dispatchId);

    res.status(200).json({
      success: true,
      statementId: transformedStatement.id,
      message: 'Statement processed successfully'
    });

  } catch (error) {
    logger.error('Statement processing failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      body: req.body
    });

    res.status(400).json({
      error: 'Bad Request',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Batch statement processing endpoint
app.post('/statements/batch', rateLimitMiddleware, tenantValidationMiddleware, async (req, res) => {
  try {
    const statements = req.body;
    
    if (!Array.isArray(statements)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Request body must be an array of statements'
      });
    }

    const results = [];
    const errors = [];

    for (let i = 0; i < statements.length; i++) {
      try {
        const statement = statements[i];
        
        // Transform and validate statement
        const transformedStatement = await StatementTransformer.transform(statement);
        
        // Extract tenant information
        const { tenantId, dispatchId } = StatementTransformer.extractTenantInfo(transformedStatement);
        
        // Verify tenant matches headers
        if (tenantId !== req.tenantId || dispatchId !== req.dispatchId) {
          throw new Error('Statement tenant/dispatch mismatch with headers');
        }

        // Forward to LRS
        await statementForwarder.forwardStatement(transformedStatement);
        
        // Store metadata
        await statementForwarder.storeStatementMetadata(transformedStatement, tenantId, dispatchId);

        results.push({
          index: i,
          statementId: transformedStatement.id,
          success: true
        });

      } catch (error) {
        errors.push({
          index: i,
          error: error instanceof Error ? error.message : 'Unknown error',
          success: false
        });
      }
    }

    res.status(200).json({
      success: errors.length === 0,
      processed: results.length,
      failed: errors.length,
      results,
      errors
    });

  } catch (error) {
    logger.error('Batch statement processing failed', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to process batch statements'
    });
  }
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method
  });

  res.status(500).json({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred'
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`Statement Forwarder Service started on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// TypeScript declaration augmentation
declare global {
  namespace Express {
    interface Request {
      tenantId: string;
      dispatchId: string;
    }
  }
}

export default app;
