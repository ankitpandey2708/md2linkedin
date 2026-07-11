// Shared vocabulary for rendered block assets (code fences, tables).
//
// One asset per code block / table, built once in cli.js and read by the
// article renderer. The rendering follows from evidence about what actually
// survives on LinkedIn's article editor (which keeps a monospace code block):
//
//   CODE              code block (selectable)
//   TABLE (narrow)    code block (aligned ASCII)
//   TABLE (wide)      image (base64-embedded inline)
//
// (A "narrow" table is one whose ASCII width fits WIDTH_BUDGET; wider tables
//  wrap inside LinkedIn's code block and lose alignment, so they become images.)

export const CODE = "code";
export const TABLE = "table";
export const DIAGRAM = "diagram"; // ```mermaid → rendered diagram image
