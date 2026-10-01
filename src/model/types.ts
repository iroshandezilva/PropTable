// Shared data model. Everything in src/model is plain TypeScript with no
// access to the `figma` global, so it can be unit-tested in Node.

export type PropType = "VARIANT" | "BOOLEAN" | "TEXT" | "INSTANCE_SWAP" | "SLOT";

export const DEFAULT_TYPE_ORDER: PropType[] = ["VARIANT", "BOOLEAN", "INSTANCE_SWAP", "TEXT", "SLOT"];

export interface NamedRef {
  id: string;
  name: string;
}

export interface PropDoc {
  key: string; // raw key, e.g. "Label#12:3"
  name: string; // display name, e.g. "Label"
  type: PropType;
  defaultValue: string | boolean;
  options?: string[]; // variant options
  preferred?: NamedRef[]; // instance-swap preferred values
  defaultName?: string; // resolved instance-swap default name
  nestedPath?: string; // exposed nested instance name, e.g. "Icon"
  controlsLayers?: boolean; // boolean: does any layer use it for visibility?
}

export interface VariantDoc {
  id: string;
  name: string; // "Size=sm, State=default"
  description: string;
  docLinks: string[];
}

export interface TokenUse {
  collection: string;
  variable: string; // "color/bg/primary"
  field: string; // "fill", "paddingLeft", ...
  layer: string;
}

export interface ComponentDoc {
  id: string;
  name: string;
  kind: "COMPONENT" | "COMPONENT_SET";
  remote: boolean;
  page: string;
  description: string;
  docLinks: string[];
  props: PropDoc[];
  variants: VariantDoc[];
  tokens: TokenUse[];
}

// --- Raw input produced by the Figma adapter ---

export interface RawPropDef {
  type: string;
  defaultValue: string | boolean;
  variantOptions?: string[];
  preferred?: NamedRef[];
  defaultName?: string;
}

export interface RawNested {
  instanceName: string;
  definitions: Record<string, RawPropDef>;
}

export interface RawComponent {
  id: string;
  name: string;
  kind: "COMPONENT" | "COMPONENT_SET";
  remote: boolean;
  page: string;
  description: string;
  docLinks: string[];
  definitions: Record<string, RawPropDef>;
  /** Property keys referenced by any layer for visibility. */
  visibilityRefs: string[];
  variants: VariantDoc[];
  nested: RawNested[];
  tokens: TokenUse[];
}

// --- Change tracking ---

export interface SnapshotProp {
  name: string;
  type: PropType;
  signature: string;
}

export interface Snapshot {
  version: 2;
  props: SnapshotProp[];
  builtAt: string;
}

export type ChangeMark = "new" | "changed";

export interface DiffResult {
  marks: Record<string, ChangeMark>; // keyed by prop id (see propId)
  removed: string[];
}

// --- Lint ---

export type LintRule =
  | "missing-description"
  | "missing-doc-link"
  | "variant-casing"
  | "boolean-unused"
  | "text-empty-default"
  | "name-whitespace"
  | "duplicate-name"
  | "variant-missing-description";

export interface LintIssue {
  rule: LintRule;
  message: string;
  /** Prop id the issue belongs to; absent for component-level issues. */
  prop?: string;
}

// --- Settings ---

export interface Settings {
  theme: "light" | "dark";
  accent: string;
  font: string;
  columns: { type: boolean; default: boolean; notes: boolean };
  sections: { variants: boolean; previews: boolean; tokens: boolean; nested: boolean };
  typeOrder: PropType[];
  placement: "right" | "below";
  changeMarks: boolean;
  lintMarks: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: "light",
  accent: "#7C3AED",
  font: "Inter",
  columns: { type: true, default: true, notes: true },
  sections: { variants: true, previews: true, tokens: true, nested: true },
  typeOrder: DEFAULT_TYPE_ORDER,
  placement: "right",
  changeMarks: true,
  lintMarks: true,
};

/** Stable id for a property row: nested props are scoped by their instance. */
export function propId(prop: Pick<PropDoc, "name" | "nestedPath">): string {
  return prop.nestedPath ? `${prop.nestedPath}/${prop.name}` : prop.name;
}
