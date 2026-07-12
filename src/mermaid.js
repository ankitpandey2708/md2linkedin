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
// Render flowcharts with extra margin around the diagram. LinkedIn intermittently
// shaves a few pixels off the top of a flush diagram on the *first* paste; the
// built-in margin means that lands on whitespace, not the boxes' top border.
// This is mermaid's own render config (default is 8), not a post-hoc image edit.
const DIAGRAM_PADDING = 24;

export async function renderMermaid(source) {
  const res = await fetch(KROKI_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: withPadding(source),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Kroki HTTP ${res.status}${detail ? `: ${detail.slice(0, 120)}` : ""}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

// Prepend a mermaid init directive requesting flowchart padding — unless the
// source already carries its own init config, in which case we respect the
// author's settings and change nothing.
function withPadding(source) {
  if (/%%\{\s*init\s*:/i.test(source)) return source;
  return `%%{init: {'flowchart': {'diagramPadding': ${DIAGRAM_PADDING}}}}%%\n${source}`;
}
