// Puts rich HTML on the OS clipboard so pasting into the LinkedIn article editor
// yields formatted text. Uses @crosscopy/clipboard — a native, cross-platform
// (Windows/macOS/Linux) addon that builds the platform-correct clipboard format
// from an HTML string (CF_HTML on Windows, public.html on macOS, text/html on
// Linux). Best-effort: callers still write article.html to disk as a fallback.

import { setHtml, setText } from "@crosscopy/clipboard";

// Put the fragment on the clipboard as rich HTML. Returns true on success.
export async function copyHtml(fragment) {
  try {
    await setHtml(fragment);
    return true;
  } catch {
    return false;
  }
}

// Put plain text on the clipboard. Used for the feed post: the Unicode
// bold/italic glyphs ARE the content (the feed box is plain-text only), so this
// just skips the open-file-and-copy step. Returns true on success.
export async function copyText(text) {
  try {
    await setText(text);
    return true;
  } catch {
    return false;
  }
}
