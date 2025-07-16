/**
 * @file RUSTICI KILLER - Shared TypeScript Type Definitions
 * @description Common interfaces and types used across all services
 * @version 0.1.0
 * 
 * This package contains all shared TypeScript interfaces and types
 * that are used across the RUSTICI KILLER microservices architecture.
 * 
 * These types represent the core data models for:
 * - Course metadata and structure
 * - Registration tracking
 * - xAPI statements and LRS data
 * - SCORM CMI data models
 * - Multi-tenant context and authentication
 */

// =============================================================================
// COURSE TYPES - PHASE 4 ADDITION
// =============================================================================

export * from './Course';
export * from './Launch';

// =============================================================================
// TENANT & AUTHENTICATION TYPES
// =============================================================================

/**
 * Multi-tenant context passed through all services
 * Ensures data isolation and proper scoping
 */
export interface TenantContext {
  tenantId: string;
  applicationId: string;
  organizationName: string;
  plan: 'free' | 'pro' | 'enterprise';
  limits: {
    maxCourses: number;
    maxActiveRegistrations: number;
    maxStorageGB: number;
    maxApiCallsPerMonth: number;
  };
}

/**
 * API authentication context
 * Derived from API keys, JWTs, or OAuth tokens
 */
export interface AuthContext {
  userId?: string;
  tenantId: string;
  applicationId: string;
  scopes: string[];
  rateLimit: {
    limit: number;
    remaining: number;
    reset: Date;
  };
}

// =============================================================================
// COURSE & CONTENT TYPES
// =============================================================================

/**
 * Course metadata extracted from manifest parsing
 * Supports SCORM 1.2, SCORM 2004, AICC, cmi5, and xAPI content
 */
export interface CourseMetadata {
  id: string;
  tenantId: string;
  applicationId: string;
  title: string;
  description?: string;
  version: string;
  
  // Standards information
  standard: 'scorm_1_2' | 'scorm_2004' | 'aicc' | 'cmi5' | 'xapi' | 'pdf' | 'video';
  scormVersion?: '1.2' | '2004_2nd' | '2004_3rd' | '2004_4th';
  
  // Manifest and structure
  manifestPath: string;
  entryPoint: string; // Main launch URL/file
  assets: CourseAsset[];
  
  // SCORM-specific metadata
  scos?: SCOMetadata[];
  sequencingRules?: SequencingRule[];
  
  // Storage and delivery
  storageSize: number; // bytes
  cdnBaseUrl: string;
  
  // Lifecycle
  uploadedAt: Date;
  lastModified: Date;
  isActive: boolean;
  
  // Parser feedback
  parserWarnings: string[];
  parserErrors: string[];
}

/**
 * Individual course assets (HTML, images, videos, etc.)
 */
export interface CourseAsset {
  path: string; // relative path within course
  mimeType: string;
  size: number;
  lastModified: Date;
  cdnUrl: string;
}

/**
 * SCORM Sharable Content Object metadata
 */
export interface SCOMetadata {
  id: string;
  title: string;
  entryPoint: string;
  sequencingId?: string;
  prerequisites?: string[];
  masteryScore?: number;
  completionThreshold?: number;
  timeLimitAction?: 'exit,message' | 'exit,no message' | 'continue,message' | 'continue,no message';
}

/**
 * SCORM 2004 sequencing rules (placeholder structure)
 */
export interface SequencingRule {
  id: string;
  type: 'precondition' | 'postcondition' | 'exit' | 'rollup';
  conditions: unknown; // Complex sequencing logic - TBD in future phases
  actions: unknown;
}

// =============================================================================
// REGISTRATION & TRACKING TYPES
// =============================================================================

/**
 * Registration represents a learner's enrollment in a specific course
 * This is the core tracking entity for all standards
 */
export interface Registration {
  id: string;
  tenantId: string;
  applicationId: string;
  
  // Course and learner association
  courseId: string;
  learnerId: string;
  learnerFirstName: string;
  learnerLastName: string;
  learnerEmail?: string;
  
  // Status and results
  registrationStatus: 'created' | 'launched' | 'suspended' | 'completed' | 'failed';
  completionStatus: 'completed' | 'incomplete' | 'unknown';
  successStatus: 'passed' | 'failed' | 'unknown';
  
  // Scoring
  scoreRaw?: number;
  scoreMin?: number;
  scoreMax?: number;
  scoreScaled?: number; // 0.0 to 1.0
  
