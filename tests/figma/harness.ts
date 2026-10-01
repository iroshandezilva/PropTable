// Test-only bundle for running the reader and renderer inside Figma via the
// MCP use_figma tool, which can't use plugin data. Not shipped.
import { FULL_READ, readComponent } from "../../src/figmaAdapter";
import { diff } from "../../src/model/diff";
import { extract } from "../../src/model/extract";
import { lint } from "../../src/model/lint";
import { DEFAULT_SETTINGS, Settings, Snapshot } from "../../src/model/types";
import { buildTable } from "../../src/render/table";
import { buildOverview } from "../../src/render/overview";
import { loadFonts, palette } from "../../src/render/theme";

export async function render(id: string, overrides: Partial<Settings> = {}, previous: Snapshot | null = null, notes: Record<string, string> = {}) {
  const target = await figma.getNodeByIdAsync(id);
  if (!target || (target.type !== "COMPONENT" && target.type !== "COMPONENT_SET")) throw new Error("not a component");
  const settings = { ...DEFAULT_SETTINGS, ...overrides };
  const { fonts, warning } = await loadFonts(settings.font);
  const ctx = { fonts, colors: palette(settings) };
  const doc = extract(await readComponent(target, FULL_READ), settings.typeOrder);
  const issues = lint(doc);
  const table = await buildTable({ doc, settings, ctx, changes: diff(doc, previous), issues, notes, builtAt: new Date() });
  return { table, doc, issues, warning };
}

export async function overview(rows: Parameters<typeof buildOverview>[1]) {
  const { fonts } = await loadFonts("Inter");
  return buildOverview({ fonts, colors: palette(DEFAULT_SETTINGS) }, rows, new Date());
}
