// Draws the documentation card for one component.

import { groupTokens } from "../model/extract";
import { TYPE_LABELS } from "../model/export";
import { truncate } from "../model/names";
import { ComponentDoc, DiffResult, LintIssue, PropDoc, Settings, VariantDoc, propId } from "../model/types";
import { NOTE_PLACEHOLDER, NOTE_PREFIX, REMOVED_NOTE_PREFIX } from "../storage";
import { IconName, toggleSvg } from "./icons";
import {
  Ctx,
  appendFill,
  badge,
  bottomBorder,
  docLinkBadge,
  hstack,
  icon,
  sectionLabel,
  solid,
  tag,
  text,
  vstack,
} from "./primitives";
import { rgbToHex } from "./theme";

const COL = { prop: 200, type: 150, default: 400, notes: 240 };
const VARIANT_COL = { preview: 184, name: 240 };
const ROW_MIN = 42;
const CARD_PAD = 43;
const MAX_TEXT_DEFAULT = 120;
const MAX_VARIANTS = 50;
const PREVIEW_MAX = { w: 160, h: 80 };

export interface TableInput {
  doc: ComponentDoc;
  settings: Settings;
  ctx: Ctx;
  changes: DiffResult;
  issues: LintIssue[];
  notes: Record<string, string>;
  builtAt: Date;
}

export async function buildTable(input: TableInput): Promise<FrameNode> {
  const { doc, settings, ctx } = input;
  const c = ctx.colors;
  const width = tableWidth(settings);

  const card = vstack({ name: `${doc.name} Properties`, padding: CARD_PAD, gap: 40, width: width + CARD_PAD * 2, fill: c.bg });
  card.strokes = solid(c.accent);
  card.strokeWeight = 2;
  card.strokeAlign = "INSIDE";
  card.dashPattern = [8, 8];
  card.cornerRadius = 29;

  appendFill(card, buildHeader(input));
  appendFill(card, buildPropsTable(input));

  if (settings.changeMarks && input.changes.removed.length) {
    appendFill(
      card,
      text(ctx, `Removed since last update: ${input.changes.removed.join(", ")}`, { size: 13, color: c.textMuted, name: "Removed properties" })
    );
  }

  const removedNotes = orphanNotes(input);
  if (removedNotes.length) appendFill(card, buildRemovedNotes(ctx, removedNotes));

  if (settings.sections.variants && doc.kind === "COMPONENT_SET") {
    const section = await buildVariants(input);
    if (section) appendFill(card, section);
  }

  if (settings.sections.tokens && doc.tokens.length) appendFill(card, buildTokens(input));

  return card;
}

function tableWidth(s: Settings): number {
  return COL.prop + (s.columns.type ? COL.type : 0) + (s.columns.default ? COL.default : 0) + (s.columns.notes ? COL.notes : 0);
}

// --- Header ---

function buildHeader({ doc, ctx, issues, settings, builtAt }: TableInput): FrameNode {
  const c = ctx.colors;
  const header = vstack({ name: "Header", gap: 16, padding: [0, 8] });

  const title = hstack({ name: "Title Line", gap: 8 });
  title.appendChild(icon(ctx, "COMPONENT", 24));
  title.appendChild(text(ctx, `${doc.name} properties`, { size: 24, lineHeight: 28, weight: "semibold" }));
  if (doc.remote) title.appendChild(badge(ctx, "Library", c.linkBg, c.linkText));
  header.appendChild(title);

  header.appendChild(text(ctx, `Updated ${builtAt.toISOString().slice(0, 10)}`, { size: 12, lineHeight: 16, color: c.textMuted, name: "Updated" }));

  const componentIssues = settings.lintMarks ? issues.filter((i) => !i.prop) : [];
  if (doc.description || doc.docLinks.length || componentIssues.length) {
    const box = vstack({ name: "Description Box", gap: 16, padding: 20, radius: 20, fill: c.surface, stroke: c.surfaceBorder });
    if (doc.description) {
      const desc = vstack({ name: "Description Content", gap: 4 });
      desc.appendChild(sectionLabel(ctx, "Description"));
      appendFill(desc, text(ctx, doc.description, { lineHeight: 20, color: c.textMuted }));
      appendFill(box, desc);
    }
    if (doc.docLinks.length) {
      const links = hstack({ name: "Doc Links", gap: 8, wrap: true });
      doc.docLinks.forEach((uri, i) => links.appendChild(docLinkBadge(ctx, uri, doc.docLinks.length > 1 ? `Documentation ${i + 1}` : "Documentation")));
      appendFill(box, links);
    }
    for (const issue of componentIssues) appendFill(box, warning(ctx, issue.message));
    appendFill(header, box);
  }
  return header;
}

