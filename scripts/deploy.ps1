# Deployment Script - Rustici Killer Platform (PowerShell)
# Deploys the complete platform with health checks

param(
    [string]$Environment = "production",
    [switch]$Build = $false,
    [switch]$Clean = $false
)

Write-Host "🚀 Deploying Rustici Killer Platform..." -ForegroundColor Cyan
Write-Host "Environment: $Environment" -ForegroundColor Yellow
Write-Host "=================================================" -ForegroundColor Cyan

# Clean up if requested
if ($Clean) {
    Write-Host "🧹 Cleaning up existing containers..." -ForegroundColor Yellow
    docker-compose down --volumes --remove-orphans
    docker system prune -f
}

# Build images if requested
if ($Build) {
    Write-Host "🏗️ Building Docker images..." -ForegroundColor Yellow
    & "$PSScriptRoot\build-docker.ps1"
}

try {
    # Set environment file
    $envFile = if ($Environment -eq "production") { ".env.production" } else { ".env.development" }
    Write-Host "📝 Using environment file: $envFile" -ForegroundColor Blue
    
    # Deploy with Docker Compose
    Write-Host "🐳 Starting services with Docker Compose..." -ForegroundColor Yellow
    docker-compose --env-file $envFile up -d
    
    # Wait for services to be ready
    Write-Host "⏳ Waiting for services to be ready..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
    
    # Health check function
    function Test-ServiceHealth {
        param($serviceName, $url)
        
        try {
            $response = Invoke-WebRequest -Uri $url -TimeoutSec 5 -UseBasicParsing
            if ($response.StatusCode -eq 200) {
                Write-Host "✅ $serviceName is healthy" -ForegroundColor Green
                return $true
            } else {
                Write-Host "❌ $serviceName health check failed (Status: $($response.StatusCode))" -ForegroundColor Red
                return $false
            }
        } catch {
            Write-Host "❌ $serviceName health check failed: $($_.Exception.Message)" -ForegroundColor Red
            return $false
        }
    }
    
    # Perform health checks
    Write-Host "🔍 Performing health checks..." -ForegroundColor Yellow
    
    $services = @(
        @{Name="API Gateway"; Url="http://localhost:3000/health"},
        @{Name="Content Ingestion"; Url="http://localhost:3002/health"},
        @{Name="SCORM Runtime"; Url="http://localhost:3003/health"},
        @{Name="Sequencing Engine"; Url="http://localhost:3004/health"},
        @{Name="LRS Service"; Url="http://localhost:3005/health"},
        @{Name="Frontend"; Url="http://localhost:3006/health"}
    )
    
    $allHealthy = $true
    foreach ($service in $services) {
        $healthy = Test-ServiceHealth -serviceName $service.Name -url $service.Url
        if (-not $healthy) {
            $allHealthy = $false
        }
    }
    
    if ($allHealthy) {
        Write-Host "🎉 All services are healthy and ready!" -ForegroundColor Green
        Write-Host "=================================================" -ForegroundColor Cyan
        Write-Host "🌐 Frontend: http://localhost:3006" -ForegroundColor Blue
        Write-Host "🔧 API Gateway: http://localhost:3000" -ForegroundColor Blue
        Write-Host "📦 Content Ingestion: http://localhost:3002" -ForegroundColor Blue
        Write-Host "🎮 SCORM Runtime: http://localhost:3003" -ForegroundColor Blue
        Write-Host "🔄 Sequencing Engine: http://localhost:3004" -ForegroundColor Blue
        Write-Host "📊 LRS Service: http://localhost:3005" -ForegroundColor Blue
        Write-Host "=================================================" -ForegroundColor Cyan
        Write-Host "💡 Use 'docker-compose logs -f' to view logs" -ForegroundColor Yellow
        Write-Host "💡 Use 'docker-compose down' to stop services" -ForegroundColor Yellow
    } else {
        Write-Host "⚠️ Some services are not healthy. Check logs with: docker-compose logs" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "❌ Deployment failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
