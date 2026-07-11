// Renders the token stream to a LinkedIn carousel (a PDF "document post").
//
// Page splitting is deterministic — a new page starts at every heading and at
// every `---` thematic break — so the same Markdown always yields the same deck.
// Slide *role* is by position: first page = cover, last = closing/CTA, middle =
// content. No content heuristics.
//
// Slides are drawn with pdfkit, so prose is *native selectable PDF text* (crisp
// at any zoom, small file). Code / tables / mermaid are inherently pictures, so
// they embed as images (rendered via resvg / Kroki) — the prose stays selectable,
// the visuals are images.

import PDFDocument from "pdfkit";
import { inlineText, extractTable } from "./parse.js";
import { renderCode, renderPlainText } from "./codeimg.js";
import { renderMermaid } from "./mermaid.js";
import { buildAscii } from "./table.js";
import { loadFonts } from "./fonts.js";
import { pageSize } from "./config.js";

// ── deterministic page split ────────────────────────────────────────────────
const CONTENTFUL = new Set([
  "heading_open", "paragraph_open", "bullet_list_open", "ordered_list_open",
  "fence", "table_open", "blockquote_open",
]);

export function splitPages(tokens) {
  const pages = [];
  let cur = [];
  const flush = () => {
    if (cur.some((t) => CONTENTFUL.has(t.type))) pages.push(cur);
    cur = [];
  };
  for (const t of tokens) {
    if (t.type === "heading_open") { flush(); cur = [t]; }
    else if (t.type === "hr") { flush(); }
    else cur.push(t);
  }
  flush();
  return pages;
}

// ── page tokens → a simple content model ────────────────────────────────────
async function pageContent(tokens) {
  let heading = null;
  const blocks = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type === "heading_open") {
      heading = inlineText(tokens[i + 1]);
      i += 2;
    } else if (t.type === "paragraph_open") {
      blocks.push({ type: "para", text: inlineText(tokens[i + 1]) });
      i += 2;
    } else if (t.type === "bullet_list_open" || t.type === "ordered_list_open") {
      const closeType = t.type.replace("_open", "_close");
      const ordered = t.type === "ordered_list_open";
      const items = [];
      let depth = 0;
      for (; i < tokens.length; i++) {
        const x = tokens[i];
        if (x.type === t.type) depth++;
        else if (x.type === closeType) { if (--depth === 0) break; }
        else if (x.type === "inline") items.push(inlineText(x));
      }
      blocks.push({ type: "list", ordered, items });
    } else if (t.type === "fence") {
      const lang = t.info.trim();
      let png;
      if (lang === "mermaid") {
        try { png = await renderMermaid(t.content); }
        catch { png = (await renderCode(t.content, lang)).png; }
      } else {
        png = (await renderCode(t.content, lang)).png;
      }
      blocks.push({ type: "image", png });
    } else if (t.type === "table_open") {
      const { rows, endIdx } = extractTable(tokens, i);
      i = endIdx;
      blocks.push({ type: "image", png: renderPlainText(buildAscii(rows, { hasHeader: true })) });
    }
  }
  return { heading, blocks };
}

// ── pdfkit drawing helpers ──────────────────────────────────────────────────
const pngSize = (buf) => ({ w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) });

// Fetch a logo image; returns a PNG/JPEG Buffer pdfkit can embed, or throws.
async function fetchLogo(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const isPng = buf[0] === 0x89 && buf[1] === 0x50;
  const isJpg = buf[0] === 0xff && buf[1] === 0xd8;
  if (!isPng && !isJpg) throw new Error("must be PNG or JPEG");
  return buf;
}

function registerFonts(doc, fonts) {
  doc.registerFont("heading", fonts.heading);
  doc.registerFont("body", fonts.body);
}

// The identity strip: logo (circular) + handle on the left, page number on the
// right. Sits in the top or bottom margin band per identity.placement.
function drawIdentity(doc, theme, W, H, n, total, color, logo) {
  const m = theme.layout.margins;
  const top = theme.identity.placement === "top";
  const stripH = logo ? 44 : 24;
  const y = (top ? 0 : H - m) + (m - stripH) / 2;
  let textX = m;
  const textY = logo ? y + 10 : y;
  if (logo) {
    doc.save();
    doc.circle(m + 22, y + 22, 22).clip();
    doc.image(logo, m, y, { width: 44, height: 44 });
    doc.restore();
    textX = m + 44 + 14;
  }
  doc.font("body").fontSize(24).fillColor(color).fillOpacity(1);
  if (theme.identity.handle) doc.text(theme.identity.handle, textX, textY, { lineBreak: false });
  if (theme.layout.pageNumber) {
    doc.text(`${n} / ${total}`, m, textY, { width: W - 2 * m, align: "right", lineBreak: false });
  }
}

// Draw an image block centered within the content width; returns the y below it.
function drawImage(doc, png, x, y, cw, maxH) {
  const { w, h } = pngSize(png);
  let dw = cw, dh = (h / w) * cw;
  if (dh > maxH) { dh = maxH; dw = (w / h) * maxH; }
  doc.image(png, x + (cw - dw) / 2, y, { width: dw, height: dh });
  return y + dh;
}

