// Renders a mermaid diagram to a PNG Buffer via the Kroki service
// (https://kroki.io). Mermaid needs a browser engine to lay out diagrams, so we
// offload rendering rather than bundle a headless browser — keeping the install
// lightweight. Throws on failure; the caller falls back to a code-image
// screenshot of the source so a bad diagram never breaks a run.

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
