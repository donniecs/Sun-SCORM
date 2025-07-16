/**
 * Global Error Handler - Phase 1.5 Cleanup
 * 
 * WHAT: Centralized error handling for all API routes
 * WHY: Consistent error responses and better debugging
 * IMPACT: Improved API reliability and developer experience
 */

import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';

// Custom error types
export class APIError extends Error {
  statusCode: number;
  code: string;
  isOperational: boolean;
  
  constructor(message: string, statusCode: number, code: string, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    
    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);
  }
}

// Error response interface
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
  requestId?: string;
}

/**
 * Global error handler middleware
 * Catches all errors and provides consistent error responses
 */
export const globalErrorHandler = (
  error: Error | APIError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Generate request ID for tracking
  const requestId = req.headers['x-request-id'] as string || 
                   Math.random().toString(36).substring(2, 15);

  // Log error for debugging
  console.error('=== ERROR CAUGHT ===');
  console.error('Request ID:', requestId);
  console.error('URL:', req.method, req.originalUrl);
  console.error('Error:', error.message);
  console.error('Stack:', error.stack);
  console.error('=====================');

  // Handle APIError instances
  if (error instanceof APIError) {
    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        code: error.code,
        message: error.message
      },
      requestId
    };

    res.status(error.statusCode).json(errorResponse);
    return;
  }

  // Handle Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const prismaError = handlePrismaError(error);
    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        code: prismaError.code,
        message: prismaError.message
      },
      requestId
    };

    res.status(prismaError.statusCode).json(errorResponse);
    return;
  }

  // Handle validation errors (Joi)
  if (error.name === 'ValidationError') {
    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input data',
        details: error.message
      },
      requestId
    };

    res.status(400).json(errorResponse);
    return;
  }

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or malformed token'
      },
      requestId
    };

    res.status(401).json(errorResponse);
    return;
  }

  if (error.name === 'TokenExpiredError') {
    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        code: 'TOKEN_EXPIRED',
        message: 'Token has expired'
      },
      requestId
    };

    res.status(401).json(errorResponse);
    return;
  }

  // Handle file upload errors
  if (error.message.includes('LIMIT_FILE_SIZE')) {
    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        code: 'FILE_TOO_LARGE',
        message: 'File size exceeds the allowed limit'
      },
      requestId
    };

    res.status(413).json(errorResponse);
    return;
  }

  // Handle unknown errors
  const errorResponse: ErrorResponse = {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production' 
        ? 'An unexpected error occurred' 
        : error.message
    },
    requestId
  };

  res.status(500).json(errorResponse);
};

/**
 * Convert Prisma errors to structured error responses
 */
function handlePrismaError(error: Prisma.PrismaClientKnownRequestError): {
  statusCode: number;
  code: string;
  message: string;
} {
  switch (error.code) {
    case 'P2002':
      return {
        statusCode: 409,
        code: 'UNIQUE_CONSTRAINT_VIOLATION',
        message: 'A record with this value already exists'
      };
    
    case 'P2025':
      return {
        statusCode: 404,
        code: 'RECORD_NOT_FOUND',
        message: 'The requested record was not found'
      };
    
    case 'P2003':
      return {
        statusCode: 400,
        code: 'FOREIGN_KEY_CONSTRAINT_VIOLATION',
        message: 'Referenced record does not exist'
      };
    
    case 'P2014':
      return {
        statusCode: 400,
        code: 'INVALID_RELATION',
        message: 'Invalid relation in the request'
      };
    
    case 'P2021':
      return {
        statusCode: 500,
        code: 'TABLE_NOT_FOUND',
        message: 'Database table does not exist'
      };
    
    default:
      return {
        statusCode: 500,
        code: 'DATABASE_ERROR',
        message: 'Database operation failed'
      };
  }
}

/**
 * 404 handler for undefined routes
 */
export const notFoundHandler = (req: Request, res: Response): void => {
  const errorResponse: ErrorResponse = {
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} not found`
    }
  };

  res.status(404).json(errorResponse);
};

/**
 * Async error wrapper for route handlers
 * Eliminates need for try/catch in every route
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Success response helper
 */
export const successResponse = (
  res: Response,
  data: any,
  message: string = 'Success',
  statusCode: number = 200
): void => {
  res.status(statusCode).json({
    success: true,
    message,
    data
  });
};

/**
 * Error response helper
 */
export const errorResponse = (
  res: Response,
  message: string,
  code: string = 'GENERAL_ERROR',
  statusCode: number = 500,
  details?: any
): void => {
  const errorResponse: ErrorResponse = {
    success: false,
    error: {
      code,
      message,
      details
    }
  };

  res.status(statusCode).json(errorResponse);
};

export default {
  globalErrorHandler,
  notFoundHandler,
  asyncHandler,
  successResponse,
  errorResponse,
  APIError
};
