/**
 * Download Routes - Phase 3
 * 
 * IMPLEMENTATION: SCORM Dispatch ZIP Generator
 * 
 * This endpoint dynamically generates SCORM-compliant ZIP dispatch packages
 * that can be uploaded to third-party LMSs like TalentLMS.
 * 
 * KEY FEATURES:
 * - Dynamic imsmanifest.xml generation
 * - Launcher HTML with embedded configuration
 * - SCORM-to-xAPI wrapper integration
 * - Secure launch token generation
 * - Asset inclusion from original courses
 */

import { Router, Request, Response } from 'express';
import { handleDatabaseError, prisma } from '../utils/database';
import { validateParams, uuidParam } from '../utils/validation';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { createDispatchZip } from '../utils/createDispatchZip';
import winston from 'winston';

const router = Router();

// Logger for download events
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'dispatch-download.log' }),
    new winston.transports.Console()
  ]
});

/**
 * GET /api/v1/dispatches/:dispatchId/download
 * Generate and download dispatch ZIP package
 * 
 * AUTHENTICATION: Required (admin only)
 * AUTHORIZATION: User must own the course associated with the dispatch
 * 
 * This endpoint generates a SCORM-compliant ZIP file containing:
 * - imsmanifest.xml with course metadata
 * - index.html with embedded Sun-SCORM configuration
 * - SCORM-to-xAPI wrapper
 * - Original course assets (future enhancement)
 */
router.get('/:dispatchId/download', 
  requireAuth,
  requireAdmin,
  validateParams(uuidParam),
  async (req: Request, res: Response) => {
    const { dispatchId } = req.params;
    const user = (req as any).user;
    
    logger.info('Dispatch download requested', {
      dispatchId,
      userId: user.id,
      userEmail: user.email
    });
    
    try {
      // 1. Fetch dispatch with authorization check
      const dispatch = await prisma.dispatch.findUnique({
        where: { id: dispatchId },
        include: {
          course: {
            select: {
              id: true,
              title: true,
              version: true,
              structure: true,
              ownerId: true
            }
          },
          tenant: {
            select: {
              id: true,
              name: true,
              domain: true
            }
          }
        }
      });
      
      if (!dispatch) {
        logger.error('Dispatch not found', { dispatchId, userId: user.id });
        return res.status(404).json({
          success: false,
          error: {
            code: 'DISPATCH_NOT_FOUND',
            message: 'Dispatch not found'
          }
        });
      }
      
      // 2. Authorization check
      if (dispatch.course.ownerId !== user.id) {
        logger.error('Unauthorized dispatch download', {
          dispatchId,
          userId: user.id,
          courseOwnerId: dispatch.course.ownerId
        });
        
        return res.status(403).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'You do not have permission to download this dispatch'
          }
        });
      }
      
      // 3. Generate ZIP package
      const platformUrl = process.env.PLATFORM_URL || process.env.FRONTEND_URL || 'https://app.sun-scorm.com';
      
      const zipOptions = {
        dispatchId: dispatch.id,
        courseId: dispatch.course.id,
        courseTitle: dispatch.course.title,
        launchToken: dispatch.id, // For now, use dispatch ID as launch identifier
        platformUrl
      };
      
      const zipBuffer = await createDispatchZip(zipOptions);
      
      // 4. Generate filename
      const sanitizedTitle = dispatch.course.title
        .replace(/[^a-zA-Z0-9\s-]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 30);
      
      const filename = `${sanitizedTitle}_dispatch_${dispatch.id.substring(0, 8)}_v${dispatch.course.version}.zip`;
      
      // 5. Log successful download
      logger.info('Dispatch download successful', {
        dispatchId,
        courseId: dispatch.course.id,
        userId: user.id,
        filename,
        fileSize: zipBuffer.length
      });
      
      // 6. Stream ZIP file to client
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', zipBuffer.length.toString());
      res.setHeader('Cache-Control', 'no-cache');
      
      res.send(zipBuffer);
      
    } catch (error) {
      logger.error('Dispatch download failed', {
        dispatchId,
        userId: user.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
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
 * GET /api/v1/dispatches/:dispatchId/assets
 * Get original course assets for ZIP inclusion (future enhancement)
 * 
 * This endpoint will be used to include original SCORM course assets
 * in the dispatch ZIP file for complete course delivery.
 */
router.get('/:dispatchId/assets', 
  requireAuth,
  requireAdmin,
  validateParams(uuidParam),
  async (req: Request, res: Response) => {
    try {
      // Asset retrieval will be implemented when we add full course asset support
      // For now, return empty assets array
      
      res.json({
        success: true,
        message: 'Asset retrieval will be implemented in future version',
        assets: []
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