function drawCover(doc, theme, c, W, H, n, total, logo) {
  const m = theme.layout.margins;
  const cw = W - 2 * m;
  doc.rect(0, 0, W, H).fill(theme.color.background);

  doc.font("heading").fontSize(84);
  const hH = doc.heightOfString(c.heading || "", { width: cw, lineGap: 4 });
  const sub = c.blocks.find((b) => b.type === "para");
  let sH = 0;
  if (sub) { doc.font("body").fontSize(34); sH = doc.heightOfString(sub.text, { width: cw, lineGap: 6 }); }
  const totalH = 6 + 32 + hH + (sub ? 30 + sH : 0);

  let y = Math.max(m, (H - totalH) / 2);
  doc.rect(m, y, 72, 6).fill(theme.color.accent);
  y += 6 + 32;
  doc.font("heading").fontSize(84).fillColor(theme.color.foreground);
  doc.text(c.heading || "", m, y, { width: cw, lineGap: 4 });
  if (sub) {
    doc.font("body").fontSize(34).fillColor(theme.color.muted);
    doc.text(sub.text, m, doc.y + 30, { width: cw, lineGap: 6 });
  }
  drawIdentity(doc, theme, W, H, n, total, theme.color.muted, logo);
}

function drawContent(doc, theme, c, W, H, n, total, logo) {
  const m = theme.layout.margins;
  const cw = W - 2 * m;
  doc.rect(0, 0, W, H).fill(theme.color.background);

  let y = m;
  if (c.heading) {
    doc.font("heading").fontSize(54).fillColor(theme.color.foreground);
    doc.text(c.heading, m, y, { width: cw, lineGap: 2 });
    y = doc.y + 26;
  }
  for (const b of c.blocks) {
    if (b.type === "para") {
      doc.font("body").fontSize(33).fillColor(theme.color.foreground);
      doc.text(b.text, m, y, { width: cw, lineGap: 6 });
      y = doc.y + 18;
    } else if (b.type === "list") {
      doc.font("body").fontSize(33);
      for (let i = 0; i < b.items.length; i++) {
        doc.fillColor(theme.color.accent).text(b.ordered ? `${i + 1}.` : "—", m, y, { width: 40, lineBreak: false });
        doc.fillColor(theme.color.foreground).text(b.items[i], m + 46, y, { width: cw - 46, lineGap: 4 });
        y = doc.y + 12;
      }
    } else if (b.type === "image") {
      y = drawImage(doc, b.png, m, y + 8, cw, H * 0.5) + 20;
    }
  }
  drawIdentity(doc, theme, W, H, n, total, theme.color.muted, logo);
}

function drawClosing(doc, theme, c, W, H, n, total, logo) {
  const m = theme.layout.margins;
  const cw = W - 2 * m;
  const fg = theme.color.background; // light text on the accent fill
  doc.rect(0, 0, W, H).fill(theme.color.accent);

  // measure for vertical centering (heading + paragraphs)
  let totalH = 6 + 32;
  if (c.heading) { doc.font("heading").fontSize(66); totalH += doc.heightOfString(c.heading, { width: cw, lineGap: 2 }) + 26; }
  const paras = c.blocks.filter((b) => b.type === "para");
  for (const p of paras) { doc.font("body").fontSize(33); totalH += doc.heightOfString(p.text, { width: cw, lineGap: 6 }) + 18; }

  let y = Math.max(m, (H - totalH) / 2);
  doc.rect(m, y, 72, 6).fill(fg);
  y += 6 + 32;
  if (c.heading) {
    doc.font("heading").fontSize(66).fillColor(fg);
    doc.text(c.heading, m, y, { width: cw, lineGap: 2 });
    y = doc.y + 26;
  }
  for (const p of paras) {
    doc.font("body").fontSize(33).fillColor(fg);
    doc.text(p.text, m, y, { width: cw, lineGap: 6 });
    y = doc.y + 18;
  }
  drawIdentity(doc, theme, W, H, n, total, fg, logo);
}

// ── stream the document to a Buffer ─────────────────────────────────────────
function pdfToBuffer(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

export async function buildCarousel(tokens, theme) {
  const [W, H] = pageSize(theme);
  const pages = splitPages(tokens);
  if (!pages.length) throw new Error("no content to render into a carousel");

  const fonts = await loadFonts(theme.font);
  let logo = null;
  if (theme.identity.logo) {
    try { logo = await fetchLogo(theme.identity.logo); }
    catch (e) { console.error(`  (logo skipped: ${e.message})`); }
  }
  const contents = [];
  for (const p of pages) contents.push(await pageContent(p)); // renders embedded images

  const doc = new PDFDocument({ size: [W, H], margin: 0, autoFirstPage: false });
  registerFonts(doc, fonts);
  const total = contents.length;

  contents.forEach((c, i) => {
    doc.addPage({ size: [W, H], margin: 0 });
    if (i === 0) drawCover(doc, theme, c, W, H, i + 1, total, logo);
    else if (i === total - 1) drawClosing(doc, theme, c, W, H, i + 1, total, logo);
    else drawContent(doc, theme, c, W, H, i + 1, total, logo);
  });

  return { pdf: await pdfToBuffer(doc), pages: total };
}
