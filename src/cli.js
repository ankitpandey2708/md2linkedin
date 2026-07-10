#!/usr/bin/env node
// md2linkedin — convert a Markdown file into LinkedIn-ready output.
//
//   node src/cli.js <input.md>            → feed-post output
//   node src/cli.js <input.md> --article  → article output
//   ... --save                            → also keep the .txt/.html file
//
// The clipboard is the deliverable: post copies plain text, article copies rich
// HTML with images embedded inline. Files are opt-in (--save) — except post-mode
// gallery PNGs, which can't ride the clipboard and are always written.
//
//   article: clipboard = HTML + embedded images (one paste = whole article).
//            --save also writes out/article.html (a self-contained preview).
//   post:    clipboard = plain text; out/assets/ holds a PNG per code block &
//            table (uploaded manually). --save also writes out/post.txt.
//
// `out/` is wiped each run, and written to only when there's actually a file.

import { rmSync, writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { parse, extractTable } from "./parse.js";
import { renderPost } from "./render-post.js";
import { renderArticle, renderArticleFragment } from "./render-article.js";
import { renderCode, renderPlainText } from "./codeimg.js";
import { renderMermaid } from "./mermaid.js";
import { buildAscii, fitsWidth } from "./table.js";
import { copyHtml, copyText } from "./clipboard.js";
import { CODE, TABLE, DIAGRAM } from "./assets.js";
import { loadTheme } from "./config.js";
import { buildCarousel } from "./carousel.js";
import { fetchBrand, brandToTheme } from "./brand.js";

const POST_LIMIT = 3000;
const OUT = "out";
const ASSETS = "assets";

function parseArgs(argv) {
  const args = { article: false, carousel: false, save: false, brand: null, input: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--article") args.article = true;
    else if (a === "--carousel") args.carousel = true;
    else if (a === "--save") args.save = true;
    else if (a === "--brand") args.brand = argv[++i]; // next token is the domain
    else if (a.startsWith("--brand=")) args.brand = a.slice("--brand=".length);
    else if (a.startsWith("-")) console.error(`ignoring unknown option: ${a}`);
    else if (!args.input) args.input = a; // first non-flag is the input file
  }
  return args;
}

// Annotate each fence/table token with its asset.
//
// post:    every code block, table & diagram becomes a PNG file in out/assets
//          (uploaded manually to the feed's bottom gallery).
// article: code and narrow tables are text (code blocks). Wide tables and mermaid
//          diagrams become a PNG base64-embedded straight into the HTML — no file
//          on disk, so a single paste carries the image inline.
//
// Mermaid diagrams render via the Kroki service; on failure they fall back to a
// code-image of the source.
async function buildAssets(tokens, mode, counts, warnings) {
  let assetsMade = false;
  const assetPath = (name) => {
    if (!assetsMade) {
      mkdirSync(join(OUT, ASSETS), { recursive: true });
      assetsMade = true;
    }
    return join(OUT, name);
  };
  const dataUri = (png) => `data:image/png;base64,${png.toString("base64")}`;

  let imgNo = 0; // post-only: order to attach images in the bottom gallery
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];

    if (t.type === "fence") {
      const lang = t.info.trim();
      let diagram = null;
      if (lang === "mermaid") {
        try {
          diagram = await renderMermaid(t.content);
        } catch (e) {
          warnings.push(`mermaid diagram failed to render (${e.message}) — using a code image`);
        }
      }
      if (diagram && mode === "post") {
        counts.diagram++;
        const rel = `${ASSETS}/diagram-${String(counts.diagram).padStart(2, "0")}.png`;
        writeFileSync(assetPath(rel), diagram);
        t._asset = { kind: DIAGRAM, rel, altText: "Mermaid diagram", imgNo: ++imgNo };
      } else if (diagram) {
        counts.embedded++;
        t._asset = { kind: DIAGRAM, altText: "Mermaid diagram", src: dataUri(diagram) };
      } else if (mode === "post") {
        const rel = `${ASSETS}/code-${String(++counts.code).padStart(2, "0")}.png`;
        const { png, altText } = await renderCode(t.content, lang);
        writeFileSync(assetPath(rel), png);
        t._asset = { kind: CODE, rel, altText, imgNo: ++imgNo };
      } else {
        t._asset = { kind: CODE }; // article: code block, no image
      }
    }

    if (t.type === "table_open") {
      const { rows } = extractTable(tokens, i);
      const ascii = buildAscii(rows, { hasHeader: true });
      const fits = fitsWidth(ascii);
      if (mode === "post") {
        const rel = `${ASSETS}/table-${String(++counts.table).padStart(2, "0")}.png`;
        writeFileSync(assetPath(rel), renderPlainText(ascii));
        t._asset = { kind: TABLE, rel, imgNo: ++imgNo };
      } else if (!fits) {
        // Wide table: embed the PNG in the HTML (survives paste, no upload).
        counts.embedded++;
        t._asset = { kind: TABLE, ascii, fits: false, src: dataUri(renderPlainText(ascii)) };
      } else {
        t._asset = { kind: TABLE, ascii, fits: true }; // narrow: code block
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
    console.error("usage: md2li <input.md> [--article | --carousel] [--save]  |  md2li --brand <domain>");
    process.exit(1);
  }

  const src = readFileSync(args.input, "utf8");
  const tokens = parse(src);
  const counts = { code: 0, table: 0, diagram: 0, embedded: 0 };
  const warnings = []; // problems the user should act on
  const notes = []; // informational — expected, good outcomes
  const mode = args.carousel ? "carousel" : args.article ? "article" : "post";

  rmSync(OUT, { recursive: true, force: true }); // clear any stale output first
  const ensureOut = () => mkdirSync(OUT, { recursive: true });

  // Carousel: a PDF document post. It renders its own slide images (no clipboard,
  // no gallery), so it bypasses buildAssets and the post/article paths entirely.
  if (mode === "carousel") {
    const theme = loadTheme(join(dirname(args.input), "md2linkedin.config.json"));
    const { pdf, pages } = await buildCarousel(tokens, theme);
    ensureOut();
    const outPath = join(OUT, "carousel.pdf");
    writeFileSync(outPath, pdf);
    console.log("md2linkedin ✓  (carousel)");
    console.log(`  ${outPath}  (${pages} slides — upload as a LinkedIn document post)`);
    return;
  }

  // buildAssets writes only the *unavoidable* files: post-mode gallery PNGs,
  // which can't ride the clipboard (feed images upload manually). Article images
  // are embedded in the HTML, so it writes nothing.
  await buildAssets(tokens, mode, counts, warnings);

  // The clipboard is the primary deliverable. The text/html file is written only
  // with --save, or automatically if the clipboard copy fails (so output is
  // never lost).
  let clip = false;
  let savedPath = null;
  if (mode === "article") {
    clip = await copyHtml(renderArticleFragment(tokens));
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
  } else {
    const post = renderPost(tokens);
    clip = await copyText(post); // plain text — the feed box takes nothing richer
    const chars = Array.from(post).length;
    if (chars > POST_LIMIT) warnings.push(`post is ${chars} chars (feed limit ${POST_LIMIT})`);
    const galleryCount = counts.code + counts.table + counts.diagram;
    if (galleryCount) {
      warnings.push(
        `${galleryCount} image(s) attach in a gallery at the bottom of a post, not inline — ` +
          `use --article to place code/tables/diagrams inline`
      );
    }
    if (args.save || !clip) {
      ensureOut();
      savedPath = join(OUT, "post.txt");
      writeFileSync(savedPath, post, "utf8");
    }
  }

  // ── summary ──────────────────────────────────────────────────────────────
  console.log(`md2linkedin ✓  (${mode})`);
  if (clip) console.log("  → clipboard   paste into LinkedIn");
  else console.log("  clipboard copy failed — use the saved file below");
  if (savedPath) console.log(`  ${savedPath}${args.save ? "" : "  (auto-saved: clipboard failed)"}`);
  else if (!args.save) console.log("  (no file written — rerun with --save to keep one)");
  if (counts.code || counts.table || counts.diagram) {
    console.log(
      `  ${join(OUT, ASSETS)}/  (${counts.code} code, ${counts.table} table, ` +
        `${counts.diagram} diagram — upload manually)`
    );
  }
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
