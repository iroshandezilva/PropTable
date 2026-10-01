# PropTable v2 — Design

**Status:** Draft for review · **Date:** 2026-10-01 · **Target release:** v2.0.0 (one release, all features)

## 1. Goal

Turn PropTable from a one-shot table generator into a component documentation tool for design systems: it documents every property, explains it, checks it, and hands it off to developers.

**Users:** design system designers keeping libraries documented, and the developers who build from those components.

**Success criteria**

- Every feature in §4 works in the Figma editor; export features also work in Dev Mode.
- Tables made with v1 keep working and upgrade on their first update. No canvas breaks.
- Rebuilding a table never loses notes a designer typed.
- The model logic (extraction, change detection, lint, export) is covered by unit tests.
- Generating a table for a 50-variant set takes under 3 seconds.

**Out of scope:** CI, UI localisation, publishing to Figma Community (done by hand after merge).

## 2. Decisions made during brainstorming

| Topic | Decision |
|---|---|
| Delivery | One spec, one branch (`feat/v2`), one v2.0.0 release |
| Variant descriptions | Separate **Variants** section under the properties table |
| Notes | Typed directly on the canvas; read back and kept on rebuild |
| How it runs | Menu of commands; quick generate needs no window |
| Build | esbuild + plain TypeScript window; vitest for model tests |

## 3. Architecture

```
src/
  main.ts              entry: sends each figma.command to a handler
  commands/
    generate.ts        Generate table (selection, many components at once)
    updateAll.ts       Update all tables on page / in file
    overview.ts        Create overview page
    openUi.ts          Window and message handling
  model/               pure logic, no `figma` global; unit-tested
    types.ts           ComponentDoc and related types
    extract.ts         node-like input → ComponentDoc
    diff.ts            previous snapshot vs current → change marks
    lint.ts            ComponentDoc → LintIssue[]
    export.ts          ComponentDoc → Markdown | JSON | TypeScript
    names.ts           property-name cleanup, camelCase, casing detection
  render/              ComponentDoc + Settings → Figma nodes
    table.ts  header.ts  rows.ts  variants.ts  tokens.ts  overview.ts
    theme.ts  icons.ts  primitives.ts
  storage.ts           settings, table/component links, snapshots, reading notes back
  figmaAdapter.ts      reads Figma nodes into the plain input extract.ts takes
  devmode.ts           Dev Mode panel
ui/
  ui.html  ui.ts  ui.css   window: Export, Checks, Settings tabs
tests/
  extract.test.ts  diff.test.ts  lint.test.ts  export.test.ts  names.test.ts
build.mjs              esbuild: src/main.ts → code.js; ui/ → inlined ui.html
```

**Data flow:** `figmaAdapter` reads nodes into plain objects, `model/extract` turns them into a `ComponentDoc`, then `render/*` draws the canvas table while `model/export` and `model/lint` feed the window and Dev Mode. Because only `figmaAdapter` and `render/` touch the Figma API, everything in `model/` can be tested in Node.

**Tooling:** `npm run build` runs `build.mjs`, `npm run watch` rebuilds on change, `npm test` runs vitest, `npm run typecheck` runs `tsc --noEmit`. `code.js` and `ui.html` stay git-ignored; the release zip contains `manifest.json`, `code.js` and `ui.html`.

### 3.1 Core types

```ts
type PropType = "VARIANT" | "BOOLEAN" | "TEXT" | "INSTANCE_SWAP";

interface PropDoc {
  key: string;              // raw key, e.g. "Label#12:3"
  name: string;             // display name, e.g. "Label"
  type: PropType;
  defaultValue: string | boolean;
  options?: string[];       // variant options
  preferred?: { id: string; name: string }[]; // instance-swap preferred values
  defaultName?: string;     // resolved instance-swap default name
  nestedPath?: string;      // e.g. "Icon" for exposed nested properties
  controlsLayers?: boolean; // boolean: does any layer use it for visibility?
}

interface VariantDoc {
  id: string;
  name: string;             // "Size=sm, State=default"
  description: string;
  docLinks: string[];
}

interface TokenUse {
  collection: string;
  variable: string;         // "color/bg/primary"
  field: string;            // "fill", "paddingLeft", ...
  layer: string;            // layer name
}

interface ComponentDoc {
  id: string;
  name: string;
  kind: "COMPONENT" | "COMPONENT_SET";
  remote: boolean;
  description: string;
  docLinks: string[];
  props: PropDoc[];
  variants: VariantDoc[];   // empty for single components
  tokens: TokenUse[];
}

interface Snapshot {        // saved on the table after each build
  version: 2;
  props: { name: string; type: PropType; signature: string }[];
  builtAt: string;          // ISO date
}
```

## 4. Features

### 4.1 Variant descriptions (new)

