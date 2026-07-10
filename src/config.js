// Carousel configuration. Two non-overlapping parts:
//
//   1. Token model — DEFAULT_THEME: what a theme *is*. Each axis is self-contained,
//      holding both its selections and the catalog of values they draw from.
//   2. Resolvers   — pageSize, loadTheme: turn a theme into usable output.
//
// A project-local md2linkedin.config.json overrides any subset of the theme
// (config file only — no frontmatter). Because the catalogs live inside the theme,
// a config can rebrand fully — custom fonts and page sizes, not just colors.

import { readFileSync, existsSync } from "node:fs";

const GH = "https://cdn.jsdelivr.net/gh/google/fonts@main";

// ── 1. Token model ──────────────────────────────────────────────────────────
// Four independent axes; each holds its selections plus the options backing them:
//   color   — background, foreground (text), accent, muted (footers/labels)
//   font    — heading, body: a .ttf URL per role (fetched + cached by fonts.js)
//   identity— handle, logo, placement
//   layout  — ratio (chosen by name) + ratios (catalog), margins, pageNumber
export const DEFAULT_THEME = {
  color: { background: "#faf7f2", foreground: "#1a1a1a", accent: "#0f766e", muted: "#777777" },
  font: {
    heading: `${GH}/ofl/ptserif/PT_Serif-Web-Bold.ttf`,
    body: `${GH}/ofl/ptsans/PT_Sans-Web-Regular.ttf`,
  },
  identity: { handle: "", logo: null, placement: "bottom" },
  layout: {
    ratio: "4:5",
    margins: 72,
    pageNumber: true,
    // ratio name → [width, height] in points. 4:5 (portrait) performs best.
    ratios: { "4:5": [1080, 1350], "1:1": [1080, 1080], "9:16": [1080, 1920] },
  },
};

// ── 2. Resolvers ────────────────────────────────────────────────────────────
// Turn a theme into concrete output the renderer consumes.

// layout.ratio → concrete [width, height], falling back to 4:5.
export function pageSize(theme) {
  return theme.layout.ratios[theme.layout.ratio] || theme.layout.ratios["4:5"];
}

function deepMerge(base, over) {
  const out = { ...base };
  for (const k of Object.keys(over || {})) {
    const v = over[k];
    if (v && typeof v === "object" && !Array.isArray(v) && base[k] && typeof base[k] === "object") {
      out[k] = deepMerge(base[k], v);
    } else if (v !== undefined) {
      out[k] = v;
    }
  }
  return out;
}

// Load ./md2linkedin.config.json (if present) and merge it over DEFAULT_THEME.
// Accepts either { "theme": {...} } or a flat {...}.
export function loadTheme(path = "md2linkedin.config.json") {
  if (!existsSync(path)) return DEFAULT_THEME;
  let cfg;
  try {
    cfg = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    throw new Error(`invalid ${path}: ${e.message}`);
  }
  return deepMerge(DEFAULT_THEME, cfg.theme || cfg);
}
