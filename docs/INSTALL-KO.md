# 설치 가이드 — Windows

## 추천: GitHub Actions에서 설치 파일 만들기

로컬 개발 환경을 준비할 필요가 없는 방법입니다.

1. 저장소의 **Actions** 탭으로 이동합니다.
2. **Build Korean Windows Launcher**를 엽니다.
3. **Run workflow**를 누릅니다.
4. 빌드가 성공하면 실행 화면 아래의 **Artifacts**에서 `gpt-is-free-korean-windows`를 받습니다.
5. ZIP을 풀고 `.exe` 설치 파일을 실행합니다.

> 원본 프로젝트와 동일한 런처/브리지 런타임을 기반으로 하므로, 이미 원본 Codex Web GPT를 설치했다면 같은 설정 영역을 사용합니다. 동시에 서로 다른 두 버전을 띄우기보다는 기존 런처를 종료한 뒤 한국어판을 설치/실행하는 것을 권장합니다.

## 설치 후

1. 런처 안에서 ChatGPT 로그인
2. **브라우저 동작 테스트** 실행
3. **모델 설치** 실행
4. 런처는 켜 둔 상태로 유지
5. Codex 창과 백그라운드 Codex 프로세스를 완전히 종료
6. Codex 재실행
7. 모델 선택기에서 `ChatGPT Web — High` 등 선택

## 소스에서 실행

저장소를 clone한 뒤 PowerShell에서:

```powershell
./scripts/bootstrap-ko.ps1
```

그러면 `.work/codex-chatgpt-web` 아래에 고정된 원본 v5.0.6 소스를 가져오고 한국어 패치를 적용합니다.

직접 런처까지 실행하려면 Bun 1.4.0을 준비한 뒤:

```powershell
./scripts/bootstrap-ko.ps1 -Run
```

## 제거

런처를 그냥 삭제하기 전에 먼저 런처 설정의 **Codex 연결 제거**를 사용해 기존 Codex 라우트를 복원하세요. 그 다음 Codex를 완전히 재시작하고 런처를 제거합니다.

## 보안

이 프로젝트는 비공식 ChatGPT 웹 자동화를 사용할 수 있습니다. 자동화가 싫다면 **Zero Risk** 모드를 사용하세요. ChatGPT 쿠키, 브라우저 프로필, API 키, Tunnel ID는 절대 공유하지 마세요.
