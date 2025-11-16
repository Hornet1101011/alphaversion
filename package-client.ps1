<##
This script builds the React client and packages its build output into
the top-level `build/client` folder and creates `build/client-build.zip`.

Usage (PowerShell from repo root):
    .\package-client.ps1

If you run into execution policy issues, run:
    powershell -ExecutionPolicy Bypass -File .\package-client.ps1

##>
param()

Write-Host "Starting client packaging script..."

$root = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $root

$clientDir = Join-Path $root 'client'
$buildDir = Join-Path $root 'build'
$clientBuild = Join-Path $clientDir 'build'
$target = Join-Path $buildDir 'client'

if (-not (Test-Path $clientDir)) {
    Write-Error "Client directory not found at $clientDir"
    exit 1
}

Write-Host "Installing client dependencies..."
Push-Location $clientDir
npm install

Write-Host "Running client build..."
npm run build
Pop-Location

if (-not (Test-Path $clientBuild)) {
    Write-Error "Client build output not found at $clientBuild — build may have failed"
    exit 1
}

Write-Host "Preparing output folder $target"
if (Test-Path $target) { Remove-Item $target -Recurse -Force }
New-Item -ItemType Directory -Path $target -Force | Out-Null

Write-Host "Copying build files to $target"
Copy-Item -Path (Join-Path $clientBuild '*') -Destination $target -Recurse -Force

# Copy helpful project files
if (Test-Path (Join-Path $clientDir 'package.json')) {
    Copy-Item -Path (Join-Path $clientDir 'package.json') -Destination $target -Force
}
if (Test-Path (Join-Path $clientDir 'public')) {
    Copy-Item -Path (Join-Path $clientDir 'public') -Destination (Join-Path $target 'public') -Recurse -Force
}

if (-not (Test-Path $buildDir)) { New-Item -ItemType Directory -Path $buildDir | Out-Null }

$zipPath = Join-Path $buildDir 'client-build.zip'
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

Write-Host "Creating zip archive $zipPath"
Compress-Archive -Path (Join-Path $target '*') -DestinationPath $zipPath

Write-Host "Done. Client packaged to:`n - Folder: $target`n - Zip:    $zipPath"
