param(
  [Parameter(Mandatory = $true)]
  [string]$SourceDir
)

$ErrorActionPreference = "Stop"
$SourceDir = (Resolve-Path $SourceDir).Path

function Normalize-Lf([string]$Text) {
  return $Text.Replace("`r`n", "`n").Replace("`r", "`n")
}

function Read-Utf8([string]$Path) {
  return Normalize-Lf ([System.IO.File]::ReadAllText($Path, [System.Text.UTF8Encoding]::new($false)))
}

function Write-Utf8([string]$Path, [string]$Text) {
  [System.IO.File]::WriteAllText($Path, (Normalize-Lf $Text), [System.Text.UTF8Encoding]::new($false))
}

function Replace-Exact([string]$Path, [string]$Old, [string]$New, [string]$Label) {
  $text = Read-Utf8 $Path
  $oldLf = Normalize-Lf $Old
  $newLf = Normalize-Lf $New
  if (-not $text.Contains($oldLf)) {
    throw "[$Label] upstream source changed; expected text was not found in $Path"
  }
  $text = $text.Replace($oldLf, $newLf)
  Write-Utf8 $Path $text
  Write-Host "[OK] $Label"
}

$types = Join-Path $SourceDir "launcher/src/types.ts"
$state = Join-Path $SourceDir "launcher/electron/state.cjs"
$app = Join-Path $SourceDir "launcher/src/App.tsx"
$i18n = Join-Path $SourceDir "launcher/src/i18n.ts"
$main = Join-Path $SourceDir "launcher/electron/main.cjs"

foreach ($file in @($types, $state, $app, $i18n, $main)) {
  if (-not (Test-Path $file)) { throw "Required upstream file is missing: $file" }
}

# 1) Language type and persisted state validation.
Replace-Exact $types `
  'export type Language = "en" | "zh-CN" | "ja";' `
  'export type Language = "en" | "zh-CN" | "ja" | "ko";' `
  "language type"

Replace-Exact $state `
  'if (state.language !== null && state.language !== "en" && state.language !== "zh-CN" && state.language !== "ja") {' `
  'if (state.language !== null && state.language !== "en" && state.language !== "zh-CN" && state.language !== "ja" && state.language !== "ko") {' `
  "state language validation"

# 2) Main-process language validation.
Replace-Exact $main `
@'
function validateLanguage(value) {
  if (value !== "en" && value !== "zh-CN" && value !== "ja") {
    throw new Error("Language must be en, zh-CN, or ja");
  }
  return value;
}
'@ `
@'
function validateLanguage(value) {
  if (value !== "en" && value !== "zh-CN" && value !== "ja" && value !== "ko") {
    throw new Error("Language must be en, zh-CN, ja, or ko");
  }
  return value;
}
'@ `
  "IPC language validation"

# 3) Korean edition renders Korean before the user has chosen a language.
# Existing saved language preferences are still respected.
Replace-Exact $app `
  'const documentLanguage = snapshot?.state.language ?? "en";' `
  'const documentLanguage = snapshot?.state.language ?? "ko";' `
  "default document language"
Replace-Exact $app `
  'const language = snapshot.state.language ?? "en";' `
  'const language = snapshot.state.language ?? "ko";' `
  "default launcher language"

# 4) Add Korean to first-run language picker.
$jaWelcome = @'
              <WelcomeOption
                active={selectedLanguage === "ja"}
                detail={localized.japanese}
                label={localized.japanese}
                marker="日"
                onClick={() => setSelectedLanguage("ja")}
              />
'@
$jaAndKoWelcome = @'
              <WelcomeOption
                active={selectedLanguage === "ja"}
                detail={localized.japanese}
                label={localized.japanese}
                marker="日"
                onClick={() => setSelectedLanguage("ja")}
              />
              <WelcomeOption
                active={selectedLanguage === "ko"}
                detail="한국어"
                label="한국어"
                marker="한"
                onClick={() => setSelectedLanguage("ko")}
              />
'@
Replace-Exact $app $jaWelcome $jaAndKoWelcome "onboarding Korean option"

# 5) Add Korean to Settings > Language.
$languageOptions = @'
  const options: Array<{ label: string; value: Language }> = [
    { label: copy.english, value: "en" },
    { label: copy.chinese, value: "zh-CN" },
    { label: copy.japanese, value: "ja" },
  ];
