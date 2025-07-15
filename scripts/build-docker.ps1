# Docker Build Script - Rustici Killer Platform (PowerShell)
# Builds all Docker images for the platform

Write-Host "🐳 Building Docker images for Rustici Killer Platform..." -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan

try {
    # Build API Gateway
    Write-Host "📦 Building API Gateway..." -ForegroundColor Yellow
    docker build -t rustici-killer-api-gateway:latest -f packages/api-gateway/Dockerfile .
    
    # Build Content Ingestion
    Write-Host "📦 Building Content Ingestion..." -ForegroundColor Yellow
    docker build -t rustici-killer-content-ingestion:latest -f packages/content-ingestion/Dockerfile .
    
    # Build SCORM Runtime
    Write-Host "📦 Building SCORM Runtime..." -ForegroundColor Yellow
    docker build -t rustici-killer-scorm-runtime:latest -f packages/scorm-runtime/Dockerfile .
    
    # Build Sequencing Engine
    Write-Host "📦 Building Sequencing Engine..." -ForegroundColor Yellow
    docker build -t rustici-killer-sequencing-engine:latest -f packages/sequencing-engine/Dockerfile .
    
    # Build LRS Service
    Write-Host "📦 Building LRS Service..." -ForegroundColor Yellow
    docker build -t rustici-killer-lrs-service:latest -f packages/lrs-service/Dockerfile .
    
    # Build Frontend
    Write-Host "📦 Building Frontend..." -ForegroundColor Yellow
    docker build -t rustici-killer-frontend:latest -f apps/frontend/Dockerfile .
    
    Write-Host "✅ All Docker images built successfully!" -ForegroundColor Green
    Write-Host "=================================================" -ForegroundColor Cyan
    
    # List built images
    Write-Host "📋 Built images:" -ForegroundColor Blue
    docker images | findstr rustici-killer
    
    Write-Host "🚀 Ready to deploy with: docker-compose up" -ForegroundColor Green
    
} catch {
    Write-Host "❌ Error building Docker images: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
