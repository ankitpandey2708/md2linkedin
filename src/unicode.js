// Text-width measurement, shared by the ASCII-table builder (column alignment)
// and the code-image renderer (canvas sizing). Both iterate by Unicode code
// point, so astral characters (emoji, etc.) are never double-counted the way
// `.length` counts their UTF-16 surrogate pairs.

// Double-width (CJK, fullwidth, most emoji) glyphs occupy two monospace columns.
function isWide(cp) {
  return (
    cp === 0x3000 ||
    (cp >= 0x1100 && cp <= 0x115f) ||
    (cp >= 0x2e80 && cp <= 0xa4cf) ||
    (cp >= 0xac00 && cp <= 0xd7a3) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xfe30 && cp <= 0xfe4f) ||
    (cp >= 0xff00 && cp <= 0xff60) ||
    (cp >= 0xffe0 && cp <= 0xffe6) ||
    (cp >= 0x1f000 && cp <= 0x1faff) ||
    (cp >= 0x2600 && cp <= 0x27bf)
  );
}

// Display columns a string occupies in a monospace context: each code point is
// one column, except wide glyphs (above), which are two. This is the measure
// that keeps monospace tables and code images aligned across scripts.
export function displayWidth(str) {
  let w = 0;
  for (const ch of str) w += isWide(ch.codePointAt(0)) ? 2 : 1;
  return w;
}

// Pad `str` with trailing spaces to `w` display columns (no-op if already ≥ w).
// Unlike String.padEnd, which counts UTF-16 units, this pads to display width so
// cells holding wide glyphs still line up.
export function padToWidth(str, w) {
  return str + " ".repeat(Math.max(0, w - displayWidth(str)));
}
