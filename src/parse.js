// Markdown parsing + small token-stream helpers shared by both renderers.

import MarkdownIt from "markdown-it";

const md = new MarkdownIt({ html: false, linkify: true, breaks: false });

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

// Flatten an inline token's children to plain text (drops emphasis markup).
export function inlineText(inlineToken) {
  if (!inlineToken || !inlineToken.children) return inlineToken?.content ?? "";
  let out = "";
  for (const c of inlineToken.children) {
    if (c.type === "text" || c.type === "code_inline") out += c.content;
    else if (c.type === "softbreak" || c.type === "hardbreak") out += " ";
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
