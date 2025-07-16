/**
 * Dashboard Embedding Package
 * 
 * This package provides React components and services for embedding
 * Metabase dashboards with JWT authentication and tenant isolation.
 */

// Core services
export { MetabaseJWTService, createMetabaseJWTService } from './services/MetabaseJWTService';
export type { 
  MetabaseJWTPayload, 
  DashboardConfig, 
  EmbeddingConfig 
} from './services/MetabaseJWTService';

// React components
export {
  MetabaseDashboard,
  MetabaseQuestion,
  CompletionFunnelDashboard,
  DropoutAnalysisDashboard,
  QuizPerformanceDashboard,
  RealtimeActivityDashboard,
  EngagementMetricsDashboard,
  CompletionRateChart,
  PassRateChart,
  AverageScoreChart,
  TimeSpentChart,
  DropoutFunnelChart,
  DailyActivityChart,
  RealTimeLearnersChart,
  AnalyticsDashboardLayout
} from './components/MetabaseDashboard';

export type {
  DashboardProps,
  QuestionProps,
  AnalyticsDashboardLayoutProps
} from './components/MetabaseDashboard';

// Constants
export { DASHBOARD_CONFIGS, QUESTION_IDS } from './services/MetabaseJWTService';

// Styles
import './styles/index.css';
