import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";

export const MODEL_SLUG = "devin/swe-2";
export const DISPLAY_NAME = "Devin SWE-2";

function object(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function reasoningLevel(template, effort, description) {
  const levels = Array.isArray(template?.supported_reasoning_levels) ? template.supported_reasoning_levels : [];
  const source = levels.find(level => object(level) && level.effort === effort)
    || levels.find(level => object(level))
    || {};
  return { ...structuredClone(source), effort, description };
}

export function appendDevinModel(catalog) {
  if (!object(catalog) || !Array.isArray(catalog.models)) throw new Error("Upstream model catalog is invalid");
  const models = catalog.models.filter(model => !(object(model) && model.slug === MODEL_SLUG));
  const template = models.find(model => object(model)
    && model.visibility === "list"
    && typeof model.slug === "string"
    && Array.isArray(model.supported_reasoning_levels));
  if (!template) throw new Error("No suitable Codex model template found");
  const routed = {
    ...structuredClone(template),
    slug: MODEL_SLUG,
    display_name: DISPLAY_NAME,
    description: "SWE-2 through the official Devin CLI and ACP transport.",
    input_modalities: ["text"],
    visibility: "list",
    supported_in_api: true,
    multi_agent_version: "disabled",
    default_reasoning_level: "high",
    supported_reasoning_levels: [
      reasoningLevel(template, "low", "Devin SWE-2 Low"),
      reasoningLevel(template, "medium", "Devin SWE-2 Medium"),
      reasoningLevel(template, "high", "Devin SWE-2 High"),
      reasoningLevel(template, "xhigh", "Devin SWE-2 Max"),
    ],
    additional_speed_tiers: [],
    service_tiers: [],
    default_service_tier: null,
  };
  delete routed.comp_hash;
  delete routed.availability_nux;
  return { ...structuredClone(catalog), models: [...models, routed] };
}

function contentText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map(part => {
    if (typeof part === "string") return part;
    if (object(part) && typeof part.text === "string") return part.text;
    if (object(part) && typeof part.output === "string") return part.output;
    return "";
  }).filter(Boolean).join("\n");
}

export function requestText(body) {
  const chunks = [];
  if (typeof body.instructions === "string" && body.instructions.trim()) chunks.push(body.instructions.trim());
  if (typeof body.input === "string") chunks.push(body.input);
  if (Array.isArray(body.input)) {
    for (const item of body.input) {
      if (typeof item === "string") chunks.push(item);
      else if (object(item)) {
        const text = contentText(item.content);
        if (text) chunks.push(text);
        else if (typeof item.output === "string") chunks.push(item.output);
      }
    }
  }
  if (!chunks.length) throw new Error("No text input was found in the request");
  return chunks.join("\n\n");
}

function validDirectory(path) {
  try { return existsSync(path) && statSync(path).isDirectory(); }
  catch { return false; }
}

export function workingDirectory(explicit, prompt) {
  for (const candidate of [explicit, process.env.DEVIN_WORKDIR]) {
    if (!candidate) continue;
    const path = resolve(candidate);
    if (validDirectory(path)) return path;
  }
  const match = /<cwd>\s*([^<\r\n]+?)\s*<\/cwd>/i.exec(prompt);
  if (match) {
    const path = resolve(match[1].trim());
    if (validDirectory(path)) return path;
  }
  return process.cwd();
}

export function ids() {
  const compact = () => randomUUID().replaceAll("-", "");
  return { responseId: `resp_${compact()}`, itemId: `msg_${compact()}` };
}

export function item(id, text, status = "completed") {
  return {
    type: "message",
    id,
    status,
    role: "assistant",
    content: status === "completed" ? [{ type: "output_text", text, annotations: [] }] : [],
  };
}

export function response(id, status, output, error = null) {
  return {
    id,
    object: "response",
    created_at: Math.floor(Date.now() / 1000),
    status,
    error,
    model: MODEL_SLUG,
    output,
    usage: status === "completed" ? { input_tokens: 0, output_tokens: 0, total_tokens: 0 } : null,
  };
}

export function sse(res, name, payload, sequence) {
  res.write(`event: ${name}\ndata: ${JSON.stringify({ type: name, sequence_number: sequence, ...payload })}\n\n`);
}
