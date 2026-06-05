# Run RBAC + client_settings migrations (requires Postgres).
# Usage: .\scripts\run-migrations.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

Write-Host "Starting Postgres (docker compose)..." -ForegroundColor Cyan
Set-Location $root
docker compose up -d postgres
if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker failed. Start Docker Desktop or Postgres on localhost:5432, then re-run." -ForegroundColor Red
    exit 1
}

Write-Host "Waiting for Postgres..." -ForegroundColor Cyan
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
    docker compose exec -T postgres pg_isready -U postgres -d listingpro 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    Start-Sleep -Seconds 2
}
if (-not $ready) {
    Write-Host "Postgres did not become ready in time." -ForegroundColor Red
    exit 1
}

Write-Host "Running migrations..." -ForegroundColor Cyan
Set-Location (Join-Path $root "backend")
npm run migration:run
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Migrations complete." -ForegroundColor Green
npm run migration:show