  // Timing
  totalTime?: number; // seconds
  sessionTime?: number; // seconds for current session
  
  // Launch information
  launchCount: number;
  firstLaunchAt?: Date;
  lastLaunchAt?: Date;
  lastExitAt?: Date;
  
  // State management
  suspendData?: string; // SCORM suspend_data for bookmarking
  location?: string; // SCORM location for navigation
  
  // Lifecycle
  createdAt: Date;
  updatedAt: Date;
  
  // Runtime session data (stored in Redis during active sessions)
  activeSessionId?: string;
}

/**
 * Active session state maintained in Redis during course playback
 * Contains the live CMI data model for SCORM content
 */
export interface SessionState {
  registrationId: string;
  sessionId: string;
  tenantId: string;
  
  // Session metadata
  startedAt: Date;
  lastActivityAt: Date;
  isActive: boolean;
  
  // SCORM RTE state
  cmiData: CMIDataModel;
  
  // Interaction tracking
  interactions: CMIInteraction[];
  objectives: CMIObjective[];
  
  // Real-time events for debugging
  apiCalls: APICall[];
}

// =============================================================================
// SCORM CMI DATA MODEL TYPES
// =============================================================================

/**
 * SCORM Computer-Managed Instruction data model
 * Supports both SCORM 1.2 and SCORM 2004 formats
 */
export interface CMIDataModel {
  // Core elements (SCORM 1.2 & 2004)
  'cmi.core.lesson_status'?: 'passed' | 'failed' | 'completed' | 'incomplete' | 'browsed' | 'not attempted';
  'cmi.core.score.raw'?: string;
  'cmi.core.score.min'?: string;
  'cmi.core.score.max'?: string;
  'cmi.core.student_id'?: string;
  'cmi.core.student_name'?: string;
  'cmi.core.lesson_location'?: string;
  'cmi.core.credit'?: 'credit' | 'no-credit';
  'cmi.core.lesson_mode'?: 'browse' | 'normal' | 'review';
  'cmi.core.exit'?: 'time-out' | 'suspend' | 'logout' | '';
  'cmi.core.session_time'?: string;
  'cmi.core.total_time'?: string;
  
  // SCORM 2004 enhanced elements
  'cmi.completion_status'?: 'completed' | 'incomplete' | 'not attempted' | 'unknown';
  'cmi.success_status'?: 'passed' | 'failed' | 'unknown';
  'cmi.score.scaled'?: string;
  'cmi.progress_measure'?: string;
  'cmi.max_time_allowed'?: string;
  'cmi.time_limit_action'?: 'exit,message' | 'exit,no message' | 'continue,message' | 'continue,no message';
  
  // Suspend data for bookmarking
  'cmi.suspend_data'?: string;
  
  // Additional CMI elements stored as key-value pairs
  [key: string]: string | undefined;
}

/**
 * SCORM interaction tracking
 */
export interface CMIInteraction {
  id: string;
  type: 'true-false' | 'choice' | 'fill-in' | 'long-fill-in' | 'matching' | 'performance' | 'sequencing' | 'likert' | 'numeric' | 'other';
  timestamp: Date;
  weighting?: number;
  learner_response?: string;
  result: 'correct' | 'incorrect' | 'unanticipated' | 'neutral';
  latency?: string; // ISO 8601 duration
  description?: string;
}

/**
 * SCORM objective tracking
 */
export interface CMIObjective {
  id: string;
  score?: {
    raw?: number;
    min?: number;
    max?: number;
    scaled?: number;
  };
  success_status?: 'passed' | 'failed' | 'unknown';
  completion_status?: 'completed' | 'incomplete' | 'not attempted' | 'unknown';
  progress_measure?: number;
  description?: string;
}

/**
 * API call tracking for debugging and analytics
 */
export interface APICall {
  timestamp: Date;
  method: 'Initialize' | 'GetValue' | 'SetValue' | 'Commit' | 'Terminate' | 'GetLastError' | 'GetDiagnostic';
  parameter?: string;
  value?: string;
  errorCode?: string;
  success: boolean;
}

// =============================================================================
// xAPI & LRS TYPES
// =============================================================================

/**
 * xAPI Statement structure
 * Follows the xAPI specification format
 */
