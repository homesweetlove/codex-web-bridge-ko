const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROUTE_URL = 'http://127.0.0.1:17842/v1';
const OFFICIAL_CODEX_BASE = 'https://chatgpt.com/backend-api/codex';
const stateDir = path.join(os.homedir(), '.devin-is-free');
const statePath = path.join(stateDir, 'route-state.json');
const codexDir = path.join(os.homedir(), '.codex');
const configPath = path.join(codexDir, 'config.toml');

function ensureDirs() {
  fs.mkdirSync(stateDir, { recursive: true });
  fs.mkdirSync(codexDir, { recursive: true });
}
function readConfig() { try { return fs.readFileSync(configPath, 'utf8'); } catch { return ''; } }
function readState() { try { return JSON.parse(fs.readFileSync(statePath, 'utf8')); } catch { return null; } }
function writeUtf8(file, text) { fs.writeFileSync(file, text, { encoding: 'utf8' }); }
function linesOf(content) { return String(content || '').replace(/\r\n/g, '\n').split('\n'); }
function quoteToml(value) { return `"${String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`; }

function parseConfig(content = readConfig()) {
  const lines = linesOf(content);
  let section = '';
  let modelProvider = null;
  let topBase = null;
  const providers = new Map();
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const table = raw.match(/^\s*\[([^\]]+)\]\s*(?:#.*)?$/);
    if (table) {
      section = table[1].trim();
      const p = section.match(/^model_providers\.([A-Za-z0-9_.-]+)$/);
      if (p && !providers.has(p[1])) providers.set(p[1], { headerLine: i, baseLine: -1, baseUrl: null });
      continue;
    }
    const kv = raw.match(/^\s*([A-Za-z0-9_-]+)\s*=\s*"([^"]*)"\s*(?:#.*)?$/);
    if (!kv) continue;
    const key = kv[1];
    const value = kv[2];
    if (!section) {
      if (key === 'model_provider') modelProvider = value;
      if (key === 'openai_base_url') topBase = value;
      continue;
    }
    const p = section.match(/^model_providers\.([A-Za-z0-9_.-]+)$/);
    if (p && key === 'base_url') {
      const info = providers.get(p[1]) || { headerLine: -1, baseLine: -1, baseUrl: null };
      info.baseLine = i;
      info.baseUrl = value;
      providers.set(p[1], info);
    }
  }
  const selectedProvider = modelProvider || 'openai';
  const selectedInfo = providers.get(selectedProvider) || null;
  const effectiveBase = selectedInfo?.baseUrl || (selectedProvider === 'openai' ? topBase : null);
  return { lines, modelProvider, selectedProvider, topBase, providers, selectedInfo, effectiveBase };
}

function setTopLevelString(content, key, value) {
  const lines = linesOf(content);
  let sectionSeen = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*\[/.test(lines[i])) sectionSeen = true;
    if (!sectionSeen && new RegExp(`^\\s*${key}\\s*=`).test(lines[i])) {
      lines[i] = `${key} = ${quoteToml(value)}`;
      return lines.join('\r\n');
    }
  }
  const firstSection = lines.findIndex(line => /^\s*\[/.test(line));
  lines.splice(firstSection >= 0 ? firstSection : lines.length, 0, `${key} = ${quoteToml(value)}`);
  return lines.join('\r\n');
}
function removeTopLevelKey(content, key) {
  const lines = linesOf(content);
  let sectionSeen = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*\[/.test(lines[i])) sectionSeen = true;
    if (!sectionSeen && new RegExp(`^\\s*${key}\\s*=`).test(lines[i])) lines[i] = '';
  }
  return lines.join('\r\n').replace(/\r\n{3,}/g, '\r\n\r\n');
}
function setProviderBase(content, provider, value) {
  const parsed = parseConfig(content);
  const info = parsed.providers.get(provider);
  if (!info) return content;
  const lines = parsed.lines;
  if (info.baseLine >= 0) lines[info.baseLine] = `base_url = ${quoteToml(value)}`;
  else lines.splice(info.headerLine + 1, 0, `base_url = ${quoteToml(value)}`);
  return lines.join('\r\n');
}
function removeProviderBase(content, provider) {
  const parsed = parseConfig(content);
  const info = parsed.providers.get(provider);
  if (!info || info.baseLine < 0) return content;
  const lines = parsed.lines;
  lines[info.baseLine] = '';
  return lines.join('\r\n').replace(/\r\n{3,}/g, '\r\n\r\n');
}

