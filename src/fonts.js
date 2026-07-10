// pdfkit needs the actual font bytes (not a URL or system font name). Rather than
// bloat the package with ~1MB of TTFs, we fetch each theme font on first use and
// cache it under ~/.md2linkedin/fonts (keyed by the URL's filename) so later runs
// are offline-fast. Carousel already needs the network (Kroki), so this adds no
// new connectivity requirement.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, basename } from "node:path";

const CACHE_DIR = join(homedir(), ".md2linkedin", "fonts");

async function fetchFont(url) {
  const path = join(CACHE_DIR, basename(new URL(url).pathname));
  if (existsSync(path)) return readFileSync(path);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`could not fetch font ${url}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(path, buf);
  return buf;
}

// Given a theme's `font` ({ heading, body } URLs), returns their TTF buffers as
// { heading, body } for pdfkit registerFont — fetching+caching on first use.
export async function loadFonts(font) {
  return {
    heading: await fetchFont(font.heading),
    body: await fetchFont(font.body),
  };
}
