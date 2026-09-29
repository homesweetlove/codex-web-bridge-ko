$ErrorActionPreference = "Stop"

$installedUrl = "http://127.0.0.1:17842/v1"
$configPath = Join-Path (Join-Path $HOME ".codex") "config.toml"
$statePath = Join-Path (Join-Path $HOME ".devin-is-free") "route-state.json"
$utf8 = New-Object System.Text.UTF8Encoding($false)

if (-not (Test-Path $statePath)) {
    Write-Host "No Devin proxy route state was found. Nothing to restore."
    exit 0
}
if (-not (Test-Path $configPath)) {
    throw "Codex config does not exist: $configPath"
}

$state = Get-Content -Raw $statePath | ConvertFrom-Json
$content = [IO.File]::ReadAllText($configPath)
$pattern = '(?m)^[ \t]*openai_base_url[ \t]*=[ \t]*"([^"]*)"[ \t]*(?:#.*)?$'
$match = [regex]::Match($content, $pattern)
$currentUrl = if ($match.Success) { $match.Groups[1].Value } else { $null }

if ($currentUrl -ne $installedUrl) {
    throw "Refusing to overwrite Codex routing because openai_base_url is no longer $installedUrl (current: $currentUrl)"
}

if ($state.had_openai_base_url -and $state.previous_openai_base_url) {
    $replacement = 'openai_base_url = "' + [string]$state.previous_openai_base_url + '"'
    $newContent = ([regex]$pattern).Replace($content, $replacement, 1)
    Write-Host "Restored previous Codex route: $($state.previous_openai_base_url)"
} else {
    $newContent = ([regex]$pattern).Replace($content, "", 1)
    Write-Host "Removed Devin Codex route and restored the previous no-override state."
}

[IO.File]::WriteAllText($configPath, $newContent, $utf8)
Remove-Item -Force $statePath
Write-Host "Restart Codex to apply the restored route."
