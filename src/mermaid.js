// Renders a mermaid diagram to a PNG Buffer via the Kroki service
// (https://kroki.io). Mermaid needs a browser engine to lay out diagrams, so we
// offload rendering rather than bundle a headless browser — keeping the install
// lightweight. Throws on failure; the caller falls back to a code-image
// screenshot of the source so a bad diagram never breaks a run.
//
// Resolution note: this is the one image the tool can't oversample. Kroki
// ignores scale options for mermaid (PNG comes back at the diagram's native
// size), and its SVG uses <foreignObject> for labels, which resvg can't
// rasterize — so unlike code/tables/math it can't go through raster.js. It's
// therefore rendered at Kroki's native density; the only way to sharpen it
// would be bundling a headless browser, which this tool deliberately avoids.

const KROKI_URL = "https://kroki.io/mermaid/png";

export async function renderMermaid(source) {
  const res = await fetch(KROKI_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: source,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Kroki HTTP ${res.status}${detail ? `: ${detail.slice(0, 120)}` : ""}`);
  }
  return Buffer.from(await res.arrayBuffer());
}
