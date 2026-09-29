import { spawn } from "node:child_process";
import readline from "node:readline";

const DEVIN_BIN = process.env.DEVIN_BIN || "devin";
const REQUEST_TIMEOUT_MS = Number.parseInt(process.env.DEVIN_REQUEST_TIMEOUT_MS || String(60 * 60 * 1000), 10);
const AUTO_APPROVE = /^(1|true|yes)$/i.test(process.env.DEVIN_AUTO_APPROVE || "0");
const DEBUG = /^(1|true|yes)$/i.test(process.env.DEVIN_PROXY_DEBUG || "");

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function debug(...args) {
  if (DEBUG) console.error("[devin-is-free:acp]", ...args);
}

function flattenOptions(options) {
  const out = [];
  for (const option of Array.isArray(options) ? options : []) {
    if (!isObject(option)) continue;
    if (Array.isArray(option.options)) out.push(...flattenOptions(option.options));
    else {
      const value = typeof option.value === "string" ? option.value : typeof option.id === "string" ? option.id : undefined;
      if (value) out.push({ value, name: typeof option.name === "string" ? option.name : value });
    }
  }
  return out;
}

function configByKind(configOptions, kind) {
  const configs = Array.isArray(configOptions) ? configOptions.filter(isObject) : [];
  if (kind === "model") return configs.find(option => option.category === "model" || option.id === "model");
  return configs.find(option => option.category === "thought_level"
    || /thought|thinking|reasoning|effort|budget/i.test(String(option.id || "")));
}

function chooseSwe2(configOptions) {
  const config = configByKind(configOptions, "model");
  if (!config) throw new Error("Devin ACP did not advertise a model selector");
  const options = flattenOptions(config.options);
  const exact = options.find(option => /^swe[-_.]?2$/i.test(option.value) || /^swe[-_.]?2$/i.test(option.name));
  const match = exact || options.find(option => /swe[-_. ]?2/i.test(`${option.value} ${option.name}`) && !/fusion/i.test(`${option.value} ${option.name}`));
  if (!match) {
    const ids = options.map(option => option.value).slice(0, 40).join(", ");
    throw new Error(`SWE-2 is not available in this Devin CLI session. Advertised models: ${ids || "<none>"}`);
  }
  return { configId: String(config.id || "model"), value: match.value };
}

function chooseReasoning(configOptions, requestedEffort) {
  const config = configByKind(configOptions, "reasoning");
  if (!config) return null;
  const options = flattenOptions(config.options);
  const effort = String(requestedEffort || "high").toLowerCase();
  const aliases = effort === "xhigh" || effort === "max"
    ? ["max", "xhigh", "extra_high", "extra-high", "high"]
    : effort === "high"
      ? ["high", "max", "xhigh"]
      : effort === "medium"
        ? ["medium", "med", "balanced"]
        : ["low", "minimal", "min"];
  for (const alias of aliases) {
    const exact = options.find(option => option.value.toLowerCase() === alias || option.name.toLowerCase() === alias);
    if (exact) return { configId: String(config.id), value: exact.value };
  }
  for (const alias of aliases) {
    const fuzzy = options.find(option => option.value.toLowerCase().includes(alias) || option.name.toLowerCase().includes(alias));
    if (fuzzy) return { configId: String(config.id), value: fuzzy.value };
  }
  return null;
}

export class DevinAcpSession {
  constructor({ cwd, onText = () => {}, onActivity = () => {} }) {
    this.cwd = cwd;
    this.onText = onText;
    this.onActivity = onActivity;
    this.child = null;
    this.reader = null;
    this.pending = new Map();
    this.nextId = 1;
    this.sessionId = null;
    this.closed = false;
    this.stderr = "";
  }

