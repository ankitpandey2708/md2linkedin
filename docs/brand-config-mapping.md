# Brand → config mapping

How `md2li --brand <domain>` turns a [brandkit.dev](https://brandkit.dev) API
response into a scaffolded `md2linkedin.config.json`. Implemented in
[`src/brand.js`](../src/brand.js) (`brandToTheme()`).

The output is **best-effort scaffolding to review/tweak** — it writes the config,
it does not render. Every field is independently optional: anything not mapped
is omitted, and `config.loadTheme` deep-merges the scaffold over `DEFAULT_THEME`,
so omitted keys inherit their defaults.

## Field mapping

| config field | brandkit source | transform | if missing → default |
|---|---|---|---|
| `color.background` | `branding.colors.background` | copied as-is | `#faf7f2` |
| `color.foreground` | `branding.colors.textPrimary` | renamed `textPrimary` → `foreground` | `#1a1a1a` |
| `color.accent` | `branding.colors.accent`, else `branding.colors.primary` | fallback chain (accent wins) | `#0f766e` |
| `color.muted` | — (never mapped) | — | `#777777` |
| `identity.logo` | `data.logos` → first `type:"icon"`, else `type:"logo"`, else `logos[0]` → `.formats[0].src` | prefer square icon; first format URL | `null` |
| `identity.handle` | `data.domain` | `handleFromDomain()`: strip `www.`, take label before public suffix, lowercase, prefix `@` | `""` |
| `identity.placement` | — (never mapped) | — | `"bottom"` |
| `font.heading` | family: `branding.typography.fontFamilies.heading` → `.primary` → `fonts[0].family` | resolve via Google Fonts css2 → **700-weight** `.ttf` URL | PT Serif Bold |
| `font.body` | same family as heading | resolve via Google Fonts css2 → **400-weight** `.ttf` URL | PT Sans |
| `layout.ratio` | — (never mapped) | — | `"4:5"` |
| `layout.margins` | — (never mapped) | — | `72` |
| `layout.pageNumber` | — (never mapped) | — | `true` |
| `layout.ratios` | — (never mapped) | — | `4:5`, `1:1`, `9:16` |

## Notes

- **Two data sources.** Colors, logo, and domain come from **brandkit**; the
  actual font `.ttf` URLs come from a **second call to Google Fonts** — brandkit
  only supplies the family *name*.
- **Non-Google fonts.** If the detected family isn't on Google Fonts,
  `resolveGoogleFont` returns `null` and `theme.font` is omitted entirely
  (→ PT Serif / PT Sans defaults).
- **Font weight fallback.** `heading` (700) falls back to `body` (400); if the
  400 weight is missing, the whole `font` block is dropped.
- **Section gating.** `theme.color` and `theme.identity` are only written when
  at least one of their fields was found.
- **Request params.** `fetchBrand` sends `sites: 1, images: false, sse: false`
  — a single-site extraction with no image crawl.
- **Never inferred.** `color.muted`, `identity.placement`, and all of `layout.*`
  are always left to defaults; brandkit has no notion of slide dimensions.