- For component sets, each child `ComponentNode`'s `description` and `documentationLinks` go into `VariantDoc`.
- Shown in a **Variants** section under the properties table: preview | variant name | description + doc-link badges.
- With previews on, every variant is listed. With previews off, only variants that have a description or a doc link; if none do, the section is left out.

### 4.2 Table contents

**Header:** an icon and "<Name> properties"; the component description; **all** doc links as badges; a small "Updated <YYYY-MM-DD>" label.

**Properties table:** Property | Type | Default / Options | Notes. Columns can be turned on or off in settings, except Property.

- **#4 Preferred values:** instance-swap rows show the default as a tag, then the preferred components (`preferredValues`, resolved to names) as tags. Unresolved ones show as "Library component".
- **#5 Long text:** text defaults wrap within the cell. Anything over 120 characters is cut to 119 plus "…", and the full value is kept in the layer name.
- **#6 Nested properties:** for every nested instance inside the component (or the default variant) with `isExposedInstance === true`, its properties are listed under a sub-header row "↳ <instance name> (nested)", with indented names.
- **#7 Notes:** each row's Notes cell is a text layer named `Note:<property name>`, with grey placeholder text "Add a note…" when empty. See §5.2 for how notes survive a rebuild.
- **#10 Change marks:** after the first build, rows get a "New" badge (property not in the previous snapshot) or "Changed" badge (same name, different type, default or options). A line "Removed since last update: A, B" goes under the table. Marks reflect only the latest update. They can be turned off.
- **#17 Lint marks:** a ⚠ icon next to the property name, with the issue in small text under it. Component-level issues go in the header. They can be turned off.

### 4.3 #8 Variant previews

- Each variant is exported with `exportAsync({ format: "PNG", constraint: { type: "HEIGHT", value: 80 } })` and placed as an image fill on an 80 px tall frame, with the width kept in proportion and capped at 160 px.
- Sets with more than 50 variants: the first 50 are shown, followed by "+N more variants not shown".
- Previews can be turned off in settings and are on by default.

### 4.4 #9 Tokens section

- Walks the component (for sets, the default variant) and collects `boundVariables` from each node's fills, strokes, effects, spacing, padding, corner radius and text fields.
- Each variable is resolved with `figma.variables.getVariableByIdAsync`, and its collection name is looked up.
- Shown as a list grouped by collection: `variable name → field on layer`. Identical uses are merged ("fill on Background, Border").
- If no variables are used, the section is left out. It can be turned off.

### 4.5 #17 Lint rules

| Rule id | Level | Condition |
|---|---|---|
| `missing-description` | component | the component (or set) has no description |
| `missing-doc-link` | component | no documentation links |
| `variant-casing` | property | a variant property's options mix casing styles (lower, Title, UPPER, camel) |
| `boolean-unused` | property | a boolean property that no layer uses for visibility (`componentPropertyReferences.visible`) |
| `text-empty-default` | property | a text property whose default is empty or only spaces |
| `name-whitespace` | property | a property name with spaces at the start or end, or double spaces |
| `duplicate-name` | property | two properties with the same display name |
| `variant-missing-description` | component | at least one variant has a description, but some don't (lists the count) |

### 4.6 Commands (manifest `menu`)

```json
"menu": [
  { "name": "Generate table", "command": "generate" },
  { "name": "Update all tables on page", "command": "update-page" },
  { "name": "Update all tables in file", "command": "update-file" },
  { "name": "Create overview page", "command": "overview" },
  { "separator": true },
  { "name": "Open PropTable…", "command": "open" }
],
"relaunchButtons": [
  { "command": "generate", "name": "Update table" }
]
```

- **#2 Generate table:** works on every selected node. Each node is mapped to a component or set the same way as v1, plus generated tables mapped back to their component. Duplicates are removed. New tables go to the right of their reference node (or below it, depending on settings) with a 100 px gap. If several are new, each one goes below the previous one. Everything built is selected at the end, and the notification sums up the result ("Created 3, updated 1").
- **#1 Relaunch:** after a build, the component (if local) and the table get `setRelaunchData({ generate: "" })`. Components that have never been documented get no button, because the plugin doesn't add relaunch data to nodes it hasn't built a table for.
- **#3 Update all:** finds every frame whose `sourceComponentId` link is set (on the page, or on every page after `figma.loadAllPagesAsync()`), plus v1 tables found through their component's `propTableId`, and rebuilds each one in place. Summary: "Updated N tables · M components missing". A table whose component is missing is left alone.
- **#18 Overview:** creates or reuses a page named "PropTable Overview", and creates or replaces one frame on it named "PropTable Overview". One row per local component set or standalone component (not variants inside a set): name (a link to the node), page, property count, variant count, description ✓/✗, doc link ✓/✗, lint warning count. Rows are sorted by page, then name.
- **Open PropTable…:** opens the window at 360×520 px.

### 4.7 Window

There are three tabs. The window listens for `selectionchange` and refreshes.

