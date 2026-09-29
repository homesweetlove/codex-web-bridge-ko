const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const DEVIN_MODEL = 'devin/swe-2';
const codexDir = path.join(os.homedir(), '.codex');
const configPath = path.join(codexDir, 'config.toml');
const stateDir = path.join(os.homedir(), '.devin-is-free');
const modelStatePath = path.join(stateDir, 'model-state.json');

function readConfig() {
  try { return fs.readFileSync(configPath, 'utf8'); } catch { return ''; }
}
function readState() {
  try { return JSON.parse(fs.readFileSync(modelStatePath, 'utf8')); } catch { return null; }
}
function topModel(content = readConfig()) {
  let inSection = false;
  for (const line of String(content).replace(/\r\n/g, '\n').split('\n')) {
    if (/^\s*\[/.test(line)) inSection = true;
    if (inSection) continue;
    const match = line.match(/^\s*model\s*=\s*"([^"]*)"/);
    if (match) return match[1];
  }
  return null;
}
function setModel(content, value) {
  const lines = String(content).replace(/\r\n/g, '\n').split('\n');
  let inSection = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*\[/.test(lines[i])) inSection = true;
    if (!inSection && /^\s*model\s*=/.test(lines[i])) {
      lines[i] = `model = "${value}"`;
      return lines.join('\r\n');
    }
  }
  const firstSection = lines.findIndex(line => /^\s*\[/.test(line));
  lines.splice(firstSection >= 0 ? firstSection : lines.length, 0, `model = "${value}"`);
  return lines.join('\r\n');
}
function removeModel(content) {
  const lines = String(content).replace(/\r\n/g, '\n').split('\n');
  let inSection = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*\[/.test(lines[i])) inSection = true;
    if (!inSection && /^\s*model\s*=/.test(lines[i])) lines[i] = '';
  }
  return lines.join('\r\n').replace(/\r\n{3,}/g, '\r\n\r\n');
}
function activate() {
  fs.mkdirSync(codexDir, { recursive: true });
  fs.mkdirSync(stateDir, { recursive: true });
  const content = readConfig();
  const current = topModel(content);
  const prior = readState();
  if (!prior) {
    fs.writeFileSync(modelStatePath, JSON.stringify({ hadModel: current !== null, previousModel: current }, null, 2), 'utf8');
  }
  if (current !== DEVIN_MODEL) fs.writeFileSync(configPath, setModel(content, DEVIN_MODEL), 'utf8');
  return { active: true, model: DEVIN_MODEL };
}
function restore() {
  const saved = readState();
  const content = readConfig();
  if (topModel(content) !== DEVIN_MODEL) return { changed: false };
  const next = saved?.hadModel && saved.previousModel ? setModel(content, saved.previousModel) : removeModel(content);
  fs.writeFileSync(configPath, next, 'utf8');
  try { fs.unlinkSync(modelStatePath); } catch {}
  return { changed: true, model: saved?.previousModel || null };
}
function status() {
  const model = topModel();
  return { model, active: model === DEVIN_MODEL, target: DEVIN_MODEL };
}

module.exports = { DEVIN_MODEL, activate, restore, status };
