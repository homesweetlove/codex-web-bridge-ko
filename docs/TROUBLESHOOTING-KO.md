# 문제 해결 — 한국어판

이 문서는 `gpt_is_free` 한국어판과 원본 `codex-chatgpt-web` v5.0.6 기준입니다.

## 1. ChatGPT Web 모델이 Codex 모델 목록에 안 보임

먼저 런처를 **켜 둔 상태**로 유지하세요. `Codex Web GPT` 프로세스는 Codex 본체가 아니라 로컬 브리지/런처입니다.

PowerShell에서 Codex 설정을 확인합니다.

```powershell
Get-Content "$env:USERPROFILE\.codex\config.toml"
```

다음 줄이 있어야 합니다.

```toml
openai_base_url = "http://127.0.0.1:17841/v1"
```

> 위 TOML 문장을 PowerShell에 직접 입력하면 안 됩니다. PowerShell 명령어가 아니라 설정 파일 안의 내용입니다.

### Codex 완전 종료

창만 닫는 것으로는 모델 목록이 새로고침되지 않을 수 있습니다.

```powershell
Get-Process | Where-Object {
    $_.ProcessName -match "codex|openai"
} | Select-Object ProcessName, Id, Path
```

출력을 보고 **Codex 본체만** 완전히 종료하세요. `Codex Web GPT` 런처는 계속 켜 둡니다.

Codex 프로세스만 골라 종료하기 어렵다면 작업 관리자에서 Codex 앱/백그라운드 프로세스를 종료한 뒤 Codex를 다시 실행하는 것이 안전합니다.

## 2. 설치는 성공했는데 모델 목록만 갱신되지 않음

런처에서 다음을 확인합니다.

1. ChatGPT 로그인 완료
2. 브라우저 동작 테스트 통과
3. 모델 설치 완료
4. 런처가 계속 실행 중
5. Codex를 백그라운드 프로세스까지 완전히 종료 후 재실행

그 뒤 **설정 → 진단 → 진단 실행(Run doctor)** 결과를 확인합니다.

## 3. 라우트 충돌

다른 Codex 프록시/라우터가 `openai_base_url`을 바꾸면 이 프로젝트와 동시에 라우트 소유권을 가질 수 없습니다.

예를 들어 OpenCodex, Headroom, OmniRoute, Codex++, CC Switch 또는 직접 작성한 provider/proxy 설정이 있다면 해당 도구의 프록시 기능을 끄고 다시 설정해야 할 수 있습니다.

현재 라우트를 빠르게 확인하려면:

```powershell
Select-String -Path "$env:USERPROFILE\.codex\config.toml" -Pattern "openai_base_url"
```

정상적인 Browser-only 설치 기준 값:

```text
http://127.0.0.1:17841/v1
```

## 4. 런처가 실제로 서버를 열고 있는지 확인

```powershell
Get-NetTCPConnection -LocalPort 17841 -ErrorAction SilentlyContinue
```

또는:

```powershell
Test-NetConnection 127.0.0.1 -Port 17841
```

`TcpTestSucceeded : True`이면 로컬 포트가 열려 있습니다.

## 5. 브라우저 동작 테스트가 실패함

- 런처 안에서 ChatGPT 로그인이 실제로 완료됐는지 확인
- 일반 Temporary Chat을 열 수 있는지 확인
- ChatGPT에 용량/제한/로그인 안내창이 떠 있지 않은지 확인
- 런처를 최신 한국어 빌드로 다시 빌드
- 같은 오류가 반복되면 **활동 → 안전한 로그 내보내기** 사용

ChatGPT의 웹 UI가 바뀌면 비공식 브라우저 자동화가 일시적으로 깨질 수 있습니다.

## 6. 안전한 로그를 공유할 때

다음 정보는 절대로 공개 저장소나 이슈에 그대로 올리지 마세요.

- ChatGPT 쿠키
- 브라우저 저장소/프로필
- API 키
- Tunnel ID
- 인증 헤더
- 전체 Codex 프롬프트
- 민감한 로컬 파일 경로

런처의 **안전한 로그 내보내기** 기능으로 만든 로그를 사용하세요.

## 7. 한국어판 설치 파일이 필요함

이 저장소에서:

1. `Actions`
2. `Build Korean Windows Launcher`
3. `Run workflow`
4. 빌드 완료 후 `gpt-is-free-korean-windows` artifact 다운로드

한국어판은 원본 v5.0.6의 기능 로직을 유지하고 UI 언어 패치만 적용합니다.
