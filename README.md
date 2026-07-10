# md2linkedin

Convert Markdown into LinkedIn-ready output — a **feed post**, an **article**, or a **carousel**.

LinkedIn keeps no Markdown — no tables, no code blocks, no diagrams — and its surfaces differ:

- **Feed post** — plain text only. Prose faked with **Unicode** (bold/italic/mono); code, tables & **mermaid diagrams** become **images** (bottom gallery, since posts can't inline images). → clipboard.
- **Article** — keeps native prose + a monospace **code block**. Code and narrow tables render as **selectable text**; wide tables and **mermaid diagrams** are **images embedded in the paste** (base64 data-URIs LinkedIn keeps), so one Ctrl+V lands the whole article. → clipboard.
- **Carousel** — a swipeable **PDF document post** (the highest-engagement format). Each Markdown section becomes a slide; prose is **selectable text**, code/tables/diagrams are images. Themeable via `config.json`. → `out/carousel.pdf`.

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
md2li file.md              # feed post → clipboard (plain text)
md2li file.md --article    # article   → clipboard (HTML + embedded images)
md2li file.md --carousel   # carousel  → out/carousel.pdf (upload as a document post)
md2li file.md --save       # (post/article) also keep the .txt/.html file
```

### From source (development)

```
git clone https://github.com/ankitpandey2708/md2linkedin.git
cd md2linkedin
npm install
node src/cli.js file.md   # same flags as above
```

## Diagrams

Fenced ` ```mermaid ` blocks are rendered to real diagram images via the [Kroki](https://kroki.io) service, so this needs a network connection (the diagram source is sent to Kroki). A block is treated as a diagram **only when tagged `mermaid`** — any other fence is a code block. If rendering fails, it falls back to a code image of the source.

## Carousel

`--carousel` builds `out/carousel.pdf` — upload it as a LinkedIn **document post** (the swipeable format).

- **Deterministic paging** — a new slide starts at **every heading** and **every `---`**. Same Markdown → same deck.
- **Roles by position** — first slide = cover, last = closing/CTA, the rest = content. No content guessing; you control the cover and CTA by what you put first and last.
- **Selectable text** — prose is native PDF text (crisp, copyable). Code, tables, and mermaid diagrams embed as images (they're pictures).
- Fonts are fetched once and cached in `~/.md2linkedin/fonts` (network on first use; carousels already use the network for mermaid).

### Theming (`config.json`)

Drop a **`md2linkedin.config.json` next to your `.md` file** to override the default "Editorial" theme. Any subset works — missing keys fall back to defaults; no file means all defaults.

```json
{
  "color": { "background": "#0f1e2e", "foreground": "#eaf0f6", "accent": "#f59e0b", "muted": "#8aa0b4" },
  "font": {
    "heading": "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/ptserif/PT_Serif-Web-Bold.ttf",
    "body": "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/ptsans/PT_Sans-Web-Regular.ttf"
  },
  "identity": { "handle": "@you", "logo": "https://…/avatar.png", "placement": "bottom" },
  "layout": { "ratio": "4:5", "margins": 72, "pageNumber": true }
}
```

Four axes: **color** (background / foreground / accent / muted), **font** (heading & body TTF URLs), **identity** (handle, circular logo, `placement` = `top`\|`bottom`), **layout** (`ratio` = `4:5`\|`1:1`\|`9:16`, margins, pageNumber). Only the carousel uses the theme.

## Output

No file by default (post/article). `--save` keeps a copy in `out/`. Auto-saved if a clipboard copy fails. `out/` is wiped each run.

Exception: **feed-post images** can't ride the clipboard, so code, table & diagram PNGs are always written to `out/assets/` for manual upload.

```
# post      clipboard: text   | out/assets/*.png (upload manually) | + post.txt (--save)
# --article clipboard: HTML+images (one paste)                     | + article.html (--save)
# --carousel out/carousel.pdf  (upload as a document post)
```

## Publishing

**Feed post** — Ctrl+V into the post box. Upload PNGs from `out/assets/`; they gallery at the bottom, and the text has `🖼️ image N below` markers for ordering.

**Article** — Write article → click body → Ctrl+V. Prose, code blocks, and images all land in one paste.

**Carousel** — Start a post → document/PDF → upload `out/carousel.pdf`.

## Pipeline

```
input.md → markdown-it tokens
  post    → render-post.js    → Unicode text (clipboard) + PNG gallery
  article → render-article.js → HTML (clipboard), wide-table PNGs base64-embedded
  carousel→ carousel.js       → PDF (pdfkit): selectable text + embedded images
```

Modules: `parse`, `unicode`, `table` (`buildAscii` + width), `codeimg` (Shiki + resvg), `mermaid` (Kroki), `carousel` (pdfkit), `config`, `fonts`, `assets`, `render-post`, `render-article`, `escape`, `clipboard`, `cli`.

## License

MIT
