# Upstream

이 저장소는 아래 프로젝트를 기반으로 하는 한국어 로컬라이징 레이어입니다.

- Repository: https://github.com/miuuyy/codex-chatgpt-web
- Upstream version: `5.0.6`
- Pinned commit: `e85e3693fdb4e3e033348c08df0298c20fcdb612`
- License: MIT

한국어판은 원본 기능 로직을 가능한 한 수정하지 않고 런처 언어 지원과 한국어 문서만 추가하는 것을 원칙으로 합니다.

업스트림을 올릴 때는 먼저 새 버전의 언어 관련 파일 구조가 바뀌었는지 확인한 뒤 `scripts/apply-ko.ps1`의 안전 검사를 갱신해야 합니다. 패치 대상 문자열을 찾지 못하면 스크립트는 조용히 넘어가지 않고 실패하도록 설계합니다.
