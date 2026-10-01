// Reads Figma nodes into the plain RawComponent shape used by src/model.

import { NamedRef, RawComponent, RawNested, RawPropDef, TokenUse } from "./model/types";
import { SOURCE_ID_KEY, findTableAncestor } from "./storage";

export type DocTarget = ComponentNode | ComponentSetNode;

export class UserError extends Error {}

export interface ReadOptions {
  nested: boolean;
  tokens: boolean;
  resolveNames: boolean; // resolve instance-swap defaults and preferred values
}

export const FULL_READ: ReadOptions = { nested: true, tokens: true, resolveNames: true };
export const LIGHT_READ: ReadOptions = { nested: false, tokens: false, resolveNames: false };

// --- Selection → component ---

export async function resolveTarget(node: SceneNode): Promise<DocTarget | null> {
  const table = findTableAncestor(node);
  if (table) {
    const source = await figma.getNodeByIdAsync(table.getPluginData(SOURCE_ID_KEY));
    return source && (source.type === "COMPONENT" || source.type === "COMPONENT_SET") ? source : null;
  }
  if (node.type === "COMPONENT_SET") return node;
  if (node.type === "COMPONENT") return node.parent?.type === "COMPONENT_SET" ? node.parent : node;
  if (node.type === "INSTANCE") {
    const main = await node.getMainComponentAsync();
    if (!main) return null;
    return main.parent?.type === "COMPONENT_SET" ? main.parent : main;
  }
  return null;
}

export function pageOf(node: BaseNode): PageNode | null {
  let current: BaseNode | null = node;
  while (current && current.type !== "PAGE") current = current.parent;
  return current as PageNode | null;
}

// --- Name resolution with per-run caches ---

export class NameResolver {
  private byId = new Map<string, string | null>();
  private byKey = new Map<string, string | null>();
  private localKeys: Map<string, string> | null = null;

  async nodeName(id: string): Promise<string | null> {
    if (this.byId.has(id)) return this.byId.get(id)!;
    let name: string | null = null;
    try {
      const node = await figma.getNodeByIdAsync(id);
      name = node ? node.name : null;
    } catch {
      name = null;
    }
    this.byId.set(id, name);
    return name;
  }

  async keyName(key: string, type: "COMPONENT" | "COMPONENT_SET"): Promise<string | null> {
    if (this.byKey.has(key)) return this.byKey.get(key)!;
    if (!this.localKeys) {
      this.localKeys = new Map();
      for (const n of figma.currentPage.findAllWithCriteria({ types: ["COMPONENT", "COMPONENT_SET"] })) {
        this.localKeys.set(n.key, n.name);
      }
    }
    let name = this.localKeys.get(key) ?? null;
    if (!name) {
      try {
        const node =
          type === "COMPONENT_SET"
            ? await figma.importComponentSetByKeyAsync(key)
            : await figma.importComponentByKeyAsync(key);
        name = node.name;
      } catch {
        name = null;
      }
    }
    this.byKey.set(key, name);
    return name;
  }
}

// --- Reading ---

async function readDefinitions(
  defs: ComponentPropertyDefinitions,
  values: Record<string, { value: string | boolean; preferredValues?: InstanceSwapPreferredValue[] }> | null,
  resolver: NameResolver,
  opts: ReadOptions
): Promise<Record<string, RawPropDef>> {
  const out: Record<string, RawPropDef> = {};
  for (const [key, def] of Object.entries(defs)) {
    const current = values?.[key];
    const raw: RawPropDef = {
      type: def.type,
      defaultValue: (current ? current.value : def.defaultValue) as string | boolean,
    };
    if (def.type === "VARIANT" && def.variantOptions) raw.variantOptions = [...def.variantOptions];
    if (def.type === "INSTANCE_SWAP" && opts.resolveNames) {
      raw.defaultName = (await resolver.nodeName(String(raw.defaultValue))) ?? undefined;
      const prefs = current?.preferredValues ?? def.preferredValues ?? [];
      const preferred: NamedRef[] = [];
      for (const p of prefs) {
        preferred.push({ id: p.key, name: (await resolver.keyName(p.key, p.type)) ?? "Library component" });
      }
      if (preferred.length) raw.preferred = preferred;
    }
    out[key] = raw;
  }
  return out;
}

function baseComponent(target: DocTarget): ComponentNode {
  if (target.type === "COMPONENT") return target;
  return target.defaultVariant ?? (target.children.find((c) => c.type === "COMPONENT") as ComponentNode);
}

