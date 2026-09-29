$ErrorActionPreference = "Continue"

$ok = $true
$installedUrl = "http://127.0.0.1:17842/v1"
$configPath = Join-Path (Join-Path $HOME ".codex") "config.toml"

Write-Host "== Devin SWE-2 Proxy Doctor =="

$node = Get-Command node -ErrorAction SilentlyContinue
if ($node) {
    $nodeVersion = (& node --version 2>$null)
    Write-Host "[OK] Node: $nodeVersion"
} else {
    Write-Host "[FAIL] Node.js not found"
    $ok = $false
}

$devin = Get-Command devin -ErrorAction SilentlyContinue
if ($devin) {
    $devinVersion = (& devin --version 2>$null | Select-Object -First 1)
    Write-Host "[OK] Devin CLI: $devinVersion"
} else {
    Write-Host "[FAIL] Devin CLI not found on PATH"
    $ok = $false
}

if (Test-Path $configPath) {
    $content = Get-Content -Raw $configPath
    $match = [regex]::Match($content, '(?m)^[ \t]*openai_base_url[ \t]*=[ \t]*"([^"]*)"')
    if ($match.Success) {
        $route = $match.Groups[1].Value
        if ($route -eq $installedUrl) {
            Write-Host "[OK] Codex route: $route"
        } else {
            Write-Host "[WARN] Codex route currently points to: $route"
        }
    } else {
        Write-Host "[WARN] Codex openai_base_url is not configured"
    }
} else {
    Write-Host "[WARN] Codex config does not exist yet: $configPath"
}

try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:17842/health" -TimeoutSec 2
    Write-Host "[OK] Proxy is running: $($health.model)"
    Write-Host "     Upstream: $($health.upstream)"
    Write-Host "     Permissions: $($health.permissions)"
    Write-Host "     CWD fallback: $($health.cwd_fallback)"
} catch {
    Write-Host "[WARN] Proxy is not currently responding on port 17842"
}

if ($ok) {
    Write-Host "Doctor checks completed."
    exit 0
}
Write-Host "One or more required components are missing."
exit 1
