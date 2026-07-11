// Renders the token stream to LinkedIn-safe HTML for the *article* editor, which
// keeps native prose (h1/h2, strong, em, ul/ol, blockquote, a) and monospace
// code blocks on paste. Code and narrow tables become code blocks (selectable,
// aligned); wide tables would wrap in a code block, so they become inline images.

import { matchClose } from "./parse.js";
import { escapeMarkup as esc } from "./escape.js";
import { DIAGRAM } from "./assets.js";

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
        html.push(`<p>${renderInline(tokens[i + 1])}</p>`);
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
        html.push(`<blockquote>${renderBlocks(tokens, i + 1, close).join("")}</blockquote>`);
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
      const inner = renderBlocks(tokens, i + 1, close)
        .join("")
        .replace(/^<p>|<\/p>$/g, ""); // unwrap single paragraph inside <li>
      out += `<li>${inner}</li>`;
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
