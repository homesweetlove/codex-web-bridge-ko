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

function Replace-Exact([string]$Path, [string]$Old, [string]$New, [string]$Label) {
  $text = Read-Utf8 $Path
  if (-not $text.Contains($Old)) { throw "[$Label] expected text was not found in $Path" }
  Write-Utf8 $Path ($text.Replace($Old, $New))
  Write-Host "[OK] $Label"
}

$app = Join-Path $SourceDir "launcher/src/App.tsx"
$i18n = Join-Path $SourceDir "launcher/src/i18n.ts"
$main = Join-Path $SourceDir "launcher/electron/main.cjs"

foreach ($file in @($app, $i18n, $main)) {
  if (-not (Test-Path $file)) { throw "Required file is missing: $file" }
}

# Always render the Korean edition in Korean, even if an older launcher profile saved another language.
Replace-Exact $app 'const documentLanguage = snapshot?.state.language ?? "ko";' 'const documentLanguage: Language = "ko";' "force document language"
Replace-Exact $app 'const language = snapshot.state.language ?? "ko";' 'const language: Language = "ko";' "force renderer language"

# Skip the language-selection screen. The first screen only asks how ChatGPT should be operated.
Replace-Exact $app @'
  const [stage, setStage] = useState<"language" | "interaction" | "support">(
    snapshot.state.language ? "interaction" : "language",
  );
'@ @'
  const [stage, setStage] = useState<"language" | "interaction" | "support">("interaction");
'@ "skip language onboarding"
Replace-Exact $app 'const [selectedLanguage, setSelectedLanguage] = useState<Language>(language);' 'const [selectedLanguage, setSelectedLanguage] = useState<Language>("ko");' "lock onboarding language"

# Remove the extra social/support step: choose a mode and start immediately.
Replace-Exact $app 'const stageIndex = isLanguage ? 0 : isInteraction ? 1 : 2;' 'const stageIndex = 0;' "single-step onboarding index"
Replace-Exact $app '          {!isLanguage ? (' '          {stage === "support" ? (' "hide onboarding back button"
Replace-Exact $app '              onClick={() => setStage(isInteraction ? "language" : "interaction")}' '              onClick={() => setStage("interaction")}' "disable language back navigation"
Replace-Exact $app @'
          onClick={isLanguage
            ? chooseLanguage
            : isInteraction ? () => setStage("support") : finish}
'@ @'
          onClick={isLanguage ? chooseLanguage : finish}
'@ "finish onboarding directly"
Replace-Exact $app '        <div className="welcome-progress" aria-label={`${stageIndex + 1} / 3`}>' '        <div className="welcome-progress" aria-label={`${stageIndex + 1} / 1`}>' "single-step progress label"
Replace-Exact $app '          {[0, 1, 2].map(index => (' '          {[0].map(index => (' "single-step progress dots"

# Settings keeps a harmless language row, but it only contains Korean.
$languageOptionsOld = @'
  const options: Array<{ label: string; value: Language }> = [
    { label: "한국어", value: "ko" },
    { label: copy.english, value: "en" },
    { label: copy.chinese, value: "zh-CN" },
    { label: copy.japanese, value: "ja" },
  ];
'@
$languageOptionsNew = @'
  const options: Array<{ label: string; value: Language }> = [
    { label: "한국어", value: "ko" },
  ];
'@
Replace-Exact $app $languageOptionsOld $languageOptionsNew "Korean-only settings language"

