param(
  [Parameter(Mandatory = $true)]
  [string]$SourceDir
)

$ErrorActionPreference = "Stop"
$SourceDir = (Resolve-Path $SourceDir).Path

function Read-Utf8([string]$Path) {
  return [System.IO.File]::ReadAllText($Path, [System.Text.UTF8Encoding]::new($false)).Replace("`r`n", "`n").Replace("`r", "`n")
}

function Write-Utf8([string]$Path, [string]$Text) {
  [System.IO.File]::WriteAllText($Path, $Text.Replace("`r`n", "`n").Replace("`r", "`n"), [System.Text.UTF8Encoding]::new($false))
}

function Replace-Regex([string]$Path, [string]$Pattern, [string]$Replacement, [string]$Label) {
  $text = Read-Utf8 $Path
  $matches = [regex]::Matches($text, $Pattern, [System.Text.RegularExpressions.RegexOptions]::Singleline)
  if ($matches.Count -ne 1) {
    throw "[$Label] expected exactly 1 match, found $($matches.Count) in $Path"
  }
  $next = [regex]::Replace($text, $Pattern, $Replacement, [System.Text.RegularExpressions.RegexOptions]::Singleline)
  Write-Utf8 $Path $next
  Write-Host "[OK] $Label"
}

$app = Join-Path $SourceDir "launcher/src/App.tsx"
$i18n = Join-Path $SourceDir "launcher/src/i18n.ts"
$main = Join-Path $SourceDir "launcher/electron/main.cjs"

foreach ($file in @($app, $i18n, $main)) {
  if (-not (Test-Path $file)) { throw "Required file missing: $file" }
}

Replace-Regex $app `
  'const \[stage, setStage\] = useState<"language" \| "interaction" \| "support">\(\s*snapshot\.state\.language \? "interaction" : "language",\s*\);' `
  'const [stage, setStage] = useState<"language" | "interaction" | "support">("interaction");' `
  'skip language onboarding'

Replace-Regex $app `
  'onClick=\{isLanguage\s*\? chooseLanguage\s*:\s*isInteraction \? \(\) => setStage\("support"\) : finish\}\s*>\s*\{stage === "support" \? localized\.finishWelcome : localized\.continue\}' `
  'onClick={isLanguage ? chooseLanguage : finish}>`n          {localized.finishWelcome}' `
  'finish onboarding directly'

Replace-Regex $app `
  '\{!isLanguage \? \(\s*<button\s+className="text-button"\s+onClick=\{\(\) => setStage\(isInteraction \? "language" : "interaction"\)\}\s+type="button"\s*>\s*\{localized\.previous\}\s*</button>\s*\) : null\}' `
  '' `
  'remove onboarding back button'

Replace-Regex $app `
  '<div className="welcome-progress" aria-label=\{`\$\{stageIndex \+ 1\} / 3`\}>.*?</div>' `
  '<div />' `
  'remove onboarding progress'

Replace-Regex $app `
  '<SettingRow body=\{copy\.chooseLanguageHint\} label=\{copy\.language\}>\s*<LanguageMenu copy=\{copy\} language=\{language\} onChange=\{\(next\) => void updateLanguage\(next\)\} />\s*</SettingRow>' `
  '' `
  'remove language setting'

$copy = Read-Utf8 $i18n
$replacements = [ordered]@{
  'manualInteraction: "Zero Risk"' = 'manualInteraction: "수동 안전 모드"'
  'manualInteractionBody: "ChatGPT 페이지를 읽거나 변경하지 않습니다. 런처가 프롬프트를 준비하면 직접 붙여넣고 커넥터, 모델, 추론 강도를 선택해 전송합니다."' = 'manualInteractionBody: "런처가 ChatGPT 페이지를 자동으로 조작하지 않습니다. 준비된 내용을 직접 붙여넣어 보내는 가장 안전한 방식입니다."'
  'automaticInteraction: "자동화 사용"' = 'automaticInteraction: "자동 모드"'
  'automaticInteractionBody: "프롬프트를 자동 전송하고 ChatGPT 페이지 상태를 읽습니다. 중복 전송 방지 기능이 있지만 브라우저 자동화는 OpenAI 약관 또는 계정 정책과 충돌할 수 있습니다."' = 'automaticInteractionBody: "질문 전송과 응답 확인을 자동으로 처리합니다. 가장 간편하게 사용할 수 있는 방식입니다."'
  'zeroRiskModelSettings: "Zero Risk 모델 프로필"' = 'zeroRiskModelSettings: "수동 안전 모드 모델"'
  'zeroRiskDefaultProfile: "기본"' = 'zeroRiskDefaultProfile: "일반"'
  'zeroRiskDefaultProfileBody: "ChatGPT Web — Zero Risk만 설치합니다."' = 'zeroRiskDefaultProfileBody: "ChatGPT Web 수동 안전 모델만 설치합니다."'
  'zeroRiskProProfileBody: "ChatGPT Web — Zero Risk Pro도 설치합니다."' = 'zeroRiskProProfileBody: "ChatGPT Web 수동 안전 Pro 모델도 함께 설치합니다."'
  'manualPromptWaiting: "Codex Zero Risk 연결 대기 중"' = 'manualPromptWaiting: "수동 안전 연결 대기 중"'
}
foreach ($entry in $replacements.GetEnumerator()) {
  if ($copy.Contains($entry.Key)) { $copy = $copy.Replace($entry.Key, $entry.Value) }
}
Write-Utf8 $i18n $copy
Write-Host "[OK] Korean terminology simplified"

# 네이티브 메뉴/대화상자는 한국어 사전을 최우선으로 사용.
Replace-Regex $main `
  'function nativeCopyFor\(language\) \{\s*return NATIVE_COPY\[language\] \|\| NATIVE_COPY\.en;\s*\}' `
  "function nativeCopyFor(language) {`n  return NATIVE_COPY.ko || NATIVE_COPY[language] || NATIVE_COPY.en;`n}" `
  'force Korean native copy'

Write-Host "Korean-only UX patch complete."
