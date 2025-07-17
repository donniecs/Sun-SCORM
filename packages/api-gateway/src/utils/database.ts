/**
 * Database Utilities
 * 
 * PHASE 1.5 CLEANUP: Centralized database operations
 * 
 * WHY: Eliminates redundant database queries and validation logic
 * IMPACT: Single source of truth for common database operations
 * 
 * Based on Gemini's recommendation to:
 * - Centralize course validation
 * - Standardize error handling
 * - Prepare for advanced license enforcement
 */

import { PrismaClient } from '@prisma/client';
import { mockPrisma } from './mockDatabase';

// Try to use real Prisma, fallback to mock
let prisma: any;
try {
  prisma = new PrismaClient();
} catch (error) {
  console.warn('Prisma not available, using mock database for development');
  prisma = mockPrisma;
}

// Export prisma instance for use in other modules
export { prisma };

/**
 * Course validation utilities
 */
export class CourseService {
  /**
   * Validate course exists and user has access
   * Used by: /courses/:id/launch, /dispatch endpoints
   */
  static async validateCourseAccess(courseId: string, userId: string) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        owner: {
          select: { id: true, tenantId: true, tenant: { select: { id: true, name: true, domain: true } } }
        }
      }
    });

    if (!course) {
      throw new Error('COURSE_NOT_FOUND');
    }

    if (course.ownerId !== userId) {
      throw new Error('UNAUTHORIZED_COURSE_ACCESS');
    }

    return course;
  }

  /**
   * Get course with full metadata
   * Used by: course upload, dispatch creation
   */
  static async getCourseWithMetadata(courseId: string) {
    return prisma.course.findUnique({
      where: { id: courseId },
      include: {
        owner: {
          select: { id: true, tenantId: true, tenant: { select: { id: true, name: true, domain: true } } }
        },
        dispatches: {
          include: {
            users: true,
            tenant: { select: { id: true, name: true, domain: true } }
          }
        }
      }
    });
  }
}

/**
 * Dispatch validation utilities
 */
export class DispatchService {
  /**
   * Validate dispatch exists and user has access
   * Used by: /dispatch/:id/launch, /dispatch/:id/export
   */
  static async validateDispatchAccess(dispatchId: string, userId: string) {
    const dispatch = await prisma.dispatch.findUnique({
      where: { id: dispatchId },
      include: {
        course: { select: { id: true, title: true, ownerId: true } },
        tenant: { select: { id: true, name: true, domain: true } },
        users: true
      }
    });

    if (!dispatch) {
      throw new Error('DISPATCH_NOT_FOUND');
    }

    if (dispatch.course.ownerId !== userId) {
      throw new Error('UNAUTHORIZED_DISPATCH_ACCESS');
    }

    return dispatch;
  }

  /**
   * Check dispatch license constraints
   * Used by: /dispatch/:id/launch
   */
  static async checkLicenseConstraints(dispatchId: string) {
    const dispatch = await prisma.dispatch.findUnique({
      where: { id: dispatchId },
      include: { users: true }
    });

    if (!dispatch) {
      throw new Error('DISPATCH_NOT_FOUND');
    }

    // Check expiration
    if (dispatch.expiresAt && new Date() > dispatch.expiresAt) {
      throw new Error('DISPATCH_EXPIRED');
    }

    // Check user capacity
    if (dispatch.maxUsers && dispatch.users.length >= dispatch.maxUsers) {
      throw new Error('DISPATCH_AT_CAPACITY');
    }

    return dispatch;
  }

  /**
   * Add user to dispatch with constraints check
   * Used by: /dispatch/:id/launch
   */
  static async addUserToDispatch(dispatchId: string, email: string, launchToken: string) {
    // Check constraints first
    await this.checkLicenseConstraints(dispatchId);

    // Create dispatch user
    return prisma.dispatchUser.create({
      data: {
        dispatchId,
        email,
        launchToken
      }
    });
  }
}

/**
 * Tenant validation utilities
 */
export class TenantService {
  /**
   * Validate tenant exists
   * Used by: /dispatch creation, /org/tenants endpoints
   */
  static async validateTenantExists(tenantId: string) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId }
    });

    if (!tenant) {
      throw new Error('TENANT_NOT_FOUND');
    }

    return tenant;
  }

  /**
   * Get tenant with comprehensive statistics
   * Used by: /org/tenants endpoint
   */
  static async getTenantWithStats(tenantId: string) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        users: true,
        dispatches: {
          include: {
            course: { select: { id: true, title: true } },
            users: true
          }
        }
      }
    });

    if (!tenant) {
      throw new Error('TENANT_NOT_FOUND');
    }

    // Calculate statistics
    const stats = {
      totalUsers: tenant.users.length,
      activeUsers: tenant.users.filter(u => u.isActive).length, // Use isActive field instead of lastLoginAt
      totalCourses: new Set(tenant.dispatches.map(d => d.courseId)).size,
      totalDispatches: tenant.dispatches.length
    };

    return {
      ...tenant,
      stats,
      recentDispatches: tenant.dispatches.slice(0, 3)
    };
  }
}

/**
 * Error handling utilities
 */
export class DatabaseError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

/**
 * Convert database errors to standardized format
 */
export function handleDatabaseError(error: any) {
  if (error.message === 'COURSE_NOT_FOUND') {
    return new DatabaseError('COURSE_NOT_FOUND', 'Course not found', 404);
  }
  
  if (error.message === 'UNAUTHORIZED_COURSE_ACCESS') {
    return new DatabaseError('UNAUTHORIZED', 'You do not have permission to access this course', 403);
  }
  
  if (error.message === 'DISPATCH_NOT_FOUND') {
    return new DatabaseError('DISPATCH_NOT_FOUND', 'Dispatch not found', 404);
  }
  
  if (error.message === 'UNAUTHORIZED_DISPATCH_ACCESS') {
    return new DatabaseError('UNAUTHORIZED', 'You do not have permission to access this dispatch', 403);
  }
  
  if (error.message === 'DISPATCH_EXPIRED') {
    return new DatabaseError('DISPATCH_EXPIRED', 'This dispatch has expired', 400);
  }
  
  if (error.message === 'DISPATCH_AT_CAPACITY') {
    return new DatabaseError('DISPATCH_AT_CAPACITY', 'This dispatch has reached its maximum number of users', 400);
  }
  
  if (error.message === 'TENANT_NOT_FOUND') {
    return new DatabaseError('TENANT_NOT_FOUND', 'Tenant not found', 404);
  }
  
  // Default to internal error
  return new DatabaseError('INTERNAL_ERROR', 'An internal error occurred', 500);
}

export { prisma };
export default prisma;
