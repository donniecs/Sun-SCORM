# End-to-End Test Script - Rustici Killer Platform
# Validates complete deployment and functionality

param(
    [string]$BaseUrl = "http://localhost"
)

Write-Host "🧪 Running End-to-End Tests for Rustici Killer Platform..." -ForegroundColor Cyan
Write-Host "Base URL: $BaseUrl" -ForegroundColor Yellow
Write-Host "=================================================" -ForegroundColor Cyan

$testResults = @()

# Test function
function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Url,
        [string]$ExpectedStatus = "200",
        [string]$ContentType = "application/json"
    )
    
    try {
        $response = Invoke-WebRequest -Uri $Url -TimeoutSec 10 -UseBasicParsing
        
        if ($response.StatusCode -eq $ExpectedStatus) {
            Write-Host "✅ $Name - PASS" -ForegroundColor Green
            return @{Test=$Name; Status="PASS"; Response=$response.StatusCode}
        } else {
            Write-Host "❌ $Name - FAIL (Status: $($response.StatusCode))" -ForegroundColor Red
            return @{Test=$Name; Status="FAIL"; Response=$response.StatusCode}
        }
    } catch {
        Write-Host "❌ $Name - ERROR ($($_.Exception.Message))" -ForegroundColor Red
        return @{Test=$Name; Status="ERROR"; Response=$_.Exception.Message}
    }
}

# Test comprehensive API endpoints
function Test-ComprehensiveAPI {
    param([string]$ServiceName, [string]$BaseUrl)
    
    Write-Host "🔍 Testing $ServiceName..." -ForegroundColor Yellow
    
    $endpoints = @(
        @{Name="$ServiceName Health Check"; Url="$BaseUrl/health"},
        @{Name="$ServiceName Status"; Url="$BaseUrl/status"},
        @{Name="$ServiceName Info"; Url="$BaseUrl/info"}
    )
    
    foreach ($endpoint in $endpoints) {
        $result = Test-Endpoint -Name $endpoint.Name -Url $endpoint.Url
        $script:testResults += $result
    }
}

# Service Tests
Write-Host "🏥 Testing Service Health..." -ForegroundColor Blue
Test-ComprehensiveAPI -ServiceName "API Gateway" -BaseUrl "$BaseUrl:3000"
Test-ComprehensiveAPI -ServiceName "Content Ingestion" -BaseUrl "$BaseUrl:3002"
Test-ComprehensiveAPI -ServiceName "SCORM Runtime" -BaseUrl "$BaseUrl:3003"
Test-ComprehensiveAPI -ServiceName "Sequencing Engine" -BaseUrl "$BaseUrl:3004"
Test-ComprehensiveAPI -ServiceName "LRS Service" -BaseUrl "$BaseUrl:3005"
Test-ComprehensiveAPI -ServiceName "Frontend" -BaseUrl "$BaseUrl:3006"

# Database Connection Tests
Write-Host "🗄️ Testing Database Connectivity..." -ForegroundColor Blue
$dbTestResult = Test-Endpoint -Name "Database Connection (via API Gateway)" -Url "$BaseUrl:3000/api/db/test"
$testResults += $dbTestResult

# Authentication Tests
Write-Host "🔐 Testing Authentication..." -ForegroundColor Blue
$authTests = @(
    @{Name="User Registration"; Url="$BaseUrl:3000/api/auth/register"},
    @{Name="User Login"; Url="$BaseUrl:3000/api/auth/login"},
    @{Name="Token Validation"; Url="$BaseUrl:3000/api/auth/validate"}
)

foreach ($test in $authTests) {
    $result = Test-Endpoint -Name $test.Name -Url $test.Url
    $testResults += $result
}

# Course Management Tests
Write-Host "📚 Testing Course Management..." -ForegroundColor Blue
$courseTests = @(
    @{Name="Course List"; Url="$BaseUrl:3000/api/courses"},
    @{Name="Course Upload"; Url="$BaseUrl:3002/api/upload"},
    @{Name="Course Metadata"; Url="$BaseUrl:3000/api/courses/metadata"}
)

foreach ($test in $courseTests) {
    $result = Test-Endpoint -Name $test.Name -Url $test.Url
    $testResults += $result
}

