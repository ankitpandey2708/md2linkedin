// Renders the token stream to a LinkedIn *feed post*: plain text where all
// formatting is faked with Unicode. Blocks are separated by blank lines.

import { matchClose } from "./parse.js";
import { toBold, toItalic, toBoldItalic, toMonospace } from "./unicode.js";
import { TABLE } from "./assets.js";

const BULLET = "•";

function renderInline(inlineToken) {
  if (!inlineToken?.children) return inlineToken?.content ?? "";
  let out = "";
  const stack = []; // active emphasis: 'strong' | 'em'
  for (const c of inlineToken.children) {
    switch (c.type) {
      case "text":
        out += applyEmphasis(c.content, stack);
        break;
      case "code_inline":
        out += toMonospace(c.content);
        break;
      case "strong_open":
        stack.push("strong");
        break;
      case "strong_close":
        stack.pop();
        break;
      case "em_open":
        stack.push("em");
        break;
      case "em_close":
        stack.pop();
        break;
      case "softbreak":
        out += "\n";
        break;
      case "hardbreak":
        out += "\n";
        break;
      case "link_open":
        stack._href = c.attrGet("href");
        break;
      case "link_close":
        if (stack._href) {
          out += ` (${stack._href})`;
          stack._href = null;
        }
        break;
      default:
        if (c.content) out += c.content;
    }
  }
  return out;
}

function applyEmphasis(text, stack) {
  const strong = stack.includes("strong");
  const em = stack.includes("em");
  if (strong && em) return toBoldItalic(text);
  if (strong) return toBold(text);
  if (em) return toItalic(text);
  return text;
}

// Render a slice of block tokens [start, end) to an array of block strings.
function renderBlocks(tokens, start, end, ctx) {
  const blocks = [];
  let i = start;
  while (i < end) {
    const t = tokens[i];
    switch (t.type) {
      case "heading_open": {
        const close = matchClose(tokens, i);
        const text = renderInline(tokens[i + 1]);
        blocks.push(toBold(stripFormatting(text)));
        i = close + 1;
        break;
      }
      case "paragraph_open": {
        const close = matchClose(tokens, i);
        blocks.push(renderInline(tokens[i + 1]));
        i = close + 1;
        break;
      }
      case "bullet_list_open": {
        const close = matchClose(tokens, i);
        blocks.push(renderList(tokens, i + 1, close, ctx, null));
        i = close + 1;
        break;
      }
      case "ordered_list_open": {
        const close = matchClose(tokens, i);
        blocks.push(renderList(tokens, i + 1, close, ctx, 1));
        i = close + 1;
        break;
      }
      case "blockquote_open": {
        const close = matchClose(tokens, i);
        const inner = renderBlocks(tokens, i + 1, close, ctx);
        blocks.push(inner.map((b) => "▏ " + b.replace(/\n/g, "\n▏ ")).join("\n"));
        i = close + 1;
        break;
      }
      case "fence": {
        const a = t._asset;
        // Code images and mermaid diagrams both attach to the gallery (imgNo).
        if (a?.imgNo) blocks.push(`🖼️ image ${a.imgNo} below — ${a.altText}`);
        else blocks.push("```\n" + t.content + "```");
        i++;
        break;
      }
      case "hr":
        blocks.push("────────────");
        i++;
        break;
      case "table_open": {
        const close = matchClose(tokens, i);
        const a = t._asset;
        if (a?.kind === TABLE) blocks.push(`🖼️ image ${a.imgNo} below (table)`);
        i = close + 1;
        break;
      }
      default:
        i++;
    }
  }
  return blocks;
}

function renderList(tokens, start, end, ctx, ordered) {
  const items = [];
  let i = start;
  let n = ordered || 1;
  while (i < end) {
    if (tokens[i].type === "list_item_open") {
      const close = matchClose(tokens, i);
      const inner = renderBlocks(tokens, i + 1, close, ctx);
      const marker = ordered ? `${n}.` : BULLET;
      const body = inner.join("\n").replace(/\n/g, "\n   ");
      items.push(`${marker} ${body}`);
      n++;
      i = close + 1;
    } else i++;
  }
  return items.join("\n");
}

function stripFormatting(text) {
  return text;
}

export function renderPost(tokens) {
  const blocks = renderBlocks(tokens, 0, tokens.length, {});
  return blocks.join("\n\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}
