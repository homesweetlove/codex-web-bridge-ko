const $ = id => document.getElementById(id);

function mark(id, ok, yes = '정상', no = '필요') {
  const el = $(id);
  if (!el) return;
  el.textContent = ok ? yes : no;
  el.className = ok ? 'ok' : 'bad';
}

function setBusy(text, percent = 0, state = 'running') {
  const wrap = $('progressWrap');
  const bar = $('progressBar');
  const label = $('progressText');
  if (wrap) wrap.classList.add('visible');
  if (bar) bar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  if (label) {
    label.textContent = text;
    label.className = state === 'error' ? 'bad' : state === 'success' ? 'ok' : '';
  }
}

function toast(text) {
  const el = $('toast');
  if (!el) return;
  el.textContent = text;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2600);
}

function render(data) {
  if (!data) return;
  $('appVersion').textContent = `v${data.version || '?'}`;
  mark('cliInstalled', data.cli?.installed, data.cli?.version || '설치됨', '미설치');
  mark('cliAcp', data.cli?.acp, '지원', '미지원');
  mark('cliAuth', data.cli?.auth, '로그인됨', '로그인 필요');
  mark('proxyStatus', data.proxy?.running, '실행 중', '중지됨');

  const devinActive = Boolean(data.route?.devinActive);
  mark('routeStatus', devinActive, 'Devin 활성', data.route?.applied ? '라우트만 적용' : '미적용');
  $('routeText').textContent = devinActive
    ? `${data.route?.model || 'devin/swe-2'} → ${data.route?.current || data.route?.route || ''}`
    : (data.route?.current || data.route?.route || '없음');

  $('workDir').textContent = data.settings?.workDir || '선택하지 않음';
  $('allowTools').checked = Boolean(data.settings?.allowTools);
  $('autoStart').checked = Boolean(data.loginAtStartup);

  mark('githubInstalled', data.github?.installed, data.github?.version || '설치됨', '미설치');
  mark('githubAuth', data.github?.auth, '로그인됨', '로그인 필요');
  $('githubUser').textContent = data.github?.user || '-';
  mark('githubSkill', data.githubSkill?.installed, '설치됨', '미설치');

  const ready = Boolean(data.cli?.installed && data.cli?.acp && data.cli?.auth && data.proxy?.running && devinActive);
  $('overallDot').className = ready ? 'dot green' : 'dot';
  $('overallTitle').textContent = ready ? 'Devin SWE-2 활성화 완료' : '설정이 더 필요합니다';
  $('overallText').textContent = ready
    ? 'Codex를 완전히 재시작하고 새 대화를 열면 Devin SWE-2가 기본 모델로 사용됩니다.'
    : '빨간 항목을 순서대로 눌러 설정하세요.';

  $('installBtn').disabled = Boolean(data.cli?.installed);
  $('loginBtn').disabled = !data.cli?.installed || Boolean(data.cli?.auth);
  $('updateBtn').disabled = !data.cli?.installed;
  $('applyBtn').disabled = devinActive;
  $('restoreBtn').disabled = !data.route?.applied && !devinActive;
  $('githubInstallBtn').disabled = Boolean(data.github?.installed);
  $('githubLoginBtn').disabled = !data.github?.installed || Boolean(data.github?.auth);
  $('githubSkillBtn').disabled = Boolean(data.githubSkill?.installed);
  $('githubTestBtn').disabled = !data.github?.installed || !data.github?.auth;
}

async function action(fn, starting, done) {
  try {
    setBusy(starting, 10);
    await fn();
    setBusy(done, 100, 'success');
    await window.devinApp.refresh();
    toast(done);
  } catch (error) {
    setBusy(error.message || String(error), 100, 'error');
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  window.devinApp.onStatus(render);
  window.devinApp.onProgress(p => setBusy(p.message, p.percent, p.state));
  render(await window.devinApp.status());

  $('refreshBtn').onclick = async () => render(await window.devinApp.refresh());
  $('installBtn').onclick = () => action(() => window.devinApp.installDevin(), '설치 프로그램 여는 중...', '공식 Devin CLI 설치 프로그램을 열었습니다');
  $('loginBtn').onclick = () => action(() => window.devinApp.loginDevin(), '로그인 창 여는 중...', 'Devin 로그인 창을 열었습니다');
  $('updateBtn').onclick = () => action(() => window.devinApp.updateDevin(), '업데이트 시작 중...', 'Devin CLI 업데이트를 시작했습니다');
  $('applyBtn').onclick = () => action(() => window.devinApp.applyRoute(), 'Codex에 Devin SWE-2 활성화 중...', 'Devin SWE-2 활성화 완료');
  $('restoreBtn').onclick = () => action(() => window.devinApp.restoreRoute(), 'Codex 설정 복구 중...', 'Codex 원상복구 완료');
  $('restartBtn').onclick = () => action(() => window.devinApp.restartProxy(), '프록시 재시작 중...', '프록시 재시작 완료');

  $('githubInstallBtn').onclick = () => action(() => window.devinApp.installGithub(), 'GitHub CLI 설치 시작 중...', 'GitHub CLI 설치를 시작했습니다');
  $('githubLoginBtn').onclick = () => action(() => window.devinApp.loginGithub(), 'GitHub 로그인 시작 중...', 'GitHub 로그인 창을 열었습니다');
  $('githubSkillBtn').onclick = () => action(() => window.devinApp.installGithubSkill(), 'Devin GitHub 스킬 설치 중...', 'GitHub 스킬 설치 완료');
  $('githubTestBtn').onclick = async () => {
    const result = await window.devinApp.testGithub();
    if (result?.ok) toast(`GitHub 연결 성공: ${result.user || '로그인됨'}`);
  };

  $('workDirBtn').onclick = async () => {
    const value = await window.devinApp.chooseWorkDir();
    if (value) toast('작업 폴더를 변경했습니다');
  };
  $('allowTools').onchange = event => window.devinApp.setAllowTools(event.target.checked);
  $('autoStart').onchange = event => window.devinApp.setAutoStart(event.target.checked);
  $('configBtn').onclick = () => window.devinApp.openCodexConfig();
  $('docsBtn').onclick = () => window.devinApp.openDocs();
  $('testBtn').onclick = async () => {
    $('testBtn').disabled = true;
    setBusy('전체 연결 점검 시작...', 1);
    const result = await window.devinApp.fullTest();
    $('testBtn').disabled = false;
    if (result?.ok) toast('SWE-2 실제 연결 성공');
  };
});
