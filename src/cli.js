#!/usr/bin/env node
// md2linkedin — convert a Markdown file into LinkedIn-ready output.
//
//   node src/cli.js <input.md>            → article output
//   node src/cli.js <input.md> --carousel → carousel (PDF document post)
//   ... --save                            → also keep the .html file
//
// The clipboard is the deliverable: article copies rich HTML with images
// embedded inline (one paste = whole article). Files are opt-in (--save).
//
//   article: clipboard = HTML + embedded images (one paste = whole article).
//            --save also writes out/article.html (a self-contained preview).
//
// `out/` is wiped each run, and written to only when there's actually a file.

import { rmSync, writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { parse, extractTable } from "./parse.js";
import { renderArticle, renderArticleFragment } from "./render-article.js";
import { renderPlainText, renderCode } from "./codeimg.js";
import { renderMermaid } from "./mermaid.js";
import { renderMath } from "./mathimg.js";
import { resolveImage, toDataUri } from "./image.js";
import { buildAscii, fitsWidth } from "./table.js";
import { copyHtml } from "./clipboard.js";
import { openUrl } from "./open.js";
import { CODE, TABLE, DIAGRAM, IMAGE, MATH } from "./assets.js";
import { loadTheme } from "./config.js";
import { buildCarousel } from "./carousel.js";
import { fetchBrand, brandToTheme } from "./brand.js";

const OUT = "out";
const ARTICLE_EDITOR_URL = "https://www.linkedin.com/article/new/";

function parseArgs(argv) {
  const args = { carousel: false, save: false, brand: null, input: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--carousel") args.carousel = true;
    else if (a === "--save") args.save = true;
    else if (a === "--brand") args.brand = argv[++i]; // next token is the domain
    else if (a.startsWith("--brand=")) args.brand = a.slice("--brand=".length);
    else if (a.startsWith("-")) console.error(`ignoring unknown option: ${a}`);
    else if (!args.input) args.input = a; // first non-flag is the input file
  }
  return args;
}

// Annotate each fence/table token with its asset for the article HTML.
//
// Code and narrow tables are text (code blocks). Wide tables and mermaid
// diagrams become a PNG base64-embedded straight into the HTML — no file on
// disk, so a single paste carries the image inline.
//
// Mermaid diagrams render via the Kroki service; on failure the source is kept
// as a plain code block.
async function buildAssets(tokens, counts, warnings, baseDir) {
  const dataUri = (png) => `data:image/png;base64,${png.toString("base64")}`;

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];

    if (t.type === "fence") {
      const lang = t.info.trim();
      let diagram = null;
      if (lang === "mermaid") {
        try {
          diagram = await renderMermaid(t.content);
        } catch (e) {
          warnings.push(`mermaid diagram failed to render (${e.message}) — keeping the source as a code block`);
        }
      }
      if (diagram) {
        counts.embedded++;
        t._asset = { kind: DIAGRAM, altText: "Mermaid diagram", src: dataUri(diagram) };
      } else {
        t._asset = { kind: CODE }; // code block, no image
      }
    }

    if (t.type === "table_open") {
      const { rows } = extractTable(tokens, i);
      const ascii = buildAscii(rows, { hasHeader: true });
      const fits = fitsWidth(ascii);
      if (!fits) {
        // Wide table: embed the PNG in the HTML (survives paste, no upload).
        counts.embedded++;
        t._asset = { kind: TABLE, ascii, fits: false, src: dataUri(renderPlainText(ascii)) };
      } else {
        t._asset = { kind: TABLE, ascii, fits: true }; // narrow: code block
      }
    }

    // Inline images and inline/block math live inside an `inline` token's
    // children; resolve each to a base64 data-URI stashed on the child token.
    if (t.type === "inline" && t.children) {
      for (const c of t.children) {
        if (c.type === "image") {
          const src = c.attrGet("src");
          try {
            c._asset = { kind: IMAGE, altText: c.content || "image", src: toDataUri(await resolveImage(src, baseDir)) };
            counts.embedded++;
          } catch (e) {
            warnings.push(`image failed to load (${src}: ${e.message}) — showing alt text`);
          }
        } else if (c.type === "math_inline") {
          try {
            c._asset = { kind: MATH, src: dataUri(await renderMath(c.content)) };
          } catch (e) {
            warnings.push(`math failed to render (${e.message}) — showing a code image`);
            c._asset = { kind: MATH, src: dataUri((await renderCode(c.content, "latex")).png) };
          }
          counts.embedded++;
        }
      }
    }
  }
}

// Read a secret from the environment, falling back to a local .env file.
function envKey(name) {
  if (process.env[name]) return process.env[name];
  try {
    const m = readFileSync(".env", "utf8").match(new RegExp(`^${name}=(.*)$`, "m"));
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  } catch {}
  return null;
}

