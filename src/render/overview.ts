import { Ctx, appendFill, bottomBorder, hstack, icon, sectionLabel, solid, text, vstack } from "./primitives";

export interface OverviewRow {
  id: string;
  name: string;
  page: string;
  props: number;
  variants: number;
  hasDescription: boolean;
  hasDocLink: boolean;
  warnings: number;
}

const COLS: [string, number][] = [
  ["Component", 280],
  ["Page", 180],
  ["Properties", 110],
  ["Variants", 100],
  ["Description", 120],
  ["Doc link", 110],
  ["Warnings", 110],
];

export function buildOverview(ctx: Ctx, rows: OverviewRow[], builtAt: Date): FrameNode {
  const c = ctx.colors;
  const width = COLS.reduce((s, [, w]) => s + w, 0);
  const card = vstack({ name: "PropTable Overview", padding: 43, gap: 24, width: width + 86, fill: c.bg });
  card.cornerRadius = 29;
  card.strokes = solid(c.accent);
  card.strokeWeight = 2;
  card.strokeAlign = "INSIDE";
  card.dashPattern = [8, 8];

  const title = hstack({ name: "Title", gap: 8 });
  title.appendChild(icon(ctx, "COMPONENT", 24));
  title.appendChild(text(ctx, "Component overview", { size: 24, lineHeight: 28, weight: "semibold" }));
  card.appendChild(title);

  const documented = rows.filter((r) => r.hasDescription && r.hasDocLink).length;
  card.appendChild(
    text(ctx, `${rows.length} components · ${documented} fully documented · Updated ${builtAt.toISOString().slice(0, 10)}`, {
      size: 13,
      color: c.textMuted,
    })
  );

  const table = vstack({ name: "Table" });
  const header = hstack({ name: "Row: Header", fill: c.bg });
  bottomBorder(header, c.border);
  for (const [label, w] of COLS) {
    const cell = vstack({ name: "Cell", padding: [12, 8], width: w });
    appendFill(cell, sectionLabel(ctx, label));
    header.appendChild(cell);
  }
  appendFill(table, header);

  if (rows.length === 0) {
    const empty = hstack({ name: "Row: Empty", padding: [12, 8] });
    empty.appendChild(text(ctx, "No components in this file", { color: c.textMuted }));
    appendFill(table, empty);
  }

  for (const r of rows) {
    const line = hstack({ name: `Row: ${r.name}`, fill: c.bg });
    bottomBorder(line, c.border);
    const values: [string, RGB, HyperlinkTarget?][] = [
      [r.name, c.linkText, { type: "NODE", value: r.id }],
      [r.page, c.textMuted],
      [String(r.props), c.text],
      [r.variants ? String(r.variants) : "—", c.text],
      [r.hasDescription ? "✓" : "✗", r.hasDescription ? c.newText : c.warnText],
      [r.hasDocLink ? "✓" : "✗", r.hasDocLink ? c.newText : c.warnText],
      [r.warnings ? `⚠ ${r.warnings}` : "0", r.warnings ? c.warnText : c.textMuted],
    ];
    values.forEach(([value, color, link], i) => {
      const cell = vstack({ name: "Cell", padding: [10, 8], width: COLS[i][1] });
      appendFill(cell, text(ctx, value, { size: 13, lineHeight: 20, color, link, weight: i === 0 ? "medium" : "regular" }));
      line.appendChild(cell);
      cell.layoutSizingVertical = "FILL";
    });
    appendFill(table, line);
  }
  appendFill(card, table);
  return card;
}
