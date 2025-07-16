/**
 * React Dashboard Components
 * 
 * This module provides React components for embedding Metabase dashboards
 * with automatic JWT token management and responsive design.
 * 
 * GEMINI'S STRATEGIC INSIGHT ON EMBEDDED ANALYTICS:
 * The key to successful embedded analytics is making the dashboards feel
 * like native parts of the application. This means consistent styling,
 * seamless authentication, and intelligent loading states.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MetabaseJWTService, DashboardConfig, DASHBOARD_CONFIGS, QUESTION_IDS } from '../services/MetabaseJWTService';

export interface DashboardProps {
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
  height?: number;
  width?: string;
  className?: string;
  onLoad?: () => void;
  onError?: (error: Error) => void;
  refreshInterval?: number; // in seconds
  showBorder?: boolean;
  showTitle?: boolean;
}

export interface QuestionProps extends Omit<DashboardProps, 'dashboardId'> {
  questionId: number;
}

/**
 * Main Dashboard Component
 */
export const MetabaseDashboard: React.FC<DashboardProps> = ({
  dashboardId,
  tenantId,
  dispatchId,
  userId,
  userRole,
  timeRange,
  filters,
  height = 600,
  width = '100%',
  className = '',
  onLoad,
  onError,
  refreshInterval = 300, // 5 minutes
  showBorder = true,
  showTitle = true
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [iframeUrl, setIframeUrl] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const jwtService = useRef<MetabaseJWTService | null>(null);

  // Initialize JWT service
  useEffect(() => {
    try {
      jwtService.current = new MetabaseJWTService({
        metabaseSecret: process.env.REACT_APP_METABASE_SECRET_KEY || 'your-metabase-secret-key',
        metabaseUrl: process.env.REACT_APP_METABASE_URL || 'http://localhost:3000',
        tokenExpiration: parseInt(process.env.REACT_APP_METABASE_TOKEN_EXPIRATION || '3600'),
        allowedDomains: process.env.REACT_APP_METABASE_ALLOWED_DOMAINS?.split(',') || ['localhost', 'sun-scorm.com']
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to initialize JWT service');
      setError(error);
      onError?.(error);
    }
  }, [onError]);

  // Generate dashboard URL
  const generateDashboardUrl = useCallback(() => {
    if (!jwtService.current) return '';

    const config: DashboardConfig = {
      dashboardId,
      tenantId,
      dispatchId,
      userId,
      userRole,
      timeRange,
      filters
    };

    return jwtService.current.generateDashboardUrl(config);
  }, [dashboardId, tenantId, dispatchId, userId, userRole, timeRange, filters]);

  // Load dashboard
  const loadDashboard = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const url = generateDashboardUrl();
      if (!url) {
        throw new Error('Failed to generate dashboard URL');
      }

      setIframeUrl(url);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to load dashboard');
      setError(error);
      onError?.(error);
    } finally {
      setIsLoading(false);
    }
  }, [generateDashboardUrl, onError]);

  // Refresh dashboard
  const refreshDashboard = useCallback(async () => {
    setIsRefreshing(true);
    await loadDashboard();
    setIsRefreshing(false);
  }, [loadDashboard]);

  // Initial load
  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // Auto-refresh interval
  useEffect(() => {
    if (refreshInterval > 0) {
      const interval = setInterval(refreshDashboard, refreshInterval * 1000);
      return () => clearInterval(interval);
    }
  }, [refreshDashboard, refreshInterval]);

  // Handle iframe load
  const handleIframeLoad = useCallback(() => {
    setIsLoading(false);
    onLoad?.();
  }, [onLoad]);

  // Handle iframe error
  const handleIframeError = useCallback(() => {
    const error = new Error('Failed to load dashboard iframe');
    setError(error);
    onError?.(error);
    setIsLoading(false);
  }, [onError]);

  if (error) {
    return (
      <div className={`metabase-dashboard-error ${className}`} style={{ height, width }}>
        <div className="error-content">
          <h3>Dashboard Error</h3>
          <p>{error.message}</p>
          <button onClick={loadDashboard} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`metabase-dashboard-container ${className}`} style={{ width, position: 'relative' }}>
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>Loading dashboard...</p>
          </div>
        </div>
      )}
      
      {isRefreshing && (
        <div className="refresh-indicator">
          <div className="refresh-spinner"></div>
          <span>Refreshing...</span>
        </div>
      )}

      <iframe
        ref={iframeRef}
        src={iframeUrl}
        width={width}
        height={height}
        style={{
          border: showBorder ? '1px solid #e0e0e0' : 'none',
          borderRadius: '8px',
          display: isLoading ? 'none' : 'block'
        }}
        onLoad={handleIframeLoad}
        onError={handleIframeError}
        title={`Dashboard ${dashboardId}`}
        allowFullScreen
      />
    </div>
  );
};

