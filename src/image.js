// Resolve a Markdown image source to raw bytes that pdfkit (carousel) or the
// article HTML can embed: fetch it if it's a URL, decode it if it's a data:
// URI, otherwise read it from disk relative to the input file. Returns a
// Buffer. Shared by the article asset pipeline and the carousel renderer.

import { readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";

export async function resolveImage(src, baseDir = ".") {
  if (/^https?:\/\//.test(src)) {
    const res = await fetch(src);
    if (!res.ok) throw new Error(`image HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
  if (/^data:/.test(src)) {
    return Buffer.from(src.slice(src.indexOf(",") + 1), "base64");
  }
  return readFileSync(isAbsolute(src) ? src : join(baseDir, src));
}

// Build a data: URI from image bytes, sniffing the MIME from magic bytes so the
// article HTML embeds PNG/JPEG/GIF correctly.
export function toDataUri(buf) {
  let mime = "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8) mime = "image/jpeg";
  else if (buf[0] === 0x47 && buf[1] === 0x49) mime = "image/gif";
  return `data:${mime};base64,${buf.toString("base64")}`;
}