# SCORM Runtime Tests
Write-Host "🎮 Testing SCORM Runtime..." -ForegroundColor Blue
$scormTests = @(
    @{Name="SCORM API"; Url="$BaseUrl:3003/api/scorm"},
    @{Name="Launch Course"; Url="$BaseUrl:3003/api/launch"},
    @{Name="Session Management"; Url="$BaseUrl:3003/api/session"}
)

foreach ($test in $scormTests) {
    $result = Test-Endpoint -Name $test.Name -Url $test.Url
    $testResults += $result
}

# Sequencing Engine Tests
Write-Host "🔄 Testing Sequencing Engine..." -ForegroundColor Blue
$sequencingTests = @(
    @{Name="Navigation Request"; Url="$BaseUrl:3004/api/navigation"},
    @{Name="Activity State"; Url="$BaseUrl:3004/api/activity/state"},
    @{Name="Sequence Status"; Url="$BaseUrl:3004/api/sequence/status"}
)

foreach ($test in $sequencingTests) {
    $result = Test-Endpoint -Name $test.Name -Url $test.Url
    $testResults += $result
}

# xAPI/LRS Tests
Write-Host "📊 Testing xAPI/LRS..." -ForegroundColor Blue
$xapiTests = @(
    @{Name="xAPI Statements"; Url="$BaseUrl:3005/xapi/statements"},
    @{Name="xAPI About"; Url="$BaseUrl:3005/xapi/about"},
    @{Name="Activity Profile"; Url="$BaseUrl:3005/xapi/activities/profile"}
)

foreach ($test in $xapiTests) {
    $result = Test-Endpoint -Name $test.Name -Url $test.Url
    $testResults += $result
}

# Frontend Tests
Write-Host "🌐 Testing Frontend..." -ForegroundColor Blue
$frontendTests = @(
    @{Name="Frontend Home"; Url="$BaseUrl:3006/"},
    @{Name="Course Viewer"; Url="$BaseUrl:3006/courses"},
    @{Name="Dashboard"; Url="$BaseUrl:3006/dashboard"}
)

foreach ($test in $frontendTests) {
    $result = Test-Endpoint -Name $test.Name -Url $test.Url
    $testResults += $result
}

# Test Summary
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "🧪 Test Results Summary:" -ForegroundColor Blue

$passCount = ($testResults | Where-Object { $_.Status -eq "PASS" }).Count
$failCount = ($testResults | Where-Object { $_.Status -eq "FAIL" }).Count
$errorCount = ($testResults | Where-Object { $_.Status -eq "ERROR" }).Count
$totalCount = $testResults.Count

Write-Host "✅ Passed: $passCount" -ForegroundColor Green
Write-Host "❌ Failed: $failCount" -ForegroundColor Red
Write-Host "💥 Errors: $errorCount" -ForegroundColor Yellow
Write-Host "📊 Total: $totalCount" -ForegroundColor Blue

# Calculate success rate
$successRate = if ($totalCount -gt 0) { [math]::Round(($passCount / $totalCount) * 100, 2) } else { 0 }
Write-Host "🎯 Success Rate: $successRate%" -ForegroundColor $(if ($successRate -ge 80) { "Green" } elseif ($successRate -ge 60) { "Yellow" } else { "Red" })

# Show failed tests
if ($failCount -gt 0 -or $errorCount -gt 0) {
    Write-Host "⚠️ Failed/Error Tests:" -ForegroundColor Yellow
    $testResults | Where-Object { $_.Status -ne "PASS" } | ForEach-Object {
        Write-Host "  - $($_.Test): $($_.Status) ($($_.Response))" -ForegroundColor Red
    }
}

Write-Host "=================================================" -ForegroundColor Cyan

# Export results to file
$reportPath = "test-results-$(Get-Date -Format 'yyyy-MM-dd-HH-mm-ss').json"
$testResults | ConvertTo-Json -Depth 2 | Out-File -FilePath $reportPath -Encoding UTF8
Write-Host "📄 Test report saved to: $reportPath" -ForegroundColor Blue

if ($successRate -ge 80) {
    Write-Host "🎉 Platform is ready for production deployment!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "⚠️ Platform needs attention before production deployment" -ForegroundColor Yellow
    exit 1
}
