$ErrorActionPreference = "Stop"

$installedUrl = "http://127.0.0.1:17842/v1"
$codexDir = Join-Path $HOME ".codex"
$configPath = Join-Path $codexDir "config.toml"
$stateDir = Join-Path $HOME ".devin-is-free"
$statePath = Join-Path $stateDir "route-state.json"
$utf8 = New-Object System.Text.UTF8Encoding($false)

New-Item -ItemType Directory -Force -Path $codexDir | Out-Null
New-Item -ItemType Directory -Force -Path $stateDir | Out-Null

$content = if (Test-Path $configPath) { [IO.File]::ReadAllText($configPath) } else { "" }
$pattern = '(?m)^[ \t]*openai_base_url[ \t]*=[ \t]*"([^"]*)"[ \t]*(?:#.*)?$'
$match = [regex]::Match($content, $pattern)
$currentUrl = if ($match.Success) { $match.Groups[1].Value } else { $null }

if ($currentUrl -eq $installedUrl -and (Test-Path $statePath)) {
    Write-Host "Devin proxy route is already installed: $installedUrl"
    exit 0
}

$state = [ordered]@{
    version = 1
    installed_base_url = $installedUrl
    had_openai_base_url = [bool]$match.Success
    previous_openai_base_url = $currentUrl
    upstream_base_url = if ($currentUrl -and $currentUrl -ne $installedUrl) { $currentUrl } else { $null }
    configured_at = (Get-Date).ToString("o")
}

$newLine = 'openai_base_url = "' + $installedUrl + '"'
if ($match.Success) {
    $newContent = ([regex]$pattern).Replace($content, $newLine, 1)
} else {
    $separator = if ($content.Length -gt 0 -and -not $content.EndsWith("`n")) { "`r`n" } else { "" }
    $newContent = $content + $separator + $newLine + "`r`n"
}

[IO.File]::WriteAllText($configPath, $newContent, $utf8)
[IO.File]::WriteAllText($statePath, ($state | ConvertTo-Json -Depth 4), $utf8)

Write-Host "Installed Devin Codex route: $installedUrl"
if ($state.upstream_base_url) {
    Write-Host "Previous route will remain available through passthrough: $($state.upstream_base_url)"
} else {
    Write-Host "Native Codex traffic will be passed through to the official Codex backend."
}
Write-Host "Restart Codex after starting the proxy."