'@
$languageOptionsKo = @'
  const options: Array<{ label: string; value: Language }> = [
    { label: "한국어", value: "ko" },
    { label: copy.english, value: "en" },
    { label: copy.chinese, value: "zh-CN" },
    { label: copy.japanese, value: "ja" },
  ];
'@
Replace-Exact $app $languageOptions $languageOptionsKo "settings Korean option"

# 6) Renderer copy. The spread keeps any future/untranslated upstream keys usable in English.
$koBlock = @'
const ko: Record<keyof typeof en, string> = {
  ...en,
  product: "Codex Web GPT 한국어판",
  tagline: "네이티브 Codex 환경에서 ChatGPT Web 사용",
  chooseLanguage: "언어 선택",
  chooseLanguageHint: "나중에 설정에서 변경할 수 있습니다.",
  continue: "계속",
  supportTitle: "시작하기 전에",
  supportBody: "원본 프로젝트와 제작자 페이지를 열어 프로젝트를 확인할 수 있습니다.",
  star: "원본 GitHub 열기",
  starred: "GitHub 열림",
  follow: "제작자 X 열기",
  followed: "X 열림",
  finishWelcome: "런처 열기",
  setup: "설정",
  activity: "활동",
  settings: "설정",
  workspace: "작업 공간",
  configuration: "구성",
  runtime: "런타임",
  browser: "브라우저",
  openChatgpt: "ChatGPT 열기",
  temporaryChat: "임시 채팅",
  back: "뒤로",
  forward: "앞으로",
  reload: "새로고침",
  zoomOut: "축소",
  zoomReset: "확대/축소 초기화",
  zoomIn: "확대",
  hideSidebar: "사이드바 숨기기",
  showSidebar: "사이드바 표시",
  resizeSidebar: "사이드바 크기 조절",
  hideTab: "탭 닫기",
  browserTabLimit: "ChatGPT Web 탭은 동시에 최대 5개까지 사용할 수 있습니다. 과도한 병렬 요청으로 계정 제한이 발생하는 것을 줄이기 위한 제한입니다.",
  browserAddress: "ChatGPT 브라우저",
  noActiveTask: "진행 중인 작업 없음",
  noActiveTaskBody: "Codex가 Web 모델 작업을 시작하면 여기에 ChatGPT가 표시됩니다.",
  browserReady: "브라우저 준비됨",
  showBrowser: "ChatGPT 표시",
  hideBrowser: "ChatGPT 숨기기",
  setupTitle: "Codex Web GPT 설정",
  setupSubtitle: "세 단계 확인을 완료하면 Codex의 기본 모델 선택기에서 ChatGPT Web을 사용할 수 있습니다.",
  coreSetup: "기본 설정",
  interactionMode: "ChatGPT 작동 방식",
  interactionModeOnboardingBody: "런처가 ChatGPT와 상호작용하는 방법을 선택하세요. 기본값은 자동화 사용입니다. 나중에 설정에서 변경할 수 있습니다.",
  automaticInteraction: "자동화 사용",
  automaticInteractionBody: "프롬프트를 자동 전송하고 ChatGPT 페이지 상태를 읽습니다. 중복 전송 방지 기능이 있지만 브라우저 자동화는 OpenAI 약관 또는 계정 정책과 충돌할 수 있습니다.",
  manualInteraction: "Zero Risk",
  manualInteractionBody: "ChatGPT 페이지를 읽거나 변경하지 않습니다. 런처가 프롬프트를 준비하면 직접 붙여넣고 커넥터, 모델, 추론 강도를 선택해 전송합니다.",
  optional: "선택 사항",
  required: "필수",
  stepAccount: "ChatGPT 로그인",
  stepAccountBody: "내장 ChatGPT 브라우저에서 직접 로그인하세요. 로그인 정보는 이 런처의 비공개 프로필에 유지됩니다.",
  signIn: "로그인 열기",
  passkeySignIn: "패스키 사용",
  passkeyContinue: "계속",
  passkeyImporting: "가져오는 중…",
  passkeyContinueBody: "전용 Chrome 창에서 패스키 로그인을 완료한 뒤 여기로 돌아와 계속을 누르세요.",
  checkingSignIn: "저장된 세션 확인 중",
  verifySignIn: "로그인 확인",
  signedIn: "로그인됨",
  stepSmoke: "브라우저 동작 테스트",
  stepSmokeBody: "High를 선택하고 짧은 임시 메시지를 보내 전체 스트리밍 응답이 정상인지 확인합니다.",
  runSmoke: "동작 테스트 실행",
  smokePassed: "동작 테스트 통과",
  stepInstall: "Codex에 설치",
  stepInstallBody: "Codex의 기본 모델 목록을 없애지 않고 ChatGPT Web 모델을 추가합니다. 기존 사용자 지정 라우트는 저장했다가 브리지를 제거할 때 복원합니다.",
  install: "모델 설치",
  reinstall: "다시 설치",
  awaitingCodex: "Codex 재시작 필요",
  restartCodex: "Codex 창뿐 아니라 백그라운드 프로세스까지 완전히 종료한 다음 다시 실행해야 모델 목록이 새로고침됩니다. 로그아웃/로그인이나 창만 닫는 것은 재시작이 아닙니다. 이 런처는 계속 켜 두세요.",
  biggerContext: "더 큰 컨텍스트 (실험적)",
  biggerContextBody: "작은 작업은 한 메시지로 유지하고 큰 컨텍스트는 2~3개 메시지로 나눕니다. 모델 컨텍스트와 압축 기준이 3배로 늘어납니다. 변경 후 Codex를 재시작하세요. 추가 요청으로 인해 속도 제한이나 일시적인 쿨다운이 늘어날 수 있습니다. 기본값은 꺼짐입니다.",
  biggerContextRecommendationTitle: "최대 3배 컨텍스트 사용",
  biggerContextRecommendationBody: "큰 작업을 여러 메시지로 보내 ChatGPT Web이 최대 3배의 컨텍스트를 사용하도록 합니다. 실험적 기능이며 일시적 쿨다운 가능성이 높아질 수 있습니다.",
  biggerContextRecommendationToggleBody: "큰 작업을 여러 메시지로 나누고 모델 컨텍스트와 압축 한도를 높입니다.",
  mcpTitle: "MCP를 통한 Codex 도구 연결",
  mcpSubtitle: "OpenAI 터널을 통해 ChatGPT를 현재 Codex 하네스에 연결합니다.",
  mcpBody: "계정에서 사용할 수 있는 ChatGPT Web 모델이 현재 Codex 하네스 도구를 사용할 수 있게 합니다.",
  configureMcp: "MCP 설정",
  mcpReady: "MCP 설정 완료",
  close: "닫기",
  previous: "뒤로",
  next: "다음",
  done: "완료",
  guideVideo: "안내 영상",
  expandGuideVideo: "안내 영상 크게 보기",
  closeGuideVideo: "확대 영상 닫기",
  mcpStepOne: "터널과 API 키 만들기",
  mcpStepOneBody: "OpenAI 터널을 만들고 Tunnel ID를 복사한 뒤 Tunnels Read + Use 권한의 일반 API 키를 만드세요. 이 키는 터널 실행에만 필요합니다.",
  openTunnels: "Tunnels 열기",
  openKeys: "API 키 만들기",
  mcpStepTwo: "로컬 하네스 연결",
  mcpStepTwoBody: "Tunnel ID와 API 키를 붙여넣으세요. 터널은 ChatGPT에서 사용할 OpenAI 계정과 같은 계정에 속해야 합니다. 키는 로컬 비공개 저장소에만 저장되고 런처 로그에는 기록되지 않습니다.",
  mcpStepTwoHint: "이 단계가 성공하고 터널이 실행 중이어야 ChatGPT에 MCP 커넥터를 추가할 수 있습니다.",
  mcpCatalogRequired: "Codex 모델 설치와 확인이 끝나기 전에는 하네스를 연결할 수 없습니다. 설정으로 돌아가 모델 설치를 누르고 Codex를 완전히 재시작한 뒤 모델 목록 확인이 끝날 때까지 기다리세요.",
  tunnelId: "Tunnel ID",
  runtimeKey: "API 키 (Admin 키 아님)",
  connect: "하네스 연결",
  reconnect: "하네스 다시 연결",
  credentialsConfigured: "터널 인증 정보 저장됨",
  credentialsConfiguredBody: "이 기기에 비공개로 저장된 Tunnel ID와 API 키를 런처가 다시 사용합니다.",
  replaceCredentials: "인증 정보 교체",
  keepCredentials: "저장된 인증 정보 사용",
  mcpStepThree: "ChatGPT 커넥터 연결",
  mcpStepThreeBody: "커넥터를 만들기 전에 ChatGPT 설정에서 Developer Mode를 켜세요. ChatGPT Plugins에서 새 커넥터를 만들고 Tunnel을 선택한 뒤 Authentication은 None, 권한은 Allow all actions로 설정하세요. 아래 표시된 커넥터 이름을 정확히 사용한 다음 런타임 확인을 실행하세요.",
  manualMcpStepThreeBody: "아래의 정확한 이름 Codex Zero Risk로 별도 커넥터를 만들고 Zero Risk 작업마다 직접 선택하세요. 런처는 이 모드에서 ChatGPT 페이지 상태를 읽지 않습니다.",
  connectorMigrationNotice: "Codex Native에서 업그레이드하는 경우 기존 커넥터는 그대로 두고 Codex Native2를 새로 만드세요.",
  manualConnectorNotice: "Codex Zero Risk는 별도 커넥터입니다. Zero Risk 프롬프트를 보낼 때마다 직접 선택해야 합니다.",
  openConnectors: "ChatGPT Plugins 열기",
  connectorName: "커넥터 이름",
  verifyRuntime: "런타임 확인",
  checkingChatGptConnector: "ChatGPT 커넥터 확인 중",
  doctorProxyHealthy: "Responses 프록시가 {endpoint}에서 정상 작동 중입니다",
  doctorTunnelBinaryInstalled: "고정 버전 openai/tunnel-client 바이너리가 설치되어 있습니다",
  doctorTunnelKeyStored: "터널 런타임 키가 비공개로 저장되어 있습니다",
  doctorTunnelRuntimeOwned: "런처가 터널 런타임을 관리하고 있습니다",
  doctorTunnelRuntimeReady: "터널 런타임이 정상이며 준비되었습니다",
  doctorConnectorAvailable: "ChatGPT 커넥터 \"{name}\"을 사용할 수 있습니다",
  activityTitle: "런타임 활동",
  activitySubtitle: "로컬 진단 정보입니다. 공유 전 개인정보 보호 로그를 내보내세요. 원본 로그는 이 기기에만 남습니다.",
  recentActivity: "최근 이벤트",
  noLogs: "아직 런타임 이벤트가 없습니다.",
  exportSafeLog: "안전한 로그 내보내기",
  settingsTitle: "런처 설정",
  general: "일반",
  launchAtLogin: "로그인 시 실행",
  launchAtLoginBody: "Codex가 열리기 전에 로컬 Responses 라우트를 사용할 수 있게 유지합니다.",
  keepRunningOnClose: "창을 닫아도 서버 계속 실행",
  keepRunningOnCloseBody: "런처를 시스템 트레이에 숨겨 네이티브 모델과 ChatGPT Web 모델을 계속 사용할 수 있게 합니다.",
  showDuringTurns: "작업 중 브라우저 표시",
  showDuringTurnsBody: "브라우저 작업이 진행 중일 때 내장 ChatGPT 화면을 표시합니다.",
  manualPromptTitle: "이 작업을 ChatGPT에서 전송",
  manualPromptInstruction: "프롬프트가 클립보드에 복사되어 있습니다. 열린 ChatGPT 탭에 붙여넣고 원하는 모델과 추론 강도, Codex Zero Risk 커넥터를 선택한 뒤 전송하고 아래에서 확인하세요.",
  manualPromptCopy: "프롬프트 복사",
  manualPromptCancel: "작업 취소",
  manualPromptSent: "전송 완료",
  manualPromptWaiting: "Codex Zero Risk 연결 대기 중",
  manualPromptRunning: "ChatGPT가 Codex 하네스를 통해 작업 중",
  manualPromptSeconds: "초 남음",
  language: "언어",
  diagnostics: "진단",
  runDoctor: "진단 실행",
  cancelTurns: "진행 중인 Codex 작업 취소",
  cancelTurnsBody: "활성 HTTP 스트림과 유지 중인 ChatGPT 브라우저 작업을 중단합니다.",
  turnsCancelled: "진행 중인 Codex 작업이 취소되었습니다",
  uninstallIntegration: "Codex 연결 제거",
  uninstallIntegrationBody: "기존 Codex 모델 라우트를 복원하고 비공개 브리지 런타임을 제거합니다.",
  integrationRemoved: "연결이 제거되었습니다. Codex를 한 번 재시작하세요",
  running: "실행 중",
  complete: "완료",
  failed: "실패",
  healthy: "정상",
  needsAttention: "확인 필요",
  loading: "불러오는 중",
  platform: "플랫폼",
  version: "버전",
  status: "상태",
  notConfigured: "설정되지 않음",
  error: "문제가 발생했습니다",
  dismiss: "닫기",
  sessionReminderTitle: "ChatGPT 세션을 새로고침하세요",
  sessionReminderBody: "2일마다 다시 로그인하는 것을 권장합니다. 오래된 ChatGPT 세션은 Web 모델 작업과 MCP 도구 실행을 중단시킬 수 있습니다.",
  logOut: "로그아웃",
};

