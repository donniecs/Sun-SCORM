-- Production Database Migration Script
-- Rustici Killer Platform - Complete Schema

BEGIN;

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create courses table
CREATE TABLE IF NOT EXISTS courses (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    course_id VARCHAR(255) UNIQUE NOT NULL,
    version VARCHAR(50) DEFAULT '1.0',
    manifest_path TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create activities table
CREATE TABLE IF NOT EXISTS activities (
    id SERIAL PRIMARY KEY,
    course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
    activity_id VARCHAR(255) NOT NULL,
    title VARCHAR(255),
    type VARCHAR(100),
    launch_url TEXT,
    parent_id INTEGER REFERENCES activities(id) ON DELETE CASCADE,
    sequence_position INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(course_id, activity_id)
);

-- Create user_sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create activity_sessions table
CREATE TABLE IF NOT EXISTS activity_sessions (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES user_sessions(id) ON DELETE CASCADE,
    activity_id INTEGER REFERENCES activities(id) ON DELETE CASCADE,
    attempt_number INTEGER DEFAULT 1,
    completion_status VARCHAR(50) DEFAULT 'unknown',
    success_status VARCHAR(50) DEFAULT 'unknown',
    score_raw DECIMAL(10,2),
    score_min DECIMAL(10,2),
    score_max DECIMAL(10,2),
    progress_measure DECIMAL(5,4),
    session_time INTERVAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create sequencing_sessions table
CREATE TABLE IF NOT EXISTS sequencing_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
    current_activity_id INTEGER REFERENCES activities(id),
    navigation_state JSONB DEFAULT '{}',
    completion_state JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create xapi_statements table
CREATE TABLE IF NOT EXISTS xapi_statements (
    id SERIAL PRIMARY KEY,
    statement_id UUID UNIQUE NOT NULL,
    actor JSONB NOT NULL,
    verb JSONB NOT NULL,
    object JSONB NOT NULL,
    result JSONB,
    context JSONB,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    stored TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    authority JSONB,
    version VARCHAR(20) DEFAULT '1.0.3',
    attachments JSONB,
    more_info TEXT,
    user_id INTEGER REFERENCES users(id),
    course_id INTEGER REFERENCES courses(id),
    activity_id INTEGER REFERENCES activities(id)
);

-- Create user_progress table
CREATE TABLE IF NOT EXISTS user_progress (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
    activity_id INTEGER REFERENCES activities(id) ON DELETE CASCADE,
    completion_status VARCHAR(50) DEFAULT 'incomplete',
    success_status VARCHAR(50) DEFAULT 'unknown',
    score_raw DECIMAL(10,2),
    score_scaled DECIMAL(5,4),
    progress_measure DECIMAL(5,4),
    session_time INTERVAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, course_id, activity_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_courses_course_id ON courses(course_id);
CREATE INDEX IF NOT EXISTS idx_activities_course_id ON activities(course_id);
CREATE INDEX IF NOT EXISTS idx_activities_activity_id ON activities(activity_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_activity_sessions_session_id ON activity_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_sequencing_sessions_user_id ON sequencing_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sequencing_sessions_course_id ON sequencing_sessions(course_id);
CREATE INDEX IF NOT EXISTS idx_xapi_statements_statement_id ON xapi_statements(statement_id);
CREATE INDEX IF NOT EXISTS idx_xapi_statements_actor ON xapi_statements USING GIN(actor);
CREATE INDEX IF NOT EXISTS idx_xapi_statements_verb ON xapi_statements USING GIN(verb);
CREATE INDEX IF NOT EXISTS idx_xapi_statements_object ON xapi_statements USING GIN(object);
CREATE INDEX IF NOT EXISTS idx_xapi_statements_timestamp ON xapi_statements(timestamp);
CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_course_id ON user_progress(course_id);

-- Create trigger for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_courses_updated_at ON courses;
CREATE TRIGGER update_courses_updated_at BEFORE UPDATE ON courses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_activity_sessions_updated_at ON activity_sessions;
CREATE TRIGGER update_activity_sessions_updated_at BEFORE UPDATE ON activity_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sequencing_sessions_updated_at ON sequencing_sessions;
CREATE TRIGGER update_sequencing_sessions_updated_at BEFORE UPDATE ON sequencing_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_progress_updated_at ON user_progress;
CREATE TRIGGER update_user_progress_updated_at BEFORE UPDATE ON user_progress FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data for testing
INSERT INTO users (username, email, password_hash, first_name, last_name) VALUES 
('testuser', 'test@example.com', '$2b$10$sample.hash.here', 'Test', 'User')
ON CONFLICT (username) DO NOTHING;

INSERT INTO courses (title, description, course_id, version) VALUES 
('Sample SCORM Course', 'A sample course for testing', 'sample-course-v1', '1.0')
ON CONFLICT (course_id) DO NOTHING;

COMMIT;

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;
