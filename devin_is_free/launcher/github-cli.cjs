const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: 'utf8',
    windowsHide: true,
    timeout: options.timeout || 15000,
    shell: false,
  });
}

function candidates() {
  const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
  const local = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  return [
    process.env.GH_BIN,
    path.join(programFiles, 'GitHub CLI', 'gh.exe'),
    path.join(local, 'Programs', 'GitHub CLI', 'gh.exe'),
    'gh',
  ].filter(Boolean);
}

function resolveBin() {
  for (const candidate of candidates()) {
    if (candidate !== 'gh' && !fs.existsSync(candidate)) continue;
    const version = run(candidate, ['--version'], { timeout: 5000 });
    if (version.status === 0) return candidate;
  }
  return null;
}

function detect() {
  const bin = resolveBin();
  if (!bin) return { installed: false, auth: false, user: '', version: '', bin: null };
  const version = run(bin, ['--version']);
  const auth = run(bin, ['auth', 'status', '--hostname', 'github.com']);
  let user = '';
  if (auth.status === 0) {
    const who = run(bin, ['api', 'user', '--jq', '.login']);
    if (who.status === 0) user = String(who.stdout || '').trim();
  }
  return {
    installed: version.status === 0,
    auth: auth.status === 0,
    user,
    version: String(version.stdout || version.stderr || '').split(/\r?\n/)[0].trim(),
    bin,
    authText: `${auth.stdout || ''}${auth.stderr || ''}`.trim(),
  };
}

function install() {
  const winget = run('where.exe', ['winget.exe'], { timeout: 3000 });
  if (winget.status !== 0) throw new Error('winget을 찾을 수 없습니다. Microsoft App Installer를 설치하거나 GitHub CLI를 수동 설치해 주세요.');
  const child = spawn('winget.exe', [
    'install', '--id', 'GitHub.cli', '--exact', '--source', 'winget',
    '--accept-package-agreements', '--accept-source-agreements',
  ], { detached: true, windowsHide: false, stdio: 'ignore' });
  child.unref();
  return true;
}

function encodedPowerShell(script) {
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  const args = [
    '/d', '/c', 'start', '',
    'powershell.exe', '-NoLogo', '-NoExit', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded,
  ];
  const child = spawn('cmd.exe', args, {
    detached: true,
    windowsHide: true,
    stdio: 'ignore',
  });
  child.unref();
}

function login() {
  const bin = resolveBin();
  if (!bin) throw new Error('GitHub CLI가 설치되어 있지 않습니다.');
  const q = bin.replaceAll("'", "''");
  encodedPowerShell(`& '${q}' auth login --hostname github.com --web --git-protocol https; if ($LASTEXITCODE -eq 0) { & '${q}' auth setup-git }; Write-Host ''; Write-Host 'GitHub login flow finished. Return to Devin is Free and press refresh.' -ForegroundColor Green`);
  return true;
}

function logout() {
  const bin = resolveBin();
  if (!bin) return false;
  const result = run(bin, ['auth', 'logout', '--hostname', 'github.com', '--user', detect().user], { timeout: 30000 });
  return result.status === 0;
}

function test() {
  const info = detect();
  if (!info.installed) return { ok: false, error: 'GitHub CLI가 설치되어 있지 않습니다.' };
  if (!info.auth) return { ok: false, error: 'GitHub 로그인이 필요합니다.' };
  const result = run(info.bin, ['repo', 'list', info.user, '--limit', '1', '--json', 'name,isPrivate']);
  if (result.status !== 0) return { ok: false, error: `${result.stdout || ''}${result.stderr || ''}`.trim() || 'GitHub repo 조회 실패' };
  return { ok: true, user: info.user, bin: info.bin };
}

module.exports = { detect, resolveBin, install, login, logout, test };