function warning(ctx: Ctx, message: string): FrameNode {
  const row = hstack({ name: "Lint", gap: 4, align: "MIN" });
  row.appendChild(icon(ctx, "WARN", 14, ctx.colors.warnText));
  row.appendChild(text(ctx, message, { size: 12, lineHeight: 16, color: ctx.colors.warnText }));
  return row;
}

// --- Properties table ---

function row(name: string, ctx: Ctx, fill?: RGB): FrameNode {
  const r = hstack({ name: `Row: ${name}`, align: "MIN", fill: fill ?? ctx.colors.bg });
  r.minHeight = ROW_MIN;
  bottomBorder(r, ctx.colors.border);
  return r;
}

/** Add a cell to a row. Without a width it fills the remaining space. */
function cell(r: FrameNode, width?: number, padLeft = 8): FrameNode {
  const c = vstack({ name: "Cell", gap: 4, padding: [8, 8, 8, padLeft], width });
  c.primaryAxisAlignItems = "CENTER";
  r.appendChild(c);
  c.layoutSizingVertical = "FILL";
  if (width === undefined) c.layoutSizingHorizontal = "FILL";
  return c;
}

function buildPropsTable(input: TableInput): FrameNode {
  const { doc, ctx, settings } = input;
  const cols = settings.columns;
  const table = vstack({ name: "Table" });

  const header = row("Header", ctx);
  const headers: [string, number | undefined][] = [["Property", COL.prop]];
  if (cols.type) headers.push(["Type", COL.type]);
  if (cols.default) headers.push(["Default / Options", undefined]);
  if (cols.notes) headers.push(["Notes", cols.default ? COL.notes : undefined]);
  if (!cols.default && !cols.notes) headers[headers.length - 1][1] = undefined;
  for (const [label, w] of headers) appendFill(cell(header, w), sectionLabel(ctx, label));
  header.minHeight = 48;
  appendFill(table, header);

  const props = settings.sections.nested ? doc.props : doc.props.filter((p) => !p.nestedPath);
  if (props.length === 0) {
    const empty = row("Empty", ctx);
    appendFill(cell(empty), text(ctx, "No properties defined", { color: ctx.colors.textMuted }));
    appendFill(table, empty);
    return table;
  }

  let currentGroup: string | undefined;
  for (const p of props) {
    if (p.nestedPath !== currentGroup) {
      currentGroup = p.nestedPath;
      if (currentGroup) {
        const sub = row(`Nested: ${currentGroup}`, ctx, ctx.colors.surface);
        appendFill(cell(sub), text(ctx, `↳ ${currentGroup} (nested)`, { size: 13, weight: "medium", color: ctx.colors.textMuted }));
        appendFill(table, sub);
      }
    }
    appendFill(table, buildPropRow(input, p, headers));
  }
  return table;
}

function buildPropRow(input: TableInput, p: PropDoc, headers: [string, number | undefined][]): FrameNode {
  const { ctx, settings } = input;
  const c = ctx.colors;
  const id = propId(p);
  const r = row(id, ctx);
  const width = (label: string) => headers.find((h) => h[0] === label)?.[1];

  // Property name, change badge, lint
  const nameCell = cell(r, width("Property"), p.nestedPath ? 24 : 8);
  appendFill(nameCell, text(ctx, p.name, { lineHeight: 22 }));
  const mark = settings.changeMarks ? input.changes.marks[id] : undefined;
  if (mark === "new") nameCell.appendChild(badge(ctx, "New", c.newBg, c.newText));
  if (mark === "changed") nameCell.appendChild(badge(ctx, "Changed", c.changedBg, c.changedText));
  if (settings.lintMarks) {
    for (const issue of input.issues.filter((i) => i.prop === id)) appendFill(nameCell, warning(ctx, issue.message));
  }

  if (settings.columns.type) {
    const typeCell = cell(r, width("Type"));
    const line = hstack({ name: "Type", gap: 8 });
    line.appendChild(icon(ctx, p.type as IconName, 16));
    line.appendChild(text(ctx, TYPE_LABELS[p.type], { lineHeight: 22 }));
    typeCell.appendChild(line);
  }

  if (settings.columns.default) {
    const valueCell = cell(r, width("Default / Options"));
    fillValue(ctx, valueCell, p);
  }

  if (settings.columns.notes) {
    const notesCell = cell(r, width("Notes"));
    const note = input.notes[id];
    appendFill(
      notesCell,
      text(ctx, note ?? NOTE_PLACEHOLDER, { size: 13, lineHeight: 20, color: note ? c.text : c.placeholder, name: `${NOTE_PREFIX}${id}` })
    );
  }
  return r;
}

