import { brotliDecompressSync, gunzipSync, inflateSync, zstdDecompressSync } from "node:zlib";

const MAX_ENCODED = 64 * 1024 * 1024;
const MAX_DECODED = 128 * 1024 * 1024;

function limit(buffer, max, label) {
  if (buffer.length > max) throw new Error(`${label} exceeds ${max} bytes`);
  return buffer;
}

export function decodeBody(raw, contentEncoding = "identity") {
  limit(raw, MAX_ENCODED, "Encoded request body");
  const encoding = String(contentEncoding || "identity").trim().toLowerCase();
  let decoded;
  if (!encoding || encoding === "identity") decoded = raw;
  else if (encoding === "zstd") decoded = zstdDecompressSync(raw);
  else if (encoding === "gzip") decoded = gunzipSync(raw);
  else if (encoding === "deflate") decoded = inflateSync(raw);
  else if (encoding === "br") decoded = brotliDecompressSync(raw);
  else throw new Error(`Unsupported Content-Encoding: ${encoding}`);
  return limit(decoded, MAX_DECODED, "Decoded request body");
}

export function parseJsonBody(raw, contentEncoding) {
  const decoded = decodeBody(raw, contentEncoding);
  const text = new TextDecoder("utf-8", { fatal: true }).decode(decoded);
  return JSON.parse(text);
}
