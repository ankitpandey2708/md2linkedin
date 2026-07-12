// Markdown parsing + small token-stream helpers shared by both renderers.

import MarkdownIt from "markdown-it";
import footnote from "markdown-it-footnote";

// Inline/block math tokenizer. We only *tokenize* ($…$ / $$…$$ → math_inline
// with a `meta.display` flag holding the raw TeX); the image is rendered
// asynchronously elsewhere, because md.render is synchronous and the image
// fetch is not. Best-effort dollar rules keep prose like "$5 and $10" from
// being mistaken for math.
function mathPlugin(md) {
  md.inline.ruler.before("escape", "math", (state, silent) => {
    const src = state.src;
    const pos = state.pos;
    if (src[pos] !== "$") return false;
    const display = src[pos + 1] === "$";
    const delim = display ? "$$" : "$";
    const contentStart = pos + delim.length;
    const closeIdx = src.indexOf(delim, contentStart);
    if (closeIdx === -1) return false;
    const content = src.slice(contentStart, closeIdx);
    if (!content.trim()) return false;
    if (!display) {
      // inline guards: no padding whitespace, closing $ not glued to a digit ($5)
      if (/^\s|\s$/.test(content)) return false;
      if (/\d/.test(src[closeIdx + delim.length] || "")) return false;
    }
    if (!silent) {
      const token = state.push("math_inline", "", 0);
      token.content = content.trim();
      token.markup = delim;
      token.meta = { display };
    }
    state.pos = closeIdx + delim.length;
    return true;
  });
}

const md = new MarkdownIt({ html: false, linkify: true, breaks: false })
  .use(footnote)
  .use(mathPlugin);

export function parse(src) {
  return md.parse(src, {});
}

// Find the closing token that matches an *_open token at `openIdx`.
export function matchClose(tokens, openIdx) {
  const openType = tokens[openIdx].type;
  const closeType = openType.replace(/_open$/, "_close");
  let depth = 0;
  for (let i = openIdx; i < tokens.length; i++) {
    if (tokens[i].type === openType) depth++;
    else if (tokens[i].type === closeType) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return tokens.length - 1;
}

// Flatten an inline token's children to plain text (drops markup). The
// `footnotes` option maps footnote id → note text; a footnote_ref then inlines
// "(note)". Strikethrough markers are ignored — the text passes through plain.
export function inlineText(inlineToken, { footnotes = null } = {}) {
  if (!inlineToken || !inlineToken.children) return inlineToken?.content ?? "";
  let out = "";
  for (const c of inlineToken.children) {
    switch (c.type) {
      case "text":
      case "code_inline":
        out += c.content;
        break;
      case "softbreak":
      case "hardbreak":
        out += " ";
        break;
      case "footnote_ref": {
        const note = footnotes && footnotes[c.meta?.id];
        if (note) out += ` (${note})`;
        break;
      }
      default:
        break;
    }
  }
  return out;
}

// Extract a Markdown table into rows of plain-text cells.
// Returns { rows, endIdx } where rows[0] is the header row.
export function extractTable(tokens, tableOpenIdx) {
  const endIdx = matchClose(tokens, tableOpenIdx);
  const rows = [];
  let current = null;
  for (let i = tableOpenIdx + 1; i < endIdx; i++) {
    const t = tokens[i];
    if (t.type === "tr_open") current = [];
    else if (t.type === "tr_close") {
      if (current) rows.push(current);
      current = null;
    } else if (t.type === "inline" && current) {
      current.push(inlineText(t).trim());
    }
  }
  return { rows, endIdx };
}