# Complete Korean copy: no English fallback for visible launcher strings.
$ko = @'
const ko: Record<keyof typeof en, string> = {
  product: "Codex 웹 GPT",
  devBadge: "개발",
  devSetupTitle: "격리된 개발 프로필 설정",
  devSetupSubtitle: "이 브라우저, 계정, 설정과 런타임 데이터는 일반 런처 및 Codex와 분리됩니다.",
  devCoreSetup: "개발 프로필",
  devStepInstall: "개발 하네스 초기화",
  devStepInstallBody: "격리된 개발 홈에 계정 기능을 저장합니다. Codex 경로, Responses 리스너 또는 시스템 서비스는 설치하지 않으며 전체 모드에서는 격리된 MCP 터널만 관리합니다.",
  devInstall: "프로필 초기화",
  devReinstall: "프로필 새로고침",
  devMcpTitle: "MCP 시뮬레이션 도구",
  devMcpSubtitle: "별도 ChatGPT 계정을 격리된 저장소 하네스에 연결합니다.",
  devMcpBody: "개발 런처는 격리된 MCP 터널을 준비 상태로 유지합니다. 저장소 채팅이 터널에 연결되고 도구 동작 결과를 명확히 반환합니다.",
  devConnectorIsolationNotice: "아래의 정확한 개발용 이름으로 별도 커넥터를 만드세요. Codex Native2는 그대로 두면 실제 환경과 개발 환경을 함께 사용할 수 있습니다.",
  devSettingsTitle: "개발 프로필 설정",
  devKeepRunningBody: "창을 닫아도 격리된 브라우저 세션과 개발용 MCP 터널을 유지합니다.",
  biggerContext: "더 큰 컨텍스트 (실험 기능)",
  biggerContextBody: "작은 작업은 한 메시지로 보내고 큰 작업은 2~3개 메시지로 나눕니다. 컨텍스트와 압축 기준이 최대 3배로 늘어납니다. 변경 후 Codex를 재시작하세요. 요청 수가 늘어 일시적 제한이 더 자주 걸릴 수 있습니다. 기본값은 꺼짐입니다.",
  biggerContextRecommendationTitle: "최대 3배 컨텍스트 사용",
  biggerContextRecommendationBody: "큰 작업을 여러 메시지로 나눠 ChatGPT 웹이 최대 3배의 컨텍스트를 사용하게 합니다. 실험 기능이며 일시적 제한이 늘 수 있습니다.",
  biggerContextRecommendationToggleBody: "큰 작업을 여러 메시지로 나누고 컨텍스트와 압축 한도를 높입니다.",
  tagline: "Codex에서 ChatGPT 웹 모델 사용",
  chooseLanguage: "언어",
  chooseLanguageHint: "이 버전은 한국어 전용입니다.",
  english: "영어",
  chinese: "중국어",
  japanese: "일본어",
  continue: "시작하기",
  supportTitle: "시작하기",
  supportBody: "준비가 끝났습니다.",
  star: "원본 GitHub 열기",
  starred: "GitHub 열림",
  follow: "제작자 페이지 열기",
  followed: "제작자 페이지 열림",
  finishWelcome: "시작하기",
  setup: "설정",
  activity: "활동",
  settings: "환경설정",
  updateAvailable: "업데이트 가능",
  updating: "업데이트 중…",
  workspace: "작업 공간",
  configuration: "구성",
  runtime: "실행 환경",
  browser: "브라우저",
  openChatgpt: "ChatGPT 열기",
  temporaryChat: "임시 채팅",
  back: "뒤로",
  forward: "앞으로",
  reload: "새로고침",
  zoomOut: "축소",
  zoomReset: "배율 초기화",
  zoomIn: "확대",
  hideSidebar: "사이드바 숨기기",
  showSidebar: "사이드바 보이기",
  resizeSidebar: "사이드바 크기 조절",
  hideTab: "탭 닫기",
  browserTabLimit: "ChatGPT 웹 탭은 동시에 최대 5개까지 사용할 수 있습니다.",
  browserAddress: "ChatGPT 브라우저",
  noActiveTask: "진행 중인 작업 없음",
  noActiveTaskBody: "Codex에서 웹 모델 작업을 시작하면 여기에 ChatGPT가 표시됩니다.",
  browserReady: "브라우저 준비됨",
  showBrowser: "ChatGPT 보이기",
  hideBrowser: "ChatGPT 숨기기",
  setupTitle: "Codex 웹 GPT 설정",
  setupSubtitle: "아래 순서대로 진행하면 Codex 모델 목록에 ChatGPT 웹 모델이 추가됩니다.",
  coreSetup: "기본 설정",
  interactionMode: "사용 방식 선택",
  interactionModeOnboardingBody: "자동 모드가 가장 간편합니다. 직접 전송하고 싶으면 수동 안전 모드를 선택하세요.",
  automaticInteraction: "자동 모드 (추천)",
  automaticInteractionBody: "프롬프트 전송과 응답 확인을 자동으로 처리합니다. 가장 간편하지만 비공식 브라우저 자동화 방식입니다.",
  manualInteraction: "수동 안전 모드",
  manualInteractionBody: "ChatGPT 페이지를 자동으로 읽거나 조작하지 않습니다. 준비된 프롬프트를 직접 붙여넣고 전송합니다.",
  optional: "선택",
  required: "필수",
  stepAccount: "1. ChatGPT 로그인",
  stepAccountBody: "내장 브라우저에서 ChatGPT에 로그인하세요. 로그인 정보는 이 런처 전용 공간에 저장됩니다.",
  signIn: "로그인하기",
  passkeySignIn: "패스키 사용",
  passkeyContinue: "계속",
  passkeyImporting: "가져오는 중…",
  passkeyContinueBody: "Chrome 창에서 패스키 로그인을 마친 뒤 여기로 돌아와 계속을 누르세요.",
  checkingSignIn: "로그인 확인 중",
  verifySignIn: "로그인 확인",
  signedIn: "로그인 완료",
  stepSmoke: "2. 연결 테스트",
  stepSmokeBody: "High 모델로 짧은 임시 메시지를 보내 정상 응답 여부를 확인합니다.",
  runSmoke: "연결 테스트",
  smokePassed: "연결 테스트 완료",
  stepInstall: "3. Codex에 모델 추가",
  stepInstallBody: "기존 Codex 모델은 유지하고 ChatGPT 웹 모델만 추가합니다.",
  zeroRiskModelSettings: "수동 안전 모드 모델",
  zeroRiskModelSettingsBody: "Codex에 추가할 수동 모델을 선택합니다.",
  zeroRiskDefaultProfile: "기본",
  zeroRiskDefaultProfileBody: "수동 안전 모델만 추가합니다.",
  zeroRiskProProfile: "Pro",
  zeroRiskProProfileBody: "수동 안전 Pro 모델도 추가합니다.",
  zeroRiskProProfileInfo: "압축 전 약 25만 토큰을 사용할 수 있습니다. 매 작업마다 ChatGPT Pro를 직접 선택해야 하며 Pro 계정이 필요합니다.",
  install: "모델 추가",
  reinstall: "다시 설치",
  awaitingCodex: "Codex 재시작 필요",
  restartCodex: "Codex를 백그라운드 프로세스까지 완전히 종료한 뒤 다시 실행하세요. 창만 닫거나 로그아웃하는 것은 재시작이 아닙니다. 이 런처는 계속 켜 두세요.",
  mcpTitle: "Codex 도구 연결 (MCP)",
  mcpSubtitle: "ChatGPT가 Codex의 파일·터미널 도구를 사용할 수 있게 연결합니다.",
  mcpBody: "필요한 경우에만 설정하세요. 일반적인 웹 모델 사용에는 필수가 아닙니다.",
  configureMcp: "도구 연결 설정",
  mcpReady: "도구 연결 완료",
  close: "닫기",
  previous: "뒤로",
  next: "다음",
  done: "완료",
  guideVideo: "안내 영상",
  expandGuideVideo: "영상 크게 보기",
  closeGuideVideo: "큰 영상 닫기",
  mcpStepOne: "1. 터널과 API 키 만들기",
  mcpStepOneBody: "OpenAI 터널을 만들고 Tunnel ID를 복사한 뒤 Tunnels Read + Use 권한의 일반 API 키를 만드세요. 키는 터널 실행에만 사용됩니다.",
  openTunnels: "터널 설정 열기",
  openKeys: "API 키 만들기",
  mcpStepTwo: "2. 로컬 도구 연결",
  mcpStepTwoBody: "Tunnel ID와 API 키를 붙여넣으세요. 같은 OpenAI 계정의 터널을 사용해야 합니다. 키는 이 기기의 비공개 저장소에만 저장됩니다.",
  mcpStepTwoHint: "이 단계가 완료되고 터널이 실행 중이어야 ChatGPT에 MCP 커넥터를 추가할 수 있습니다.",
  mcpCatalogRequired: "먼저 모델 추가를 완료하고 Codex를 완전히 재시작하세요. 모델 목록 확인이 끝난 뒤 도구 연결을 설정할 수 있습니다.",
  tunnelId: "터널 ID",
  runtimeKey: "API 키 (관리자 키 아님)",
  connect: "연결하기",
  reconnect: "다시 연결",
  credentialsConfigured: "터널 정보 저장됨",
  credentialsConfiguredBody: "이 기기에 저장된 터널 ID와 API 키를 다시 사용합니다.",
  replaceCredentials: "정보 바꾸기",
  keepCredentials: "저장된 정보 사용",
  mcpStepThree: "3. ChatGPT 커넥터 연결",
  mcpStepThreeBody: "ChatGPT 설정에서 개발자 모드를 켠 뒤 Plugins에서 새 커넥터를 만드세요. Tunnel을 선택하고, Authentication은 None, 권한은 Allow all actions로 설정한 다음 아래 커넥터 이름을 정확히 사용하세요.",
  manualMcpStepThreeBody: "아래의 정확한 이름인 Codex Zero Risk로 별도 커넥터를 만들고 수동 작업마다 직접 선택하세요. 자동 모드와는 별도의 터널과 인증 정보가 필요합니다.",
  connectorMigrationNotice: "기존 Codex Native를 사용 중이라면 그대로 두고 Codex Native2를 새로 만드세요. 기존 커넥터 이름은 바꾸지 마세요.",
  manualConnectorNotice: "Codex Zero Risk는 수동 안전 모드 전용 커넥터입니다. 프롬프트를 보내기 전에 직접 선택해야 합니다.",
  openConnectors: "ChatGPT 플러그인 열기",
  connectorName: "커넥터 이름",
  verifyRuntime: "연결 확인",
  checkingChatGptConnector: "ChatGPT 커넥터 확인 중",
  doctorProxyHealthy: "응답 프록시가 {endpoint}에서 정상 작동 중입니다",
  doctorTunnelBinaryInstalled: "터널 실행 파일이 설치되어 있습니다",
  doctorTunnelKeyStored: "터널 실행 키가 안전하게 저장되어 있습니다",
  doctorTunnelRuntimeOwned: "런처가 터널 실행 환경을 관리하고 있습니다",
  doctorTunnelRuntimeReady: "터널 실행 환경이 정상이며 사용 가능합니다",
  doctorConnectorAvailable: "ChatGPT 커넥터 \"{name}\"을 사용할 수 있습니다",
  activityTitle: "실행 기록",
  activitySubtitle: "로컬 진단 기록입니다. 공유 전 개인정보가 제거된 로그만 내보내세요.",
  recentActivity: "최근 기록",
  noLogs: "아직 기록이 없습니다.",
  exportSafeLog: "안전한 로그 내보내기",
  settingsTitle: "런처 환경설정",
  general: "일반",
  launchAtLogin: "Windows 로그인 시 자동 실행",
  launchAtLoginBody: "Codex보다 먼저 로컬 연결을 준비합니다.",
  keepRunningOnClose: "창을 닫아도 계속 실행",
  keepRunningOnCloseBody: "런처를 트레이에 숨기고 Codex와 ChatGPT 웹 모델 연결을 유지합니다.",
  showDuringTurns: "작업 중 브라우저 표시",
  showDuringTurnsBody: "웹 모델이 작업할 때 내장 ChatGPT 화면을 자동으로 보여줍니다.",
  manualBiggerContextUnavailable: "수동 안전 모드는 고정된 3배 압축 간격을 사용하며 프롬프트는 직접 전송합니다.",
  manualPromptTitle: "ChatGPT에 이 작업 보내기",
  manualPromptInstruction: "프롬프트가 클립보드에 복사되었습니다. 열린 ChatGPT 탭에 붙여넣고 원하는 모델과 추론 강도, Codex Zero Risk 커넥터를 선택한 뒤 전송하세요.",
  manualPromptCopy: "프롬프트 복사",
  manualPromptCancel: "작업 취소",
  manualPromptSent: "전송 완료",
  manualPromptWaiting: "Codex Zero Risk 연결 대기 중",
  manualPromptRunning: "ChatGPT가 Codex 도구로 작업 중입니다",
  manualPromptSeconds: "초 남음",
  language: "언어",
  diagnostics: "진단",
  runDoctor: "전체 진단 실행",
  cancelTurns: "진행 중인 Codex 작업 취소",
  cancelTurnsBody: "현재 HTTP 스트림과 연결된 ChatGPT 웹 작업을 중단합니다.",
  turnsCancelled: "진행 중인 Codex 작업을 취소했습니다",
  uninstallIntegration: "Codex 연결 제거",
  uninstallIntegrationBody: "기존 Codex 모델 경로를 복원하고 이 브리지 실행 환경을 제거합니다.",
  integrationRemoved: "연결 제거 완료. Codex를 한 번 완전히 재시작하세요",
  running: "실행 중",
  complete: "완료",
  failed: "실패",
  healthy: "정상",
  needsAttention: "확인 필요",
  loading: "불러오는 중",
  platform: "운영체제",
  version: "버전",
  status: "상태",
  notConfigured: "설정 안 됨",
  error: "문제가 발생했습니다",
  dismiss: "닫기",
  sessionReminderTitle: "ChatGPT 로그인 갱신 권장",
  sessionReminderBody: "이틀에 한 번 다시 로그인하는 것을 권장합니다. 오래된 로그인 세션은 웹 모델 작업이나 MCP 도구 연결을 중단시킬 수 있습니다.",
  logOut: "로그아웃",
};
'@

