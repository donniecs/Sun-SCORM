/**
 * Validation Utilities
 * 
 * PHASE 1.5 CLEANUP: Centralized validation logic
 * 
 * WHY: Eliminates redundant validation code across endpoints
 * IMPACT: Consistent validation and error handling
 * 
 * Based on Gemini's recommendation to:
 * - Centralize input validation
 * - Standardize error responses
 * - Prepare for SCORM manifest validation
 */

import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

/**
 * Validation schemas
 */
export const schemas = {
  // User registration/login
  userRegistration: Joi.object({
    email: Joi.string().email().required(),
    firstName: Joi.string().min(1).max(50).required(),
    lastName: Joi.string().min(1).max(50).required(),
    password: Joi.string().min(8).required(),
    tenantId: Joi.string().uuid().required()
  }),

  userLogin: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  }),

  // Course upload
  courseUpload: Joi.object({
    title: Joi.string().min(1).max(100).required(),
    version: Joi.string().max(20).optional(),
    description: Joi.string().max(500).optional()
  }),

  // Dispatch creation
  dispatchCreation: Joi.object({
    courseId: Joi.string().uuid().required(),
    tenantId: Joi.string().uuid().required(),
    mode: Joi.string().valid('capped', 'unlimited', 'time-bound').required(),
    maxUsers: Joi.number().integer().min(1).when('mode', {
      is: 'capped',
      then: Joi.required(),
      otherwise: Joi.forbidden()
    }),
    expiresAt: Joi.date().min('now').when('mode', {
      is: 'time-bound',
      then: Joi.required(),
      otherwise: Joi.optional()
    }),
    allowAnalytics: Joi.boolean().default(true)
  }),

  // Launch token generation
  launchTokenGeneration: Joi.object({
    email: Joi.string().email().required()
  }),

  // Tenant creation
  tenantCreation: Joi.object({
    name: Joi.string().min(1).max(100).required(),
    domain: Joi.string().hostname().required()
  }),

  // Tenant user creation
  tenantUserCreation: Joi.object({
    email: Joi.string().email().required(),
    firstName: Joi.string().min(1).max(50).required(),
    lastName: Joi.string().min(1).max(50).required(),
    password: Joi.string().min(8).required(),
    role: Joi.string().valid('admin', 'instructor', 'learner').default('learner')
  }),

  // Course assignment
  courseAssignment: Joi.object({
    courseId: Joi.string().uuid().required()
  }),

  // Dispatch launch (external LMS)
  dispatchLaunch: Joi.object({
    userAgent: Joi.string().max(500).optional(),
    timestamp: Joi.string().isoDate().optional(),
    learnerInfo: Joi.object({
      id: Joi.string().max(100).optional(),
      name: Joi.string().max(100).optional(),
      email: Joi.string().email().optional()
    }).optional()
  }).options({ allowUnknown: true }) // Allow additional fields from LMS
};

/**
 * Validation middleware factory
 */
export function validateBody(schema: Joi.ObjectSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const validationErrors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: validationErrors
        }
      });
    }

    // Replace request body with validated and sanitized data
    req.body = value;
    next();
  };
}

/**
 * Validate URL parameters
 */
export function validateParams(schema: Joi.ObjectSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.params);

    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PARAMS',
          message: 'Invalid URL parameters',
          details: error.details[0].message
        }
      });
    }

    req.params = value;
    next();
  };
}

/**
 * UUID parameter validation
 */
export const uuidParam = Joi.object({
  id: Joi.string().uuid().required()
});

/**
 * SCORM manifest validation utilities
 * Based on Gemini's recommendation for robust file handling
 */
export class SCORMValidator {
  /**
   * Validate SCORM manifest structure
   * Used by: /courses/upload endpoint
   */
  static validateManifest(manifestXML: string): {
    isValid: boolean;
    errors: string[];
    metadata?: {
      title?: string;
      version?: string;
      identifier?: string;
      resource?: {
        href?: string;
        type?: string;
      };
    };
  } {
    const errors: string[] = [];
    let metadata: any = {};

    try {
      // Basic XML structure validation
      if (!manifestXML.includes('<manifest')) {
        errors.push('Invalid SCORM manifest: missing <manifest> element');
      }

      if (!manifestXML.includes('<organizations')) {
        errors.push('Invalid SCORM manifest: missing <organizations> element');
      }

      if (!manifestXML.includes('<resources')) {
        errors.push('Invalid SCORM manifest: missing <resources> element');
      }

      // Extract basic metadata (simplified for Phase 1.5)
      const titleRegex = /<title[^>]*>([^<]+)<\/title>/;
      const titleMatch = titleRegex.exec(manifestXML);
      if (titleMatch) {
        metadata.title = titleMatch[1];
      }

      const versionRegex = /version="([^"]+)"/;
      const versionMatch = versionRegex.exec(manifestXML);
      if (versionMatch) {
        metadata.version = versionMatch[1];
      }

      const identifierRegex = /identifier="([^"]+)"/;
      const identifierMatch = identifierRegex.exec(manifestXML);
      if (identifierMatch) {
        metadata.identifier = identifierMatch[1];
      }

      // Extract resource information
      const resourceRegex = /<resource[^>]*href="([^"]+)"[^>]*type="([^"]+)"/;
      const resourceMatch = resourceRegex.exec(manifestXML);
      if (resourceMatch) {
        metadata.resource = {
          href: resourceMatch[1],
          type: resourceMatch[2]
        };
      }

      return {
        isValid: errors.length === 0,
        errors,
        metadata
      };
    } catch (error) {
      return {
        isValid: false,
        errors: ['Failed to parse SCORM manifest: ' + (error as Error).message]
      };
    }
  }

  /**
   * Validate SCORM package structure
   * Used by: /courses/upload endpoint
   */
  static validatePackageStructure(fileList: string[]): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Check for required files
    if (!fileList.includes('imsmanifest.xml')) {
      errors.push('Missing required file: imsmanifest.xml');
    }

    // Check for common SCORM files
    const hasIndex = fileList.some(file => 
      file.toLowerCase().includes('index.html') || 
      file.toLowerCase().includes('index.htm')
    );

    if (!hasIndex) {
      errors.push('Warning: No index.html file found in package');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

/**
 * Error response utilities
 */
export function sendValidationError(res: Response, message: string, details?: any) {
  return res.status(400).json({
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message,
      details
    }
  });
}

export function sendNotFoundError(res: Response, resource: string) {
  return res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `${resource} not found`
    }
  });
}

export function sendUnauthorizedError(res: Response, message: string = 'Unauthorized') {
  return res.status(403).json({
    success: false,
    error: {
      code: 'UNAUTHORIZED',
      message
    }
  });
}

export function sendInternalError(res: Response, message: string = 'Internal server error') {
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message
    }
  });
}
