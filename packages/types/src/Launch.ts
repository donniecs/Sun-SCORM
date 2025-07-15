/**
 * CHANGE LOG - 2025-07-14 19:45
 * =========================
 * WHAT: Created Launch.ts with launch functionality interfaces
 * WHY: Phase 6 requirement for SCORM course launch and runtime integration
 * IMPACT: Type safety for launch endpoints and registration tracking
 * NOTES FOR CHATGPT: These interfaces support launch session creation and tracking
 */

/**
 * Request interface for launching a course
 * Used when user clicks "Launch Course" button
 */
export interface LaunchRequest {
  courseId: string;
  userId: string;
}

/**
 * Response interface for course launch
 * Contains launch URL and session metadata
 */
export interface LaunchResponse {
  success: boolean;
  launchUrl: string;
  registrationId: string;
  courseTitle: string;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Registration interface for tracking launch sessions
 * Mirrors the Prisma Registration model
 */
export interface Registration {
  id: string;
  courseId: string;
  userId: string;
  startedAt: Date;
  completedAt?: Date;
  status: RegistrationStatus;
  progress?: number;
  scoreRaw?: number;
  scoreMax?: number;
  scoreMin?: number;
  completionStatus?: CompletionStatus;
  successStatus?: SuccessStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Registration status enumeration
 */
export enum RegistrationStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in-progress',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

/**
 * SCORM completion status enumeration
 */
export enum CompletionStatus {
  COMPLETED = 'completed',
  INCOMPLETE = 'incomplete',
  NOT_ATTEMPTED = 'not_attempted',
  UNKNOWN = 'unknown'
}

/**
 * SCORM success status enumeration
 */
export enum SuccessStatus {
  PASSED = 'passed',
  FAILED = 'failed',
  UNKNOWN = 'unknown'
}

/**
 * Launch session creation request
 * Internal interface for API endpoint
 */
export interface CreateLaunchSessionRequest {
  courseId: string;
  userId: string;
}

/**
 * Launch session creation response
 * Internal interface for API endpoint
 */
export interface CreateLaunchSessionResponse {
  success: boolean;
  data?: {
    registrationId: string;
    launchUrl: string;
    courseTitle: string;
  };
  error?: {
    code: string;
    message: string;
  };
}