async function readNested(base: ComponentNode, resolver: NameResolver, opts: ReadOptions): Promise<RawNested[]> {
  const exposed = base.findAll((n) => n.type === "INSTANCE" && n.isExposedInstance) as InstanceNode[];
  const result: RawNested[] = [];
  for (const inst of exposed) {
    const main = await inst.getMainComponentAsync();
    if (!main) continue;
    const owner = main.parent?.type === "COMPONENT_SET" ? main.parent : main;
    let defs: ComponentPropertyDefinitions;
    try {
      defs = owner.componentPropertyDefinitions;
    } catch {
      continue; // definitions can throw on broken library components
    }
    const definitions = await readDefinitions(defs, inst.componentProperties, resolver, opts);
    if (Object.keys(definitions).length) result.push({ instanceName: inst.name, definitions });
  }
  return result;
}

const FIELD_LABELS: Record<string, string> = { fills: "fill", strokes: "stroke", effects: "effect", layoutGrids: "grid" };

async function readTokens(base: ComponentNode): Promise<TokenUse[]> {
  const nodes: SceneNode[] = [base, ...base.findAll(() => true)];
  const varCache = new Map<string, { variable: string; collection: string }>();
  const collectionCache = new Map<string, string>();
  const uses: TokenUse[] = [];

  const lookup = async (id: string) => {
    if (varCache.has(id)) return varCache.get(id)!;
    let entry = { variable: id, collection: "Unknown" };
    try {
      const v = await figma.variables.getVariableByIdAsync(id);
      if (v) {
        let collection = collectionCache.get(v.variableCollectionId);
        if (collection === undefined) {
          const c = await figma.variables.getVariableCollectionByIdAsync(v.variableCollectionId);
          collection = c ? c.name : "Unknown";
          collectionCache.set(v.variableCollectionId, collection);
        }
        entry = { variable: v.name, collection };
      }
    } catch {
      // keep the id as a fallback
    }
    varCache.set(id, entry);
    return entry;
  };

  for (const node of nodes) {
    const bound = (node as SceneNode & { boundVariables?: Record<string, unknown> }).boundVariables;
    if (!bound) continue;
    for (const [field, value] of Object.entries(bound)) {
      if (field === "componentProperties") continue;
      const aliases = (Array.isArray(value) ? value : [value]).filter(
        (a): a is VariableAlias => !!a && typeof a === "object" && (a as VariableAlias).type === "VARIABLE_ALIAS"
      );
      for (const alias of aliases) {
        const { variable, collection } = await lookup(alias.id);
        uses.push({ collection, variable, field: FIELD_LABELS[field] ?? field, layer: node.name });
      }
    }
  }
  return uses;
}

export async function readComponent(
  target: DocTarget,
  opts: ReadOptions = FULL_READ,
  resolver: NameResolver = new NameResolver()
): Promise<RawComponent> {
  let defs: ComponentPropertyDefinitions;
  try {
    defs = target.componentPropertyDefinitions;
  } catch {
    throw new UserError(`"${target.name}" has conflicting property names, fix them in Figma first.`);
  }

  const scopes: SceneNode[] = target.type === "COMPONENT_SET" ? [...target.children] : [target];
  const visibilityRefs = new Set<string>();
  for (const scope of scopes) {
    const all = "findAll" in scope ? [scope, ...scope.findAll(() => true)] : [scope];
    for (const n of all) {
      const ref = n.componentPropertyReferences?.visible;
      if (ref) visibilityRefs.add(ref);
    }
  }

  const variants =
    target.type === "COMPONENT_SET"
      ? target.children
          .filter((c): c is ComponentNode => c.type === "COMPONENT")
          .map((c) => ({
            id: c.id,
            name: c.name,
            description: c.description || "",
            docLinks: (c.documentationLinks || []).map((l) => l.uri),
          }))
      : [];

  const base = baseComponent(target);
  return {
    id: target.id,
    name: target.name,
    kind: target.type,
    remote: target.remote,
    page: pageOf(target)?.name ?? "",
    description: target.description || "",
    docLinks: (target.documentationLinks || []).map((l) => l.uri),
    definitions: await readDefinitions(defs, null, resolver, opts),
    visibilityRefs: [...visibilityRefs],
    variants,
    nested: opts.nested && base ? await readNested(base, resolver, opts) : [],
    tokens: opts.tokens && base ? await readTokens(base) : [],
  };
}
