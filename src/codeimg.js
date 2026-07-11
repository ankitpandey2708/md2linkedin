// Renders text (code or a gated table) to a PNG. Code goes through Shiki for
// syntax highlighting; tables render as plain monospace. Images never wrap and
// look identical on desktop and mobile. Used for article wide-table embeds and
// for carousel (PDF) slide code/table images.

import { Resvg } from "@resvg/resvg-js";
import { codeToTokens } from "shiki";
import { escapeMarkup } from "./escape.js";
import { displayWidth } from "./unicode.js";

const FONT_SIZE = 32;
const LINE_HEIGHT = Math.round(FONT_SIZE * 1.5);
const CHAR_WIDTH = FONT_SIZE * 0.55; // Consolas advance ≈0.55em; sizes the canvas to the text (no right slack)
const PAD = 0;
// Light card to sit naturally on LinkedIn's white feed.
const BG = "#ffffff";
const FG = "#1f2328";
const FONT = "Consolas, 'DejaVu Sans Mono', monospace";
const ZOOM = 2; // retina

// Sizing the canvas by code-point count alone would undercount wide glyphs
// (CJK, fullwidth, most emoji) and clip the right edge, so we measure display
// columns (see unicode.js) instead.
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

// Returns the rendered PNG as a Buffer; callers base64-embed it in the article
// HTML or place it on a carousel slide as they need.
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