function fillValue(ctx: Ctx, cellNode: FrameNode, p: PropDoc): void {
  const c = ctx.colors;
  switch (p.type) {
    case "VARIANT": {
      const tags = hstack({ name: "Options", gap: 4, wrap: true });
      for (const o of p.options ?? []) tags.appendChild(tag(ctx, o, o === String(p.defaultValue)));
      appendFill(cellNode, tags);
      break;
    }
    case "BOOLEAN": {
      const on = p.defaultValue === true;
      const line = hstack({ name: "Toggle", gap: 6 });
      const toggle = figma.createNodeFromSvg(toggleSvg(on, rgbToHex(c.toggleOn), rgbToHex(c.toggleOff)));
      toggle.name = "Toggle";
      line.appendChild(toggle);
      line.appendChild(text(ctx, on ? "True" : "False", { lineHeight: 22 }));
      cellNode.appendChild(line);
      break;
    }
    case "TEXT": {
      const full = String(p.defaultValue);
      const shown = full.trim() ? truncate(full, MAX_TEXT_DEFAULT) : "(empty)";
      appendFill(cellNode, text(ctx, shown, { lineHeight: 22, color: full.trim() ? c.text : c.textMuted, name: `Default: ${truncate(full, 500)}` }));
      break;
    }
    case "INSTANCE_SWAP": {
      const tags = hstack({ name: "Instances", gap: 4, wrap: true });
      tags.appendChild(icon(ctx, "INSTANCE", 16));
      const defaultName = p.defaultName ?? "Library component";
      tags.appendChild(tag(ctx, defaultName, true));
      for (const pref of p.preferred ?? []) {
        if (pref.name !== defaultName) tags.appendChild(tag(ctx, pref.name));
      }
      appendFill(cellNode, tags);
      break;
    }
    case "SLOT":
      appendFill(cellNode, text(ctx, "Slot content", { lineHeight: 22, color: c.textMuted }));
      break;
  }
}

// --- Notes for removed properties ---

function orphanNotes({ doc, notes }: TableInput): [string, string][] {
  const ids = new Set(doc.props.map(propId));
  return Object.entries(notes).filter(([id]) => !ids.has(id));
}

function buildRemovedNotes(ctx: Ctx, notes: [string, string][]): FrameNode {
  const box = vstack({ name: "Notes for removed properties", gap: 8, padding: 16, radius: 12, fill: ctx.colors.surface, stroke: ctx.colors.surfaceBorder });
  box.appendChild(sectionLabel(ctx, "Notes for removed properties"));
  for (const [id, note] of notes) {
    const item = vstack({ name: id, gap: 2 });
    appendFill(item, text(ctx, id, { size: 12, lineHeight: 16, weight: "medium", color: ctx.colors.textMuted }));
    appendFill(item, text(ctx, note, { size: 13, lineHeight: 20, name: `${REMOVED_NOTE_PREFIX}${id}` }));
    appendFill(box, item);
  }
  return box;
}

// --- Variants section ---

