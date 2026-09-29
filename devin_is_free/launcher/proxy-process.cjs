const { spawn } = require('node:child_process');
const path = require('node:path');
const devin = require('./devin-cli.cjs');

const PORT = 17842;
const HEALTH = `http://127.0.0.1:${PORT}/health`;

class ProxyProcess {
  constructor({ app, statePath, getSettings }) {
    this.app = app;
    this.statePath = statePath;
    this.getSettings = getSettings;
    this.child = null;
    this.stopping = false;
    this.restartTimer = null;
    this.starting = null;
  }

  script() {
    return this.app.isPackaged
      ? path.join(process.resourcesPath, 'proxy', 'server.mjs')
      : path.join(__dirname, '..', 'src', 'server.mjs');
  }

  async health() {
    try {
      const response = await fetch(HEALTH, { signal: AbortSignal.timeout(1200) });
      return response.ok ? await response.json() : null;
    } catch { return null; }
  }

  scheduleRestart() {
    if (this.stopping || this.restartTimer) return;
    this.restartTimer = setTimeout(async () => {
      this.restartTimer = null;
      if (this.stopping || await this.health()) return;
      try { await this.start(); } catch (error) { console.error('[proxy] automatic restart failed', error); this.scheduleRestart(); }
    }, 500);
  }

  async start() {
    if (await this.health()) return true;
    if (this.starting) return this.starting;
    this.stopping = false;
    this.starting = this.startInternal().finally(() => { this.starting = null; });
    return this.starting;
  }

  async startInternal() {
    const settings = this.getSettings();
    const env = {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      DEVIN_PROXY_PORT: String(PORT),
      DEVIN_STATE_FILE: this.statePath,
      DEVIN_AUTO_APPROVE: settings.allowTools ? '1' : '0',
    };
    const resolvedDevin = devin.resolveBin();
    if (resolvedDevin) env.DEVIN_BIN = resolvedDevin;
    if (settings.workDir) env.DEVIN_WORKDIR = settings.workDir;
    const child = spawn(process.execPath, [this.script()], {
      env,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    this.child = child;
    child.stdout?.on('data', chunk => console.log(`[proxy] ${chunk}`.trim()));
    child.stderr?.on('data', chunk => console.error(`[proxy] ${chunk}`.trim()));
    child.on('error', error => console.error('[proxy] process error', error));
    child.on('exit', (code, signal) => {
      if (this.child === child) this.child = null;
      console.error(`[proxy] exited code=${code} signal=${signal || ''}`);
      this.scheduleRestart();
    });
    for (let i = 0; i < 40; i++) {
      await new Promise(resolve => setTimeout(resolve, 125));
      if (await this.health()) return true;
      if (child.exitCode !== null) break;
    }
    this.scheduleRestart();
    return false;
  }

  async stop() {
    this.stopping = true;
    if (this.restartTimer) { clearTimeout(this.restartTimer); this.restartTimer = null; }
    if (this.child) {
      try { this.child.kill(); } catch {}
      this.child = null;
    }
    await new Promise(resolve => setTimeout(resolve, 250));
    return !(await this.health());
  }

  async restart() {
    await this.stop();
    this.stopping = false;
    return this.start();
  }
}

module.exports = { ProxyProcess, PORT, HEALTH };
