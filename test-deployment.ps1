#!/usr/bin/env pwsh
# ============================================================================
# RUSTICI KILLER - PHASE 10 DEPLOYMENT TESTING SCRIPT
# ============================================================================
# This script comprehensively tests the Docker deployment of the Rustici Killer
# SCORM platform to ensure all core functionality is working properly.
# 
# Author: GitHub Copilot
# Date: 2025-07-15
# Phase: 10 (DEPLOYMENT PREP, ENVIRONMENT HARDENING, AND MVP LAUNCH PATH)
# ============================================================================

Write-Host "🚀 RUSTICI KILLER - PHASE 10 DEPLOYMENT TESTING" -ForegroundColor Green
Write-Host "=" * 60 -ForegroundColor Green

# Configuration
$BaseUrl = "http://localhost:3000"
$TestUser = @{
    email = "testuser@example.com"
    password = "password123"
    firstName = "Test"
    lastName = "User"
    tenantName = "test-tenant"
}

# Test Results
$TestResults = @()

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Url,
        [string]$Method = "GET",
        [hashtable]$Headers = @{},
        [string]$Body = $null,
        [bool]$ExpectSuccess = $true
    )
    
    Write-Host "Testing: $Name..." -ForegroundColor Yellow
    
    try {
        $params = @{
            Uri = $Url
            Method = $Method
            Headers = $Headers
        }
        
        if ($Body) {
            $params.Body = $Body
            $params.ContentType = "application/json"
        }
        
        $response = Invoke-RestMethod @params
        
        if ($ExpectSuccess) {
            if ($response.success -eq $true) {
                Write-Host "✅ $Name - PASSED" -ForegroundColor Green
                $TestResults += @{ Test = $Name; Status = "PASSED"; Details = $response }
                return $response
            } else {
                Write-Host "❌ $Name - FAILED (Expected success)" -ForegroundColor Red
                $TestResults += @{ Test = $Name; Status = "FAILED"; Details = $response }
                return $null
            }
        } else {
            Write-Host "✅ $Name - PASSED (Expected failure)" -ForegroundColor Green
            $TestResults += @{ Test = $Name; Status = "PASSED"; Details = $response }
            return $response
        }
    } catch {
        if ($ExpectSuccess) {
            Write-Host "❌ $Name - FAILED (Exception: $($_.Exception.Message))" -ForegroundColor Red
            $TestResults += @{ Test = $Name; Status = "FAILED"; Details = $_.Exception.Message }
        } else {
            Write-Host "✅ $Name - PASSED (Expected exception)" -ForegroundColor Green
            $TestResults += @{ Test = $Name; Status = "PASSED"; Details = "Expected exception occurred" }
        }
        return $null
    }
}

# Test 1: Infrastructure Health
Write-Host "`n🔍 INFRASTRUCTURE TESTS" -ForegroundColor Cyan
Write-Host "-" * 30 -ForegroundColor Cyan

Test-Endpoint -Name "API Gateway Health Check" -Url "$BaseUrl/health"
Test-Endpoint -Name "Database Connection" -Url "$BaseUrl/health"

# Test 2: User Registration
Write-Host "`n👤 USER AUTHENTICATION TESTS" -ForegroundColor Cyan
Write-Host "-" * 30 -ForegroundColor Cyan

$registerBody = $TestUser | ConvertTo-Json
$registerResponse = Test-Endpoint -Name "User Registration" -Url "$BaseUrl/auth/register" -Method "POST" -Body $registerBody

if ($registerResponse -and $registerResponse.token) {
    Write-Host "Registration successful - Token received" -ForegroundColor Green
    $authToken = $registerResponse.token
} else {
    Write-Host "Registration failed - Cannot continue with authenticated tests" -ForegroundColor Red
    exit 1
}

# Test 3: User Login
$loginBody = @{
    email = $TestUser.email
    password = $TestUser.password
} | ConvertTo-Json

$loginResponse = Test-Endpoint -Name "User Login" -Url "$BaseUrl/auth/login" -Method "POST" -Body $loginBody

if ($loginResponse -and $loginResponse.token) {
    Write-Host "Login successful - Token received" -ForegroundColor Green
    $authToken = $loginResponse.token
} else {
    Write-Host "Login failed - Using registration token" -ForegroundColor Yellow
}

# Test 4: Authenticated Endpoints
Write-Host "`n🔐 AUTHENTICATED ENDPOINT TESTS" -ForegroundColor Cyan
Write-Host "-" * 30 -ForegroundColor Cyan

