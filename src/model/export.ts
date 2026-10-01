import { camelCase, pascalCase } from "./names";
import { ComponentDoc, PropDoc, PropType } from "./types";

export type ExportFormat = "markdown" | "json" | "typescript";

export const TYPE_LABELS: Record<PropType, string> = {
  VARIANT: "Variant",
  BOOLEAN: "Boolean",
  TEXT: "Text",
  INSTANCE_SWAP: "Instance swap",
  SLOT: "Slot",
};

export function exportDoc(doc: ComponentDoc, format: ExportFormat): string {
  switch (format) {
    case "markdown":
      return toMarkdown(doc);
    case "json":
      return toJson(doc);
    case "typescript":
      return toTypeScript(doc);
  }
}

// --- Markdown ---

function mdCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");
}

export function defaultLabel(p: PropDoc): string {
  if (p.type === "BOOLEAN") return p.defaultValue === true ? "true" : "false";
  if (p.type === "INSTANCE_SWAP") return p.defaultName ?? "Library component";
  return String(p.defaultValue);
}

function optionsLabel(p: PropDoc): string {
  if (p.type === "VARIANT") return (p.options ?? []).join(", ");
  if (p.type === "INSTANCE_SWAP") return (p.preferred ?? []).map((x) => x.name).join(", ");
  return "";
}

function propLabel(p: PropDoc): string {
  return p.nestedPath ? `${p.nestedPath} → ${p.name}` : p.name;
}

export function toMarkdown(doc: ComponentDoc): string {
  const lines: string[] = [`## ${doc.name}`, ""];
  if (doc.description.trim()) lines.push(doc.description.trim(), "");
  for (const link of doc.docLinks) lines.push(`[Documentation](${link})`, "");

  if (doc.props.length === 0) {
    lines.push("_No properties defined._");
  } else {
    lines.push("| Property | Type | Default | Options |", "| --- | --- | --- | --- |");
    for (const p of doc.props) {
      lines.push(
        `| ${mdCell(propLabel(p))} | ${TYPE_LABELS[p.type]} | ${mdCell(defaultLabel(p))} | ${mdCell(optionsLabel(p))} |`
      );
    }
  }

  const described = doc.variants.filter((v) => v.description.trim() || v.docLinks.length);
  if (described.length) {
    lines.push("", "### Variants", "", "| Variant | Description |", "| --- | --- |");
    for (const v of described) {
      const links = v.docLinks.map((l) => `[Docs](${l})`).join(" ");
      lines.push(`| ${mdCell(v.name)} | ${mdCell([v.description.trim(), links].filter(Boolean).join(" "))} |`);
    }
  }
  return lines.join("\n").trimEnd() + "\n";
}

// --- JSON ---

export function toJson(doc: ComponentDoc): string {
  const out = {
    name: doc.name,
    description: doc.description,
    docLinks: doc.docLinks,
    properties: doc.props.map((p) => {
      const o: Record<string, unknown> = { name: p.name, type: p.type, default: p.type === "INSTANCE_SWAP" ? defaultLabel(p) : p.defaultValue };
      if (p.nestedPath) o.nestedIn = p.nestedPath;
      if (p.options) o.options = p.options;
      if (p.preferred) o.preferred = p.preferred.map((x) => x.name);
      return o;
    }),
    variants: doc.variants.map((v) => ({ name: v.name, description: v.description, docLinks: v.docLinks })),
    tokens: doc.tokens.map((t) => ({ collection: t.collection, variable: t.variable, field: t.field, layer: t.layer })),
  };
  return JSON.stringify(out, null, 2) + "\n";
}

// --- TypeScript ---

function tsType(p: PropDoc): string {
  switch (p.type) {
    case "VARIANT":
      return (p.options ?? []).length ? (p.options ?? []).map((o) => JSON.stringify(o)).join(" | ") : "string";
    case "BOOLEAN":
      return "boolean";
    case "TEXT":
      return "string";
    case "INSTANCE_SWAP":
    case "SLOT":
      return "React.ReactNode";
  }
}

function tsDefault(p: PropDoc): string {
  if (p.type === "BOOLEAN") return p.defaultValue === true ? "true" : "false";
  if (p.type === "INSTANCE_SWAP") return defaultLabel(p);
  return JSON.stringify(String(p.defaultValue));
}

function uniqueName(base: string, used: Set<string>): string {
  let name = base;
  let n = 2;
  while (used.has(name)) name = `${base}${n++}`;
  used.add(name);
  return name;
}

function tsMember(p: PropDoc, name: string, indent: string): string[] {
  const doc = `/** @default ${tsDefault(p).replace(/\*\//g, "*\\/")} */`;
  return [`${indent}${doc}`, `${indent}${name}?: ${tsType(p)};`];
}

export function toTypeScript(doc: ComponentDoc): string {
  const lines: string[] = [`export interface ${pascalCase(doc.name)}Props {`];
  const used = new Set<string>();

  for (const p of doc.props.filter((x) => !x.nestedPath)) {
    lines.push(...tsMember(p, uniqueName(camelCase(p.name), used), "  "));
  }

  const groups = new Map<string, PropDoc[]>();
  for (const p of doc.props.filter((x) => x.nestedPath)) {
    const g = groups.get(p.nestedPath!) ?? [];
    g.push(p);
    groups.set(p.nestedPath!, g);
  }
  for (const [path, props] of groups) {
    lines.push(`  ${uniqueName(camelCase(path), used)}?: {`);
    const inner = new Set<string>();
    for (const p of props) lines.push(...tsMember(p, uniqueName(camelCase(p.name), inner), "    "));
    lines.push("  };");
  }

  lines.push("}");
  return lines.join("\n") + "\n";
}