/**
 * Question Component (for individual charts)
 */
export const MetabaseQuestion: React.FC<QuestionProps> = ({
  questionId,
  tenantId,
  dispatchId,
  userId,
  userRole,
  timeRange,
  filters,
  height = 400,
  width = '100%',
  className = '',
  onLoad,
  onError,
  refreshInterval = 300,
  showBorder = true,
  showTitle = true
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [iframeUrl, setIframeUrl] = useState<string>('');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const jwtService = useRef<MetabaseJWTService | null>(null);

  // Initialize JWT service
  useEffect(() => {
    try {
      jwtService.current = new MetabaseJWTService({
        metabaseSecret: process.env.REACT_APP_METABASE_SECRET_KEY || 'your-metabase-secret-key',
        metabaseUrl: process.env.REACT_APP_METABASE_URL || 'http://localhost:3000',
        tokenExpiration: parseInt(process.env.REACT_APP_METABASE_TOKEN_EXPIRATION || '3600'),
        allowedDomains: process.env.REACT_APP_METABASE_ALLOWED_DOMAINS?.split(',') || ['localhost', 'sun-scorm.com']
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to initialize JWT service');
      setError(error);
      onError?.(error);
    }
  }, [onError]);

  // Generate question URL
  const generateQuestionUrl = useCallback(() => {
    if (!jwtService.current) return '';

    const config = {
      tenantId,
      dispatchId,
      userId,
      userRole,
      timeRange,
      filters
    };

    return jwtService.current.generateQuestionUrl(questionId, config);
  }, [questionId, tenantId, dispatchId, userId, userRole, timeRange, filters]);

  // Load question
  const loadQuestion = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const url = generateQuestionUrl();
      if (!url) {
        throw new Error('Failed to generate question URL');
      }

      setIframeUrl(url);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to load question');
      setError(error);
      onError?.(error);
    } finally {
      setIsLoading(false);
    }
  }, [generateQuestionUrl, onError]);

  // Initial load
  useEffect(() => {
    loadQuestion();
  }, [loadQuestion]);

  // Auto-refresh interval
  useEffect(() => {
    if (refreshInterval > 0) {
      const interval = setInterval(loadQuestion, refreshInterval * 1000);
      return () => clearInterval(interval);
    }
  }, [loadQuestion, refreshInterval]);

  // Handle iframe load
  const handleIframeLoad = useCallback(() => {
    setIsLoading(false);
    onLoad?.();
  }, [onLoad]);

  // Handle iframe error
  const handleIframeError = useCallback(() => {
    const error = new Error('Failed to load question iframe');
    setError(error);
    onError?.(error);
    setIsLoading(false);
  }, [onError]);

  if (error) {
    return (
      <div className={`metabase-question-error ${className}`} style={{ height, width }}>
        <div className="error-content">
          <h4>Chart Error</h4>
          <p>{error.message}</p>
          <button onClick={loadQuestion} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`metabase-question-container ${className}`} style={{ width, position: 'relative' }}>
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>Loading chart...</p>
          </div>
        </div>
      )}

      <iframe
        ref={iframeRef}
        src={iframeUrl}
        width={width}
        height={height}
        style={{
          border: showBorder ? '1px solid #e0e0e0' : 'none',
          borderRadius: '8px',
          display: isLoading ? 'none' : 'block'
        }}
        onLoad={handleIframeLoad}
        onError={handleIframeError}
        title={`Question ${questionId}`}
        allowFullScreen
      />
    </div>
  );
};

/**
 * Predefined Dashboard Components
 */
export const CompletionFunnelDashboard: React.FC<Omit<DashboardProps, 'dashboardId'>> = (props) => (
  <MetabaseDashboard dashboardId={DASHBOARD_CONFIGS.COMPLETION_FUNNEL.id} {...props} />
);

export const DropoutAnalysisDashboard: React.FC<Omit<DashboardProps, 'dashboardId'>> = (props) => (
  <MetabaseDashboard dashboardId={DASHBOARD_CONFIGS.DROPOUT_ANALYSIS.id} {...props} />
);

export const QuizPerformanceDashboard: React.FC<Omit<DashboardProps, 'dashboardId'>> = (props) => (
  <MetabaseDashboard dashboardId={DASHBOARD_CONFIGS.QUIZ_PERFORMANCE.id} {...props} />
);

export const RealtimeActivityDashboard: React.FC<Omit<DashboardProps, 'dashboardId'>> = (props) => (
  <MetabaseDashboard dashboardId={DASHBOARD_CONFIGS.REALTIME_ACTIVITY.id} {...props} />
);

export const EngagementMetricsDashboard: React.FC<Omit<DashboardProps, 'dashboardId'>> = (props) => (
  <MetabaseDashboard dashboardId={DASHBOARD_CONFIGS.ENGAGEMENT_METRICS.id} {...props} />
);

/**
 * Predefined Question Components
 */
