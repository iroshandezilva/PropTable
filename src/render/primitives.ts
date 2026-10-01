// Small building blocks for drawing auto-layout frames on the canvas.

import { IconName, SVG_ICONS } from "./icons";
import { Fonts, Palette, rgbToHex } from "./theme";

export interface Ctx {
  fonts: Fonts;
  colors: Palette;
}

type Weight = "regular" | "medium" | "semibold";

export interface TextOpts {
  size?: number;
  lineHeight?: number;
  weight?: Weight;
  color?: RGB;
  upper?: boolean;
  name?: string;
  link?: HyperlinkTarget;
}

export function solid(color: RGB): SolidPaint[] {
  return [{ type: "SOLID", color }];
}

export function text(ctx: Ctx, characters: string, opts: TextOpts = {}): TextNode {
  const t = figma.createText();
  t.fontName = ctx.fonts[opts.weight ?? "regular"];
  t.characters = characters;
  t.fontSize = opts.size ?? 14;
  t.lineHeight = { value: opts.lineHeight ?? Math.round((opts.size ?? 14) * 1.55), unit: "PIXELS" };
  t.fills = solid(opts.color ?? ctx.colors.text);
  if (opts.upper) t.textCase = "UPPER";
  if (opts.name) t.name = opts.name;
  if (opts.link) t.hyperlink = opts.link;
  return t;
}

export interface StackOpts {
  name?: string;
  gap?: number;
  padding?: number | [number, number] | [number, number, number, number];
  width?: number; // fixed width; otherwise hug
  wrap?: boolean;
  align?: "MIN" | "CENTER" | "MAX";
  fill?: RGB;
  radius?: number;
  stroke?: RGB;
}

function frame(direction: "HORIZONTAL" | "VERTICAL", opts: StackOpts): FrameNode {
  const f = figma.createFrame();
  f.name = opts.name ?? (direction === "HORIZONTAL" ? "Row" : "Column");
  f.layoutMode = direction;
  f.itemSpacing = opts.gap ?? 0;
  const p = opts.padding ?? 0;
  const [top, right, bottom, left] =
    typeof p === "number" ? [p, p, p, p] : p.length === 2 ? [p[0], p[1], p[0], p[1]] : p;
  f.paddingTop = top;
  f.paddingRight = right;
  f.paddingBottom = bottom;
  f.paddingLeft = left;
  f.fills = opts.fill ? solid(opts.fill) : [];
  if (opts.radius) f.cornerRadius = opts.radius;
  if (opts.stroke) {
    f.strokes = solid(opts.stroke);
    f.strokeWeight = 1;
    f.strokeAlign = "INSIDE";
  }
  if (opts.wrap) {
    f.layoutWrap = "WRAP";
    f.counterAxisSpacing = opts.gap ?? 0;
  }
  f.counterAxisAlignItems = opts.align ?? (direction === "HORIZONTAL" ? "CENTER" : "MIN");
  if (opts.width !== undefined) {
    f.resize(opts.width, 10);
    f.layoutSizingHorizontal = "FIXED";
  } else {
    f.layoutSizingHorizontal = "HUG";
  }
  f.layoutSizingVertical = "HUG";
  f.clipsContent = false;
  return f;
}

export const hstack = (opts: StackOpts = {}) => frame("HORIZONTAL", opts);
export const vstack = (opts: StackOpts = {}) => frame("VERTICAL", opts);

/** Append a child and make it fill the parent's width. */
export function appendFill(parent: FrameNode, child: SceneNode): void {
  parent.appendChild(child);
  // Text must wrap by height before it can fill; otherwise it collapses.
  if (child.type === "TEXT") child.textAutoResize = "HEIGHT";
  if ("layoutSizingHorizontal" in child) child.layoutSizingHorizontal = "FILL";
}

export function icon(ctx: Ctx, name: IconName, size = 16, color?: RGB): FrameNode {
  const svg = SVG_ICONS[name].replace(/\{\{color\}\}/g, rgbToHex(color ?? ctx.colors.text));
  const node = figma.createNodeFromSvg(svg);
  node.name = `Icon: ${name}`;
  node.resize(size, size);
  return node;
}

export function tag(ctx: Ctx, label: string, highlighted = false): FrameNode {
  const c = ctx.colors;
  const t = hstack({
    name: `Tag: ${label}`,
    padding: [4, 8],
    radius: 6,
    fill: highlighted ? c.defaultTagBg : c.tagBg,
    stroke: highlighted ? c.accent : c.tagBorder,
  });
  t.appendChild(text(ctx, label, { size: 12, lineHeight: 16, weight: "medium", color: highlighted ? c.defaultTagText : c.text }));
  return t;
}

export function badge(ctx: Ctx, label: string, bg: RGB, fg: RGB): FrameNode {
  const b = hstack({ name: `Badge: ${label}`, padding: [2, 6], radius: 4, fill: bg });
  b.appendChild(text(ctx, label, { size: 11, lineHeight: 14, weight: "semibold", color: fg }));
  return b;
}

export function docLinkBadge(ctx: Ctx, uri: string, label = "Documentation"): FrameNode {
  const c = ctx.colors;
  const b = hstack({ name: "Doc Link", padding: [4, 6], gap: 4, radius: 6, fill: c.linkBg });
  b.appendChild(icon(ctx, "DOCUMENTATION", 16, c.linkText));
  b.appendChild(text(ctx, label, { size: 12, lineHeight: 16, color: c.linkText, link: { type: "URL", value: uri } }));
  return b;
}

export function sectionLabel(ctx: Ctx, label: string): TextNode {
  return text(ctx, label, { size: 14, lineHeight: 23, weight: "medium", upper: true });
}

export function bottomBorder(node: FrameNode, color: RGB): void {
  node.strokes = solid(color);
  node.strokeTopWeight = 0;
  node.strokeRightWeight = 0;
  node.strokeLeftWeight = 0;
  node.strokeBottomWeight = 1;
  node.strokeAlign = "INSIDE";
}