function applyRoute() {
  ensureDirs();
  const original = readConfig();
  const before = parseConfig(original);
  const existing = readState();
  const selected = before.selectedProvider;
  const providerExists = before.providers.has(selected);
  const providerAlready = !providerExists || before.selectedInfo?.baseUrl === ROUTE_URL;
  const topAlready = before.topBase === ROUTE_URL;
  if (before.effectiveBase === ROUTE_URL && topAlready && providerAlready && existing) {
    return { changed: false, route: ROUTE_URL, upstream: existing.upstream_base_url || OFFICIAL_CODEX_BASE, provider: selected };
  }

  const sameManagedInstall = existing?.installed_base_url === ROUTE_URL;
  const sameProvider = sameManagedInstall && (!existing.selected_provider || existing.selected_provider === selected);
  const state = {
    version: 3,
    installed_base_url: ROUTE_URL,
    selected_provider: selected,
    had_openai_base_url: sameManagedInstall ? Boolean(existing.had_openai_base_url) : before.topBase !== null,
    previous_openai_base_url: sameManagedInstall ? (existing.previous_openai_base_url ?? null) : before.topBase,
    provider_section_existed: sameProvider && 'provider_section_existed' in existing ? Boolean(existing.provider_section_existed) : providerExists,
    provider_had_base_url: sameProvider && 'provider_had_base_url' in existing
      ? Boolean(existing.provider_had_base_url)
      : before.selectedInfo?.baseUrl !== null && before.selectedInfo?.baseUrl !== undefined,
    previous_provider_base_url: sameProvider && 'previous_provider_base_url' in existing
      ? existing.previous_provider_base_url
      : (before.selectedInfo?.baseUrl ?? null),
    upstream_base_url: sameManagedInstall && existing.upstream_base_url
      ? existing.upstream_base_url
      : (before.effectiveBase && before.effectiveBase !== ROUTE_URL ? before.effectiveBase : OFFICIAL_CODEX_BASE),
    configured_at: existing?.configured_at || new Date().toISOString(),
    repaired_at: sameManagedInstall ? new Date().toISOString() : undefined,
  };

  let next = setTopLevelString(original, 'openai_base_url', ROUTE_URL);
  if (providerExists) next = setProviderBase(next, selected, ROUTE_URL);
  writeUtf8(configPath, next);
  writeUtf8(statePath, JSON.stringify(state, null, 2));
  return { changed: true, route: ROUTE_URL, upstream: state.upstream_base_url, provider: selected };
}

function restoreRoute() {
  ensureDirs();
  const state = readState();
  if (!state) return { changed: false, message: '저장된 이전 Codex 경로가 없습니다.' };
  const currentContent = readConfig();
  const current = parseConfig(currentContent);
  const selected = state.selected_provider || current.selectedProvider || 'openai';
  const providerInfo = current.providers.get(selected);
  const providerManaged = !providerInfo || providerInfo.baseUrl === ROUTE_URL;
  const topManaged = current.topBase === ROUTE_URL;
  if (!topManaged && !providerManaged) {
    return { changed: false, refused: true, message: 'Codex 경로가 이미 다른 값으로 바뀌어 있어 덮어쓰지 않았습니다.' };
  }
  let next = currentContent;
  if (topManaged) {
    next = state.had_openai_base_url && state.previous_openai_base_url
      ? setTopLevelString(next, 'openai_base_url', state.previous_openai_base_url)
      : removeTopLevelKey(next, 'openai_base_url');
  }
  const reparsed = parseConfig(next);
  const nowProvider = reparsed.providers.get(selected);
  if (nowProvider?.baseUrl === ROUTE_URL) {
    next = state.provider_had_base_url && state.previous_provider_base_url
      ? setProviderBase(next, selected, state.previous_provider_base_url)
      : removeProviderBase(next, selected);
  }
  writeUtf8(configPath, next);
  try { fs.unlinkSync(statePath); } catch {}
  return { changed: true, restored: state.previous_provider_base_url || state.previous_openai_base_url || null };
}

function status() {
  const parsed = parseConfig();
  const state = readState();
  const providerExists = parsed.providers.has(parsed.selectedProvider);
  const providerRoute = parsed.selectedInfo?.baseUrl || null;
  const effectiveApplied = parsed.effectiveBase === ROUTE_URL;
  const fullyApplied = effectiveApplied && parsed.topBase === ROUTE_URL && (!providerExists || providerRoute === ROUTE_URL);
  return {
    configPath,
    statePath,
    route: ROUTE_URL,
    current: parsed.effectiveBase,
    topLevelCurrent: parsed.topBase,
    providerCurrent: providerRoute,
    selectedProvider: parsed.selectedProvider,
    applied: effectiveApplied,
    fullyApplied,
    partial: effectiveApplied && !fullyApplied,
    upstream: state?.upstream_base_url || (parsed.effectiveBase && parsed.effectiveBase !== ROUTE_URL ? parsed.effectiveBase : OFFICIAL_CODEX_BASE),
  };
}

module.exports = { ROUTE_URL, statePath, applyRoute, restoreRoute, status };
