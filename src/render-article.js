// Renders the token stream to LinkedIn-safe HTML for the *article* editor, which
// keeps native prose (h1/h2, strong, em, ul/ol, blockquote, a) and monospace
// code blocks on paste. Code and narrow tables become code blocks (selectable,
// aligned); wide tables would wrap in a code block, so they become inline images.
// Task lists, alerts and footnotes map onto native HTML; images and math ride in
// as base64-embedded <img> (assets built in cli.buildAssets).
// (Strikethrough is intentionally unsupported: LinkedIn strips <s>, and the
//  Unicode-overlay fallback renders like an underline, so it's left as plain text.)

import { matchClose } from "./parse.js";
import { escapeMarkup as esc } from "./escape.js";
import { DIAGRAM } from "./assets.js";

// GitHub alert types → the labeled heading we render inside the blockquote.
const ALERT_LABELS = {
  NOTE: "📌 NOTE",
  TIP: "💡 TIP",
  IMPORTANT: "❗ IMPORTANT",
  WARNING: "⚠️ WARNING",
  CAUTION: "🔴 CAUTION",
};

// LinkedIn keeps an <img> only when it is alone in its own <p>; an image that
// shares a paragraph with text or another image is dropped on paste. So each
// image/math breaks out of the current paragraph into its own <p><img></p>.
// (Empty paragraphs from the split are stripped by the paragraph handler.)
const imgBlock = (src, alt) => `</p><p><img src="${src}" alt="${esc(alt || "")}" style="max-width:100%"/></p><p>`;

function renderInline(inlineToken) {
  if (!inlineToken?.children) return esc(inlineToken?.content ?? "");
  let out = "";
  for (const c of inlineToken.children) {
    switch (c.type) {
      case "text":
        out += esc(c.content);
        break;
      case "code_inline":
        out += `<code>${esc(c.content)}</code>`;
        break;
      case "strong_open":
        out += "<strong>";
        break;
      case "strong_close":
        out += "</strong>";
        break;
      case "em_open":
        out += "<em>";
        break;
      case "em_close":
        out += "</em>";
        break;
      case "link_open":
        out += `<a href="${esc(c.attrGet("href"))}">`;
        break;
      case "link_close":
        out += "</a>";
        break;
      case "softbreak":
        out += " ";
        break;
      case "hardbreak":
        out += "<br/>";
        break;
      case "image":
        if (c._asset?.src) out += imgBlock(c._asset.src, c._asset.altText);
        else out += esc(c.content || ""); // load failed → fall back to alt text
        break;
      case "math_inline":
        if (c._asset?.src) out += imgBlock(c._asset.src, c.content);
        else out += `<code>${esc(c.content)}</code>`;
        break;
      case "footnote_ref":
        out += `<sup>[${(c.meta?.id ?? 0) + 1}]</sup>`;
        break;
      default:
        if (c.content) out += esc(c.content);
    }
  }
  return out;
}