- **Export (#11, #12):** a Markdown | JSON | TypeScript switch, a read-only `<textarea>` preview, and a Copy button. Copying uses `document.execCommand("copy")` on the textarea, because `navigator.clipboard` is blocked in plugin iframes. With nothing usable selected, the tab says "Select a component to export".
  - **Markdown:** `## Name`, the description, then a table `| Property | Type | Default | Options |`, then a Variants table if any variant has a description.
  - **JSON:** the `ComponentDoc` without internal IDs, formatted with 2-space indentation.
  - **TypeScript:** `export interface <PascalName>Props { ... }`.
    - Property names are camelCased (`Show icon` → `showIcon`).
    - Variant → a union of its options in quotes; boolean → `boolean`; text → `string`; instance swap → `React.ReactNode`.
    - Every property is optional, with a `/** @default <value> */` comment.
    - Nested properties go under a sub-object named after the nested instance, in camelCase.
    - Name clashes get a number added (`label2`).
- **Checks (#17):** a Selection | Page switch; issues are grouped by component, and clicking one selects and zooms to that component.
- **Settings (#14–#16):** see §5.1. Changes are saved straight away. The next generate or update uses them; existing tables aren't redrawn automatically.

### 4.8 #13 Dev Mode

- The manifest adds `"editorType": ["figma", "dev"]` and `"capabilities": ["inspect"]`.
- In Dev Mode, `figma.editorType === "dev"`. `main.ts` then opens the window in a read-only mode: Export tab plus a property summary, with no Settings tab and no canvas commands.
- Dev Mode can't write to the canvas, so commands other than open are hidden there.

## 5. Storage

### 5.1 Settings (#14–#16)

Saved as JSON in `figma.root` plugin data under the key `settings`, so it's shared by everyone in the file. Missing fields use these defaults:

```ts
interface Settings {
  theme: "light" | "dark";          // default "light"
  accent: string;                   // hex, default "#7C3AED" (card border, badges)
  font: string;                     // family, default "Inter"; falls back to Inter if loading fails
  columns: { type: boolean; default: boolean; notes: boolean };   // all true
  sections: { variants: boolean; previews: boolean; tokens: boolean; nested: boolean }; // all true
  typeOrder: PropType[];            // default ["VARIANT","BOOLEAN","INSTANCE_SWAP","TEXT"]
  placement: "right" | "below";     // default "right"
  changeMarks: boolean;             // true
  lintMarks: boolean;               // true
}
```

- **Themes:** `theme.ts` maps `{ theme, accent }` to a palette, replacing the current fixed `COLORS`.
- **Fonts:** the chosen font must have Regular, Medium and Semi Bold styles. If any of them fails to load, the build uses Inter and shows "Font X unavailable, used Inter".

### 5.2 Plugin data on nodes

| Node | Key | Value |
|---|---|---|
| table frame | `sourceComponentId` | component or set ID (v1.1 key, kept) |
| table frame | `propTableVersion` | `"2"` |
| table frame | `snapshot` | `Snapshot` JSON |
| local component or set | `propTableId` | table frame ID (v1 key, kept) |

**Keeping notes on rebuild:**

1. Before removing the old table, collect every text node named `Note:<name>` whose text isn't the placeholder.
2. Build the new table and fill matching `Note:<name>` cells.
3. Notes whose property no longer exists go in a "Notes for removed properties" block at the bottom of the table, so nothing is lost silently.

**Upgrading v1 tables:** a v1 table has no `propTableVersion`. On update it's rebuilt as v2. There's no snapshot to compare against, so it gets no change marks, and it gets no notes because v1 had none.

## 6. Errors

- Every command handler runs inside one wrapper, the same pattern as v1.1:
  - an expected `UserError` shows its message;
  - anything else is logged with `console.error` and shows "PropTable failed: <message>" as an error notification;
  - then the plugin closes. The window command doesn't close.
- In multi-component and update-all runs, one failure doesn't stop the rest. It's counted and listed in the summary ("2 failed: Button, Card — see console").
- If a preview export fails, a grey placeholder box is shown instead.
- If a variable lookup fails, the variable ID is shown.

## 7. Testing

- **Unit tests (vitest):**
  - `extract`: names with `#` suffixes, sort order, nested properties, preferred values, variant docs
  - `diff`: new, changed and removed properties
  - every lint rule, passing and failing
  - `export`: snapshots of the Markdown, JSON and TypeScript output, including name clashes and camelCasing
  - `names`
- **Manual checklist in Figma** (kept in `docs/testing.md`): local component, component set, library instance, several components at once, re-running on a table, updating all on the page and in the file, notes surviving a rebuild and a property rename, each settings toggle, dark theme, an unavailable font, the overview page, Dev Mode export, and a v1 table upgrading.

## 8. Docs and release

- Update the README to cover the new features and commands.
- Bump `package.json` to 2.0.0.
- After merging: a GitHub release v2.0.0 with the zip, and a manual publish to Figma Community.
