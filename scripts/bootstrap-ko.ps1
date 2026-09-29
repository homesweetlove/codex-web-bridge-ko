param(
  [string]$WorkDir = "",
  [switch]$Run
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path $PSScriptRoot -Parent
$UpstreamUrl = "https://github.com/miuuyy/codex-chatgpt-web.git"
$UpstreamCommit = "e85e3693fdb4e3e033348c08df0298c20fcdb612"

if ([string]::IsNullOrWhiteSpace($WorkDir)) {
  $WorkDir = Join-Path $RepoRoot ".work/codex-chatgpt-web"
}
$WorkDir = [System.IO.Path]::GetFullPath($WorkDir)

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "Git이 필요합니다. Git for Windows를 먼저 설치하세요."
}

if (Test-Path $WorkDir) {
  Write-Host "기존 작업 폴더를 삭제합니다: $WorkDir"
  Remove-Item $WorkDir -Recurse -Force
}
New-Item -ItemType Directory -Force -Path (Split-Path $WorkDir -Parent) | Out-Null

Write-Host "원본 소스를 가져오는 중..."
& git clone --filter=blob:none $UpstreamUrl $WorkDir
if ($LASTEXITCODE -ne 0) { throw "원본 저장소 clone 실패" }

& git -C $WorkDir checkout --detach $UpstreamCommit
if ($LASTEXITCODE -ne 0) { throw "고정된 upstream commit checkout 실패" }

$actualCommit = (& git -C $WorkDir rev-parse HEAD).Trim()
if ($actualCommit -ne $UpstreamCommit) {
  throw "upstream commit 검증 실패: $actualCommit"
}

Write-Host "한국어 패치 적용 중..."
& (Join-Path $PSScriptRoot "apply-ko.ps1") -SourceDir $WorkDir
if ($LASTEXITCODE -ne 0) { throw "한국어 패치 적용 실패" }

Write-Host ""
Write-Host "한국어판 소스 준비 완료: $WorkDir" -ForegroundColor Green
Write-Host "Windows 설치 파일이 필요하면 GitHub Actions의 'Build Korean Windows Launcher'를 실행하세요."

if ($Run) {
  if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
    throw "로컬 실행에는 Bun 1.4.0이 필요합니다. 설치 파일만 필요하면 GitHub Actions 빌드를 사용하세요."
  }

  $bunVersion = (& bun --version).Trim()
  if ($bunVersion -ne "1.4.0") {
    throw "Bun 1.4.0이 필요합니다. 현재 버전: $bunVersion"
  }

  Push-Location $WorkDir
  try {
    & bun install --frozen-lockfile
    if ($LASTEXITCODE -ne 0) { throw "root dependency install 실패" }

    Push-Location (Join-Path $WorkDir "launcher")
    try {
      & bun install --frozen-lockfile
      if ($LASTEXITCODE -ne 0) { throw "launcher dependency install 실패" }
    } finally {
      Pop-Location
    }

    & bun run app
    if ($LASTEXITCODE -ne 0) { throw "launcher 실행 실패" }
  } finally {
    Pop-Location
  }
}