export const CompletionRateChart: React.FC<Omit<QuestionProps, 'questionId'>> = (props) => (
  <MetabaseQuestion questionId={QUESTION_IDS.COMPLETION_RATE_CHART} {...props} />
);

export const PassRateChart: React.FC<Omit<QuestionProps, 'questionId'>> = (props) => (
  <MetabaseQuestion questionId={QUESTION_IDS.PASS_RATE_CHART} {...props} />
);

export const AverageScoreChart: React.FC<Omit<QuestionProps, 'questionId'>> = (props) => (
  <MetabaseQuestion questionId={QUESTION_IDS.AVERAGE_SCORE_CHART} {...props} />
);

export const TimeSpentChart: React.FC<Omit<QuestionProps, 'questionId'>> = (props) => (
  <MetabaseQuestion questionId={QUESTION_IDS.TIME_SPENT_CHART} {...props} />
);

export const DropoutFunnelChart: React.FC<Omit<QuestionProps, 'questionId'>> = (props) => (
  <MetabaseQuestion questionId={QUESTION_IDS.DROPOUT_FUNNEL_CHART} {...props} />
);

export const DailyActivityChart: React.FC<Omit<QuestionProps, 'questionId'>> = (props) => (
  <MetabaseQuestion questionId={QUESTION_IDS.DAILY_ACTIVITY_CHART} {...props} />
);

export const RealTimeLearnersChart: React.FC<Omit<QuestionProps, 'questionId'>> = (props) => (
  <MetabaseQuestion questionId={QUESTION_IDS.REAL_TIME_LEARNERS} {...props} />
);

/**
 * Analytics Dashboard Layout Component
 */
export interface AnalyticsDashboardLayoutProps {
  tenantId: string;
  dispatchId?: string;
  userId?: string;
  userRole?: 'admin' | 'instructor' | 'learner';
  timeRange?: {
    start: string;
    end: string;
  };
  layout?: 'grid' | 'tabs' | 'stacked';
  showQuickStats?: boolean;
  className?: string;
}

export const AnalyticsDashboardLayout: React.FC<AnalyticsDashboardLayoutProps> = ({
  tenantId,
  dispatchId,
  userId,
  userRole = 'instructor',
  timeRange,
  layout = 'grid',
  showQuickStats = true,
  className = ''
}) => {
  const commonProps = {
    tenantId,
    dispatchId,
    userId,
    userRole,
    timeRange,
    height: 400,
    refreshInterval: 300
  };

  const renderGridLayout = () => (
    <div className={`analytics-grid-layout ${className}`}>
      {showQuickStats && (
        <div className="quick-stats-row">
          <div className="stat-card">
            <CompletionRateChart {...commonProps} height={200} />
          </div>
          <div className="stat-card">
            <PassRateChart {...commonProps} height={200} />
          </div>
          <div className="stat-card">
            <AverageScoreChart {...commonProps} height={200} />
          </div>
          <div className="stat-card">
            <RealTimeLearnersChart {...commonProps} height={200} />
          </div>
        </div>
      )}

      <div className="main-dashboards-row">
        <div className="dashboard-card">
          <CompletionFunnelDashboard {...commonProps} height={500} />
        </div>
        <div className="dashboard-card">
          <DropoutAnalysisDashboard {...commonProps} height={500} />
        </div>
      </div>

      <div className="secondary-dashboards-row">
        <div className="dashboard-card">
          <QuizPerformanceDashboard {...commonProps} height={400} />
        </div>
        <div className="dashboard-card">
          <EngagementMetricsDashboard {...commonProps} height={400} />
        </div>
      </div>
    </div>
  );

  const renderTabsLayout = () => (
    <div className={`analytics-tabs-layout ${className}`}>
      <div className="tab-navigation">
        <button className="tab-button active">Overview</button>
        <button className="tab-button">Completion</button>
        <button className="tab-button">Performance</button>
        <button className="tab-button">Engagement</button>
      </div>
      
      <div className="tab-content">
        <CompletionFunnelDashboard {...commonProps} height={600} />
      </div>
    </div>
  );

  const renderStackedLayout = () => (
    <div className={`analytics-stacked-layout ${className}`}>
      <div className="stacked-dashboard">
        <CompletionFunnelDashboard {...commonProps} height={500} />
      </div>
      <div className="stacked-dashboard">
        <DropoutAnalysisDashboard {...commonProps} height={500} />
      </div>
      <div className="stacked-dashboard">
        <QuizPerformanceDashboard {...commonProps} height={500} />
      </div>
      <div className="stacked-dashboard">
        <EngagementMetricsDashboard {...commonProps} height={500} />
      </div>
    </div>
  );

  switch (layout) {
    case 'tabs':
      return renderTabsLayout();
    case 'stacked':
      return renderStackedLayout();
    default:
      return renderGridLayout();
  }
};
