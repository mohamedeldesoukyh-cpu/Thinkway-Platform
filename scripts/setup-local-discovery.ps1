# Thinkway Discovery — local setup helper (Windows PowerShell)
# Run from repo root: .\scripts\setup-local-discovery.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "`n=== Thinkway Discovery Local Setup ===`n" -ForegroundColor Cyan

# 1. Root dependencies
if (-not (Test-Path "node_modules")) {
  Write-Host "Installing root npm packages..." -ForegroundColor Yellow
  npm install
}

# 2. Worker dependencies
if (-not (Test-Path "services/discovery-worker/node_modules")) {
  Write-Host "Installing discovery worker packages..." -ForegroundColor Yellow
  Push-Location "services/discovery-worker"
  npm install
  Pop-Location
}

# 3. Sync worker .env from root .env
Write-Host "Syncing worker .env from root .env..." -ForegroundColor Yellow
node -e @"
const fs=require('fs');
function parse(file){const o={}; if(!fs.existsSync(file)) return o; for(const line of fs.readFileSync(file,'utf8').split(/\r?\n/)){const t=line.trim(); if(!t||t.startsWith('#')) continue; const i=t.indexOf('='); if(i<0) continue; o[t.slice(0,i).trim()]=t.slice(i+1).trim();} return o;}
const root=parse('.env');
let rootText=fs.existsSync('.env')?fs.readFileSync('.env','utf8'):'';
if(!root.REDIS_URL){ if(!rootText.endsWith('\n')) rootText+='\n'; rootText+='REDIS_URL=redis://127.0.0.1:6379\n'; fs.writeFileSync('.env', rootText); }
const worker=['REDIS_URL='+(root.REDIS_URL||'redis://127.0.0.1:6379'),'SUPABASE_URL='+(root.NEXT_PUBLIC_SUPABASE_URL||''),'SUPABASE_SERVICE_ROLE_KEY='+(root.SUPABASE_SERVICE_ROLE_KEY||''),'OPENAI_API_KEY='+(root.OPENAI_API_KEY||''),'DISCOVERY_HEADLESS=true','DISCOVERY_MIN_DELAY_MS=2000','DISCOVERY_MAX_DELAY_MS=8000','DISCOVERY_PROXY_URLS=','DISCOVERY_USER_AGENT=Mozilla/5.0 (compatible; ThinkwayDiscovery/1.0)'].join('\n')+'\n';
fs.writeFileSync('services/discovery-worker/.env', worker);
"@

# 4. Apply discovery migrations (safe to re-run; uses IF NOT EXISTS)
Write-Host "Applying discovery database migrations..." -ForegroundColor Yellow
npx supabase db query --linked -f "supabase/migrations/20260611010000_discovery_engine.sql"
npx supabase db query --linked -f "supabase/migrations/20260612010000_creator_discovery_integration.sql"
npx supabase db query --linked "NOTIFY pgrst, 'reload schema';"

# 5. Health check
Write-Host "`nRunning health check...`n" -ForegroundColor Yellow
node scripts/verify-local-discovery.mjs

Write-Host "`n=== Setup complete ===`n" -ForegroundColor Green
Write-Host "Open TWO terminals and keep them running:"
Write-Host "  Terminal A: npm run dev"
Write-Host "  Terminal B: npm run discovery:worker:dev   (only after Redis is running)"
Write-Host ""
Write-Host "Redis on Windows (pick one):"
Write-Host "  • Memurai Developer (recommended): winget install Memurai.MemuraiDeveloper"
Write-Host "  • Docker Desktop: winget install Docker.DockerDesktop"
Write-Host "    then: docker compose -f docker-compose.discovery.yml up -d redis"
Write-Host "  • Upstash (cloud, no install): paste REDIS_URL into .env and worker .env"
Write-Host ""
