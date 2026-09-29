# Devin SWE-2 for Codex — standalone proxy

`codex-web-bridge-ko` 본체와 코드를 공유하지 않는 별도 프로그램입니다. Codex의 로컬 Responses 경로에 `Devin SWE-2` 모델을 하나 추가하고, 그 모델을 선택했을 때만 **공식 Devin CLI의 `devin acp`** 로 요청을 전달합니다.

이 프로그램은 Devin 인증이나 사용량 정책을 우회하지 않습니다. PC에 로그인된 공식 Devin CLI 세션과 해당 계정에 실제로 제공되는 SWE-2 entitlement를 그대로 사용합니다.

## 구조

```text
Codex Desktop / Codex CLI
        |
        | Responses API + SSE
        v
http://127.0.0.1:17842/v1
        |
        +-- devin/swe-2 ------> devin acp ------> SWE-2
        |
        +-- 나머지 모델 ------> 이전 Codex route 또는 공식 Codex backend
```

기존 `codex-web-bridge-ko`가 `http://127.0.0.1:17841/v1`을 사용 중이면 `setup-codex.ps1`이 그 주소를 자동으로 기억합니다. 이후 17842 프록시가 17841을 upstream으로 사용하므로 기존 ChatGPT Web 모델을 유지하면서 `Devin SWE-2`를 추가할 수 있습니다.

## 요구 사항

- Windows 우선 지원
- Node.js 20 이상
- 공식 Devin CLI가 PATH에 설치되어 있어야 함
- Devin CLI에서 본인 계정으로 로그인되어 있어야 함

Devin CLI가 아직 로그인되지 않았다면 PowerShell에서 다음을 먼저 실행하세요.

```powershell
devin auth login
```

## 설치

이 폴더에서:

```powershell
.\setup-codex.ps1
```

이 스크립트는 `~/.codex/config.toml`의 `openai_base_url`만 `http://127.0.0.1:17842/v1`로 바꿉니다. 기존 주소가 있었다면 `~/.devin-is-free/route-state.json`에 저장하고 upstream으로 계속 사용합니다.

## 실행

Devin이 작업할 프로젝트를 명시하는 방식이 가장 확실합니다.

```powershell
.\start.ps1 -WorkDir "C:\path\to\your\project"
```

코드 수정, 명령 실행 등 Devin 내부 도구까지 허용하려면:

```powershell
.\start.ps1 -WorkDir "C:\path\to\your\project" -AllowTools
```

또는 목표 프로젝트 폴더에서 이 스크립트를 절대 경로로 실행하면 현재 폴더가 fallback working directory가 됩니다.

프록시를 켠 뒤 Codex를 완전히 종료했다가 다시 실행하세요. 모델 목록에 **Devin SWE-2**가 추가되어야 합니다.

Codex의 Effort는 다음처럼 Devin ACP의 reasoning/thought 옵션에 가능한 값으로 자동 매핑합니다.

- Low → 낮은 reasoning 옵션
- Medium → medium 계열
- High → high 계열
- Extra High → max/xhigh 계열

실제 Devin CLI가 광고하는 옵션을 매 요청 시 읽어서 선택하므로 SWE-2의 내부 model id를 코드에 고정하지 않습니다.

## 안전한 권한 기본값

기본 실행에서는 ACP가 요청하는 로컬 작업 권한을 거부합니다. 따라서 단순 질의/분석은 가능하지만 파일 수정이나 명령 실행이 필요한 턴은 제한될 수 있습니다.

`-AllowTools`로 시작하면 `DEVIN_AUTO_APPROVE=1`이 설정되고, Devin이 ACP로 요청한 허용 가능한 동작을 **한 번 허용(allow once)** 방식으로 자동 승인합니다. 이 경우 Devin은 지정된 working directory에서 직접 파일을 수정하거나 명령을 실행할 수 있습니다. 이 동작은 Codex 자체의 승인 UI를 거치지 않습니다.

## 상태 확인

```powershell
.\doctor.ps1
```

프록시가 실행 중이면 다음 주소도 확인할 수 있습니다.

```powershell
Invoke-RestMethod http://127.0.0.1:17842/health
```

## 간단한 직접 테스트

Codex 연결 전에 프록시와 Devin CLI만 시험하려면:

```powershell
$body = @{
  model = "devin/swe-2"
  messages = @(
    @{ role = "user"; content = "Reply with exactly: PONG" }
  )
} | ConvertTo-Json -Depth 5

Invoke-RestMethod `
  -Uri http://127.0.0.1:17842/v1/chat/completions `
  -Method Post `
  -ContentType "application/json" `
  -Body $body
```

## 원래 Codex route로 복구

```powershell
.\restore-codex.ps1
```

설치 시 저장했던 이전 `openai_base_url`을 복구합니다. 복구 전에 사용자가 직접 route를 다른 값으로 바꾼 경우에는 설정을 덮어쓰지 않고 중단합니다.

## 현재 구현 범위

- `/v1/models`: 기존 catalog를 가져와 `devin/swe-2` 추가
- `/v1/responses`: Devin 모델은 ACP로 실행, 나머지는 upstream passthrough
- Responses SSE 텍스트 스트리밍
- `/v1/chat/completions`: 직접 진단용 비스트리밍 endpoint
- `responses/compact`, search, image endpoint passthrough
- 기존 `codex-web-bridge-ko` 17841 route와 체인 가능
- Devin ACP `session/new`의 `configOptions`에서 SWE-2와 reasoning 옵션을 동적으로 탐색

MVP에서는 Devin의 내부 도구 실행 결과를 Codex의 개별 tool-call 카드로 재구성하지 않습니다. Devin은 자신의 ACP 세션 안에서 작업하고 Codex에는 최종 assistant 텍스트를 스트리밍합니다. 파일 변경은 같은 로컬 작업 디렉터리를 사용하면 Codex/에디터의 파일 감시를 통해 보이게 됩니다.
