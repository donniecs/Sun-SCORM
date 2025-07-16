/**
 * Metabase JWT Authentication Service
 * 
 * This service generates JWT tokens for Metabase embedded dashboards
 * with tenant-specific security and parameter injection.
 * 
 * GEMINI'S STRATEGIC INSIGHT: 
 * The key to effective embedded analytics is seamless parameter injection.
 * By generating tenant-specific JWTs with pre-filtered parameters,
 * we ensure each tenant only sees their own data while maintaining
 * a unified dashboard experience.
 */

import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

export interface MetabaseJWTPayload {
  resource: {
    dashboard?: number;
    question?: number;
  };
  params: {
    [key: string]: any;
  };
  exp: number;
  iat: number;
  jti: string;
}

export interface DashboardConfig {
  dashboardId: number;
  tenantId: string;
  dispatchId?: string;
  userId?: string;
  userRole?: 'admin' | 'instructor' | 'learner';
  timeRange?: {
    start: string;
    end: string;
  };
  filters?: {
    [key: string]: any;
  };
}

export interface EmbeddingConfig {
  metabaseSecret: string;
  metabaseUrl: string;
  tokenExpiration: number; // in seconds
  allowedDomains: string[];
}

export class MetabaseJWTService {
  private readonly config: EmbeddingConfig;

  constructor(config: EmbeddingConfig) {
    this.config = config;
  }

  /**
   * Generate JWT token for dashboard embedding
   */
  generateDashboardToken(dashboardConfig: DashboardConfig): string {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + this.config.tokenExpiration;

    // Build tenant-specific parameters
    const params = {
      // Core tenant filtering
      tenant_id: dashboardConfig.tenantId,
      
      // Optional dispatch filtering
      ...(dashboardConfig.dispatchId && { dispatch_id: dashboardConfig.dispatchId }),
      
      // Optional user filtering
      ...(dashboardConfig.userId && { user_id: dashboardConfig.userId }),
      
      // Time range parameters
      ...(dashboardConfig.timeRange && {
        start_date: dashboardConfig.timeRange.start,
        end_date: dashboardConfig.timeRange.end
      }),
      
      // Custom filters
      ...dashboardConfig.filters
    };

    const payload: MetabaseJWTPayload = {
      resource: {
        dashboard: dashboardConfig.dashboardId
      },
      params,
      exp,
      iat: now,
      jti: uuidv4()
    };

    return jwt.sign(payload, this.config.metabaseSecret, { algorithm: 'HS256' });
  }

  /**
   * Generate JWT token for question embedding
   */
  generateQuestionToken(questionId: number, dashboardConfig: Omit<DashboardConfig, 'dashboardId'>): string {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + this.config.tokenExpiration;

    const params = {
      tenant_id: dashboardConfig.tenantId,
      ...(dashboardConfig.dispatchId && { dispatch_id: dashboardConfig.dispatchId }),
      ...(dashboardConfig.userId && { user_id: dashboardConfig.userId }),
      ...(dashboardConfig.timeRange && {
        start_date: dashboardConfig.timeRange.start,
        end_date: dashboardConfig.timeRange.end
      }),
      ...dashboardConfig.filters
    };

    const payload: MetabaseJWTPayload = {
      resource: {
        question: questionId
      },
      params,
      exp,
      iat: now,
      jti: uuidv4()
    };

    return jwt.sign(payload, this.config.metabaseSecret, { algorithm: 'HS256' });
  }

  /**
   * Generate iframe URL for dashboard embedding
   */
  generateDashboardUrl(dashboardConfig: DashboardConfig): string {
    const token = this.generateDashboardToken(dashboardConfig);
    const baseUrl = this.config.metabaseUrl.replace(/\/$/, '');
    
    return `${baseUrl}/embed/dashboard/${token}#bordered=true&titled=true`;
  }

  /**
   * Generate iframe URL for question embedding
   */
  generateQuestionUrl(questionId: number, dashboardConfig: Omit<DashboardConfig, 'dashboardId'>): string {
    const token = this.generateQuestionToken(questionId, dashboardConfig);
    const baseUrl = this.config.metabaseUrl.replace(/\/$/, '');
    
    return `${baseUrl}/embed/question/${token}#bordered=true&titled=true`;
  }

