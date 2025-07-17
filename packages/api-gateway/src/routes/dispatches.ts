/**
 * Dispatch Routes
 * 
 * PHASE 1.5 CLEANUP: Separated dispatch endpoints
 * 
 * WHY: Eliminates massive single-file API structure
 * IMPACT: Improved maintainability and organization
 * 
 * Based on Gemini's recommendation to:
 * - Separate dispatch creation from package generation
 * - Centralize license enforcement logic
 * - Improve token generation consistency
 */

import { Router, Request, Response } from 'express';
import { generateLaunchToken } from '../utils/tokenHelper';
import { DispatchService, CourseService, TenantService, handleDatabaseError, prisma } from '../utils/database';
import { validateBody, validateParams, schemas, uuidParam } from '../utils/validation';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { createDispatchZip } from '../utils/createDispatchZip';

const router = Router();

/**
 * POST /dispatch
 * Create a new dispatch (database record only)
 * 
 * PHASE 1.5 CLEANUP: Separated from package generation
 * - Only creates dispatch record in database
 * - Package generation handled by separate endpoint
 */
router.post('/', 
  requireAuth, 
  requireAdmin, 
  validateBody(schemas.dispatchCreation),
  async (req: Request, res: Response) => {
    try {
      const { courseId, tenantId, mode, maxUsers, expiresAt, allowAnalytics } = req.body;
      const user = (req as any).user;

      // Validate course access
      await CourseService.validateCourseAccess(courseId, user.id);

      // Validate tenant exists
      await TenantService.validateTenantExists(tenantId);

      // Create dispatch record
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

/**
 * GET /dispatch
 * List all dispatches for current user's courses
 */
router.get('/', 
  requireAuth, 
  requireAdmin, 
  async (req: Request, res: Response) => {
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
          users: true
        },
        orderBy: { createdAt: 'desc' }
      });

      // Calculate statistics for each dispatch
      const dispatchesWithStats = dispatches.map((dispatch: any) => {
        const launchedUsers = dispatch.users.filter((u: any) => u.launchedAt).length;
        const completedUsers = dispatch.users.filter((u: any) => u.completedAt).length;
        const totalUsers = dispatch.users.length;
        
        // Calculate usage rate
        let usageRate = 'Unlimited';
        if (dispatch.maxUsers) {
          usageRate = ((totalUsers / dispatch.maxUsers) * 100).toFixed(1) + '%';
        }
        
        // Calculate remaining statistics
        const remainingUsers = dispatch.maxUsers ? Math.max(0, dispatch.maxUsers - totalUsers) : null;
        const remainingDays = dispatch.expiresAt ? 
          Math.max(0, Math.floor((new Date(dispatch.expiresAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))) : 
          null;
        
        // Calculate status
        const isExpired = dispatch.expiresAt ? new Date() > dispatch.expiresAt : false;
        const isAtCapacity = dispatch.maxUsers ? totalUsers >= dispatch.maxUsers : false;
        
        // Calculate completion rate
        const completionRate = launchedUsers > 0 ? (completedUsers / launchedUsers) * 100 : 0;
        
        return {
          ...dispatch,
          stats: {
            totalUsers,
            launchedUsers,
            completedUsers,
            usageRate,
            remainingUsers,
            remainingDays,
            isExpired,
            isAtCapacity,
            completionRate
          }
        };
      });

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
  }
);

/**
 * GET /dispatch/:id
 * Get specific dispatch details
 */
router.get('/:id', 
  requireAuth, 
  requireAdmin, 
  validateParams(uuidParam),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const user = (req as any).user;

      // Validate dispatch access
      const dispatch = await DispatchService.validateDispatchAccess(id, user.id);

      res.json({
        success: true,
        data: dispatch
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

/**
 * POST /dispatch/:id/launch
 * Generate launch token for dispatch
 * 
 * PHASE 1.5 CLEANUP: Centralized token generation
 * - Uses centralized token helper
 * - Improved license enforcement
 */
router.post('/:id/launch', 
  requireAuth, 
  requireAdmin, 
  validateParams(uuidParam),
  validateBody(schemas.launchTokenGeneration),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { email } = req.body;
      const user = (req as any).user;

      // Validate dispatch access
      await DispatchService.validateDispatchAccess(id, user.id);

      // Generate launch token using centralized helper
      const launchToken = generateLaunchToken();

      // Add user to dispatch with license checks
      const dispatchUser = await DispatchService.addUserToDispatch(id, email, launchToken);

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

/**
 * GET /dispatch/:id/export
 * Generate and download dispatch package
 * 
 * PHASE 1.5 CLEANUP: Separated from dispatch creation
 * - Dedicated endpoint for package generation
 * - Improved error handling
 */
router.get('/:id/export', 
  requireAuth, 
  requireAdmin, 
  validateParams(uuidParam),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const user = (req as any).user;

      // Validate dispatch access
      const dispatch = await DispatchService.validateDispatchAccess(id, user.id);

      // Generate dispatch package
      const zipOptions = {
        dispatchId: dispatch.id,
        courseId: dispatch.courseId,
        courseTitle: dispatch.course.title,
        launchToken: 'temp-token', // This will be replaced with actual launch token generation
        platformUrl: process.env.FRONTEND_URL || 'http://localhost:3001'
      };
      
      const zipBuffer = await createDispatchZip(zipOptions);

      // Set appropriate headers for file download
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="dispatch-${dispatch.course.title}-${dispatch.id}.zip"`);
      res.setHeader('Content-Length', zipBuffer.length);

      res.send(zipBuffer);
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

/**
 * DELETE /dispatch/:id
 * Delete dispatch
 */
router.delete('/:id', 
  requireAuth, 
  requireAdmin, 
  validateParams(uuidParam),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const user = (req as any).user;

      // Validate dispatch access
      await DispatchService.validateDispatchAccess(id, user.id);

      // Delete dispatch
      await prisma.dispatch.delete({
        where: { id }
      });

      res.json({
        success: true,
        message: 'Dispatch deleted successfully'
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