function renderBlocks(tokens, start, end) {
  const html = [];
  let i = start;
  while (i < end) {
    const t = tokens[i];
    switch (t.type) {
      case "heading_open": {
        const close = matchClose(tokens, i);
        const tag = t.tag === "h1" ? "h1" : "h2";
        html.push(`<${tag}>${renderInline(tokens[i + 1])}</${tag}>`);
        i = close + 1;
        break;
      }
      case "paragraph_open": {
        const close = matchClose(tokens, i);
        // renderInline may inject `</p>…<p>` to promote images/math to their own
        // paragraph; strip any empty paragraphs that leaves behind.
        const p = `<p>${renderInline(tokens[i + 1])}</p>`.replace(/<p>\s*<\/p>/g, "");
        if (p) html.push(p);
        i = close + 1;
        break;
      }
      case "bullet_list_open": {
        const close = matchClose(tokens, i);
        html.push(`<ul>${renderListItems(tokens, i + 1, close)}</ul>`);
        i = close + 1;
        break;
      }
      case "ordered_list_open": {
        const close = matchClose(tokens, i);
        html.push(`<ol>${renderListItems(tokens, i + 1, close)}</ol>`);
        i = close + 1;
        break;
      }
      case "blockquote_open": {
        const close = matchClose(tokens, i);
        let inner = renderBlocks(tokens, i + 1, close).join("");
        // GitHub alert: a blockquote whose first line is [!NOTE] / [!WARNING] …
        const am = inner.match(/^<p>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i);
        if (am) inner = inner.replace(am[0], `<p><strong>${ALERT_LABELS[am[1].toUpperCase()]}</strong> `);
        html.push(`<blockquote>${inner}</blockquote>`);
        i = close + 1;
        break;
      }
      case "fence": {
        const a = t._asset;
        if (a?.kind === DIAGRAM && a.src) {
          // Mermaid: embed the rendered diagram image (base64) inline.
          html.push(`<img src="${a.src}" alt="${esc(a.altText || "diagram")}" style="max-width:100%"/>`);
        } else {
          // Code goes in a monospace <pre> block — selectable text that survives
          // paste (LinkedIn maps it to its code block), no image upload.
          html.push(`<pre><code>${esc(t.content.replace(/\n$/, ""))}</code></pre>`);
        }
        i++;
        break;
      }
      case "hr":
        html.push("<hr/>");
        i++;
        break;
      case "table_open": {
        const close = matchClose(tokens, i);
        const a = t._asset;
        // LinkedIn strips <table> on paste (cells collapse into run-on text), so
        // tables use survivable forms instead.
        // Narrow table → monospace <pre> (LinkedIn's code block; aligned,
        // selectable). Wide table would wrap and break the grid, so it becomes a
        // PNG base64-embedded in the HTML — LinkedIn keeps it on paste (verified),
        // so it lands inline with no manual upload.
        if (a?.fits) {
          html.push(`<pre><code>${esc(a.ascii)}</code></pre>`);
        } else {
          html.push(`<img src="${a.src}" alt="table" style="max-width:100%"/>`);
        }
        i = close + 1;
        break;
      }
      case "footnote_block_open": {
        // markdown-it-footnote collects all definitions here; render them as a
        // trailing "Notes" list (LinkedIn keeps no real footnote anchors).
        const close = matchClose(tokens, i);
        const items = [];
        for (let j = i + 1; j < close; j++) {
          if (tokens[j].type === "footnote_open") {
            const fc = matchClose(tokens, j);
            const body = renderBlocks(tokens, j + 1, fc).join("").replace(/^<p>|<\/p>$/g, "");
            items.push(`<li>${body}</li>`);
            j = fc;
          }
        }
        if (items.length) html.push(`<hr/><p><strong>Notes</strong></p><ol>${items.join("")}</ol>`);
        i = close + 1;
        break;
      }
      default:
        i++;
    }
  }
  return html;
}

function renderListItems(tokens, start, end) {
  let out = "";
  let i = start;
  while (i < end) {
    if (tokens[i].type === "list_item_open") {
      const close = matchClose(tokens, i);
      let inner = renderBlocks(tokens, i + 1, close)
        .join("")
        .replace(/^<p>|<\/p>$/g, ""); // unwrap single paragraph inside <li>
      // GFM task list: leading [ ] / [x] becomes a checkbox glyph.
      const m = inner.match(/^\[( |x|X)\]\s+/);
      const prefix = m ? (m[1] === " " ? "☐ " : "☑ ") : "";
      if (m) inner = inner.slice(m[0].length);
      out += `<li>${prefix}${inner}</li>`;
      i = close + 1;
    } else i++;
  }
  return out;
}

export function renderArticle(tokens) {
  const body = renderBlocks(tokens, 0, tokens.length).join("\n");
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>LinkedIn article</title></head>
<body>
${body}
</body></html>`;
}

// The fragment (no doctype/html wrapper) used for the clipboard CF_HTML payload.
export function renderArticleFragment(tokens) {
  return renderBlocks(tokens, 0, tokens.length).join("\n");
}
