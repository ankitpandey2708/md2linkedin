// Maps ASCII letters/digits to Unicode "Mathematical Alphanumeric" variants.
// LinkedIn renders plain text only in feed posts, so these Unicode code points
// are how we fake bold / italic / monospace. Characters without a variant
// (punctuation, symbols) pass through unchanged.

const A = 0x41; // 'A'
const Z = 0x5a; // 'Z'
const a = 0x61; // 'a'
const z = 0x7a; // 'z'
const zero = 0x30; // '0'
const nine = 0x39; // '9'

// Base code points for each style's 'A', 'a', and '0'.
const STYLES = {
  bold: { upper: 0x1d400, lower: 0x1d41a, digit: 0x1d7ce },
  italic: { upper: 0x1d434, lower: 0x1d44e, digit: null }, // no italic digits
  boldItalic: { upper: 0x1d468, lower: 0x1d482, digit: null },
  monospace: { upper: 0x1d670, lower: 0x1d68a, digit: 0x1d7f6 },
};

// A few code points in the math ranges are "holes" (reserved) and live
// elsewhere in Unicode. Italic 'h' is the best-known case.
const HOLES = {
  italic: { h: 0x210e }, // PLANCK CONSTANT
};

function mapChar(ch, styleName) {
  const style = STYLES[styleName];
  const code = ch.codePointAt(0);

  if (HOLES[styleName] && HOLES[styleName][ch] !== undefined) {
    return String.fromCodePoint(HOLES[styleName][ch]);
  }
  if (code >= A && code <= Z) {
    return String.fromCodePoint(style.upper + (code - A));
  }
  if (code >= a && code <= z) {
    return String.fromCodePoint(style.lower + (code - a));
  }
  if (code >= zero && code <= nine && style.digit !== null) {
    return String.fromCodePoint(style.digit + (code - zero));
  }
  return ch; // passthrough
}

function mapString(str, styleName) {
  let out = "";
  for (const ch of str) out += mapChar(ch, styleName);
  return out;
}

export const toBold = (s) => mapString(s, "bold");
export const toItalic = (s) => mapString(s, "italic");
export const toBoldItalic = (s) => mapString(s, "boldItalic");
export const toMonospace = (s) => mapString(s, "monospace");

// Count display columns by Unicode code points, not UTF-16 units. The math
// glyphs are astral (surrogate pairs), so `.length` double-counts them.
export const codePointLength = (str) => Array.from(str).length;
