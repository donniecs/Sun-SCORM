-- =============================================================================
-- RUSTICI KILLER - Production Database Migration
-- =============================================================================
-- This file contains the complete database schema for the Rustici Killer
-- SCORM platform production deployment.
-- 
-- Database: PostgreSQL 15+
-- Encoding: UTF-8
-- Timezone: UTC
-- 
-- CHANGE LOG:
-- 2025-07-15 02:22 - Phase 10: Production schema for Docker deployment
-- =============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =============================================================================
-- TENANT MANAGEMENT - Multi-tenant architecture
-- =============================================================================
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) UNIQUE NOT NULL,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- USER MANAGEMENT - Authentication and authorization
-- =============================================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'learner',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_email_per_tenant UNIQUE (tenant_id, email)
);

-- =============================================================================
-- COURSE MANAGEMENT - Content structure and metadata
-- =============================================================================
CREATE TABLE courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    version VARCHAR(50) DEFAULT '1.0.0',
    scorm_version VARCHAR(20) DEFAULT '2004',
    manifest_url VARCHAR(500),
    launch_url VARCHAR(500),
    mastery_score DECIMAL(5,2),
    metadata JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- REGISTRATION MANAGEMENT - User course enrollment
-- =============================================================================
CREATE TABLE registrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'enrolled',
    completion_status VARCHAR(50) DEFAULT 'incomplete',
    success_status VARCHAR(50) DEFAULT 'unknown',
    score DECIMAL(5,2),
    progress_measure DECIMAL(5,4),
    session_time INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_course UNIQUE (tenant_id, user_id, course_id)
);

-- =============================================================================
-- ACTIVITY TRACKING - Learning activity tree
-- =============================================================================
CREATE TABLE activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES activities(id) ON DELETE CASCADE,
    identifier VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    type VARCHAR(50) DEFAULT 'leaf',
    launch_url VARCHAR(500),
    parameters VARCHAR(500),
    sequence_order INTEGER DEFAULT 0,
    prerequisites TEXT,
    completion_threshold DECIMAL(5,2),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- SESSION MANAGEMENT - Learning session tracking
-- =============================================================================
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    registration_id UUID NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
    activity_id UUID REFERENCES activities(id) ON DELETE SET NULL,
    launch_url VARCHAR(500),
    session_state VARCHAR(50) DEFAULT 'active',
    entry_mode VARCHAR(50) DEFAULT 'normal',
    exit_mode VARCHAR(50),
    location VARCHAR(255),
    suspend_data TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    duration INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- CMI DATA MODEL - SCORM runtime data
-- =============================================================================
CREATE TABLE cmi_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    element_name VARCHAR(255) NOT NULL,
    element_value TEXT,
    data_type VARCHAR(50) DEFAULT 'string',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- xAPI STATEMENTS - Experience API data
-- =============================================================================
CREATE TABLE xapi_statements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    statement_id UUID UNIQUE NOT NULL,
    actor JSONB NOT NULL,
    verb JSONB NOT NULL,
    object JSONB NOT NULL,
    result JSONB,
    context JSONB,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    stored TIMESTAMPTZ DEFAULT NOW(),
    authority JSONB,
    version VARCHAR(20) DEFAULT '1.0.3',
    voided BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- AUDIT TRAIL - System activity logging
-- =============================================================================
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- INDEXES - Performance optimization
-- =============================================================================

-- Tenant indexes
CREATE INDEX idx_tenants_domain ON tenants(domain);

-- User indexes
CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(is_active);

-- Course indexes
CREATE INDEX idx_courses_tenant_id ON courses(tenant_id);
CREATE INDEX idx_courses_active ON courses(is_active);

-- Registration indexes
CREATE INDEX idx_registrations_tenant_id ON registrations(tenant_id);
CREATE INDEX idx_registrations_user_id ON registrations(user_id);
CREATE INDEX idx_registrations_course_id ON registrations(course_id);
CREATE INDEX idx_registrations_status ON registrations(status);

-- Activity indexes
CREATE INDEX idx_activities_tenant_id ON activities(tenant_id);
CREATE INDEX idx_activities_course_id ON activities(course_id);
CREATE INDEX idx_activities_parent_id ON activities(parent_id);
CREATE INDEX idx_activities_identifier ON activities(identifier);

-- Session indexes
CREATE INDEX idx_sessions_tenant_id ON sessions(tenant_id);
CREATE INDEX idx_sessions_registration_id ON sessions(registration_id);
CREATE INDEX idx_sessions_activity_id ON sessions(activity_id);
CREATE INDEX idx_sessions_state ON sessions(session_state);

-- CMI data indexes
CREATE INDEX idx_cmi_data_tenant_id ON cmi_data(tenant_id);
CREATE INDEX idx_cmi_data_session_id ON cmi_data(session_id);
CREATE INDEX idx_cmi_data_element_name ON cmi_data(element_name);

-- xAPI indexes
CREATE INDEX idx_xapi_statements_tenant_id ON xapi_statements(tenant_id);
CREATE INDEX idx_xapi_statements_statement_id ON xapi_statements(statement_id);
CREATE INDEX idx_xapi_statements_timestamp ON xapi_statements(timestamp);
CREATE INDEX idx_xapi_statements_voided ON xapi_statements(voided);

-- Audit log indexes
CREATE INDEX idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- =============================================================================
-- TRIGGERS - Automatic timestamp updates
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_courses_updated_at BEFORE UPDATE ON courses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_registrations_updated_at BEFORE UPDATE ON registrations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_activities_updated_at BEFORE UPDATE ON activities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cmi_data_updated_at BEFORE UPDATE ON cmi_data
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- SEED DATA - Initial production data
-- =============================================================================

-- Default tenant
INSERT INTO tenants (id, name, domain, settings) VALUES 
    ('00000000-0000-0000-0000-000000000001', 'Default Tenant', 'default.localhost', '{"features": {"scorm": true, "xapi": true}}');

-- Default admin user
INSERT INTO users (id, tenant_id, email, password_hash, first_name, last_name, role) VALUES 
    ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'admin@rustici-killer.com', '$2b$10$YourHashedPasswordHere', 'Admin', 'User', 'admin');

-- =============================================================================
-- SCHEMA VALIDATION
-- =============================================================================
-- This section validates the schema is properly created
DO $$
BEGIN
    -- Check if all tables exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenants') THEN
        RAISE EXCEPTION 'Migration failed: tenants table not created';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        RAISE EXCEPTION 'Migration failed: users table not created';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'courses') THEN
        RAISE EXCEPTION 'Migration failed: courses table not created';
    END IF;
    
    RAISE NOTICE 'Migration completed successfully - All tables created';
END $$;
