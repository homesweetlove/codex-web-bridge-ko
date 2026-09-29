const { app, BrowserWindow, Tray, dialog, nativeImage, ipcMain, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { applyRoute, restoreRoute, status: routeStatus, statePath } = require('./codex-mode.cjs');
const devin = require('./devin-cli.cjs');
const github = require('./github-cli.cjs');
const githubSkill = require('./github-skill.cjs');
const { ProxyProcess } = require('./proxy-process.cjs');
const { trayTemplate } = require('./tray-actions.cjs');

app.setPath('userData', path.join(app.getPath('appData'), 'devin-is-free'));
const restoreOnly = process.argv.includes('--restore-route');
const settingsPath = path.join(app.getPath('userData'), 'settings.json');
let settings = loadSettings();
let mainWindow;
let tray;
let quitting = false;
const proxy = new ProxyProcess({ app, statePath, getSettings: () => settings });

function loadSettings() {
  try { return { autoStart: true, allowTools: true, workDir: '', onboarded: false, ...JSON.parse(fs.readFileSync(settingsPath, 'utf8')) }; }
  catch { return { autoStart: true, allowTools: true, workDir: '', onboarded: false }; }
}
function saveSettings() {
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
}
async function snapshot() {
  return {
    cli: devin.detect(),
    github: github.detect(),
    githubSkill: githubSkill.status(),
    route: routeStatus(),
    proxy: { running: Boolean(await proxy.health()) },
    settings,
    loginAtStartup: app.getLoginItemSettings().openAtLogin,
    version: app.getVersion(),
  };
}
async function refresh() {
  const data = await snapshot();
  if (tray) buildTray(data);
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('status', data);
  return data;
}
function progress(step, percent, message, state = 'running') {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('progress', { step, percent, message, state });
}
function buildTray(data) {
  tray.setToolTip(`Devin is Free — ${data.proxy.running ? '실행 중' : '중지'}`);
  tray.setContextMenu(trayTemplate({
    data, mainWindow, proxy, devin, github, githubSkill, applyRoute, restoreRoute, settings, saveSettings, refresh,
    quit: () => { quitting = true; app.quit(); },
  }));
}
function trayIcon() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" rx="8" fill="#111827"/><path d="M8 8h7c6 0 9 3 9 8s-3 8-9 8H8V8zm6 5v6h2c2 0 3-1 3-3s-1-3-3-3h-2z" fill="#8ea8ff"/></svg>`;
  return nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`);
}
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 860, height: 820, minWidth: 740, minHeight: 620,
    backgroundColor: '#0e1014', title: 'Devin is Free', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false },
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.on('close', event => { if (!quitting) { event.preventDefault(); mainWindow.hide(); } });
  mainWindow.webContents.on('did-finish-load', () => refresh());
}
async function onboarding() {
  if (settings.onboarded) return;
  const cli = devin.detect();
  if (!cli.installed) {
    const r = await dialog.showMessageBox(mainWindow, { type: 'info', buttons: ['공식 Devin CLI 설치', '나중에'], defaultId: 0, title: 'Devin CLI 필요', message: 'Devin SWE-2를 사용하려면 공식 Devin CLI가 필요합니다.' });
    if (r.response === 0) devin.installOfficialCli();
  } else if (!cli.auth) {
    const r = await dialog.showMessageBox(mainWindow, { type: 'info', buttons: ['Devin 로그인', '나중에'], defaultId: 0, title: 'Devin 로그인 필요', message: '공식 Devin CLI에 로그인해 주세요.' });
    if (r.response === 0) devin.login();
  }
  if (!routeStatus().devinActive) {
    const r = await dialog.showMessageBox(mainWindow, { type: 'question', buttons: ['Codex에 적용', '나중에'], defaultId: 0, title: 'Codex 연결', message: 'Codex 기본 모델을 Devin SWE-2로 설정할까요?' });
    if (r.response === 0) applyRoute();
  }
  settings.onboarded = true;
  saveSettings();
}

async function fullTest() {
  try {
    progress('cli', 10, 'Devin CLI 설치 상태 확인 중...');
    const cli = devin.detect();
    if (!cli.installed) throw new Error('Devin CLI가 설치되어 있지 않습니다.');
    progress('acp', 25, 'ACP 지원 확인 중...');
    if (!cli.acp) throw new Error('현재 Devin CLI에서 ACP를 사용할 수 없습니다. 업데이트해 주세요.');
    progress('auth', 40, 'Devin 로그인 확인 중...');
    if (!cli.auth) throw new Error('Devin CLI 로그인이 필요합니다.');
    progress('route', 55, 'Codex 연결 상태 확인 중...');
    const route = routeStatus();
    if (!route.applied) throw new Error('Codex에 Devin 프록시가 적용되지 않았습니다.');
    if (!route.devinActive) throw new Error('Codex 기본 모델이 Devin SWE-2로 활성화되지 않았습니다. 다시 적용해 주세요.');
    progress('proxy', 70, '로컬 프록시 확인 중...');
    if (!(await proxy.health())) await proxy.start();
    if (!(await proxy.health())) throw new Error('로컬 프록시가 실행되지 않았습니다.');
    progress('swe2', 82, 'SWE-2 실제 응답 테스트 중...');
    const response = await fetch('http://127.0.0.1:17842/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'devin/swe-2', messages: [{ role: 'user', content: 'Reply with exactly: PONG' }] }),
      signal: AbortSignal.timeout(120000),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.error?.message || `SWE-2 테스트 HTTP ${response.status}`);
    const answer = body?.choices?.[0]?.message?.content || '';
    progress('done', 100, `연결 성공${answer ? ` — ${answer.trim().slice(0, 80)}` : ''}`, 'success');
    await refresh();
    return { ok: true, answer };
  } catch (error) {
    progress('error', 100, error.message || String(error), 'error');
    await refresh();
    return { ok: false, error: error.message || String(error) };
  }
}

ipcMain.handle('status', () => snapshot());
ipcMain.handle('refresh', () => refresh());
ipcMain.handle('proxy:start', async () => { progress('proxy', 30, '프록시 시작 중...'); const result = await proxy.start(); progress('proxy', 100, '프록시 시작 완료', 'success'); await refresh(); return result; });
ipcMain.handle('proxy:restart', async () => { progress('proxy', 20, '프록시 재시작 중...'); const result = await proxy.restart(); progress('proxy', 100, '프록시 재시작 완료', 'success'); await refresh(); return result; });
ipcMain.handle('route:apply', async () => { progress('route', 30, 'Codex 경로와 Devin 모델 적용 중...'); const result = applyRoute(); await proxy.start(); progress('route', 100, 'Devin SWE-2 활성화 완료. Codex를 완전히 재시작하세요.', 'success'); await refresh(); return result; });
ipcMain.handle('route:restore', async () => { progress('route', 30, '기존 Codex 설정 복구 중...'); const result = restoreRoute(); progress('route', 100, 'Codex 경로와 모델 복구 완료', 'success'); await refresh(); return result; });
ipcMain.handle('devin:install', () => { progress('install', 5, '공식 Devin CLI 설치 프로그램을 열었습니다.'); return devin.installOfficialCli(); });
ipcMain.handle('devin:login', () => { progress('login', 5, 'Devin 로그인 창을 열었습니다.'); return devin.login(); });
ipcMain.handle('devin:update', () => { progress('update', 5, 'Devin CLI 업데이트를 시작했습니다.'); return devin.update(); });
ipcMain.handle('github:install', () => { progress('github', 10, 'GitHub CLI 설치를 시작했습니다...'); return github.install(); });
ipcMain.handle('github:login', () => { progress('github', 20, 'GitHub 브라우저 로그인을 시작했습니다...'); return github.login(); });
ipcMain.handle('github:skill-install', async () => { const result = githubSkill.install(); progress('github', 100, 'GitHub 작업 스킬 설치 완료', 'success'); await refresh(); return result; });
ipcMain.handle('github:test', async () => { progress('github', 40, 'GitHub private repo 접근 상태 확인 중...'); const result = github.test(); progress('github', 100, result.ok ? `GitHub 연결 성공 — ${result.user}` : result.error, result.ok ? 'success' : 'error'); await refresh(); return result; });
ipcMain.handle('workdir:choose', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'], title: 'Devin 기본 작업 폴더 선택' });
  if (result.canceled || !result.filePaths[0]) return null;
  settings.workDir = result.filePaths[0]; saveSettings(); await proxy.restart(); await refresh(); return settings.workDir;
});
ipcMain.handle('settings:allowTools', async (_event, value) => { settings.allowTools = Boolean(value); saveSettings(); await proxy.restart(); await refresh(); return settings.allowTools; });
ipcMain.handle('settings:autoStart', async (_event, value) => { settings.autoStart = Boolean(value); saveSettings(); app.setLoginItemSettings({ openAtLogin: settings.autoStart, path: process.execPath }); await refresh(); return settings.autoStart; });
ipcMain.handle('test:full', () => fullTest());
ipcMain.handle('open:codexConfig', () => shell.showItemInFolder(routeStatus().configPath));
ipcMain.handle('open:docs', () => shell.openExternal('https://cli.devin.ai/reference/commands'));

app.whenReady().then(async () => {
  if (restoreOnly) { try { restoreRoute(); } finally { app.quit(); } return; }
  if (!app.requestSingleInstanceLock()) return app.quit();
  app.setLoginItemSettings({ openAtLogin: settings.autoStart, path: process.execPath });
  createWindow();
  tray = new Tray(trayIcon());
  tray.on('double-click', () => { mainWindow.show(); mainWindow.focus(); });
  await proxy.start();
  await onboarding();
  await refresh();
});
app.on('second-instance', () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } });
app.on('window-all-closed', event => event.preventDefault());
app.on('before-quit', () => { quitting = true; proxy.stop(); });
