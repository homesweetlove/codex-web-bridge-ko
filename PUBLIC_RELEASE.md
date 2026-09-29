# Public release checklist

이 저장소를 Public으로 전환하기 전에 아래 항목을 확인하세요.

## 1. Git 히스토리 개인정보

현재 과거 커밋의 author/committer 이메일에 개인 또는 학교 이메일이 포함되어 있을 수 있습니다.

Public 전환 전 로컬 clone에서 히스토리를 재작성한 뒤 force push 하는 것을 권장합니다.

예시:

```bash
git clone --mirror git@github.com:homesweetlove/gpt_is_free.git
cd gpt_is_free.git

git filter-repo --force \
  --email-callback 'return b"232012965+homesweetlove@users.noreply.github.com" if email == b"<OLD_EMAIL>" else email'

git push --force --mirror
```

`<OLD_EMAIL>`에는 기존 개인/학교 이메일을 넣으세요.

주의:
- 히스토리 재작성 후 모든 commit SHA가 바뀔 수 있습니다.
- 기존 clone/fork/열린 PR이 있으면 영향이 생깁니다.
- Public 전환 전에 수행하는 것이 가장 안전합니다.

## 2. 비밀정보 확인

다음 패턴이 저장소와 히스토리에 없는지 확인하세요.

- `sk-`
- `ghp_`, `github_pat_`
- `BEGIN PRIVATE KEY`
- API key / access token / refresh token
- 쿠키 및 브라우저 세션 데이터
- 개인 이메일, 전화번호, 로컬 사용자 경로

예시:

```bash
git log -p --all | grep -Ei 'sk-|ghp_|github_pat_|BEGIN .*PRIVATE KEY|api[_-]?key|access[_-]?token|refresh[_-]?token'
```

## 3. 공개 문서

README에는 다음이 명시되어야 합니다.

- 비공식 프로젝트
- upstream 및 MIT license 출처
- Web 자동화 모드가 비공식 방식이며 약관/계정 정책 영향을 받을 수 있다는 점
- Devin 연동이 공식 CLI와 실제 계정 entitlement를 사용하며 권한을 우회하지 않는다는 점

## 4. 저장소 이름

현재 repository slug가 `gpt_is_free`라면 공개 전 중립적인 이름으로 변경하는 것을 고려하세요.

예:
- `codex-web-bridge-ko`
- `codex-web-localizer-ko`
- `codex-web-launcher-ko`

GitHub의 repository rename은 기존 URL에 redirect가 생기지만, 문서/스크립트/배지의 하드코딩된 URL은 별도로 확인하세요.

## 5. Public 전환 직전

- GitHub Actions에 민감한 Repository Secrets가 필요 이상으로 설정되어 있지 않은지 확인
- release artifact에 사용자 로컬 설정 파일이 포함되지 않는지 확인
- 새 clone에서 빌드가 재현되는지 확인
- README와 LICENSE가 새 clone에서 정상적으로 보이는지 확인

위 항목 완료 후 Public 전환을 권장합니다.
