param(
    [string]$WorkDir = "",
    [switch]$AllowTools
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$server = Join-Path $root "src\server.mjs"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js 20+ is required. Install Node.js and retry."
}
if (-not (Get-Command devin -ErrorAction SilentlyContinue)) {
    throw "Devin CLI is not on PATH. Install the official Devin CLI first."
}

if ($WorkDir) {
    $resolved = Resolve-Path $WorkDir
    $env:DEVIN_WORKDIR = $resolved.Path
}
if ($AllowTools) {
    $env:DEVIN_AUTO_APPROVE = "1"
}

Write-Host "Starting Devin SWE-2 proxy on http://127.0.0.1:17842/v1"
if ($env:DEVIN_WORKDIR) {
    Write-Host "Working directory: $env:DEVIN_WORKDIR"
} else {
    Write-Host "Working directory fallback: $(Get-Location)"
}
if ($env:DEVIN_AUTO_APPROVE -eq "1") {
    Write-Warning "Devin tool permission requests will be approved once automatically for this process."
} else {
    Write-Host "Tool permission requests are denied by default. Use -AllowTools if you want Devin to edit/run inside the working directory."
}

& node $server
