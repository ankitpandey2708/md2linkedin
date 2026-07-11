# md2linkedin

Convert Markdown into LinkedIn-ready output — an **article** or a **carousel**.

LinkedIn keeps no Markdown — no tables, no code blocks, no diagrams — and its surfaces differ:

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
md2li file.md              # article   → clipboard (HTML + embedded images)
md2li file.md --carousel   # carousel  → out/carousel.pdf (upload as a document post)
md2li file.md --save       # (article) also keep the .html file
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

### Auto-theme from a brand (`--brand`)

Generate a starter config from a company's website instead of hand-writing one:

```
md2li --brand realfast.ai      # writes md2linkedin.config.json
```

It reads the brand's identity via [brandkit.dev](https://brandkit.dev) (set `BRANDKIT_KEY` in `.env` or the environment) and maps:

- **colors** → `background` / `foreground` / `accent` (semantic roles + detected light/dark scheme)
- **font** → the detected family, resolved to real Google-Fonts TTFs (bold heading + regular body)
- **logo** → the brand's square icon
- **handle** → derived from the domain (`realfast.ai` → `@realfast`)

Anything it can't determine is omitted, so it falls back to defaults. It **writes a config to review/tweak** — it doesn't render. Then run `--carousel`.

## Output

No file by default (article). `--save` keeps a copy in `out/`. Auto-saved if a clipboard copy fails. `out/` is wiped each run.

```
# article    clipboard: HTML+images (one paste)  | + article.html (--save)
# --carousel out/carousel.pdf  (upload as a document post)
```

## Publishing

**Article** — Write article → click body → Ctrl+V. Prose, code blocks, and images all land in one paste. (The CLI opens the article editor for you.)

**Carousel** — Start a post → document/PDF → upload `out/carousel.pdf`.

## Pipeline

```
input.md → markdown-it tokens
  article → render-article.js → HTML (clipboard), wide-table PNGs base64-embedded
  carousel→ carousel.js       → PDF (pdfkit): selectable text + embedded images
```

Modules: `parse`, `unicode` (`displayWidth`), `table` (`buildAscii` + width), `codeimg` (Shiki + resvg), `mermaid` (Kroki), `carousel` (pdfkit), `config`, `fonts`, `brand` (brandkit), `assets`, `render-article`, `escape`, `clipboard`, `open`, `cli`.

## License

MIT