'@

$i18nText = Read-Utf8 $i18n
if ($i18nText.Contains('const ko: Record<keyof typeof en, string>')) {
  throw "Korean localization already appears to be applied: $i18n"
}
$copyMarker = "export type Copy = typeof en;"
if (-not $i18nText.Contains($copyMarker)) {
  throw "[renderer Korean copy] upstream source changed; Copy marker missing"
}
$i18nText = $i18nText.Replace($copyMarker, (Normalize-Lf $koBlock) + $copyMarker)
$oldCopyFor = Normalize-Lf @'
export function copyFor(language: Language): Copy {
  if (language === "zh-CN") return zh as Copy;
  if (language === "ja") return ja as Copy;
  return en;
}
'@
$newCopyFor = Normalize-Lf @'
export function copyFor(language: Language): Copy {
  if (language === "zh-CN") return zh as Copy;
  if (language === "ja") return ja as Copy;
  if (language === "ko") return ko as Copy;
  return en;
}
'@
if (-not $i18nText.Contains($oldCopyFor)) {
  throw "[renderer Korean copy] upstream copyFor changed"
}
$i18nText = $i18nText.Replace($oldCopyFor, $newCopyFor)
Write-Utf8 $i18n $i18nText
Write-Host "[OK] renderer Korean copy"

