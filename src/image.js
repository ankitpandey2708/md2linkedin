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

// Pixel dimensions of PNG/GIF/JPEG bytes, or null if unrecognized. Used to stamp
// width/height on the <img> so LinkedIn's paste sanitizer keeps the image on the
// first paste instead of dropping it before the data-URI finishes decoding.
export function imageSize(buf) {
  if (buf[0] === 0x89 && buf[1] === 0x50) {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }; // PNG IHDR
  }
  if (buf[0] === 0x47 && buf[1] === 0x49) {
    return { w: buf.readUInt16LE(6), h: buf.readUInt16LE(8) }; // GIF logical screen
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    for (let o = 2; o + 9 < buf.length; ) {
      if (buf[o] !== 0xff) { o++; continue; }
      const marker = buf[o + 1];
      // SOFn frame headers carry the dimensions (skip DHT/DAC/RSTn/APPn).
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { h: buf.readUInt16BE(o + 5), w: buf.readUInt16BE(o + 7) };
      }
      o += 2 + buf.readUInt16BE(o + 2); // skip this segment
    }
  }
  return null;
}