  /**
   * Validate JWT token
   */
  validateToken(token: string): MetabaseJWTPayload | null {
    try {
      const decoded = jwt.verify(token, this.config.metabaseSecret, { algorithms: ['HS256'] });
      return decoded as MetabaseJWTPayload;
    } catch (error) {
      console.warn('Token validation failed:', error);
      return null;
    }
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(token: string): boolean {
    try {
      const decoded = jwt.decode(token) as MetabaseJWTPayload;
      if (!decoded?.exp) return true;
      
      const now = Math.floor(Date.now() / 1000);
      return decoded.exp < now;
    } catch (error) {
      console.warn('Token expiration check failed:', error);
      return true;
    }
  }

  /**
   * Refresh token if needed
   */
  refreshTokenIfNeeded(token: string, dashboardConfig: DashboardConfig): string {
    if (this.isTokenExpired(token)) {
      return this.generateDashboardToken(dashboardConfig);
    }
    return token;
  }
}

/**
 * Predefined Dashboard Configurations
 * 
 * These represent the core analytics dashboards that will be embedded
 * in the Sun SCORM interface.
 */
export const DASHBOARD_CONFIGS = {
  // Completion Funnel Dashboard
  COMPLETION_FUNNEL: {
    id: 1,
    name: 'Completion Funnel',
    description: 'Track learner progress through course completion stages',
    defaultFilters: {
      time_range: '30d'
    }
  },
  
  // Drop-off Analysis Dashboard
  DROPOUT_ANALYSIS: {
    id: 2,
    name: 'Drop-off Analysis',
    description: 'Identify where learners abandon courses',
    defaultFilters: {
      time_range: '30d',
      min_attempts: 1
    }
  },
  
  // Quiz Performance Dashboard
  QUIZ_PERFORMANCE: {
    id: 3,
    name: 'Quiz Performance',
    description: 'Analyze quiz scores and question difficulty',
    defaultFilters: {
      time_range: '30d',
      interaction_type: 'quiz'
    }
  },
  
  // Real-time Activity Dashboard
  REALTIME_ACTIVITY: {
    id: 4,
    name: 'Real-time Activity',
    description: 'Monitor current learner activity',
    defaultFilters: {
      time_range: '1d'
    }
  },
  
  // Engagement Metrics Dashboard
  ENGAGEMENT_METRICS: {
    id: 5,
    name: 'Engagement Metrics',
    description: 'Measure learner engagement and time spent',
    defaultFilters: {
      time_range: '7d'
    }
  }
} as const;

/**
 * Dashboard Question IDs
 * 
 * Individual chart components that can be embedded separately
 */
export const QUESTION_IDS = {
  COMPLETION_RATE_CHART: 101,
  PASS_RATE_CHART: 102,
  AVERAGE_SCORE_CHART: 103,
  TIME_SPENT_CHART: 104,
  DROPOUT_FUNNEL_CHART: 105,
  DAILY_ACTIVITY_CHART: 106,
  TOP_PERFORMING_CONTENT: 107,
  STRUGGLING_LEARNERS: 108,
  QUIZ_DIFFICULTY_ANALYSIS: 109,
  REAL_TIME_LEARNERS: 110
} as const;

/**
 * Factory function to create MetabaseJWTService with environment configuration
 */
export function createMetabaseJWTService(): MetabaseJWTService {
  const config: EmbeddingConfig = {
    metabaseSecret: process.env.METABASE_SECRET_KEY || 'your-metabase-secret-key',
    metabaseUrl: process.env.METABASE_URL || 'http://localhost:3000',
    tokenExpiration: parseInt(process.env.METABASE_TOKEN_EXPIRATION || '3600'), // 1 hour
    allowedDomains: process.env.METABASE_ALLOWED_DOMAINS?.split(',') || ['localhost', 'sun-scorm.com']
  };

  return new MetabaseJWTService(config);
}
