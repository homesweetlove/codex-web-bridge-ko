import http from "node:http";
import { createHash } from "node:crypto";
import { DevinAcpSession, devinPermissionMode } from "./acp.mjs";
import { parseJsonBody } from "./body.mjs";
import { MODEL_SLUG, appendDevinModel, ids, item, requestText, response, sse, workingDirectory } from "./protocol.mjs";
import { fetchUpstream, pipeUpstream, routeBaseUrl, upstreamBaseUrl, upstreamHeaders } from "./upstream.mjs";

const HOST = process.env.DEVIN_PROXY_HOST || "127.0.0.1";
const PORT = Number.parseInt(process.env.DEVIN_PROXY_PORT || "17842", 10);
const MAX_BODY = 64 * 1024 * 1024;
const DEBUG = /^(1|true|yes)$/i.test(process.env.DEVIN_PROXY_DEBUG || "");

function log(...args) { console.log("[devin-is-free]", ...args); }
function debug(...args) { if (DEBUG) console.error("[devin-is-free:debug]", ...args); }

function json(res, status, value, headers = {}) {
  const body = JSON.stringify(value);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "content-length": Buffer.byteLength(body), ...headers });
  res.end(body);
}
function error(res, status, type, message) { json(res, status, { error: { message, type, param: null, code: null } }); }

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new Error("Request body is too large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function decodeJsonRequest(req, raw) {
  try {
    return parseJsonBody(raw, req.headers["content-encoding"]);
  } catch (cause) {
    const encoding = req.headers["content-encoding"] || "identity";
    const detail = cause instanceof Error ? cause.message : String(cause);
    throw new Error(`Invalid JSON request body (${encoding}): ${detail}`);
  }
}

async function models(req, res) {
  const upstream = await fetchUpstream(req, "models");
  if (!upstream.ok) return pipeUpstream(res, upstream);
  const catalog = appendDevinModel(await upstream.json());
  const body = JSON.stringify(catalog);
  const headers = upstreamHeaders(upstream, true);
  headers["content-type"] = "application/json; charset=utf-8";
  headers["content-length"] = Buffer.byteLength(body);
  headers.etag = `W/\"${createHash("sha256").update(body).digest("base64url")}\"`;
  res.writeHead(200, headers);
  res.end(body);
}

async function devinTurn(req, res, body) {
  const prompt = requestText(body);
  const cwd = workingDirectory(req.headers["x-devin-cwd"], prompt);
  const effort = body.reasoning?.effort || "high";
  const stream = body.stream !== false;
  const { responseId, itemId } = ids();
  let text = "";
  let sequence = 0;
  let started = false;
  let heartbeat;
  let session;

  const beginMessage = () => {
    if (!stream || started || res.writableEnded) return;
    started = true;
    sse(res, "response.output_item.added", { output_index: 0, item: item(itemId, "", "in_progress") }, sequence++);
    sse(res, "response.content_part.added", {
      item_id: itemId, output_index: 0, content_index: 0,
      part: { type: "output_text", text: "", annotations: [] },
    }, sequence++);
  };

  if (stream) {
    res.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    });
    sse(res, "response.created", { response: response(responseId, "in_progress", []) }, sequence++);
    heartbeat = setInterval(() => {
      if (!res.writableEnded) res.write('event: response.heartbeat\ndata: {"type":"response.heartbeat"}\n\n');
    }, 2000);
  }

  try {
    session = new DevinAcpSession({
      cwd,
      onText: chunk => {
        text += chunk;
        if (!stream || res.writableEnded) return;
        beginMessage();
        sse(res, "response.output_text.delta", {
          item_id: itemId, output_index: 0, content_index: 0, delta: chunk, logprobs: [],
        }, sequence++);
      },
      onActivity: activity => debug("activity", activity),
    });

    const selected = await session.start(effort);
    debug("session", { cwd, selected });
    await session.prompt(prompt);

    const completedItem = item(itemId, text, "completed");
    const completedResponse = response(responseId, "completed", [completedItem]);
    if (!stream) return json(res, 200, completedResponse);

    beginMessage();
    sse(res, "response.output_text.done", { item_id: itemId, output_index: 0, content_index: 0, text }, sequence++);
    sse(res, "response.content_part.done", {
      item_id: itemId, output_index: 0, content_index: 0,
      part: { type: "output_text", text, annotations: [] },
    }, sequence++);
    sse(res, "response.output_item.done", { output_index: 0, item: completedItem }, sequence++);
    sse(res, "response.completed", { response: completedResponse }, sequence++);
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    if (!stream || !res.headersSent) return error(res, 502, "upstream_error", message);
    sse(res, "response.failed", { response: response(responseId, "failed", [], { code: "devin_cli_error", message }) }, sequence++);
    res.write("data: [DONE]\n\n");
    res.end();
  } finally {
    if (heartbeat) clearInterval(heartbeat);
    await session?.close().catch(() => {});
  }
}