export interface XAPIStatement {
  id?: string;
  timestamp?: string;
  stored?: string;
  authority?: XAPIActor;
  version?: string;
  
  // Core statement structure
  actor: XAPIActor;
  verb: XAPIVerb;
  object: XAPIObject;
  result?: XAPIResult;
  context?: XAPIContext;
  attachments?: XAPIAttachment[];
}

/**
 * xAPI Actor (learner/agent)
 */
export interface XAPIActor {
  objectType?: 'Agent' | 'Group';
  name?: string;
  mbox?: string;
  mbox_sha1sum?: string;
  openid?: string;
  account?: {
    homePage: string;
    name: string;
  };
  member?: XAPIActor[]; // For groups
}

/**
 * xAPI Verb (action taken)
 */
export interface XAPIVerb {
  id: string; // IRI
  display?: {
    [languageCode: string]: string;
  };
}

/**
 * xAPI Object (target of the action)
 */
export interface XAPIObject {
  objectType?: 'Activity' | 'Agent' | 'Group' | 'SubStatement' | 'StatementRef';
  id?: string; // IRI for activities
  definition?: {
    name?: { [languageCode: string]: string };
    description?: { [languageCode: string]: string };
    type?: string; // IRI
    moreInfo?: string; // IRI
    extensions?: { [key: string]: unknown };
  };
  
  // Additional properties for different object types
  [key: string]: unknown;
}

/**
 * xAPI Result (outcome of the action)
 */
export interface XAPIResult {
  score?: {
    scaled?: number;
    raw?: number;
    min?: number;
    max?: number;
  };
  success?: boolean;
  completion?: boolean;
  response?: string;
  duration?: string; // ISO 8601 duration
  extensions?: { [key: string]: unknown };
}

/**
 * xAPI Context (additional information)
 */
export interface XAPIContext {
  registration?: string; // UUID
  instructor?: XAPIActor;
  team?: XAPIActor;
  contextActivities?: {
    parent?: XAPIObject[];
    grouping?: XAPIObject[];
    category?: XAPIObject[];
    other?: XAPIObject[];
  };
  revision?: string;
  platform?: string;
  language?: string;
  statement?: XAPIStatementRef;
  extensions?: { [key: string]: unknown };
}

/**
 * xAPI Attachment (binary data)
 */
export interface XAPIAttachment {
  usageType: string; // IRI
  display: { [languageCode: string]: string };
  description?: { [languageCode: string]: string };
  contentType: string; // MIME type
  length: number;
  sha2: string;
  fileUrl?: string;
}

/**
 * xAPI Statement Reference
 */
export interface XAPIStatementRef {
  objectType: 'StatementRef';
  id: string; // UUID
}

// =============================================================================
// WEBHOOK & EVENT TYPES
// =============================================================================

/**
 * Webhook event payload structure
 */
export interface WebhookEvent {
  id: string;
  type: WebhookEventType;
  createdAt: Date;
  tenantId: string;
  applicationId: string;
  data: unknown; // Event-specific payload
  attempt: number;
  maxAttempts: number;
  nextRetryAt?: Date;
}

/**
 * Supported webhook event types
 */
export type WebhookEventType = 
  | 'registration.created'
  | 'registration.launched'
  | 'registration.completed'
  | 'registration.passed'
  | 'registration.failed'
  | 'statement.received'
  | 'course.import.succeeded'
  | 'course.import.failed';

/**
 * Webhook endpoint configuration
 */
export interface WebhookEndpoint {
  id: string;
  tenantId: string;
  applicationId: string;
  url: string;
  secret: string; // For HMAC signature verification
  events: WebhookEventType[];
  isActive: boolean;
  createdAt: Date;
  lastTriggeredAt?: Date;
}

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

/**
 * Standard API response wrapper
 */
export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * API error codes for consistent error handling
 */
export enum APIErrorCode {
  // Authentication & Authorization
  UNAUTHORIZED = 'unauthorized',
  FORBIDDEN = 'forbidden',
  INVALID_API_KEY = 'invalid_api_key',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  
  // Validation
  VALIDATION_ERROR = 'validation_error',
  INVALID_PARAMETER = 'invalid_parameter',
  MISSING_PARAMETER = 'missing_parameter',
  
  // Resources
  NOT_FOUND = 'not_found',
  ALREADY_EXISTS = 'already_exists',
  CONFLICT = 'conflict',
  
