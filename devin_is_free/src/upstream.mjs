import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";

const HOST = process.env.DEVIN_PROXY_HOST || "127.0.0.1";
const PORT = Number.parseInt(process.env.DEVIN_PROXY_PORT || "17842", 10);
const INSTALLED_BASE_URL = `http://${HOST}:${PORT}/v1`;
const OFFICIAL_CODEX_BASE = "https://chatgpt.com/backend-api/codex";
const STATE_FILE = process.env.DEVIN_STATE_FILE || join(homedir(), ".devin-is-free", "route-state.json");
const RETRY_STATUS = new Set([429, 502, 503, 504]);

function object(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function state() {
  try {
    const parsed = JSON.parse(readFileSync(STATE_FILE, "utf8"));
    return object(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function upstreamBaseUrl() {
  const explicit = process.env.DEVIN_UPSTREAM_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const remembered = state().upstream_base_url;
  if (typeof remembered === "string" && remembered.trim() && remembered !== INSTALLED_BASE_URL) {
    return remembered.trim().replace(/\/$/, "");
  }
  return OFFICIAL_CODEX_BASE;
}

function codexVersion(userAgent) {
  if (!userAgent) return undefined;
  const slash = userAgent.indexOf("/");
  if (slash < 1) return undefined;
  const originator = userAgent.slice(0, slash);
  const allowed = new Set(["codex_cli_rs", "codex-tui", "codex_vscode", "codex_atlas", "codex_chatgpt_desktop"]);
  if (!allowed.has(originator) && !/^Codex [A-Za-z0-9][A-Za-z0-9._ -]{0,63}$/.test(originator)) return undefined;
  const match = /^(\d{1,6})\.(\d{1,6})\.(\d{1,6})(?:[-+][0-9A-Za-z.-]+)?(?:\s|$)/.exec(userAgent.slice(slash + 1));
  return match ? `${match[1]}.${match[2]}.${match[3]}` : undefined;
}

function headersFromRequest(req) {
  const blocked = new Set(["connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailer", "transfer-encoding", "upgrade", "host", "content-length"]);
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (value === undefined || blocked.has(name.toLowerCase())) continue;
    if (Array.isArray(value)) for (const item of value) headers.append(name, item);
    else headers.set(name, value);
  }
  return headers;
}

function retryDelay(attempt, response) {
  const retryAfter = response?.headers?.get?.("retry-after");
  const seconds = Number.parseFloat(retryAfter || "");
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(4000, Math.max(250, seconds * 1000));
  return [250, 700, 1500][attempt] || 1500;
}

export async function fetchUpstream(req, endpoint, body) {
  const incoming = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);
  const target = new URL(`${upstreamBaseUrl()}/${endpoint}`);
  target.search = incoming.search;
  if (endpoint === "models" && !target.searchParams.has("client_version")) {
    const version = codexVersion(req.headers["user-agent"]);
    if (version) target.searchParams.set("client_version", version);
  }
  const headers = headersFromRequest(req);
  if (endpoint === "models") headers.delete("if-none-match");
  const method = endpoint === "models" ? "GET" : req.method || "POST";
  let lastError;

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch(target, {
        method,
        headers,
        body: method === "GET" || method === "HEAD" ? undefined : body,
        redirect: endpoint.startsWith("images/") ? "manual" : "follow",
      });
      if (!RETRY_STATUS.has(response.status) || attempt === 3) return response;
      try { await response.body?.cancel(); } catch {}
      await new Promise(resolve => setTimeout(resolve, retryDelay(attempt, response)));
    } catch (error) {
      lastError = error;
      if (attempt === 3) throw error;
      await new Promise(resolve => setTimeout(resolve, retryDelay(attempt)));
    }
  }
  throw lastError || new Error("Upstream request failed");
}

export function upstreamHeaders(upstream, transformed = false) {
  const headers = {};
  for (const [name, value] of upstream.headers) {
    const lower = name.toLowerCase();
    if (["connection", "keep-alive", "transfer-encoding", "content-length", "content-encoding"].includes(lower)) continue;
    if (transformed && lower === "etag") continue;
    headers[name] = value;
  }
  return headers;
}

export function pipeUpstream(res, upstream) {
  res.writeHead(upstream.status, upstreamHeaders(upstream));
  if (!upstream.body) return res.end();
  Readable.fromWeb(upstream.body).pipe(res);
}

export const routeBaseUrl = INSTALLED_BASE_URL;
