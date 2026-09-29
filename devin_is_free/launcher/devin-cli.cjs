const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { shell } = require('electron');

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: 'utf8',
    windowsHide: true,
    timeout: options.timeout || 15000,
    shell: false,
  });
}

function candidates() {
  const local = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  return [
    process.env.DEVIN_BIN,
    path.join(local, 'devin', 'cli', 'bin', 'devin.exe'),
    'devin',
  ].filter(Boolean);
}

function resolveBin() {
  for (const candidate of candidates()) {
    if (candidate !== 'devin' && !fs.existsSync(candidate)) continue;
    const version = run(candidate, ['--version'], { timeout: 5000 });
    if (version.status === 0) return candidate;
  }
  return null;
}

function detect() {
  const bin = resolveBin();
  if (!bin) return { installed: false, version: '', acp: false, auth: false, authText: '', bin: null };
  const version = run(bin, ['--version']);
  const acpHelp = run(bin, ['acp', '--help']);
  const authStatus = run(bin, ['auth', 'status']);
  return {
    installed: version.status === 0,
    version: `${version.stdout || version.stderr || ''}`.trim(),
    acp: acpHelp.status === 0,
    auth: authStatus.status === 0,
    authText: `${authStatus.stdout || ''}${authStatus.stderr || ''}`.trim(),
    bin,
  };
}

function openPowerShell(script) {
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  const child = spawn('powershell.exe', [
    '-NoLogo',
    '-NoExit',
    '-ExecutionPolicy', 'Bypass',
    '-EncodedCommand', encoded,
  ], {
    detached: true,
    windowsHide: false,
    stdio: 'ignore',
    shell: false,
  });
  child.unref();
}

function installOfficialCli() {
  const arm = process.arch === 'arm64';
  const url = arm
    ? 'https://static.devin.ai/cli/devin-updater-aarch64-pc-windows.exe'
    : 'https://static.devin.ai/cli/devin-updater-x86_64-pc-windows.exe';
  shell.openExternal(url);
  return { opened: true, url, arch: arm ? 'arm64' : 'x64' };
}

function login() {
  const bin = resolveBin();
  if (!bin) throw new Error('Devin CLI가 설치되어 있지 않습니다.');
  const quoted = bin.replaceAll("'", "''");
  openPowerShell(`& '${quoted}' auth login; Write-Host ''; Write-Host '로그인 완료 후 이 창을 닫고 Devin is Free에서 새로고침하세요.' -ForegroundColor Green`);
  return true;
}

function update() {
  return installOfficialCli();
}

module.exports = { detect, resolveBin, installOfficialCli, login, update };