  // Course & Content
  COURSE_PARSE_FAILED = 'course_parse_failed',
  INVALID_MANIFEST = 'invalid_manifest',
  UNSUPPORTED_STANDARD = 'unsupported_standard',
  
  // Runtime
  REGISTRATION_NOT_FOUND = 'registration_not_found',
  SESSION_EXPIRED = 'session_expired',
  SCORM_API_ERROR = 'scorm_api_error',
  
  // System
  INTERNAL_ERROR = 'internal_error',
  SERVICE_UNAVAILABLE = 'service_unavailable',
  MAINTENANCE_MODE = 'maintenance_mode'
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Pagination parameters for list endpoints
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Common filter parameters
 */
export interface FilterParams {
  tenantId?: string;
  applicationId?: string;
  courseId?: string;
  learnerId?: string;
  standard?: string;
  status?: string;
  createdAfter?: Date;
  createdBefore?: Date;
}

/**
 * Health check response
 */
export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: Date;
  uptime: number;
  version: string;
  dependencies: {
    [serviceName: string]: {
      status: 'healthy' | 'unhealthy';
      responseTime?: number;
      error?: string;
    };
  };
}

// =============================================================================
// AUTHENTICATION TYPES - PHASE 2
// =============================================================================

/**
 * User entity for authentication and tenant management
 */
export interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: 'admin' | 'user';
  tenantId: string;
  createdAt: string;
}

/**
 * Tenant entity for multi-tenant organization
 */
export interface Tenant {
  id: string;
  name: string;
  createdAt: string;
}

/**
 * JWT token payload structure
 */
export interface JWTPayload {
  userId: string;
  tenantId: string;
  role: string;
  email: string;
  iat?: number;
  exp?: number;
}