# 7) Native tray/dialog copy.
$nativeMarker = Normalize-Lf @'
});

function nativeCopyFor(language) {
'@
$nativeKo = Normalize-Lf @'
  ko: Object.freeze({
    openLauncher: "Codex Web GPT 한국어판 열기",
    quit: "종료",
    exportDiagnostics: "개인정보 보호 진단 내보내기",
    cancel: "취소",
    remove: "제거",
    removeTitle: "Codex Web GPT 제거",
    removeMessage: "Codex에서 ChatGPT Web 모델을 제거하고 이전 모델 라우트를 복원할까요?",
    removeDetail: "런처의 ChatGPT 로그인 프로필은 유지됩니다. Codex를 한 번 완전히 재시작해야 합니다.",
  }),
});

function nativeCopyFor(language) {
'@
$mainText = Read-Utf8 $main
if ($mainText.Contains('openLauncher: "Codex Web GPT 한국어판 열기"')) {
  throw "Native Korean localization already appears to be applied: $main"
}
if (-not $mainText.Contains($nativeMarker)) {
  throw "[native Korean copy] upstream NATIVE_COPY layout changed"
}
$mainText = $mainText.Replace($nativeMarker, $nativeKo)
Write-Utf8 $main $mainText
Write-Host "[OK] native Korean copy"

# 8) Sanity checks: fail instead of producing a half-patched build.
$checks = @(
  @{ Path = $types; Text = '"ja" | "ko"'; Name = "Language type contains ko" },
  @{ Path = $app; Text = 'selectedLanguage === "ko"'; Name = "Onboarding contains Korean" },
  @{ Path = $app; Text = '{ label: "한국어", value: "ko" }'; Name = "Settings contains Korean" },
  @{ Path = $i18n; Text = 'if (language === "ko") return ko as Copy;'; Name = "copyFor handles Korean" },
  @{ Path = $main; Text = 'value !== "ko"'; Name = "IPC accepts Korean" }
)
foreach ($check in $checks) {
  if (-not (Read-Utf8 $check.Path).Contains($check.Text)) {
    throw "Sanity check failed: $($check.Name)"
  }
}

Write-Host ""
Write-Host "Korean patch applied successfully to: $SourceDir" -ForegroundColor Green
