// Escape text for embedding in HTML/XML markup (both the article HTML and the
// SVG code image). Escaping " as well as &<> makes the result safe inside
// attribute values (e.g. href="..."), not just element text.
export function escapeMarkup(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
