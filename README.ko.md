[![English](https://img.shields.io/badge/README-English-24292f?style=for-the-badge)](./README.md) [![한국어](https://img.shields.io/badge/README-%ED%95%9C%EA%B5%AD%EC%96%B4-24292f?style=for-the-badge)](./README.ko.md)

# Codex Web Bridge KO

> 원본 프로젝트: [miuuyy/codex-chatgpt-web](https://github.com/miuuyy/codex-chatgpt-web)
>
> 이 저장소는 OpenAI 공식 프로젝트가 아니며, 원본 프로젝트의 MIT 라이선스를 따르는 비공식 한국어 로컬라이징/빌드 레이어입니다.

Codex 환경에서 ChatGPT Web 모델을 사용할 수 있도록 돕는 `codex-chatgpt-web` 기반 한국어판 작업 저장소입니다.

이 저장소는 OpenAI, ChatGPT, Codex, Devin 또는 Cognition의 공식 제품/배포판이 아닙니다. 각 서비스의 상표와 서비스명은 해당 권리자에게 있습니다.

## 이 저장소가 추가하는 것

- 런처 UI 한국어 지원
- 첫 실행 시 한국어 기본 표시 + 한국어 언어 선택지
- 설정에서 한국어/영어/중국어/일본어 전환
- 트레이/제거 확인창 등 네이티브 UI 한국어화
- 한국어 설치 / 문제 해결 문서
- 원본 v5.0.6 소스를 자동으로 받아 한국어 패치를 적용하는 스크립트
- GitHub Actions 기반 Windows 설치 파일 빌드
- 선택적으로 공식 Devin CLI/ACP를 이용한 별도 로컬 프록시 구성

## 주의: Web 자동화 모드

이 프로젝트의 자동화 모드는 ChatGPT 웹페이지와 비공식적으로 상호작용합니다. 서비스 약관, 계정 정책, UI 변경 또는 사용량 제한에 따라 동작이 중단되거나 계정에 영향을 줄 수 있습니다.

공개 배포나 장기 사용 시에는 사용자가 직접 입력/전송하는 `Zero Risk` / 수동 상호작용 모드를 우선 고려하세요. 자동화 모드를 사용하는 경우 각 서비스의 최신 약관과 계정 정책을 직접 확인해야 합니다.

## 가장 쉬운 사용법

### 방법 1 — GitHub Actions로 Windows 설치 파일 만들기

1. 이 저장소의 **Actions** 탭으로 이동합니다.
2. **Build Korean Windows Launcher**를 선택합니다.
3. **Run workflow**를 누릅니다.
4. 빌드가 끝나면 Artifacts의 Windows 설치 파일을 받습니다.
5. ZIP 안의 `.exe` 설치 파일을 실행합니다.

PC에 Bun이나 Node를 따로 설치할 필요가 없습니다. 자세한 내용은 [Windows 설치 가이드](docs/INSTALL-KO.md)를 참고하세요.

### 방법 2 — 소스에서 바로 실행

한국어판 소스만 준비:

```powershell
./scripts/bootstrap-ko.ps1
```

Bun 1.4.0이 설치되어 있다면 소스 준비부터 런처 실행까지:

```powershell
./scripts/bootstrap-ko.ps1 -Run
```

스크립트는 원본 v5.0.6의 지정 커밋을 내려받고 예상한 코드 구조가 맞을 때만 한국어 패치를 적용합니다.

## 사용 흐름

1. 한국어 런처 실행
2. 런처 안에서 본인 계정으로 로그인
3. 브라우저 동작 테스트 실행
4. 모델 설치
5. Codex 프로세스를 완전히 종료
6. 런처를 켜 둔 상태에서 Codex 재실행
7. 모델 선택기에서 연결된 Web 모델 선택

## 상호작용 모드

### Zero Risk / 수동 모드

런처는 ChatGPT 페이지를 읽거나 조작하지 않습니다. 프롬프트를 준비해 주면 사용자가 직접 붙여넣고 모델/추론 강도/커넥터를 고른 뒤 전송합니다.

### 자동화 모드

런처가 ChatGPT 페이지에 프롬프트를 자동으로 보내고 응답 상태를 읽습니다. 편리하지만 비공식 브라우저 자동화이므로 위의 주의사항을 먼저 확인하세요.

## Codex 모델이 안 보일 때

PowerShell에서 먼저 설정을 확인하세요.

```powershell
Get-Content "$env:USERPROFILE\.codex\config.toml"
```

다음 항목이 있어야 합니다.

```toml
openai_base_url = "http://127.0.0.1:17841/v1"
```

Codex 창만 닫지 말고 실제 Codex 프로세스까지 종료한 다음 다시 실행해야 모델 목록이 새로고침됩니다.

자세한 내용은 [한국어 문제 해결 가이드](docs/TROUBLESHOOTING-KO.md)를 참고하세요.

## Devin 연동

`devin_is_free/` 폴더의 기능은 공식 Devin CLI의 로그인 상태와 실제 계정 entitlement를 그대로 사용합니다. 인증, 사용량 정책 또는 모델 권한을 우회하지 않습니다.

자세한 내용은 [Devin 연동 README](devin_is_free/README.md)를 참고하세요.

## 업스트림 버전

현재 한국어 패치 기준:

- upstream: `miuuyy/codex-chatgpt-web`
- version: `5.0.6`
- commit: `e85e3693fdb4e3e033348c08df0298c20fcdb612`

업스트림 정보는 [UPSTREAM.md](UPSTREAM.md)에 기록합니다.

## 보안 및 개인정보

다음 정보는 이슈, 커밋, 로그, 스크린샷 또는 저장소에 올리지 마세요.

- ChatGPT/브라우저 세션 쿠키
- API 키 및 액세스 토큰
- GitHub PAT
- Tunnel ID 및 비공개 런타임 정보
- 계정 이메일, 학교/회사 계정 정보 등 개인 식별 정보
- 로컬 전체 로그 및 브라우저 프로필

공개 전 점검 항목은 [PUBLIC_RELEASE.md](PUBLIC_RELEASE.md)를 참고하세요.

## 라이선스와 출처

원본 프로젝트는 MIT License입니다. 원본 저작권 고지와 라이선스를 유지합니다.

이 저장소는 비공식 커뮤니티 프로젝트이며 OpenAI 또는 기타 언급된 서비스 제공자의 보증이나 승인을 의미하지 않습니다.
