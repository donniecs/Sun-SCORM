#!/bin/bash

# Docker Build Script - Rustici Killer Platform
# Builds all Docker images for the platform

set -e

echo "🐳 Building Docker images for Rustici Killer Platform..."
echo "================================================="

# Build API Gateway
echo "📦 Building API Gateway..."
docker build -t rustici-killer-api-gateway:latest -f packages/api-gateway/Dockerfile .

# Build Content Ingestion
echo "📦 Building Content Ingestion..."
docker build -t rustici-killer-content-ingestion:latest -f packages/content-ingestion/Dockerfile .

# Build SCORM Runtime
echo "📦 Building SCORM Runtime..."
docker build -t rustici-killer-scorm-runtime:latest -f packages/scorm-runtime/Dockerfile .

# Build Sequencing Engine
echo "📦 Building Sequencing Engine..."
docker build -t rustici-killer-sequencing-engine:latest -f packages/sequencing-engine/Dockerfile .

# Build LRS Service
echo "📦 Building LRS Service..."
docker build -t rustici-killer-lrs-service:latest -f packages/lrs-service/Dockerfile .

# Build Frontend
echo "📦 Building Frontend..."
docker build -t rustici-killer-frontend:latest -f apps/frontend/Dockerfile .

echo "✅ All Docker images built successfully!"
echo "================================================="

# List built images
echo "📋 Built images:"
docker images | grep rustici-killer

echo "🚀 Ready to deploy with: docker-compose up"
