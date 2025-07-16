-- SQL LRS Database Initialization Script
-- This script sets up the database schema for the Yet Analytics SQL LRS
-- and additional tables for statement metadata tracking

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create statement metadata table for efficient querying
CREATE TABLE IF NOT EXISTS statement_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    statement_id UUID NOT NULL UNIQUE,
    tenant_id VARCHAR(255) NOT NULL,
    dispatch_id UUID NOT NULL,
    actor_name VARCHAR(255) NOT NULL,
    verb_id VARCHAR(500) NOT NULL,
    object_id VARCHAR(500) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_statement_metadata_tenant_id ON statement_metadata(tenant_id);
CREATE INDEX IF NOT EXISTS idx_statement_metadata_dispatch_id ON statement_metadata(dispatch_id);
CREATE INDEX IF NOT EXISTS idx_statement_metadata_actor_name ON statement_metadata(actor_name);
CREATE INDEX IF NOT EXISTS idx_statement_metadata_verb_id ON statement_metadata(verb_id);
CREATE INDEX IF NOT EXISTS idx_statement_metadata_timestamp ON statement_metadata(timestamp);
CREATE INDEX IF NOT EXISTS idx_statement_metadata_processed_at ON statement_metadata(processed_at);
CREATE INDEX IF NOT EXISTS idx_statement_metadata_tenant_dispatch ON statement_metadata(tenant_id, dispatch_id);

-- Create GIN index for text search
CREATE INDEX IF NOT EXISTS idx_statement_metadata_actor_name_gin ON statement_metadata USING GIN (actor_name gin_trgm_ops);

-- Create analytics views for common queries
CREATE OR REPLACE VIEW completion_analytics AS
SELECT 
    sm.tenant_id,
    sm.dispatch_id,
    sm.actor_name,
    sm.object_id,
    COUNT(*) as total_statements,
    COUNT(CASE WHEN sm.verb_id LIKE '%completed%' THEN 1 END) as completed_count,
    COUNT(CASE WHEN sm.verb_id LIKE '%passed%' THEN 1 END) as passed_count,
    COUNT(CASE WHEN sm.verb_id LIKE '%failed%' THEN 1 END) as failed_count,
    COUNT(CASE WHEN sm.verb_id LIKE '%suspended%' THEN 1 END) as suspended_count,
    MIN(sm.timestamp) as first_activity,
    MAX(sm.timestamp) as last_activity,
    EXTRACT(EPOCH FROM (MAX(sm.timestamp) - MIN(sm.timestamp))) as session_duration_seconds
FROM statement_metadata sm
WHERE sm.timestamp >= NOW() - INTERVAL '30 days'
GROUP BY sm.tenant_id, sm.dispatch_id, sm.actor_name, sm.object_id;

CREATE OR REPLACE VIEW daily_activity_summary AS
SELECT 
    sm.tenant_id,
    DATE(sm.timestamp) as activity_date,
    COUNT(DISTINCT sm.actor_name) as unique_learners,
    COUNT(DISTINCT sm.object_id) as unique_activities,
    COUNT(*) as total_statements,
    COUNT(CASE WHEN sm.verb_id LIKE '%completed%' THEN 1 END) as completions,
    COUNT(CASE WHEN sm.verb_id LIKE '%passed%' THEN 1 END) as passes,
    COUNT(CASE WHEN sm.verb_id LIKE '%failed%' THEN 1 END) as failures
FROM statement_metadata sm
WHERE sm.timestamp >= NOW() - INTERVAL '90 days'
GROUP BY sm.tenant_id, DATE(sm.timestamp)
ORDER BY activity_date DESC;

CREATE OR REPLACE VIEW learner_progress AS
SELECT 
    sm.tenant_id,
    sm.dispatch_id,
    sm.actor_name,
    sm.object_id,
    CASE 
        WHEN COUNT(CASE WHEN sm.verb_id LIKE '%passed%' THEN 1 END) > 0 THEN 'passed'
        WHEN COUNT(CASE WHEN sm.verb_id LIKE '%failed%' THEN 1 END) > 0 THEN 'failed'
        WHEN COUNT(CASE WHEN sm.verb_id LIKE '%completed%' THEN 1 END) > 0 THEN 'completed'
        WHEN COUNT(CASE WHEN sm.verb_id LIKE '%suspended%' THEN 1 END) > 0 THEN 'suspended'
        ELSE 'in_progress'
    END as current_status,
    COUNT(*) as total_interactions,
    MIN(sm.timestamp) as started_at,
    MAX(sm.timestamp) as last_activity,
    EXTRACT(EPOCH FROM (MAX(sm.timestamp) - MIN(sm.timestamp))) as total_time_seconds