/**
 * Authentication request/response types
 */
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  tenantName: string;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: {
    id: string;
    email: string;
    role: string;
    tenantId: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

// =============================================================================
// EXPORT ALL TYPES
// =============================================================================

// All types are defined in this single file for Phase 1
// In future phases, these will be split into separate modules:
// - ./course.ts
// - ./registration.ts  
// - ./xapi.ts
// - ./cmi.ts
// - ./webhook.ts
// - ./auth.ts
// - ./api.ts

// =============================================================================
// SEQUENCING ENGINE TYPES - PHASE 9 ADDITION
// =============================================================================

/**
 * SCORM 2004 Sequencing Session Interface
 * Represents a complete sequencing session with all state information
 */
export interface SequencingSession {
  id: string;
  userId: string;
  courseId: string;
  sessionEngineId: string;
  activityTree: any;
  globalStateInfo: GlobalStateInformation;
  currentActivity?: string;
  suspendedActivity?: string;
  activityStateTree: ActivityState;
  sequencingControlFlow: SequencingControlFlow;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Activity State for SCORM 2004 Sequencing
 * Tracks the state of each activity in the activity tree
 */
export interface ActivityState {
  id: string;
  active: boolean;
  suspended: boolean;
  completed: boolean;
  progressDetermined: boolean;
  objectiveProgressDetermined: boolean;
  objectiveSatisfied: boolean;
  objectiveNormalizedMeasure?: number;
  attemptCount: number;
  attemptAbsoluteDuration?: number;
  attemptExperiencedDuration?: number;
  activityAbsoluteDuration?: number;
  activityExperiencedDuration?: number;
  suspendData?: any;
  childrenStates: Map<string, ActivityState>;
}

/**
 * Global State Information for Sequencing
 * Tracks global sequencing state and learner preferences
 */
export interface GlobalStateInformation {
  currentActivity?: string;
  suspendedActivity?: string;
  learnerPreferences: Record<string, any>;
  availableChildren: string[];
}

/**
 * Sequencing Control Flow
 * Tracks the current sequencing control flow state
 */
export interface SequencingControlFlow {
  flowDirection: 'forward' | 'backward';
  flowSubProcess: 'start' | 'resume' | 'continue' | 'exit';
  considerChildren: boolean;
  considerChoice: boolean;
  targetActivity?: string;
  choiceExit: boolean;
  endSession: boolean;
}

/**
 * Navigation Request for Sequencing Engine
 * Represents a navigation request from the UI
 */
export interface NavigationRequest {
  type: 'start' | 'resume' | 'continue' | 'previous' | 'choice' | 'exit' | 'exitAll' | 'abandon' | 'abandonAll' | 'suspendAll';
  targetActivityId?: string;
  sessionId: string;
  userId: string;
  courseId: string;
}

/**
 * Navigation Response from Sequencing Engine
 * Contains the result of a navigation request
 */
export interface NavigationResponse {
  success: boolean;
  sessionId: string;
  currentActivity?: string;
  nextActivity?: string;
  previousActivity?: string;
  deliveryRequest?: DeliveryRequest;
  terminationRequest?: TerminationRequest;
  error?: string;
  sequencingException?: string;
}

/**
 * Delivery Request for Content Launch
 * Instructs the UI to launch specific content
 */
export interface DeliveryRequest {
  type: 'start' | 'resume';
  activityId: string;
  href: string;
  parameters?: Record<string, any>;
}

/**
 * Termination Request for Content Exit
 * Instructs the UI to terminate content
 */
export interface TerminationRequest {
  type: 'exit' | 'exitAll' | 'abandon' | 'abandonAll' | 'suspendAll';
  reason: string;
}

// =============================================================================
// PROGRESS VIEW TYPES - PHASE 9 ADDITION
// =============================================================================

/**
 * Progress View State Interface
 * Represents the current state of progress tracking in the UI
 */
export interface ProgressViewState {
  sessionId: string;
  currentActivity?: string;
  activityTree: ActivityTreeNode[];
  navigationHistory: NavigationHistoryItem[];
  totalActivities: number;
  completedActivities: number;
  progressPercent: number;
  lastUpdated: Date;
}

/**
 * Activity Tree Node for Progress Display
 * Simplified activity tree structure for UI display
 */
export interface ActivityTreeNode {
  id: string;
  title: string;
  type: 'sco' | 'asset' | 'folder';
  status: 'not_attempted' | 'incomplete' | 'completed' | 'passed' | 'failed';
  isCurrent: boolean;
  isAccessible: boolean;
  children?: ActivityTreeNode[];
  href?: string;
  completionThreshold?: number;
  masteryScore?: number;
  progressMeasure?: number;
}

/**
 * Navigation History Item
 * Tracks user navigation through the course
 */
export interface NavigationHistoryItem {
  timestamp: Date;
  activityId: string;
  activityTitle: string;
  action: 'start' | 'resume' | 'continue' | 'previous' | 'choice' | 'exit' | 'abandon' | 'suspend';
  result?: 'success' | 'failure' | 'timeout' | 'error';
  duration?: number; // milliseconds
}

// =============================================================================
// LAUNCH AND SESSION TYPES - PHASE 10 ADDITION
// =============================================================================

/**
 * Request interface for launching a course
 */
export interface LaunchRequest {
  courseId: string;
  userId: string;
  tenantId: string;
  returnUrl?: string;
  completionUrl?: string;
  customData?: Record<string, any>;
}

/**
 * Response interface for course launch
 */
export interface LaunchResponse {
  success: boolean;
  launchUrl?: string;
  sessionId?: string;
  courseTitle?: string;
  error?: string;
}

/**
 * Request interface for creating a launch session
 */
export interface CreateLaunchSessionRequest {
  courseId: string;
  userId: string;
  tenantId: string;
  launchData: Record<string, any>;
}

/**
 * Response interface for creating a launch session
 */
export interface CreateLaunchSessionResponse {
  success: boolean;
  sessionId?: string;
  launchUrl?: string;
  error?: string;
}

// =============================================================================
// PHASE 15: TENANT MANAGEMENT TYPES
// =============================================================================

/**
 * Organization/Tenant creation request
 */
export interface CreateTenantRequest {
  name: string;
  domain: string;
}

/**
 * Organization/Tenant response with stats
 */
export interface TenantWithStats {
  id: string;
  name: string;
  domain: string;
  createdAt: Date;
  updatedAt: Date;
  stats: {
    totalUsers: number;
    activeUsers: number;
    totalCourses: number;
    totalDispatches: number;
  };
  users: Array<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    isActive: boolean;
  }>;
  recentDispatches: Array<{
    id: string;
    courseId: string;
    course: {
      id: string;
      title: string;
    };
    users: Array<any>;
  }>;
}

/**
 * User creation request for tenant
 */
export interface CreateTenantUserRequest {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  role?: 'learner' | 'admin';
}

/**
 * Course assignment request
 */
export interface AssignCourseRequest {
  courseId: string;
}
