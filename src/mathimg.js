// Renders a LaTeX math expression to a crisp PNG so it can be base64-embedded
// like code/tables (LinkedIn has no math surface). We fetch a *vector* SVG from
// CodeCogs — its glyphs are <path>s, no fonts needed — and rasterize it through
// the shared resvg pipeline, so math lands at the same oversampled sharpness as
// code and tables rather than the low-res raster the PNG endpoint returned.
// Best-effort: callers fall back to a code-image of the raw TeX on failure.

import { svgToPng, SCALE } from "./raster.js";

const ENDPOINT = "https://latex.codecogs.com/svg.image?";
// CodeCogs' base font is much smaller than our 32px code font, so it needs a
// larger zoom than SCALE to reach a comparable, readable density.
const MATH_SCALE = SCALE * 2;

export async function renderMath(tex) {
  const res = await fetch(ENDPOINT + encodeURIComponent(`\\bg{white} ${tex}`));
  if (!res.ok) throw new Error(`math service HTTP ${res.status}`);
  const svg = await res.text();
  if (!svg.includes("<svg")) throw new Error("math service did not return an SVG");
  return svgToPng(svg, MATH_SCALE);
}
