// Renders text (code or a gated table) to a PNG. Code goes through Shiki for
// syntax highlighting; tables render as plain monospace. Images never wrap and
// look identical on desktop and mobile — the reason code always becomes an
// image rather than fragile Unicode text.

import { Resvg } from "@resvg/resvg-js";
import { codeToTokens } from "shiki";
import { escapeMarkup } from "./escape.js";

const FONT_SIZE = 32;
const LINE_HEIGHT = Math.round(FONT_SIZE * 1.5);
const CHAR_WIDTH = FONT_SIZE * 0.55; // Consolas advance ≈0.55em; sizes the canvas to the text (no right slack)
const PAD = 0;
// Light card to sit naturally on LinkedIn's white feed.
const BG = "#ffffff";
const FG = "#1f2328";
const FONT = "Consolas, 'DejaVu Sans Mono', monospace";
const ZOOM = 2; // retina

// Double-width (CJK, fullwidth, most emoji) occupy two monospace columns. Sizing
// the canvas by code-point count alone would undercount these and clip the right
// edge, so we measure display columns instead.
function isWide(cp) {
  return (
    cp === 0x3000 ||
    (cp >= 0x1100 && cp <= 0x115f) ||
    (cp >= 0x2e80 && cp <= 0xa4cf) ||
    (cp >= 0xac00 && cp <= 0xd7a3) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xfe30 && cp <= 0xfe4f) ||
    (cp >= 0xff00 && cp <= 0xff60) ||
    (cp >= 0xffe0 && cp <= 0xffe6) ||
    (cp >= 0x1f000 && cp <= 0x1faff) ||
    (cp >= 0x2600 && cp <= 0x27bf)
  );
}
function displayWidth(str) {
  let w = 0;
  for (const ch of str) w += isWide(ch.codePointAt(0)) ? 2 : 1;
  return w;
}

// lines: Array<Array<{ content, color }>>
function svgFromLines(lines) {
  const maxCols = Math.max(
    1,
    ...lines.map((toks) => toks.reduce((n, t) => n + displayWidth(t.content), 0))
  );
  const width = Math.ceil(maxCols * CHAR_WIDTH + PAD * 2);
  const height = Math.ceil(lines.length * LINE_HEIGHT + PAD * 2);

  const textEls = lines
    .map((toks, i) => {
      const y = PAD + i * LINE_HEIGHT + FONT_SIZE;
      const spans = toks
        .map(
          (t) =>
            `<tspan fill="${t.color || FG}" xml:space="preserve">${escapeMarkup(t.content)}</tspan>`
        )
        .join("");
      return `<text x="${PAD}" y="${y}" font-family="${FONT}" font-size="${FONT_SIZE}" xml:space="preserve">${spans}</text>`;
    })
    .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<rect width="100%" height="100%" rx="14" fill="${BG}"/>
${textEls}
</svg>`;
}

// Returns the rendered PNG as a Buffer; callers write it to disk (post gallery)
// or base64-embed it in HTML (article) as they need.
function svgToPng(svg, zoom = ZOOM) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "zoom", value: zoom },
    font: { loadSystemFonts: true, defaultFontFamily: "Consolas" },
  });
  return resvg.render().asPng();
}

// Render a fenced code block to a syntax-highlighted PNG.
// Returns { png: Buffer, altText }.
export async function renderCode(code, lang) {
  const clean = code.replace(/\n$/, "");
  let lines;
  try {
    const { tokens } = await codeToTokens(clean, {
      lang: lang || "text",
      theme: "github-light",
    });
    lines = tokens.map((line) => line.map((t) => ({ content: t.content, color: t.color })));
  } catch {
    // Unknown language: fall back to uncolored monospace.
    lines = clean.split("\n").map((l) => [{ content: l, color: FG }]);
  }
  const png = svgToPng(svgFromLines(lines));

  const firstLine = clean.split("\n")[0].slice(0, 60);
  const altText = `Code snippet${lang ? ` (${lang})` : ""}: ${firstLine}${
    clean.length > 60 ? "…" : ""
  }`;
  return { png, altText };
}

// Render arbitrary monospace text (e.g. a wide table) to a PNG Buffer.
export function renderPlainText(text) {
  const lines = text.split("\n").map((l) => [{ content: l, color: FG }]);
  return svgToPng(svgFromLines(lines));
}
