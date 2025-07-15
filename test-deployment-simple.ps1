#!/usr/bin/env pwsh
# RUSTICI KILLER - PHASE 10 DEPLOYMENT TESTING SCRIPT
# Comprehensive testing for Docker deployment validation

Write-Host "RUSTICI KILLER - PHASE 10 DEPLOYMENT TESTING" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green

$BaseUrl = "http://localhost:3000"
$TestResults = @()

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Url,
        [string]$Method = "GET",
        [hashtable]$Headers = @{},
        [string]$Body = $null
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
        
        Write-Host "✅ $Name - PASSED" -ForegroundColor Green
        $script:TestResults += @{ Test = $Name; Status = "PASSED"; Details = $response }
        return $response
    } catch {
        Write-Host "❌ $Name - FAILED ($($_.Exception.Message))" -ForegroundColor Red
        $script:TestResults += @{ Test = $Name; Status = "FAILED"; Details = $_.Exception.Message }
        return $null
    }
}

# Test 1: Infrastructure Health
Write-Host "`nINFRASTRUCTURE TESTS" -ForegroundColor Cyan
Write-Host "--------------------" -ForegroundColor Cyan

Test-Endpoint -Name "API Gateway Health Check" -Url "$BaseUrl/health"

# Test 2: User Registration
Write-Host "`nUSER AUTHENTICATION TESTS" -ForegroundColor Cyan
Write-Host "--------------------------" -ForegroundColor Cyan

$registerBody = @{
    email = "newuser@example.com"
    password = "password123"
    firstName = "New"
    lastName = "User"
    tenantName = "test-tenant"
} | ConvertTo-Json

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
    email = "newuser@example.com"
    password = "password123"
} | ConvertTo-Json

$loginResponse = Test-Endpoint -Name "User Login" -Url "$BaseUrl/auth/login" -Method "POST" -Body $loginBody

if ($loginResponse -and $loginResponse.token) {
    Write-Host "Login successful - Token received" -ForegroundColor Green
    $authToken = $loginResponse.token
}

# Test 4: Authenticated Endpoints
Write-Host "`nAUTHENTICATED ENDPOINT TESTS" -ForegroundColor Cyan
Write-Host "----------------------------" -ForegroundColor Cyan

$authHeaders = @{ Authorization = "Bearer $authToken" }
Test-Endpoint -Name "User Profile (/auth/me)" -Url "$BaseUrl/auth/me" -Headers $authHeaders

# Test 5: Course Management
Write-Host "`nCOURSE MANAGEMENT TESTS" -ForegroundColor Cyan
Write-Host "-----------------------" -ForegroundColor Cyan

Test-Endpoint -Name "List Courses" -Url "$BaseUrl/courses" -Headers $authHeaders

# Test 6: Docker Container Status
Write-Host "`nDOCKER CONTAINER STATUS" -ForegroundColor Cyan
Write-Host "-----------------------" -ForegroundColor Cyan

try {
    $containers = docker ps --filter "name=rustici-killer" --format "table {{.Names}}\t{{.Status}}"
    Write-Host "Docker Containers:" -ForegroundColor Yellow
    Write-Host $containers -ForegroundColor White
    $TestResults += @{ Test = "Docker Containers"; Status = "PASSED"; Details = $containers }
} catch {
    Write-Host "❌ Docker container check failed" -ForegroundColor Red
    $TestResults += @{ Test = "Docker Containers"; Status = "FAILED"; Details = $_.Exception.Message }
}

# Test 7: Database Connection
Write-Host "`nDATABASE CONNECTION TEST" -ForegroundColor Cyan
Write-Host "------------------------" -ForegroundColor Cyan

try {
    $userCount = docker exec rustici-killer-postgres psql -U postgres -d rustici_prod -t -c "SELECT COUNT(*) FROM users;"
    Write-Host "Database user count: $userCount" -ForegroundColor Yellow
    $TestResults += @{ Test = "Database Connection"; Status = "PASSED"; Details = "User count: $userCount" }
} catch {
    Write-Host "❌ Database connection test failed" -ForegroundColor Red
    $TestResults += @{ Test = "Database Connection"; Status = "FAILED"; Details = $_.Exception.Message }
}

# Test Summary
Write-Host "`nTEST SUMMARY" -ForegroundColor Cyan
Write-Host "============" -ForegroundColor Cyan

$PassedTests = ($TestResults | Where-Object { $_.Status -eq "PASSED" }).Count
$FailedTests = ($TestResults | Where-Object { $_.Status -eq "FAILED" }).Count
$TotalTests = $TestResults.Count

Write-Host "Total Tests: $TotalTests" -ForegroundColor White
Write-Host "Passed: $PassedTests" -ForegroundColor Green
Write-Host "Failed: $FailedTests" -ForegroundColor Red

if ($FailedTests -eq 0) {
    Write-Host "`n🎉 ALL TESTS PASSED! DEPLOYMENT IS READY FOR PRODUCTION" -ForegroundColor Green
    Write-Host "Phase 10 deployment validation complete." -ForegroundColor Green
} else {
    Write-Host "`n⚠️ SOME TESTS FAILED - REVIEW REQUIRED" -ForegroundColor Yellow
}

Write-Host "`nRUSTICI KILLER DEPLOYMENT TESTING COMPLETE" -ForegroundColor Green
