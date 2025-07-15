# Database Setup Script - Rustici Killer Platform
# Initializes PostgreSQL database with required schema

param(
    [string]$Environment = "production",
    [string]$DatabaseUrl = "postgresql://postgres:password@localhost:5432/rustici_prod"
)

Write-Host "🗄️ Setting up Rustici Killer Database..." -ForegroundColor Cyan
Write-Host "Environment: $Environment" -ForegroundColor Yellow
Write-Host "Database URL: $DatabaseUrl" -ForegroundColor Blue
Write-Host "=================================================" -ForegroundColor Cyan

try {
    # Check if psql is available
    $psqlCheck = Get-Command psql -ErrorAction SilentlyContinue
    if (-not $psqlCheck) {
        Write-Host "❌ PostgreSQL client (psql) not found. Please install PostgreSQL client tools." -ForegroundColor Red
        exit 1
    }
    
    # Parse database URL
    $dbParams = @{}
    if ($DatabaseUrl -match "postgresql://(.+?):(.+?)@(.+?):(\d+)/(.+)") {
        $dbParams.User = $matches[1]
        $dbParams.Password = $matches[2]
        $dbParams.Host = $matches[3]
        $dbParams.Port = $matches[4]
        $dbParams.Database = $matches[5]
    } else {
        Write-Host "❌ Invalid database URL format" -ForegroundColor Red
        exit 1
    }
    
    # Set environment variables for psql
    $env:PGPASSWORD = $dbParams.Password
    $env:PGUSER = $dbParams.User
    $env:PGHOST = $dbParams.Host
    $env:PGPORT = $dbParams.Port
    $env:PGDATABASE = $dbParams.Database
    
    Write-Host "🔍 Testing database connection..." -ForegroundColor Yellow
    
    # Test connection
    $testResult = psql -c "SELECT 1;" 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Database connection failed: $testResult" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✅ Database connection successful" -ForegroundColor Green
    
    # Run migration
    Write-Host "🔄 Running database migration..." -ForegroundColor Yellow
    $migrationPath = Join-Path $PSScriptRoot "..\database\migration.sql"
    
    if (-not (Test-Path $migrationPath)) {
        Write-Host "❌ Migration file not found: $migrationPath" -ForegroundColor Red
        exit 1
    }
    
    $migrationResult = psql -f $migrationPath 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Migration failed: $migrationResult" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✅ Database migration completed successfully" -ForegroundColor Green
    
    # Verify schema
    Write-Host "🔍 Verifying database schema..." -ForegroundColor Yellow
    
    $tables = @(
        'users',
        'courses', 
        'activities',
        'user_sessions',
        'activity_sessions',
        'sequencing_sessions',
        'xapi_statements',
        'user_progress'
    )
    
    foreach ($table in $tables) {
        $tableCheck = psql -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = '$table';" -t 2>&1
        if ($tableCheck.Trim() -eq "1") {
            Write-Host "✅ Table '$table' exists" -ForegroundColor Green
        } else {
            Write-Host "❌ Table '$table' missing" -ForegroundColor Red
        }
    }
    
    # Show database info
    Write-Host "📊 Database Information:" -ForegroundColor Blue
    $dbInfo = psql -c "SELECT schemaname, tablename, tableowner FROM pg_tables WHERE schemaname = 'public';" 2>&1
    Write-Host $dbInfo -ForegroundColor Gray
    
    Write-Host "🎉 Database setup completed successfully!" -ForegroundColor Green
    Write-Host "=================================================" -ForegroundColor Cyan
    
    # Clear password from environment
    Remove-Item env:PGPASSWORD -ErrorAction SilentlyContinue
    
} catch {
    Write-Host "❌ Database setup failed: $($_.Exception.Message)" -ForegroundColor Red
    Remove-Item env:PGPASSWORD -ErrorAction SilentlyContinue
    exit 1
}