FROM statement_metadata sm
GROUP BY sm.tenant_id, sm.dispatch_id, sm.actor_name, sm.object_id;

-- Create performance monitoring table
CREATE TABLE IF NOT EXISTS performance_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_name VARCHAR(255) NOT NULL,
    metric_value DECIMAL(10,2) NOT NULL,
    tenant_id VARCHAR(255),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_performance_metrics_name ON performance_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_tenant ON performance_metrics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_timestamp ON performance_metrics(timestamp);

-- Create trigger for updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_statement_metadata_updated_at 
    BEFORE UPDATE ON statement_metadata 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert sample performance metrics
INSERT INTO performance_metrics (metric_name, metric_value, metadata) VALUES
('avg_response_time_ms', 125.5, '{"service": "statement-forwarder", "endpoint": "/statements"}'),
('statements_per_second', 45.2, '{"service": "sql-lrs", "type": "throughput"}'),
('error_rate_percent', 0.1, '{"service": "statement-forwarder", "time_window": "1h"}');

-- Create materialized view for dashboard performance
CREATE MATERIALIZED VIEW IF NOT EXISTS dashboard_metrics AS
SELECT 
    sm.tenant_id,
    COUNT(DISTINCT sm.actor_name) as total_learners,
    COUNT(DISTINCT sm.object_id) as total_activities,
    COUNT(*) as total_statements,
    COUNT(CASE WHEN sm.verb_id LIKE '%completed%' THEN 1 END) as total_completions,
    COUNT(CASE WHEN sm.verb_id LIKE '%passed%' THEN 1 END) as total_passes,
    COUNT(CASE WHEN sm.verb_id LIKE '%failed%' THEN 1 END) as total_failures,
    ROUND(
        COUNT(CASE WHEN sm.verb_id LIKE '%completed%' THEN 1 END) * 100.0 / 
        NULLIF(COUNT(DISTINCT sm.actor_name), 0), 2
    ) as completion_rate_percent,
    ROUND(
        COUNT(CASE WHEN sm.verb_id LIKE '%passed%' THEN 1 END) * 100.0 / 
        NULLIF(COUNT(CASE WHEN sm.verb_id LIKE '%completed%' THEN 1 END), 0), 2
    ) as pass_rate_percent,
    NOW() as last_updated
FROM statement_metadata sm
WHERE sm.timestamp >= NOW() - INTERVAL '30 days'
GROUP BY sm.tenant_id;

-- Create unique index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_dashboard_metrics_tenant ON dashboard_metrics(tenant_id);

-- Create function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_dashboard_metrics()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_metrics;
END;
$$ LANGUAGE plpgsql;

-- Create scheduled job to refresh materialized view every 5 minutes
-- Note: This would typically be handled by a job scheduler in production
-- For now, we'll create a function that can be called manually or via cron

-- Grant permissions for the LRS service
GRANT SELECT, INSERT, UPDATE, DELETE ON statement_metadata TO lrsql;
GRANT SELECT ON completion_analytics TO lrsql;
GRANT SELECT ON daily_activity_summary TO lrsql;
GRANT SELECT ON learner_progress TO lrsql;
GRANT SELECT, INSERT, UPDATE, DELETE ON performance_metrics TO lrsql;
GRANT SELECT ON dashboard_metrics TO lrsql;
GRANT EXECUTE ON FUNCTION refresh_dashboard_metrics() TO lrsql;

-- Create some sample data for testing
INSERT INTO statement_metadata (
    statement_id, tenant_id, dispatch_id, actor_name, verb_id, object_id, timestamp
) VALUES 
(
    uuid_generate_v4(), 
    'tenant1', 
    uuid_generate_v4(), 
    'John Doe', 
    'http://adlnet.gov/expapi/verbs/completed', 
    'https://example.com/course/module1',
    NOW() - INTERVAL '1 hour'
),
(
    uuid_generate_v4(), 
    'tenant1', 
    uuid_generate_v4(), 
    'Jane Smith', 
    'http://adlnet.gov/expapi/verbs/passed', 
    'https://example.com/course/module1',
    NOW() - INTERVAL '30 minutes'
),
(
    uuid_generate_v4(), 
    'tenant1', 
    uuid_generate_v4(), 
    'Bob Johnson', 
    'http://adlnet.gov/expapi/verbs/failed', 
    'https://example.com/course/module2',
    NOW() - INTERVAL '15 minutes'
);

-- Refresh the materialized view
SELECT refresh_dashboard_metrics();

-- Display initial statistics
SELECT 'Database initialization completed successfully' as status;
SELECT 'Sample data created:' as info;
SELECT COUNT(*) as statement_count FROM statement_metadata;
SELECT COUNT(*) as metric_count FROM performance_metrics;
SELECT * FROM dashboard_metrics;
