# md2linkedin

Convert Markdown into LinkedIn-ready output, copied straight to the clipboard.

LinkedIn keeps no Markdown, no tables, no code blocks — and its two surfaces differ:

- **Feed post** — plain text only. Prose faked with **Unicode** (bold/italic/mono); code & tables become **images** (bottom gallery, since posts can't inline images).
- **Article** — keeps native prose + a monospace **code block**. Code and narrow tables render as **selectable text**; wide tables are **images embedded in the paste** (base64 data-URIs LinkedIn keeps), so one Ctrl+V lands the whole article, no upload.

## Requirements

Node 18+.

## Setup

```
git clone https://github.com/ankitpandey2708/md2linkedin.git
cd md2linkedin
npm install
```

## Usage

```
node src/cli.js file.md            # feed post → clipboard (plain text)
node src/cli.js file.md --article  # article   → clipboard (HTML + embedded images)
node src/cli.js file.md --save      # also keep the .txt/.html file
```

The clipboard is the deliverable — just paste. Table width is auto-handled against a fixed LinkedIn-mobile budget.

## Output

No file by default. `--save` keeps a copy in `out/` (a self-contained `article.html` also works as a browser preview). Auto-saved if a clipboard copy fails. `out/` is wiped each run.

Exception: **feed-post images** can't ride the clipboard, so code/table PNGs are always written to `out/assets/` for manual upload.

```
# post      clipboard: text   | out/assets/*.png (upload manually) | + post.txt (--save)
# --article clipboard: HTML+images (one paste)                     | + article.html (--save)
```

## Publishing

**Feed post** — Ctrl+V into the post box. Upload PNGs from `out/assets/`; they gallery at the bottom, and the text has `🖼️ image N below` markers for ordering.

**Article** — Write article → click body → Ctrl+V. Prose, code blocks, and images all land in one paste.

## Pipeline

```
input.md → markdown-it tokens
  post    → render-post.js    → Unicode text (clipboard) + PNG gallery
  article → render-article.js → HTML (clipboard), wide-table PNGs base64-embedded
```

Modules: `parse`, `unicode`, `table` (`buildAscii` + width), `codeimg` (Shiki + resvg), `assets`, `render-post`, `render-article`, `escape`, `clipboard`, `cli`.

## License

MIT
