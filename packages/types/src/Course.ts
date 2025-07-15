/**
 * CHANGE LOG - 2025-07-14 14:45
 * =========================
 * WHAT: Created Course.ts with CourseUploadResponse interface
 * WHY: Phase 4 requirement for SCORM course upload functionality
 * IMPACT: Enables type safety between frontend and backend for course uploads
 * NOTES FOR CHATGPT: This interface defines the response structure after uploading and parsing a SCORM course
 */

/**
 * CHANGE LOG - 2025-07-14 19:00 - PHASE 5 ADDITION
 * ===============================================
 * WHAT: Added Course database model interface
 * WHY: Phase 5 requirement for course persistence and management
 * IMPACT: Type safety for course database operations and API responses
 * NOTES FOR CHATGPT: This interface mirrors the Prisma Course model
 */

/**
 * Course database model interface
 * Mirrors the Prisma Course model for type safety
 */
export interface Course {
  id: string;
  title: string;
  version: string;
  fileCount: number;
  structure: string[]; // Parsed from JSON in database
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Course creation request interface
 * Used when creating new course records
 */
export interface CreateCourseRequest {
  title: string;
  version: string;
  fileCount: number;
  structure: string[];
}

/**
 * Course list API response
 */
export interface CourseListResponse {
  success: boolean;
  courses: Course[];
}

/**
 * Single course API response
 */
export interface CourseResponse {
  success: boolean;
  course: Course;
}

/**
 * Response interface for course upload operations
 * Used by both frontend and backend for type safety
 */
export interface CourseUploadResponse {
  title: string;
  version: string;
  fileCount: number;
  structure: string[];
}

/**
 * Course upload error response
 */
export interface CourseUploadError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Complete course upload API response
 */
export interface CourseUploadApiResponse {
  success: boolean;
  data?: CourseUploadResponse;
  error?: CourseUploadError;
}
