# Bootstrap Staging Environment Script
# Creates test tenants, users, and sample course for UAT testing

param(
    [string]$DatabaseUrl = $env:DATABASE_URL,
    [string]$Environment = "staging",
    [switch]$Force = $false,
    [switch]$Verbose = $false
)

# Script metadata
$ScriptName = "bootstrap-staging.ps1"
$ScriptVersion = "1.0.0"
$ScriptDescription = "Bootstrap staging environment with test data for UAT"

Write-Host "🚀 $ScriptName v$ScriptVersion" -ForegroundColor Cyan
Write-Host "📝 $ScriptDescription" -ForegroundColor Gray
Write-Host ""

# Check if running in staging environment
if ($Environment -ne "staging") {
    Write-Host "❌ This script should only be run in staging environment" -ForegroundColor Red
    Write-Host "   Current environment: $Environment" -ForegroundColor Yellow
    exit 1
}

# Validate database connection
if (-not $DatabaseUrl) {
    Write-Host "❌ DATABASE_URL not found in environment variables" -ForegroundColor Red
    Write-Host "   Please set DATABASE_URL or pass -DatabaseUrl parameter" -ForegroundColor Yellow
    exit 1
}

Write-Host "🔍 Validating database connection..." -ForegroundColor Yellow

# Check if PostgreSQL client is available
try {
    $pgVersion = psql --version
    if ($Verbose) {
        Write-Host "✅ PostgreSQL client found: $pgVersion" -ForegroundColor Green
    }
}
catch {
    Write-Host "❌ PostgreSQL client (psql) not found in PATH" -ForegroundColor Red
    Write-Host "   Please install PostgreSQL client tools" -ForegroundColor Yellow
    exit 1
}

# Test database connection
try {
    $testQuery = "SELECT current_database(), current_user, version();"
    $dbInfo = psql $DatabaseUrl -c $testQuery -t
    Write-Host "✅ Database connection successful" -ForegroundColor Green
    
    if ($Verbose) {
        Write-Host "📊 Database info:" -ForegroundColor Gray
        Write-Host "$dbInfo" -ForegroundColor Gray
    }
}
catch {
    Write-Host "❌ Failed to connect to database" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Yellow
    exit 1
}

# Check if test data already exists
Write-Host "🔍 Checking for existing test data..." -ForegroundColor Yellow

$checkTenantQuery = "SELECT COUNT(*) FROM tenants WHERE id = 'test-tenant-uat';"
$existingTenants = psql $DatabaseUrl -c $checkTenantQuery -t --tuples-only

if ($existingTenants -gt 0 -and -not $Force) {
    Write-Host "⚠️  Test data already exists in database" -ForegroundColor Yellow
    Write-Host "   Use -Force to recreate test data" -ForegroundColor Gray
    
    # Show existing test data
    Write-Host "📊 Existing test data:" -ForegroundColor Gray
    $existingData = psql $DatabaseUrl -c "SELECT 'Tenants:' as type, COUNT(*) as count FROM tenants WHERE id LIKE 'test-%' UNION ALL SELECT 'Users:', COUNT(*) FROM users WHERE email LIKE '%@test.example%' UNION ALL SELECT 'Courses:', COUNT(*) FROM courses WHERE title LIKE 'Test Course%';" -t
    Write-Host "$existingData" -ForegroundColor Gray
    
    exit 0
}

# Create test tenant
Write-Host "🏢 Creating test tenant..." -ForegroundColor Yellow

$createTenantQuery = @"
INSERT INTO tenants (id, name, settings, created_at, updated_at)
VALUES (
    'test-tenant-uat',
    'UAT Test Tenant',
    '{
        "features": {
            "scorm_12": true,
            "scorm_2004": true,
            "xapi": true,
            "multi_course": true,
            "analytics": true
        },
        "limits": {
            "max_courses": 100,
            "max_users": 1000,
            "max_file_size": 536870912
        },
        "branding": {
            "logo": null,
            "primary_color": "#3498db",
            "secondary_color": "#2ecc71"
        }
    }',
    NOW(),
    NOW()
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    settings = EXCLUDED.settings,
    updated_at = NOW();
"@

try {
    psql $DatabaseUrl -c $createTenantQuery
    Write-Host "✅ Test tenant created successfully" -ForegroundColor Green
}
catch {
    Write-Host "❌ Failed to create test tenant" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Yellow
    exit 1
}

# Create test users
Write-Host "👥 Creating test users..." -ForegroundColor Yellow

$users = @(
    @{
        id = "test-user-admin-001"
        email = "admin@test.example"
        password = "testpassword123"
        role = "admin"
        firstName = "Test"
        lastName = "Administrator"
    },
    @{
        id = "test-user-learner-001"
        email = "learner@test.example"
        password = "testpassword123"
        role = "learner"
        firstName = "Test"
        lastName = "Learner"
    }
)