async function buildVariants(input: TableInput): Promise<FrameNode | null> {
  const { doc, ctx, settings } = input;
  const withPreviews = settings.sections.previews;
  const listed = withPreviews ? doc.variants : doc.variants.filter((v) => v.description.trim() || v.docLinks.length);
  if (listed.length === 0) return null;

  const shown = listed.slice(0, MAX_VARIANTS);
  const previews = withPreviews ? await exportPreviews(shown) : new Map<string, PreviewImage | null>();

  const section = vstack({ name: "Variants", gap: 12 });
  section.appendChild(sectionLabel(ctx, "Variants"));
  const table = vstack({ name: "Variant Table" });
  const header = row("Header", ctx);
  if (withPreviews) appendFill(cell(header, VARIANT_COL.preview), sectionLabel(ctx, "Preview"));
  appendFill(cell(header, VARIANT_COL.name), sectionLabel(ctx, "Variant"));
  appendFill(cell(header), sectionLabel(ctx, "Description"));
  appendFill(table, header);

  for (const v of shown) appendFill(table, buildVariantRow(ctx, v, withPreviews, previews.get(v.id)));
  appendFill(section, table);

  if (listed.length > shown.length) {
    section.appendChild(text(ctx, `+${listed.length - shown.length} more variants not shown`, { size: 13, color: ctx.colors.textMuted }));
  }
  return section;
}

interface PreviewImage {
  hash: string;
  width: number;
  height: number;
}

async function exportPreviews(variants: VariantDoc[]): Promise<Map<string, PreviewImage | null>> {
  const result = new Map<string, PreviewImage | null>();
  const chunk = 8;
  for (let i = 0; i < variants.length; i += chunk) {
    await Promise.all(
      variants.slice(i, i + chunk).map(async (v) => {
        try {
          const node = await figma.getNodeByIdAsync(v.id);
          if (!node || node.type !== "COMPONENT") throw new Error("missing");
          const scale = Math.min(1, PREVIEW_MAX.w / node.width, PREVIEW_MAX.h / node.height);
          const width = Math.max(1, Math.round(node.width * scale));
          const height = Math.max(1, Math.round(node.height * scale));
          const bytes = await node.exportAsync({ format: "PNG", constraint: { type: "SCALE", value: scale * 2 } });
          result.set(v.id, { hash: figma.createImage(bytes).hash, width, height });
        } catch {
          result.set(v.id, null);
        }
      })
    );
  }
  return result;
}

function buildVariantRow(ctx: Ctx, v: VariantDoc, withPreview: boolean, preview: PreviewImage | null | undefined): FrameNode {
  const c = ctx.colors;
  const r = row(v.name, ctx);
  if (withPreview) {
    const pc = cell(r, VARIANT_COL.preview);
    const box = figma.createFrame();
    box.name = "Preview";
    if (preview) {
      box.resize(preview.width, preview.height);
      box.fills = [{ type: "IMAGE", imageHash: preview.hash, scaleMode: "FIT" }];
    } else {
      box.resize(PREVIEW_MAX.w, 40);
      box.fills = solid(c.surface);
      box.cornerRadius = 6;
    }
    pc.appendChild(box);
  }
  appendFill(cell(r, VARIANT_COL.name), text(ctx, v.name, { size: 13, lineHeight: 20 }));
  const dc = cell(r);
  if (v.description.trim()) appendFill(dc, text(ctx, v.description, { size: 13, lineHeight: 20, color: c.textMuted }));
  else appendFill(dc, text(ctx, "No description", { size: 13, lineHeight: 20, color: c.placeholder }));
  if (v.docLinks.length) {
    const links = hstack({ name: "Doc Links", gap: 8, wrap: true });
    v.docLinks.forEach((uri) => links.appendChild(docLinkBadge(ctx, uri)));
    appendFill(dc, links);
  }
  return r;
}

// --- Tokens section ---

function buildTokens({ doc, ctx }: TableInput): FrameNode {
  const section = vstack({ name: "Tokens", gap: 12 });
  section.appendChild(sectionLabel(ctx, "Tokens"));
  const table = vstack({ name: "Token Table" });
  for (const group of groupTokens(doc.tokens)) {
    const sub = row(`Collection: ${group.collection}`, ctx, ctx.colors.surface);
    appendFill(cell(sub), text(ctx, group.collection, { size: 13, weight: "medium", color: ctx.colors.textMuted }));
    appendFill(table, sub);
    for (const item of group.items) {
      const r = row(item.variable, ctx);
      appendFill(cell(r, COL.prop + COL.type), text(ctx, item.variable, { size: 13, lineHeight: 20, weight: "medium" }));
      appendFill(cell(r), text(ctx, item.uses, { size: 13, lineHeight: 20, color: ctx.colors.textMuted }));
      appendFill(table, r);
    }
  }
  appendFill(section, table);
  return section;
}