  write(message) {
    if (!this.child?.stdin?.writable) throw new Error("Devin ACP stdin is not writable");
    debug("->", message);
    this.child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  request(method, params, timeoutMs = REQUEST_TIMEOUT_MS) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timed out waiting for Devin ACP method ${method}`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: value => { clearTimeout(timer); resolve(value); },
        reject: error => { clearTimeout(timer); reject(error); },
      });
      this.write({ jsonrpc: "2.0", id, method, params });
    });
  }

  respond(id, result) {
    this.write({ jsonrpc: "2.0", id, result });
  }

  handlePermission(message) {
    const options = Array.isArray(message.params?.options) ? message.params.options.filter(isObject) : [];
    if (!AUTO_APPROVE) {
      this.respond(message.id, { outcome: { outcome: "cancelled" } });
      return;
    }
    const selected = options.find(option => option.kind === "allow_once")
      || options.find(option => option.kind === "allow_always")
      || options.find(option => typeof option.kind === "string" && option.kind.startsWith("allow"));
    if (!selected || typeof selected.optionId !== "string") {
      this.respond(message.id, { outcome: { outcome: "cancelled" } });
      return;
    }
    this.onActivity({ type: "permission", title: message.params?.toolCall?.title || "tool" });
    this.respond(message.id, { outcome: { outcome: "selected", optionId: selected.optionId } });
  }

  handleUpdate(message) {
    const update = message.params?.update;
    if (!isObject(update)) return;
    if (update.sessionUpdate === "agent_message_chunk" || update.sessionUpdate === "output_chunk") {
      const text = typeof update.content?.text === "string" ? update.content.text : typeof update.text === "string" ? update.text : "";
      if (text) this.onText(text);
      return;
    }
    if (update.sessionUpdate === "tool_call" || update.sessionUpdate === "tool_call_update") {
      this.onActivity({ type: "tool", title: update.title || update.kind || "tool", status: update.status || "" });
    }
  }

  handleLine(line) {
    const trimmed = line.trim();
    if (!trimmed) return;
    let message;
    try { message = JSON.parse(trimmed); }
    catch { return debug("non-JSON stdout", trimmed); }
    debug("<-", message);
    if (message.method === "session/update") return this.handleUpdate(message);
    if (message.method === "session/request_permission" && message.id !== undefined) return this.handlePermission(message);
    if (message.method && message.id !== undefined) {
      this.write({ jsonrpc: "2.0", id: message.id, error: { code: -32601, message: `Unsupported client method: ${message.method}` } });
      return;
    }
    if (message.id !== undefined && ("result" in message || "error" in message)) {
      const waiter = this.pending.get(message.id);
      if (!waiter) return;
      this.pending.delete(message.id);
      if (message.error) waiter.reject(new Error(message.error.message || JSON.stringify(message.error)));
      else waiter.resolve(message.result);
    }
  }

  async start(reasoningEffort = "high") {
    this.child = spawn(DEVIN_BIN, ["acp"], {
      cwd: this.cwd,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
      env: process.env,
    });
    this.child.stderr.on("data", chunk => {
      const text = chunk.toString();
      this.stderr = (this.stderr + text).slice(-16384);
      if (DEBUG) process.stderr.write(text);
    });
    this.reader = readline.createInterface({ input: this.child.stdout });
    this.reader.on("line", line => this.handleLine(line));
    this.child.on("error", error => {
      for (const waiter of this.pending.values()) waiter.reject(error);
      this.pending.clear();
    });

    await this.request("initialize", {
      protocolVersion: 1,
      clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
      clientInfo: { name: "devin-is-free", version: "0.1.0" },
    }, 30000);

    let session = await this.request("session/new", { cwd: this.cwd, mcpServers: [] }, 30000);
    this.sessionId = session?.sessionId;
    if (!this.sessionId) throw new Error("Devin ACP session/new did not return a sessionId");
    let configOptions = Array.isArray(session?.configOptions) ? session.configOptions : [];

    const model = chooseSwe2(configOptions);
    const modelResult = await this.request("session/set_config_option", {
      sessionId: this.sessionId,
      configId: model.configId,
      value: model.value,
    }, 30000);
    if (Array.isArray(modelResult?.configOptions)) configOptions = modelResult.configOptions;

    const reasoning = chooseReasoning(configOptions, reasoningEffort);
    if (reasoning) {
      await this.request("session/set_config_option", {
        sessionId: this.sessionId,
        configId: reasoning.configId,
        value: reasoning.value,
      }, 30000);
    }
    return { model: model.value, reasoning: reasoning?.value || null };
  }

  async prompt(text) {
    if (!this.sessionId) throw new Error("Devin ACP session is not initialized");
    return this.request("session/prompt", {
      sessionId: this.sessionId,
      prompt: [{ type: "text", text }],
    });
  }

  async cancel() {
    if (this.closed) return;
    try {
      if (this.sessionId) this.write({ jsonrpc: "2.0", method: "session/cancel", params: { sessionId: this.sessionId } });
    } catch {}
    await this.close();
  }

  async close() {
    if (this.closed) return;
    this.closed = true;
    try { this.reader?.close(); } catch {}
    try { this.child?.stdin?.end(); } catch {}
    try { this.child?.kill(); } catch {}
    for (const waiter of this.pending.values()) waiter.reject(new Error("Devin ACP session closed"));
    this.pending.clear();
  }
}

export const devinPermissionMode = AUTO_APPROVE ? "auto-allow-once" : "deny";
