// One place to turn an SVG string into a crisp PNG Buffer. Every *vector* image
// the tool generates — code blocks, wide tables, and math — goes through here,
// so they share a single oversampling setting instead of ad-hoc per-source
// resolutions. (Mermaid is the exception: Kroki returns a pre-rasterized PNG
// from a real browser and its SVG uses <foreignObject>, which resvg can't draw,
// so diagrams can't be routed through here.)
//
// `scale` is a zoom multiplier on the SVG's intrinsic pixels. Callers pass a
// scale tuned to their source's base font so output density is comparable:
//   code/tables — SVG built at a 32px font → SCALE (2×)
//   math        — CodeCogs SVG at a small base font → a larger scale to match

import { Resvg } from "@resvg/resvg-js";

export const SCALE = 2; // retina oversample for our 32px-font SVGs

export function svgToPng(svg, scale = SCALE) {
  return new Resvg(svg, {
    fitTo: { mode: "zoom", value: scale },
    font: { loadSystemFonts: true, defaultFontFamily: "Consolas" },
  }).render().asPng();
}