$i18nText = Read-Utf8 $i18n
$pattern = '(?s)const ko: Record<keyof typeof en, string> = \{.*?\n\};\n\nexport type Copy = typeof en;'
if (-not [regex]::IsMatch($i18nText, $pattern)) {
  throw "[complete Korean copy] Korean copy block was not found"
}
$i18nText = [regex]::Replace($i18nText, $pattern, ($ko + "`n`nexport type Copy = typeof en;"), 1)

# Regardless of any stored language value, renderer copy is Korean-only.
$copyForPattern = '(?s)export function copyFor\(language: Language\): Copy \{.*?\n\}'
if (-not [regex]::IsMatch($i18nText, $copyForPattern)) { throw "[copyFor] function was not found" }
$i18nText = [regex]::Replace($i18nText, $copyForPattern, 'export function copyFor(_language: Language): Copy {`n  return ko as Copy;`n}', 1)
Write-Utf8 $i18n $i18nText
Write-Host "[OK] complete Korean renderer copy"

# Tray/context menu also stays Korean even with an old saved profile.
Replace-Exact $main @'
function nativeCopyFor(language) {
  return NATIVE_COPY[language] || NATIVE_COPY.en;
}
'@ @'
function nativeCopyFor(_language) {
  return NATIVE_COPY.ko;
}
'@ "force Korean native menus"

Write-Host "Korean-only simplification patch applied successfully."
