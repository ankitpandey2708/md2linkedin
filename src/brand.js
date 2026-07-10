// Scaffolds carousel theme tokens from a brand's site via brandkit.dev, which
// returns semantic color roles (background / text / accent) + a detected color
// scheme, a resolved font family, and logos. That maps almost 1:1 onto our theme
// — no color-role guessing. The detected font family is resolved to real static
// TTFs through the Google Fonts API so pdfkit can embed it (regular body, bold
// heading); if it isn't a Google font, fonts fall back to defaults.
//
// Best-effort: the output is a starting config.json to review, not a render.

const API = "https://brandkit.dev/api/extract";

export async function fetchBrand(url, key) {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, sites: 1, images: false, sse: false, apiKey: key }),
  });
  if (!res.ok) throw new Error(`Brandkit HTTP ${res.status}`);
  return res.json();
}

export async function brandToTheme(data) {
  const b = data.branding || {};
  const c = b.colors || {};
  const theme = {};

  const color = {};
  if (c.background) color.background = c.background;
  if (c.textPrimary) color.foreground = c.textPrimary;
  if (c.accent || c.primary) color.accent = c.accent || c.primary;
  if (Object.keys(color).length) theme.color = color;

  // identity: a square-icon logo + a handle derived from the domain name.
  const logos = data.logos || [];
  const src = (logos.find((l) => l.type === "icon") || logos.find((l) => l.type === "logo") || logos[0])?.formats?.[0]?.src;
  const identity = {};
  if (src) identity.logo = src;
  const handle = handleFromDomain(data.domain);
  if (handle) identity.handle = handle;
  if (Object.keys(identity).length) theme.identity = identity;

  // Resolve the detected font family to real TTFs (Google Fonts).
  const family = b.typography?.fontFamilies?.heading || b.typography?.fontFamilies?.primary || b.fonts?.[0]?.family;
  if (family) {
    const font = await resolveGoogleFont(family);
    if (font) theme.font = font;
  }

  return theme;
}

// Google Fonts' css2 endpoint returns static .ttf URLs (not woff2) when the
// request looks like an old browser. We pull the 400 + 700 weights so headings
// render bold. Returns { heading, body } TTF URLs, or null if not a Google font.
async function resolveGoogleFont(family) {
  const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@400;700`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/4.0" } });
  if (!res.ok) return null;
  const css = await res.text();
  const faces = css.match(/@font-face\s*{[^}]*}/g) || [];
  const pick = (weight) => {
    for (const face of faces) {
      if (face.includes(`font-weight: ${weight}`)) {
        const m = face.match(/url\((https:\/\/[^)]+\.ttf)\)/);
        if (m) return m[1];
      }
    }
    return null;
  };
  const body = pick(400);
  if (!body) return null;
  return { heading: pick(700) || body, body };
}

// Derive a handle from the registrable domain name: realfast.ai → @realfast,
// app.acme.co.uk → @acme (the label before the public suffix, best-effort).
function handleFromDomain(domain) {
  if (!domain) return null;
  const labels = domain.replace(/^www\./, "").split(".");
  const name = labels.length >= 2 ? labels[labels.length - 2] : labels[0];
  return name ? "@" + name.toLowerCase() : null;
}
