// Tables render as a plain-ASCII box table. In a monospace context (an image, or
// LinkedIn's article code block) the columns align perfectly. LinkedIn's feed
// has no monospace surface, so there tables become images. Wider than the code
// block wraps and breaks alignment, so wide tables become images too.

import { codePointLength } from "./unicode.js";

// Max monospace columns that fit LinkedIn's article code block on a phone before
// a line wraps (which breaks a table's alignment). Empirical, target-dependent
// constant (~360px width, ~16px monospace) — not derivable from the input.
export const WIDTH_BUDGET = 32;

export function measureWidth(str) {
  return Math.max(...str.split("\n").map((l) => codePointLength(l)));
}

// A table is "narrow" (safe as a code block) if no line exceeds the budget.
export function fitsWidth(asciiTable) {
  return measureWidth(asciiTable) <= WIDTH_BUDGET;
}

function columnWidths(rows) {
  const n = Math.max(...rows.map((r) => r.length));
  const widths = new Array(n).fill(0);
  for (const row of rows) {
    for (let i = 0; i < n; i++) widths[i] = Math.max(widths[i], codePointLength(row[i] ?? ""));
  }
  return widths;
}

// Plain ASCII box table. A real monospace font aligns it; that's all we need.
export function buildAscii(rows, { hasHeader = true } = {}) {
  const widths = columnWidths(rows);
  const border = (l, m, r) => l + widths.map((w) => "─".repeat(w + 2)).join(m) + r;
  const dataRow = (cells) =>
    "│" + widths.map((w, i) => " " + (cells[i] ?? "").padEnd(w, " ") + " ").join("│") + "│";

  const lines = [border("┌", "┬", "┐")];
  rows.forEach((row, i) => {
    lines.push(dataRow(row));
    if (i === 0 && hasHeader) lines.push(border("├", "┼", "┤"));
  });
  lines.push(border("└", "┴", "┘"));
  return lines.join("\n");
}
