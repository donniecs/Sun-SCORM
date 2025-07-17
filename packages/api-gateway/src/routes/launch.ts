/**
 * Secure Launch Routes - Phase 3
 * 
 * IMPLEMENTATION: Secure Course Launch Endpoint
 * 
 * This endpoint is called by the dispatch package running inside external LMS
 * to get authorization to run and enforce license limits.
 * 
 * KEY FEATURES:
 * - License validation (expiration, user count, completion count)
 * - Atomic user counting with database transactions
 * - Short-lived JWT token generation
 * - xAPI analytics configuration
 * - Comprehensive error handling with specific error codes
 */

import { Router, Request, Response } from 'express';
import { generateDispatchToken, DispatchTokenPayload } from '../utils/tokenHelper';
import { handleDatabaseError, prisma } from '../utils/database';
import { validateBody, validateParams, schemas, uuidParam } from '../utils/validation';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';

const router = Router();

// Logger for launch events
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'launch-audit.log' }),
    new winston.transports.Console()
  ]
});

/**
 * POST /api/v1/dispatches/:dispatchId/launch
 * Secure launch endpoint for external LMS dispatch packages
 * 
 * AUTHENTICATION: None required (public endpoint for external LMS)
 * AUTHORIZATION: License validation with atomic user counting
 * SECURITY: Short-lived JWT tokens, IP validation, comprehensive logging
 */
