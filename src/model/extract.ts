import { displayName } from "./names";
import {
  ComponentDoc,
  DEFAULT_TYPE_ORDER,
  PropDoc,
  PropType,
  RawComponent,
  RawPropDef,
} from "./types";

const KNOWN_TYPES: PropType[] = ["VARIANT", "BOOLEAN", "TEXT", "INSTANCE_SWAP", "SLOT"];

function toProp(rawKey: string, def: RawPropDef, visibilityRefs: Set<string>, nestedPath?: string): PropDoc | null {
  if (!KNOWN_TYPES.includes(def.type as PropType)) return null;
  const type = def.type as PropType;
  const prop: PropDoc = {
    key: rawKey,
    name: displayName(rawKey),
    type,
    defaultValue: def.defaultValue,
  };
  if (nestedPath) prop.nestedPath = nestedPath;
  if (type === "VARIANT" && def.variantOptions) prop.options = [...def.variantOptions];
  if (type === "INSTANCE_SWAP") {
    if (def.preferred && def.preferred.length) prop.preferred = def.preferred.map((p) => ({ ...p }));
    if (def.defaultName) prop.defaultName = def.defaultName;
  }
  if (type === "BOOLEAN" && !nestedPath) prop.controlsLayers = visibilityRefs.has(rawKey);
  return prop;
}

export function sortProps(props: PropDoc[], typeOrder: PropType[] = DEFAULT_TYPE_ORDER): PropDoc[] {
  const rank = (t: PropType) => {
    const i = typeOrder.indexOf(t);
    return i === -1 ? typeOrder.length : i;
  };
  // Stable sort keeps Figma's own order within a type.
  return props
    .map((p, i) => ({ p, i }))
    .sort((a, b) => rank(a.p.type) - rank(b.p.type) || a.i - b.i)
    .map((x) => x.p);
}

export function extract(raw: RawComponent, typeOrder: PropType[] = DEFAULT_TYPE_ORDER): ComponentDoc {
  const refs = new Set(raw.visibilityRefs);
  const own: PropDoc[] = [];
  for (const [key, def] of Object.entries(raw.definitions)) {
    const p = toProp(key, def, refs);
    if (p) own.push(p);
  }

  const nested: PropDoc[] = [];
  for (const n of raw.nested) {
    const group: PropDoc[] = [];
    for (const [key, def] of Object.entries(n.definitions)) {
      const p = toProp(key, def, refs, n.instanceName);
      if (p) group.push(p);
    }
    nested.push(...sortProps(group, typeOrder));
  }

  return {
    id: raw.id,
    name: raw.name,
    kind: raw.kind,
    remote: raw.remote,
    page: raw.page,
    description: raw.description,
    docLinks: [...raw.docLinks],
    props: [...sortProps(own, typeOrder), ...nested],
    variants: raw.kind === "COMPONENT_SET" ? raw.variants.map((v) => ({ ...v, docLinks: [...v.docLinks] })) : [],
    tokens: dedupeTokens(raw.tokens),
  };
}

function dedupeTokens(tokens: RawComponent["tokens"]) {
  const seen = new Set<string>();
  return tokens.filter((t) => {
    const k = `${t.collection}|${t.variable}|${t.field}|${t.layer}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Group token uses for display: variable → "fill on Background, Border". */
export function groupTokens(tokens: ComponentDoc["tokens"]): { collection: string; items: { variable: string; uses: string }[] }[] {
  const byCollection = new Map<string, Map<string, Map<string, string[]>>>();
  for (const t of tokens) {
    const vars = byCollection.get(t.collection) ?? new Map<string, Map<string, string[]>>();
    byCollection.set(t.collection, vars);
    const fields = vars.get(t.variable) ?? new Map<string, string[]>();
    vars.set(t.variable, fields);
    const layers = fields.get(t.field) ?? [];
    fields.set(t.field, layers);
    if (!layers.includes(t.layer)) layers.push(t.layer);
  }
  return [...byCollection.entries()].map(([collection, vars]) => ({
    collection,
    items: [...vars.entries()].map(([variable, fields]) => ({
      variable,
      uses: [...fields.entries()].map(([field, layers]) => `${field} on ${layers.join(", ")}`).join("; "),
    })),
  }));
}
