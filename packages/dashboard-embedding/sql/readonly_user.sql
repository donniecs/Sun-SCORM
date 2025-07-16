-- Create readonly user for Metabase access to analytics data
-- This script creates a dedicated readonly user that Metabase will use
-- to connect to the analytics database

-- Create readonly user
CREATE USER metabase_readonly WITH PASSWORD 'readonly_password';

-- Grant connect permissions
GRANT CONNECT ON DATABASE lrsql TO metabase_readonly;

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO metabase_readonly;

-- Grant select permissions on existing tables
GRANT SELECT ON ALL TABLES IN SCHEMA public TO metabase_readonly;

-- Grant select permissions on future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO metabase_readonly;

-- Grant select permissions on specific analytics tables
GRANT SELECT ON statement_metadata TO metabase_readonly;
GRANT SELECT ON completion_analytics TO metabase_readonly;
GRANT SELECT ON daily_activity_summary TO metabase_readonly;
GRANT SELECT ON learner_progress TO metabase_readonly;
GRANT SELECT ON performance_metrics TO metabase_readonly;
GRANT SELECT ON dashboard_metrics TO metabase_readonly;

-- Grant usage on sequences (needed for some queries)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO metabase_readonly;

-- Create additional analytics views for Metabase
CREATE OR REPLACE VIEW metabase_completion_funnel AS
SELECT 
    sm.tenant_id,
    sm.dispatch_id,
    sm.object_id as course_id,
    COUNT(DISTINCT sm.actor_name) as total_learners,
    COUNT(DISTINCT CASE WHEN sm.verb_id LIKE '%initialized%' THEN sm.actor_name END) as started_learners,
    COUNT(DISTINCT CASE WHEN sm.verb_id LIKE '%progressed%' THEN sm.actor_name END) as progressed_learners,
    COUNT(DISTINCT CASE WHEN sm.verb_id LIKE '%completed%' THEN sm.actor_name END) as completed_learners,
    COUNT(DISTINCT CASE WHEN sm.verb_id LIKE '%passed%' THEN sm.actor_name END) as passed_learners,
    ROUND(
        COUNT(DISTINCT CASE WHEN sm.verb_id LIKE '%completed%' THEN sm.actor_name END) * 100.0 / 
        NULLIF(COUNT(DISTINCT CASE WHEN sm.verb_id LIKE '%initialized%' THEN sm.actor_name END), 0), 2
    ) as completion_rate,
    ROUND(
        COUNT(DISTINCT CASE WHEN sm.verb_id LIKE '%passed%' THEN sm.actor_name END) * 100.0 / 
        NULLIF(COUNT(DISTINCT CASE WHEN sm.verb_id LIKE '%completed%' THEN sm.actor_name END), 0), 2
    ) as pass_rate
FROM statement_metadata sm
WHERE sm.timestamp >= NOW() - INTERVAL '30 days'
GROUP BY sm.tenant_id, sm.dispatch_id, sm.object_id;

CREATE OR REPLACE VIEW metabase_dropout_analysis AS
SELECT 
    sm.tenant_id,
    sm.dispatch_id,
    sm.object_id as course_id,
    sm.actor_name,
    MIN(sm.timestamp) as first_access,
    MAX(sm.timestamp) as last_access,
    COUNT(*) as total_interactions,
    CASE 
        WHEN COUNT(CASE WHEN sm.verb_id LIKE '%completed%' THEN 1 END) > 0 THEN 'completed'
        WHEN COUNT(CASE WHEN sm.verb_id LIKE '%suspended%' THEN 1 END) > 0 THEN 'suspended'
        WHEN MAX(sm.timestamp) < NOW() - INTERVAL '7 days' THEN 'dropped_out'
        ELSE 'active'
    END as learner_status,
    EXTRACT(EPOCH FROM (MAX(sm.timestamp) - MIN(sm.timestamp))) / 3600 as hours_engaged
FROM statement_metadata sm
WHERE sm.timestamp >= NOW() - INTERVAL '60 days'
GROUP BY sm.tenant_id, sm.dispatch_id, sm.object_id, sm.actor_name;