foreach ($user in $users) {
    $createUserQuery = @"
INSERT INTO users (id, email, password_hash, role, first_name, last_name, tenant_id, created_at, updated_at)
VALUES (
    '$($user.id)',
    '$($user.email)',
    crypt('$($user.password)', gen_salt('bf')),
    '$($user.role)',
    '$($user.firstName)',
    '$($user.lastName)',
    'test-tenant-uat',
    NOW(),
    NOW()
)
ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    role = EXCLUDED.role,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    updated_at = NOW();
"@

    try {
        psql $DatabaseUrl -c $createUserQuery
        Write-Host "✅ Created user: $($user.email) ($($user.role))" -ForegroundColor Green
    }
    catch {
        Write-Host "❌ Failed to create user: $($user.email)" -ForegroundColor Red
        Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

# Create sample course entry (placeholder)
Write-Host "📚 Creating sample course entry..." -ForegroundColor Yellow

$createCourseQuery = @"
INSERT INTO courses (id, title, description, version, tenant_id, file_path, file_size, status, created_at, updated_at)
VALUES (
    'test-course-sample-001',
    'Test Course - SCORM 1.2 Sample',
    'Sample SCORM course for UAT testing. Upload a real SCORM package to replace this placeholder.',
    '1.0',
    'test-tenant-uat',
    'placeholder/sample-course.zip',
    1024000,
    'placeholder',
    NOW(),
    NOW()
)
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    status = EXCLUDED.status,
    updated_at = NOW();
"@

try {
    psql $DatabaseUrl -c $createCourseQuery
    Write-Host "✅ Sample course entry created" -ForegroundColor Green
}
catch {
    Write-Host "❌ Failed to create sample course entry" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Create test registration
Write-Host "📋 Creating test registration..." -ForegroundColor Yellow

$createRegistrationQuery = @"
INSERT INTO registrations (id, user_id, course_id, status, progress, created_at, updated_at)
VALUES (
    'test-registration-001',
    'test-user-learner-001',
    'test-course-sample-001',
    'in_progress',
    0,
    NOW(),
    NOW()
)
ON CONFLICT (id) DO UPDATE SET
    status = EXCLUDED.status,
    progress = EXCLUDED.progress,
    updated_at = NOW();
"@

try {
    psql $DatabaseUrl -c $createRegistrationQuery
    Write-Host "✅ Test registration created" -ForegroundColor Green
}
catch {
    Write-Host "❌ Failed to create test registration" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Create sample xAPI statements
Write-Host "📊 Creating sample xAPI statements..." -ForegroundColor Yellow

$statements = @(
    @{
        id = "test-statement-001"
        actor = "learner@test.example"
        verb = "experienced"
        object = "test-course-sample-001"
        result = '{"completion": false, "success": null, "score": null}'
    },
    @{
        id = "test-statement-002"
        actor = "learner@test.example"
        verb = "attempted"
        object = "test-course-sample-001"
        result = '{"completion": false, "success": null, "score": null}'
    }
)

foreach ($statement in $statements) {
    $createStatementQuery = @"
INSERT INTO xapi_statements (id, actor, verb, object, result, timestamp, registration_id)
VALUES (
    '$($statement.id)',
    '$($statement.actor)',
    '$($statement.verb)',
    '$($statement.object)',
    '$($statement.result)',
    NOW(),
    'test-registration-001'
)
ON CONFLICT (id) DO UPDATE SET
    actor = EXCLUDED.actor,
    verb = EXCLUDED.verb,
    object = EXCLUDED.object,
    result = EXCLUDED.result,
    timestamp = NOW();
"@

    try {
        psql $DatabaseUrl -c $createStatementQuery
        Write-Host "✅ Created xAPI statement: $($statement.verb)" -ForegroundColor Green
    }
    catch {
        Write-Host "❌ Failed to create xAPI statement: $($statement.verb)" -ForegroundColor Red
        Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

# Verify test data
Write-Host "✅ Verifying test data creation..." -ForegroundColor Yellow

$verifyQuery = @"
SELECT 
    'Tenants' as type, 
    COUNT(*) as count 
FROM tenants 
WHERE id = 'test-tenant-uat'
UNION ALL
SELECT 
    'Users', 
    COUNT(*) 
FROM users 
WHERE email LIKE '%@test.example'
UNION ALL
SELECT 
    'Courses', 
    COUNT(*) 
FROM courses 
WHERE id = 'test-course-sample-001'
UNION ALL
SELECT 
    'Registrations', 
    COUNT(*) 
FROM registrations 
WHERE id = 'test-registration-001'
UNION ALL
SELECT 
    'xAPI Statements', 
    COUNT(*) 
FROM xapi_statements 
WHERE registration_id = 'test-registration-001';
"@

$verificationResult = psql $DatabaseUrl -c $verifyQuery -t
Write-Host "📊 Test data verification:" -ForegroundColor Gray
Write-Host "$verificationResult" -ForegroundColor Gray

# Output summary
Write-Host ""
Write-Host "🎉 Staging environment bootstrap completed!" -ForegroundColor Green
Write-Host ""
Write-Host "🔑 Test Account Credentials:" -ForegroundColor Cyan
Write-Host "   Admin Account:" -ForegroundColor White
Write-Host "     Email: admin@test.example" -ForegroundColor Gray
Write-Host "     Password: testpassword123" -ForegroundColor Gray
Write-Host "   Learner Account:" -ForegroundColor White
Write-Host "     Email: learner@test.example" -ForegroundColor Gray
Write-Host "     Password: testpassword123" -ForegroundColor Gray
Write-Host ""
Write-Host "🧪 Next Steps:" -ForegroundColor Cyan
Write-Host "   1. Start the application in staging mode" -ForegroundColor Gray
Write-Host "   2. Navigate to /admin/uat for UAT dashboard" -ForegroundColor Gray
Write-Host "   3. Login with test credentials" -ForegroundColor Gray
Write-Host "   4. Upload real SCORM courses for testing" -ForegroundColor Gray
Write-Host "   5. Test course launch and tracking" -ForegroundColor Gray
Write-Host ""
Write-Host "⚠️  Note: This is test data for staging only" -ForegroundColor Yellow
Write-Host "   Do not use in production environment" -ForegroundColor Yellow
Write-Host ""

Write-Host "✅ Bootstrap script completed successfully!" -ForegroundColor Green