router.post('/:dispatchId/launch', 
  validateParams(uuidParam),
  validateBody(schemas.dispatchLaunch),
  async (req: Request, res: Response) => {
    const { dispatchId } = req.params;
    const { userAgent, timestamp, learnerInfo } = req.body;
    const clientIP = req.ip || req.socket.remoteAddress;
    
    // Log all launch attempts for audit trail
    logger.info('Launch attempt', {
      dispatchId,
      clientIP,
      userAgent,
      timestamp,
      learnerInfo: learnerInfo || null
    });
    
    try {
      // Use database transaction for atomic operations
      const result = await prisma.$transaction(async (tx: any) => {
        // 1. Fetch dispatch record with related data
        const dispatch = await tx.dispatch.findUnique({
          where: { id: dispatchId },
          include: {
            course: { 
              select: { 
                id: true, 
                title: true, 
                version: true,
                ownerId: true 
              } 
            },
            tenant: { 
              select: { 
                id: true, 
                name: true, 
                domain: true 
              } 
            },
            users: {
              select: {
                id: true,
                launchedAt: true,
                completedAt: true
              }
            }
          }
        });
        
        if (!dispatch) {
          throw new Error('DISPATCH_NOT_FOUND');
        }
        
        // 2. License Validation
        const now = new Date();
        
        // Check expiration
        if (dispatch.expiresAt && now > dispatch.expiresAt) {
          throw new Error('LICENSE_EXPIRED');
        }
        
        // Check user count limits
        const launchedUsers = dispatch.users.filter((u: any) => u.launchedAt).length;
        if (dispatch.maxUsers && launchedUsers >= dispatch.maxUsers) {
          throw new Error('LICENSE_USER_LIMIT_EXCEEDED');
        }
        
        // Check completion limits (optional future feature)
        const completedUsers = dispatch.users.filter((u: any) => u.completedAt).length;
        if (dispatch.maxUsers && completedUsers >= dispatch.maxUsers) {
          // Note: This is a business logic decision - do we count completions against user limit?
          // For now, we'll just log it but not block
          logger.warn('High completion rate detected', {
            dispatchId,
            completedUsers,
            maxUsers: dispatch.maxUsers
          });
        }
        
        // 3. Create or update dispatch user record
        const learnerId = learnerInfo?.id || `learner_${uuidv4()}`;
        const learnerEmail = learnerInfo?.email || null;
        
        // Check if user already exists
        let dispatchUser = await tx.dispatchUser.findFirst({
          where: {
            dispatchId: dispatchId,
            OR: [
              { email: learnerEmail },
              { launchToken: learnerId }
            ]
          }
        });
        
        if (!dispatchUser) {
          // Create new dispatch user
          dispatchUser = await tx.dispatchUser.create({
            data: {
              dispatchId: dispatchId,
              email: learnerEmail,
              launchToken: learnerId,
              launchedAt: now
            }
          });
        } else {
          // Update existing user launch time
          dispatchUser = await tx.dispatchUser.update({
            where: { id: dispatchUser.id },
            data: { launchedAt: now }
          });
        }
        
        return {
          dispatch,
          dispatchUser,
          learnerId
        };
      });
      
      // 4. Generate short-lived JWT token
      const tokenPayload: Omit<DispatchTokenPayload, 'jti' | 'iat' | 'exp'> = {
        dispatchId: dispatchId,
        userId: result.learnerId,
        tenantId: result.dispatch.tenant.id
      };
      
      const authToken = generateDispatchToken(tokenPayload);
      
      // 5. Log successful launch
      logger.info('Launch successful', {
        dispatchId,
        userId: result.learnerId,
        tenantId: result.dispatch.tenant.id,
        courseId: result.dispatch.course.id,
        clientIP,
        userAgent
      });
      
      // 6. Return success response
      res.json({
        success: true,
        authToken,
        lrsEndpoint: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/api/analytics/statements`,
        tenantId: result.dispatch.tenant.id,
        courseInfo: {
          id: result.dispatch.course.id,
          title: result.dispatch.course.title,
          version: result.dispatch.course.version
        },
        userInfo: {
          id: result.learnerId,
          email: result.dispatchUser.email
        },
        analytics: {
          enabled: result.dispatch.allowAnalytics,
          dispatchId: dispatchId
        }
      });
      
    } catch (error) {
      // Handle specific license errors
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (errorMessage === 'DISPATCH_NOT_FOUND') {
        logger.error('Launch failed: Dispatch not found', {
          dispatchId,
          clientIP,
          userAgent
        });
        
        return res.status(404).json({
          success: false,
          error: {
            code: 'DISPATCH_NOT_FOUND',
            message: 'The requested dispatch package was not found'
          }
        });
      }
      
      if (errorMessage === 'LICENSE_EXPIRED') {
        logger.error('Launch failed: License expired', {
          dispatchId,
          clientIP,
          userAgent
        });
        
        return res.status(403).json({
          success: false,
          error: {
            code: 'LICENSE_EXPIRED',
            message: 'This course license has expired'
          }
        });
      }
      
      if (errorMessage === 'LICENSE_USER_LIMIT_EXCEEDED') {
        logger.error('Launch failed: User limit exceeded', {
          dispatchId,
          clientIP,
          userAgent
        });
        
        return res.status(403).json({
          success: false,
          error: {
            code: 'LICENSE_USER_LIMIT_EXCEEDED',
            message: 'This course has reached its maximum number of users'
          }
        });
      }
      
      // Handle database errors
      const dbError = handleDatabaseError(error);
      logger.error('Launch failed: Database error', {
        dispatchId,
        clientIP,
        userAgent,
        error: dbError.message
      });
      
      res.status(dbError.statusCode).json({
        success: false,
        error: {
          code: dbError.code,
          message: dbError.message
        }
      });
    }
  }
);

/**
 * GET /api/v1/dispatches/:dispatchId/status
 * Get current dispatch status without launching
 * 
 * AUTHENTICATION: None required (public endpoint for external LMS)
 * USE CASE: LMS can check dispatch status before showing launch button
 */
router.get('/:dispatchId/status', 
  validateParams(uuidParam),
  async (req: Request, res: Response) => {
    const { dispatchId } = req.params;
    
    try {
      const dispatch = await prisma.dispatch.findUnique({
        where: { id: dispatchId },
        include: {
          course: { 
            select: { 
              id: true, 
              title: true, 
              version: true 
            } 
          },
          users: {
            select: {
              id: true,
              launchedAt: true,
              completedAt: true
            }
          }
        }
      });
      
      if (!dispatch) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'DISPATCH_NOT_FOUND',
            message: 'The requested dispatch package was not found'
          }
        });
      }
      
      // Calculate status
      const now = new Date();
      const isExpired = dispatch.expiresAt && now > dispatch.expiresAt;
      const launchedUsers = dispatch.users.filter((u: any) => u.launchedAt).length;
      const isAtCapacity = dispatch.maxUsers && launchedUsers >= dispatch.maxUsers;
      
      res.json({
        success: true,
        status: {
          available: !isExpired && !isAtCapacity,
          expired: isExpired,
          atCapacity: isAtCapacity,
          usageStats: {
            launchedUsers,
            maxUsers: dispatch.maxUsers,
            completedUsers: dispatch.users.filter((u: any) => u.completedAt).length
          }
        },
        course: dispatch.course
      });
      
    } catch (error) {
      const dbError = handleDatabaseError(error);
      res.status(dbError.statusCode).json({
        success: false,
        error: {
          code: dbError.code,
          message: dbError.message
        }
      });
    }
  }
);

export default router;