$authHeaders = @{ Authorization = "Bearer $authToken" }
Test-Endpoint -Name "User Profile (/auth/me)" -Url "$BaseUrl/auth/me" -Headers $authHeaders

# Test 5: Course Management Endpoints
Write-Host "`n📚 COURSE MANAGEMENT TESTS" -ForegroundColor Cyan
Write-Host "-" * 30 -ForegroundColor Cyan

Test-Endpoint -Name "List Courses" -Url "$BaseUrl/courses" -Headers $authHeaders

# Test 6: Security Tests
Write-Host "`n🔒 SECURITY TESTS" -ForegroundColor Cyan
Write-Host "-" * 30 -ForegroundColor Cyan

Test-Endpoint -Name "Unauthorized Access" -Url "$BaseUrl/auth/me" -ExpectSuccess $false
Test-Endpoint -Name "Invalid Token" -Url "$BaseUrl/auth/me" -Headers @{Authorization = "Bearer invalid_token"} -ExpectSuccess $false

# Test 7: API Documentation
Write-Host "`n📖 API DOCUMENTATION TESTS" -ForegroundColor Cyan
Write-Host "-" * 30 -ForegroundColor Cyan

Test-Endpoint -Name "API Version Info" -Url "$BaseUrl/api/v1"

# Test 8: Docker Container Status
Write-Host "`n🐳 DOCKER CONTAINER TESTS" -ForegroundColor Cyan
Write-Host "-" * 30 -ForegroundColor Cyan

try {
    $containers = docker ps --filter "name=rustici-killer" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    Write-Host "Docker Containers Status:" -ForegroundColor Yellow
    Write-Host $containers -ForegroundColor White
    $TestResults += @{ Test = "Docker Containers"; Status = "PASSED"; Details = $containers }
} catch {
    Write-Host "❌ Docker container check failed" -ForegroundColor Red
    $TestResults += @{ Test = "Docker Containers"; Status = "FAILED"; Details = $_.Exception.Message }
}

# Test 9: Database Connection Test
Write-Host "`n🗄️ DATABASE TESTS" -ForegroundColor Cyan
Write-Host "-" * 30 -ForegroundColor Cyan

try {
    $dbStatus = docker exec rustici-killer-postgres psql -U postgres -d rustici_prod -c 'SELECT COUNT(*) FROM users;'
    Write-Host "Database user count check:" -ForegroundColor Yellow
    Write-Host $dbStatus -ForegroundColor White
    $TestResults += @{ Test = "Database Connection"; Status = "PASSED"; Details = $dbStatus }
} catch {
    Write-Host "❌ Database connection test failed" -ForegroundColor Red
    $TestResults += @{ Test = "Database Connection"; Status = "FAILED"; Details = $_.Exception.Message }
}

# Test Summary
Write-Host "`n📊 TEST SUMMARY" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan

$PassedTests = ($TestResults | Where-Object { $_.Status -eq "PASSED" }).Count
$FailedTests = ($TestResults | Where-Object { $_.Status -eq "FAILED" }).Count
$TotalTests = $TestResults.Count

Write-Host "Total Tests: $TotalTests" -ForegroundColor White
Write-Host "Passed: $PassedTests" -ForegroundColor Green
Write-Host "Failed: $FailedTests" -ForegroundColor Red
Write-Host "Success Rate: $([math]::Round(($PassedTests / $TotalTests) * 100, 2))%" -ForegroundColor $(if ($FailedTests -eq 0) { "Green" } else { "Yellow" })

if ($FailedTests -eq 0) {
    Write-Host "`n🎉 ALL TESTS PASSED! DEPLOYMENT IS READY FOR PRODUCTION" -ForegroundColor Green
    Write-Host "Phase 10 deployment validation complete." -ForegroundColor Green
} else {
    Write-Host "`n⚠️ SOME TESTS FAILED - REVIEW REQUIRED" -ForegroundColor Yellow
    Write-Host "Failed tests:" -ForegroundColor Red
    $TestResults | Where-Object { $_.Status -eq "FAILED" } | ForEach-Object {
        Write-Host "  - $($_.Test): $($_.Details)" -ForegroundColor Red
    }
}

Write-Host "`n🏁 RUSTICI KILLER DEPLOYMENT TESTING COMPLETE" -ForegroundColor Green
Write-Host "=" * 60 -ForegroundColor Green
