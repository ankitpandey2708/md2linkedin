// Shared vocabulary for rendered block assets (code fences, tables).
//
// One asset per code block / table, built once in cli.js and read by both
// renderers. The per-surface rendering follows from evidence about what
// actually survives on LinkedIn:
//
//                     post (feed, no code block)   article (has code block)
//   CODE              image                        code block (selectable)
//   TABLE (narrow)    image                        code block (aligned ASCII)
//   TABLE (wide)      image                        image
//
// (A "narrow" table is one whose ASCII width fits WIDTH_BUDGET; wider tables
//  wrap inside LinkedIn's code block and lose alignment, so they become images.
//  The feed has no monospace surface at all, so post tables are always images.)

export const CODE = "code";
export const TABLE = "table";
export const DIAGRAM = "diagram"; // ```mermaid → rendered diagram image