// `--brand <domain>`: fetch the brand's identity (brandkit.dev) and write a starter
// md2linkedin.config.json. It scaffolds a config to review/tweak — it does not
// render; run --carousel afterward to use it.
async function scaffoldBrand(input) {
  const brandkitKey = envKey("BRANDKIT_KEY");
  if (!brandkitKey) {
    console.error("brand: set BRANDKIT_KEY in .env or the environment");
    process.exit(1);
  }
  const domain = input.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const url = /^https?:\/\//.test(input) ? input : "https://" + domain;
  const theme = await brandToTheme(await fetchBrand(url, brandkitKey));

  const path = "md2linkedin.config.json";
  const existed = existsSync(path);
  writeFileSync(path, JSON.stringify(theme, null, 2) + "\n", "utf8");

  console.log("md2linkedin ✓  (brand → config)");
  console.log(`  ${path}${existed ? "  (overwrote existing)" : ""}  ← ${domain}`);
  const c = theme.color || {}, id = theme.identity || {}, f = theme.font || {};
  for (const [k, v] of Object.entries({ background: c.background, foreground: c.foreground, accent: c.accent, handle: id.handle })) {
    if (v) console.log(`    ${k.padEnd(11)}${v}`);
  }
  if (f.heading) console.log(`    ${"font".padEnd(11)}${f.heading.slice(0, 60)}…`);
  if (id.logo) console.log(`    ${"logo".padEnd(11)}${id.logo.slice(0, 60)}…`);
  console.log("  review/tweak the file; anything omitted uses defaults. then: md2li <file> --carousel");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.brand) {
    await scaffoldBrand(args.brand);
    return;
  }

  if (!args.input) {
    console.error("usage: md2li <input.md> [--carousel] [--save]  |  md2li --brand <domain>");
    process.exit(1);
  }

  const src = readFileSync(args.input, "utf8");
  const tokens = parse(src);
  const counts = { embedded: 0 };
  const warnings = []; // problems the user should act on
  const notes = []; // informational — expected, good outcomes
  const mode = args.carousel ? "carousel" : "article";

  rmSync(OUT, { recursive: true, force: true }); // clear any stale output first
  const ensureOut = () => mkdirSync(OUT, { recursive: true });

  // Carousel: a PDF document post. It renders its own slide images (no clipboard,
  // no gallery), so it bypasses buildAssets and the article path entirely.
  if (mode === "carousel") {
    const theme = loadTheme(join(dirname(args.input), "md2linkedin.config.json"));
    const { pdf, pages } = await buildCarousel(tokens, theme, dirname(args.input));
    ensureOut();
    const outPath = join(OUT, "carousel.pdf");
    writeFileSync(outPath, pdf);
    console.log("md2linkedin ✓  (carousel)");
    console.log(`  ${outPath}  (${pages} slides — upload as a LinkedIn document post)`);
    return;
  }

  // buildAssets writes nothing to disk: article images are base64-embedded in
  // the HTML, so the clipboard carries everything.
  await buildAssets(tokens, counts, warnings, dirname(args.input));

  // The clipboard is the primary deliverable. The html file is written only with
  // --save, or automatically if the clipboard copy fails (so output is never lost).
  let savedPath = null;
  const clip = await copyHtml(renderArticleFragment(tokens));
  if (counts.embedded) {
    notes.push(
      `${counts.embedded} image(s) embedded inline — one paste brings everything, no manual upload`
    );
  }
  if (args.save || !clip) {
    ensureOut();
    savedPath = join(OUT, "article.html");
    writeFileSync(savedPath, renderArticle(tokens), "utf8");
  }
  // Open a fresh LinkedIn article so the just-copied HTML can be pasted in —
  // only when the copy actually landed; otherwise there's nothing to paste.
  if (clip && openUrl(ARTICLE_EDITOR_URL)) {
    notes.push(`opened the LinkedIn article editor — paste (${ARTICLE_EDITOR_URL})`);
  }

  // ── summary ──────────────────────────────────────────────────────────────
  console.log(`md2linkedin ✓  (${mode})`);
  if (clip) console.log("  → clipboard   paste into LinkedIn");
  else console.log("  clipboard copy failed — use the saved file below");
  if (savedPath) console.log(`  ${savedPath}${args.save ? "" : "  (auto-saved: clipboard failed)"}`);
  else if (!args.save) console.log("  (no file written — rerun with --save to keep one)");
  if (notes.length) {
    console.log("notes:");
    for (const n of notes) console.log(`  - ${n}`);
  }
  if (warnings.length) {
    console.log("warnings:");
    for (const w of warnings) console.log(`  - ${w}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
