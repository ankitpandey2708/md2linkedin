# md2linkedin

Convert Markdown into LinkedIn-ready output, copied straight to the clipboard.

LinkedIn keeps no Markdown — no tables, no code blocks, no diagrams — and its two surfaces differ:

- **Feed post** — plain text only. Prose faked with **Unicode** (bold/italic/mono); code, tables & **mermaid diagrams** become **images** (bottom gallery, since posts can't inline images).
- **Article** — keeps native prose + a monospace **code block**. Code and narrow tables render as **selectable text**; wide tables and **mermaid diagrams** are **images embedded in the paste** (base64 data-URIs LinkedIn keeps), so one Ctrl+V lands the whole article, no upload.

## Requirements

Node 20+.

## Install

```
npm install -g md2linkedin        # then use the `md2li` command anywhere
```

Or run without installing:

```
npx md2linkedin file.md
```

## Usage

```
md2li file.md            # feed post → clipboard (plain text)
md2li file.md --article  # article   → clipboard (HTML + embedded images)
md2li file.md --save     # also keep the .txt/.html file
```

### From source (development)

```
git clone https://github.com/ankitpandey2708/md2linkedin.git
cd md2linkedin
npm install
node src/cli.js file.md   # same flags as above
```

The clipboard is the deliverable — just paste. Table width is auto-handled against a fixed LinkedIn-mobile budget.

## Diagrams

Fenced ` ```mermaid ` blocks are rendered to real diagram images via the [Kroki](https://kroki.io) service, so this needs a network connection (the diagram source is sent to Kroki). A block is treated as a diagram **only when tagged `mermaid`** — any other fence is a code block. If rendering fails, it falls back to a code image of the source.

## Output

No file by default. `--save` keeps a copy in `out/` (a self-contained `article.html` also works as a browser preview). Auto-saved if a clipboard copy fails. `out/` is wiped each run.

Exception: **feed-post images** can't ride the clipboard, so code, table & diagram PNGs are always written to `out/assets/` for manual upload.

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

Modules: `parse`, `unicode`, `table` (`buildAscii` + width), `codeimg` (Shiki + resvg), `mermaid` (Kroki), `assets`, `render-post`, `render-article`, `escape`, `clipboard`, `cli`.

## License

MIT