async function responses(req, res) {
  const raw = await readBody(req);
  let body;
  try { body = decodeJsonRequest(req, raw); }
  catch (cause) { return error(res, 400, "invalid_request_error", cause instanceof Error ? cause.message : String(cause)); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return error(res, 400, "invalid_request_error", "Request body must be an object");
  if (body.model !== MODEL_SLUG) return pipeUpstream(res, await fetchUpstream(req, "responses", raw));
  return devinTurn(req, res, body);
}

async function chatCompletions(req, res) {
  const raw = await readBody(req);
  let body;
  try { body = decodeJsonRequest(req, raw); }
  catch (cause) { return error(res, 400, "invalid_request_error", cause instanceof Error ? cause.message : String(cause)); }
  if (body?.model !== MODEL_SLUG) return error(res, 400, "invalid_request_error", `Use model ${MODEL_SLUG}`);
  const input = Array.isArray(body.messages)
    ? body.messages.map(message => ({ type: "message", role: message.role, content: message.content }))
    : [];
  const prompt = requestText({ input });
  const cwd = workingDirectory(req.headers["x-devin-cwd"], prompt);
  let text = "";
  let session;
  try {
    session = new DevinAcpSession({ cwd, onText: chunk => { text += chunk; } });
    await session.start(body.reasoning_effort || "high");
    await session.prompt(prompt);
    return json(res, 200, {
      id: `chatcmpl_${Date.now()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: MODEL_SLUG,
      choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: "stop" }],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    });
  } catch (cause) {
    return error(res, 502, "upstream_error", cause instanceof Error ? cause.message : String(cause));
  } finally {
    await session?.close().catch(() => {});
  }
}

async function route(req, res) {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-headers", "authorization, content-type, content-encoding, x-devin-cwd");
  res.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return res.end();

  const url = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);
  if (req.method === "GET" && url.pathname === "/health") {
    return json(res, 200, {
      ok: true, service: "devin-is-free", model: MODEL_SLUG, route: routeBaseUrl,
      upstream: upstreamBaseUrl(), permissions: devinPermissionMode,
      cwd_fallback: process.env.DEVIN_WORKDIR || process.cwd(),
    });
  }
  if (req.method === "GET" && url.pathname === "/v1/models") return models(req, res);
  if (req.method === "GET" && url.pathname === "/v1/responses") {
    res.writeHead(426, { "content-type": "text/plain; charset=utf-8" });
    return res.end("Use Responses over HTTP/SSE on this local route.");
  }
  if (req.method === "POST" && url.pathname === "/v1/responses") return responses(req, res);
  if (req.method === "POST" && url.pathname === "/v1/chat/completions") return chatCompletions(req, res);

  const passthrough = new Map([
    ["/v1/responses/compact", "responses/compact"],
    ["/v1/alpha/search", "alpha/search"],
    ["/v1/images/generations", "images/generations"],
    ["/v1/images/edits", "images/edits"],
  ]);
  const endpoint = passthrough.get(url.pathname);
  if (endpoint && req.method === "POST") {
    const raw = await readBody(req);
    return pipeUpstream(res, await fetchUpstream(req, endpoint, raw));
  }
  return error(res, 404, "not_found_error", `No route for ${req.method} ${url.pathname}`);
}

const server = http.createServer((req, res) => {
  route(req, res).catch(cause => {
    console.error("[devin-is-free] request failed", cause);
    if (!res.headersSent) error(res, 500, "server_error", cause instanceof Error ? cause.message : String(cause));
    else if (!res.writableEnded) res.end();
  });
});

server.listen(PORT, HOST, () => {
  log(`listening: ${routeBaseUrl}`);
  log(`model: ${MODEL_SLUG}`);
  log(`upstream: ${upstreamBaseUrl()}`);
  log(`permissions: ${devinPermissionMode}`);
  log(`cwd fallback: ${process.env.DEVIN_WORKDIR || process.cwd()}`);
});