CREATE OR REPLACE VIEW metabase_quiz_performance AS
SELECT 
    sm.tenant_id,
    sm.dispatch_id,
    sm.object_id as course_id,
    sm.actor_name,
    COUNT(CASE WHEN sm.verb_id LIKE '%answered%' THEN 1 END) as questions_answered,
    COUNT(CASE WHEN sm.verb_id LIKE '%answered%' AND sm.verb_id LIKE '%correct%' THEN 1 END) as correct_answers,
    ROUND(
        COUNT(CASE WHEN sm.verb_id LIKE '%answered%' AND sm.verb_id LIKE '%correct%' THEN 1 END) * 100.0 / 
        NULLIF(COUNT(CASE WHEN sm.verb_id LIKE '%answered%' THEN 1 END), 0), 2
    ) as accuracy_percent,
    AVG(CASE WHEN sm.verb_id LIKE '%scored%' THEN 
        CAST(split_part(sm.object_id, '/', -1) AS DECIMAL) 
    END) as average_score
FROM statement_metadata sm
WHERE sm.timestamp >= NOW() - INTERVAL '30 days'
    AND (sm.verb_id LIKE '%answered%' OR sm.verb_id LIKE '%scored%')
GROUP BY sm.tenant_id, sm.dispatch_id, sm.object_id, sm.actor_name;

CREATE OR REPLACE VIEW metabase_realtime_activity AS
SELECT 
    sm.tenant_id,
    sm.dispatch_id,
    sm.object_id as course_id,
    sm.actor_name,
    sm.verb_id,
    sm.timestamp,
    CASE 
        WHEN sm.timestamp >= NOW() - INTERVAL '5 minutes' THEN 'active_now'
        WHEN sm.timestamp >= NOW() - INTERVAL '30 minutes' THEN 'recent'
        WHEN sm.timestamp >= NOW() - INTERVAL '2 hours' THEN 'today'
        ELSE 'older'
    END as activity_recency
FROM statement_metadata sm
WHERE sm.timestamp >= NOW() - INTERVAL '24 hours'
ORDER BY sm.timestamp DESC;

CREATE OR REPLACE VIEW metabase_engagement_metrics AS
SELECT 
    sm.tenant_id,
    sm.dispatch_id,
    sm.object_id as course_id,
    sm.actor_name,
    COUNT(*) as total_interactions,
    COUNT(DISTINCT DATE(sm.timestamp)) as active_days,
    MIN(sm.timestamp) as first_interaction,
    MAX(sm.timestamp) as last_interaction,
    EXTRACT(EPOCH FROM (MAX(sm.timestamp) - MIN(sm.timestamp))) / 3600 as total_hours,
    COUNT(*) / NULLIF(COUNT(DISTINCT DATE(sm.timestamp)), 0) as avg_interactions_per_day
FROM statement_metadata sm
WHERE sm.timestamp >= NOW() - INTERVAL '30 days'
GROUP BY sm.tenant_id, sm.dispatch_id, sm.object_id, sm.actor_name;

-- Grant permissions on new views
GRANT SELECT ON metabase_completion_funnel TO metabase_readonly;
GRANT SELECT ON metabase_dropout_analysis TO metabase_readonly;
GRANT SELECT ON metabase_quiz_performance TO metabase_readonly;
GRANT SELECT ON metabase_realtime_activity TO metabase_readonly;
GRANT SELECT ON metabase_engagement_metrics TO metabase_readonly;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_statement_metadata_tenant_verb ON statement_metadata(tenant_id, verb_id);
CREATE INDEX IF NOT EXISTS idx_statement_metadata_object_verb ON statement_metadata(object_id, verb_id);
CREATE INDEX IF NOT EXISTS idx_statement_metadata_actor_verb ON statement_metadata(actor_name, verb_id);
CREATE INDEX IF NOT EXISTS idx_statement_metadata_timestamp_recent ON statement_metadata(timestamp) WHERE timestamp >= NOW() - INTERVAL '30 days';

-- Create function to refresh analytics views
CREATE OR REPLACE FUNCTION refresh_metabase_views()
RETURNS void AS $$
BEGIN
    -- Refresh any materialized views if needed
    REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_metrics;
    
    -- Update statistics for better query performance
    ANALYZE statement_metadata;
    ANALYZE performance_metrics;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION refresh_metabase_views() TO metabase_readonly;

-- Show permissions granted
SELECT 
    'Permissions granted successfully' as status,
    'metabase_readonly user created' as user_status,
    COUNT(*) as views_created
FROM information_schema.views 
WHERE table_schema = 'public' 
AND table_name LIKE 'metabase_%';
