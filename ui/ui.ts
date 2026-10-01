import { ExportFormat, TYPE_LABELS, defaultLabel, exportDoc } from "../src/model/export";
import { ComponentDoc, DEFAULT_SETTINGS, LintIssue, PropType, Settings } from "../src/model/types";
import type { PageIssueItem, SelectionItem, ToPlugin, ToUi } from "../src/messages";
import { highlight } from "./highlight";

// --- Helpers ---

const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T;
const $$ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll(sel)) as T[];

function send(msg: ToPlugin): void {
  parent.postMessage({ pluginMessage: msg }, "*");
}

type Child = Node | string | null | undefined | false;
function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string | boolean | number> = {}, children: Child[] = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false) continue;
    if (k === "class") node.className = String(v);
    else if (k === "text") node.textContent = String(v);
    else node.setAttribute(k, v === true ? "" : String(v));
  }
  for (const c of children) if (c) node.append(c);
  return node;
}

function svg(markup: string): SVGElement {
  const t = document.createElement("template");
  t.innerHTML = markup.trim();
  return t.content.firstChild as SVGElement;
}

const ICON = {
  component: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 3 3-3 3-3-3zM6 9l3 3-3 3-3-3zM18 9l3 3-3 3-3-3zM12 15l3 3-3 3-3-3z"/></svg>`,
  tick: `<svg class="tick" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3.5 8.5 3 3 6-7"/></svg>`,
  copy: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="5" width="8.5" height="8.5" rx="1.5"/><path d="M10.5 5V3.5A1.5 1.5 0 0 0 9 2H3.5A1.5 1.5 0 0 0 2 3.5V9a1.5 1.5 0 0 0 1.5 1.5H5"/></svg>`,
  check: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3.5 8.5 3 3 6-7"/></svg>`,
  warn: `<svg class="warn-icon" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="M8 2.2 14.5 13.5h-13z"/><path d="M8 6.5v3" stroke-linecap="round"/><circle cx="8" cy="11.4" r=".6" fill="currentColor" stroke="none"/></svg>`,
  go: `<svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m6 4 4 4-4 4"/></svg>`,
  ok: `<svg class="ok-icon" width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="6.25"/><path d="m5.5 8.2 1.8 1.8 3.4-3.8"/></svg>`,
  grip: `<svg class="grip" width="10" height="10" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><circle cx="5.5" cy="4" r="1.2"/><circle cx="10.5" cy="4" r="1.2"/><circle cx="5.5" cy="8" r="1.2"/><circle cx="10.5" cy="8" r="1.2"/><circle cx="5.5" cy="12" r="1.2"/><circle cx="10.5" cy="12" r="1.2"/></svg>`,
  up: `<svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m4 10 4-4 4 4"/></svg>`,
  down: `<svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg>`,
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Re-run a CSS animation class on an element. */
function replay(node: HTMLElement, cls: string): void {
  node.classList.remove(cls);
  void node.offsetWidth;
  node.classList.add(cls);
}

// --- State ---

type Tab = "export" | "checks" | "settings";

const state = {
  mode: "figma" as "figma" | "dev",
  tab: "export" as Tab,
  settings: null as Settings | null,
  selection: [] as SelectionItem[],
  loading: true,
  error: "",
  current: 0,
  format: "markdown" as ExportFormat,
  scope: "selection" as "selection" | "page",
  pageIssues: null as PageIssueItem[] | null,
  menuOpen: false,
  copied: false,
};

const FORMAT_LABEL: Record<ExportFormat, string> = { markdown: "Markdown", json: "JSON", typescript: "TypeScript" };

// --- Segmented controls ---

function setSeg(name: string, value: string): void {
  const seg = $(`[data-seg="${name}"]`);
  const buttons = $$<HTMLButtonElement>(".seg-btn", seg);
  const index = Math.max(0, buttons.findIndex((b) => b.dataset.value === value));
  buttons.forEach((b, i) => b.setAttribute("aria-pressed", String(i === index)));
  const pill = $(".seg-pill", seg);
  pill.style.width = `calc((100% - 4px) / ${buttons.length})`;
  pill.style.transform = `translateX(${index * 100}%)`;
}

function onSeg(name: string, handler: (value: string) => void): void {
  for (const b of $$<HTMLButtonElement>(`[data-seg="${name}"] .seg-btn`)) {
    b.addEventListener("click", () => handler(b.dataset.value!));
  }
}

// --- Tabs ---

function visibleTabs(): HTMLButtonElement[] {
  return $$<HTMLButtonElement>(".tab").filter((t) => !t.hidden);
}

function setTab(tab: Tab, animate = true): void {
  if (state.mode === "dev" && tab === "settings") tab = "export";
  const changed = state.tab !== tab;
  state.tab = tab;
  const tabs = visibleTabs();
  const index = tabs.findIndex((t) => t.dataset.tab === tab);
  tabs.forEach((t, i) => t.setAttribute("aria-selected", String(i === index)));
  const ink = $(".tab-ink");
  ink.style.width = `calc((100% - 24px) / ${tabs.length})`;
  ink.style.transform = `translateX(${index * 100}%)`;
  closeMenu();
  render(animate && changed);
  if (tab === "checks" && state.scope === "page") send({ type: "requestPageIssues" });
}

for (const t of $$<HTMLButtonElement>(".tab")) t.addEventListener("click", () => setTab(t.dataset.tab as Tab));

// --- Rendering ---

function render(animate = false): void {
  const hasSelection = state.selection.length > 0;
  const showEmpty = state.tab !== "settings" && !(state.tab === "checks" && state.scope === "page") && !hasSelection;
  const panels: Record<string, boolean> = {
    empty: showEmpty,
    export: state.tab === "export" && !showEmpty,
    checks: state.tab === "checks" && !showEmpty,
    settings: state.tab === "settings",
  };
  for (const [id, show] of Object.entries(panels)) {
    const panel = $(`#${id}`);
    const wasHidden = panel.hidden;
    panel.hidden = !show;
    if (show && (animate || wasHidden)) replay(panel, "enter");
  }

  if (showEmpty) {
    $("#empty-title").textContent = state.loading ? "Reading selection…" : state.error ? "Couldn't read the selection" : "Select a component";
    $("#empty-text").textContent = state.error
      ? state.error
      : state.loading
        ? "Hang on, PropTable is reading the components you selected."
        : `Pick a component, component set, instance or PropTable table on the canvas to ${state.tab === "checks" ? "check" : "export"} it.`;
  }
  if (panels.export) renderExport();
  if (panels.checks) renderChecks();
}

function metaOf(doc: ComponentDoc): string {
  const parts = [doc.kind === "COMPONENT_SET" ? "Component set" : "Component"];
  if (doc.variants.length) parts.push(plural(doc.variants.length, "variant"));
  parts.push(doc.props.length === 1 ? "1 property" : `${doc.props.length} properties`);
  if (doc.remote) parts.push("Library");
  return parts.join(" · ");
}

const FILE_EXT: Record<ExportFormat, string> = { markdown: "md", json: "json", typescript: "ts" };

function renderExport(swapCode = false): void {
  const items = state.selection;
  if (state.current >= items.length) state.current = 0;
  const doc = items[state.current].doc;

  // Dropdown trigger
  const multiple = items.length > 1;
  $("#comp-name").textContent = doc.name;
  $("#comp-meta").textContent = metaOf(doc);
  const index = $("#comp-index");
  index.hidden = !multiple;
  index.textContent = `${state.current + 1} of ${items.length}`;
  $("#chev").style.display = multiple ? "" : "none";
  const trigger = $<HTMLButtonElement>("#trigger");
  trigger.disabled = !multiple;
  trigger.setAttribute("aria-label", `Component: ${doc.name}`);
  if (!multiple) closeMenu();

  // Code
  setSeg("format", state.format);
  const code = exportDoc(doc, state.format);
  const pre = $("#code");
  pre.replaceChildren(highlight(code, state.format));
  if (swapCode) replay(pre, "swap");
  const base = state.format === "typescript" ? `${doc.name.replace(/[^A-Za-z0-9]+/g, "")}Props` : doc.name;
  $("#file-name").textContent = `${base}.${FILE_EXT[state.format]}`;
  $("#line-count").textContent = plural(code.trimEnd().split("\n").length, "line");

  // Dev Mode summary
  const summary = $("#summary");
  summary.hidden = state.mode !== "dev";
  if (state.mode === "dev") {
    $("#summary-rows").replaceChildren(
      ...doc.props.map((p) =>
        el("div", { class: "sum-row" }, [
          el("span", { text: p.nestedPath ? `${p.nestedPath} → ${p.name}` : p.name, style: "font-weight: 500" }),
          el("span", { class: "muted", text: TYPE_LABELS[p.type] }),
          el("span", { class: "mono", text: defaultLabel(p) }),
        ])
      )
    );
  }

  renderCopy();
}

function renderCopy(): void {
  const btn = $<HTMLButtonElement>("#copy");
  const label = el("span", { class: "btn-label" }, [
    svg(state.copied ? ICON.check : ICON.copy),
    state.copied ? "Copied" : `Copy ${FORMAT_LABEL[state.format]}`,
  ]);
  btn.replaceChildren(label);
}

// --- Component dropdown ---

const menu = $("#menu");
const trigger = $<HTMLButtonElement>("#trigger");

function openMenu(): void {
  if (state.selection.length < 2) return;
  state.menuOpen = true;
  $("#menu-head").textContent = `${state.selection.length} components selected`;
  $("#menu-items").replaceChildren(
    ...state.selection.map((item, i) => {
      const option = el("button", { class: "menu-item", type: "button", role: "option", "aria-selected": String(i === state.current), style: `animation-delay: ${i * 35}ms` }, [
        el("span", { class: "mini-icon" }, [svg(ICON.component)]),
        el("span", { class: "comp-text" }, [
          el("span", { text: item.doc.name, style: "font-weight: 600" }),
          el("span", { class: "comp-meta", text: metaOf(item.doc) }),
        ]),
        svg(ICON.tick),
      ]);
      option.addEventListener("click", () => {
        state.current = i;
        closeMenu();
        trigger.focus();
        renderExport(true);
      });
      return option;
    })
  );
  menu.classList.add("is-open");
  trigger.setAttribute("aria-expanded", "true");
  const selected = $<HTMLButtonElement>('.menu-item[aria-selected="true"]', menu);
  requestAnimationFrame(() => selected?.focus());
}

function closeMenu(): void {
  if (!state.menuOpen) return;
  state.menuOpen = false;
  menu.classList.remove("is-open");
  trigger.setAttribute("aria-expanded", "false");
}

trigger.addEventListener("click", () => (state.menuOpen ? closeMenu() : openMenu()));
document.addEventListener("mousedown", (e) => {
  if (state.menuOpen && !$("#dropdown").contains(e.target as Node)) closeMenu();
});
$("#dropdown").addEventListener("keydown", (e) => {
  if (e.key === "Escape" && state.menuOpen) {
    e.preventDefault();
    closeMenu();
    trigger.focus();
    return;
  }
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    if (!state.menuOpen) return openMenu();
    const options = $$<HTMLButtonElement>(".menu-item", menu);
    const at = options.indexOf(document.activeElement as HTMLButtonElement);
    const next = (at + (e.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
    options[next]?.focus();
  }
});

// --- Export actions ---

onSeg("format", (value) => {
  if (value === state.format) return;
  state.format = value as ExportFormat;
  state.copied = false;
  renderExport(true);
});

let copyTimer = 0;
$("#copy").addEventListener("click", () => {
  const doc = state.selection[state.current]?.doc;
  if (!doc) return;
  const ok = copyText(exportDoc(doc, state.format));
  if (!ok) {
    send({ type: "copied", what: `${FORMAT_LABEL[state.format]} failed — select the text and copy it` });
    return;
  }
  state.copied = true;
  renderCopy();
  showToast(`Copied ${FORMAT_LABEL[state.format]} to clipboard`);
  clearTimeout(copyTimer);
  copyTimer = window.setTimeout(() => {
    state.copied = false;
    renderCopy();
  }, 1800);
});

/** navigator.clipboard is blocked in plugin iframes; execCommand still works. */
function copyText(text: string): boolean {
  const area = el("textarea", { readonly: true, style: "position: fixed; top: -9999px; opacity: 0" }) as HTMLTextAreaElement;
  area.value = text;
  document.body.append(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  area.remove();
  return ok;
}

let toastTimer = 0;
function showToast(message: string): void {
  $("#toast-text").textContent = message;
  const toast = $("#toast");
  toast.classList.add("is-on");
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("is-on"), 1800);
}

// --- Checks ---

onSeg("scope", (value) => {
  if (value === state.scope) return;
  state.scope = value as "selection" | "page";
  setSeg("scope", state.scope);
  if (state.scope === "page") requestPage();
  render(true);
});

$("#refresh").addEventListener("click", requestPage);

function requestPage(): void {
  state.pageIssues = null;
  send({ type: "requestPageIssues" });
  if (state.tab === "checks") renderChecks();
}

function renderChecks(): void {
  setSeg("scope", state.scope);
  const selectionCount = state.selection.reduce((n, s) => n + s.issues.length, 0);
  $("#count-selection").textContent = String(selectionCount);
  $("#count-page").textContent = state.pageIssues ? String(state.pageIssues.reduce((n, g) => n + g.issues.length, 0)) : "–";
  $("#refresh").hidden = state.scope !== "page";

  const container = $("#groups");
  let groups: { id: string; name: string; issues: LintIssue[] }[];
  if (state.scope === "page") {
    if (!state.pageIssues) {
      $("#issue-summary").textContent = "Checking components on this page…";
      container.replaceChildren();
      return;
    }
    groups = state.pageIssues;
  } else {
    groups = state.selection.filter((s) => s.issues.length).map((s) => ({ id: s.doc.id, name: s.doc.name, issues: s.issues }));
  }

  const total = groups.reduce((n, g) => n + g.issues.length, 0);
  $("#issue-summary").textContent = total ? `${plural(total, "issue")} in ${plural(groups.length, "component")}` : "";
  if (total === 0) {
    container.replaceChildren(el("div", { class: "all-good" }, [svg(ICON.ok), state.scope === "page" ? "No issues on this page." : "No issues in the selection."]));
    return;
  }

  let n = 0;
  container.replaceChildren(
    ...groups.map((g) =>
      el("div", { class: "card" }, [
        el("div", { class: "group-head" }, [
          svg(ICON.component),
          el("span", { class: "name", text: g.name }),
          el("span", { class: "count warn", text: String(g.issues.length) }),
        ]),
        ...g.issues.map((issue) => {
          const btn = el("button", { class: "issue", type: "button", style: `animation-delay: ${Math.min(n++, 12) * 45}ms` }, [
            svg(ICON.warn),
            el("span", { class: "text" }, [
              el("span", { class: "title", text: issue.prop ?? "Component" }),
              el("span", { class: "msg", text: issue.message }),
            ]),
            el("span", { class: "go" }, ["Select", svg(ICON.go)]),
          ]);
          btn.addEventListener("click", () => send({ type: "select", id: g.id }));
          return btn;
        }),
      ])
    )
  );
}

// --- Settings ---

const ACCENTS = [
  { name: "Violet", hex: "#7C3AED" },
  { name: "Blue", hex: "#2563EB" },
  { name: "Teal", hex: "#0F766E" },
  { name: "Orange", hex: "#C2410C" },
  { name: "Graphite", hex: "#3F3F46" },
];

type ToggleDef = { path: string; label: string; indent?: boolean; dependsOn?: string };
const TOGGLE_GROUPS: { title: string; items: ToggleDef[] }[] = [
  {
    title: "Columns",
    items: [
      { path: "columns.type", label: "Type" },
      { path: "columns.default", label: "Default and options" },
      { path: "columns.notes", label: "Notes" },
    ],
  },
  {
    title: "Sections",
    items: [
      { path: "sections.nested", label: "Nested properties" },
      { path: "sections.variants", label: "Variants" },
      { path: "sections.previews", label: "Variant previews", indent: true, dependsOn: "sections.variants" },
      { path: "sections.tokens", label: "Tokens" },
    ],
  },
  {
    title: "Marks",
    items: [
      { path: "changeMarks", label: "Highlight changes since last update" },
      { path: "lintMarks", label: "Show lint warnings" },
    ],
  },
];

function getPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], obj);
}

function setPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split(".");
  const last = keys.pop()!;
  const target = keys.reduce<Record<string, unknown>>((o, k) => o[k] as Record<string, unknown>, obj);
  target[last] = value;
}

function update(mutate: (s: Settings) => void, moved?: { type: PropType; dir: number }): void {
  if (!state.settings) return;
  const next = JSON.parse(JSON.stringify(state.settings)) as Settings;
  mutate(next);
  state.settings = next;
  renderSettings(moved);
  send({ type: "saveSettings", settings: next });
  replay($(".saved"), "pulse");
}

// Toggle rows are built once, then updated in place so the knob can slide.
const toggleButtons = new Map<string, { button: HTMLButtonElement; row: HTMLElement; def: ToggleDef }>();
$("#toggle-groups").replaceChildren(
  ...TOGGLE_GROUPS.map((group) =>
    el("section", { class: "group" }, [
      el("h2", { text: group.title }),
      el(
        "div",
        { class: "card" },
        group.items.map((def) => {
          const id = `tg-${def.path.replace(/\./g, "-")}`;
          const button = el("button", { class: "switch", type: "button", role: "switch", "aria-checked": "false", "aria-labelledby": id }) as HTMLButtonElement;
          button.addEventListener("click", () => update((s) => setPath(s as unknown as Record<string, unknown>, def.path, !getPath(s, def.path))));
          const row = el("div", { class: def.indent ? "row indent" : "row" }, [el("span", { class: "row-label", id, text: def.label }), button]);
          toggleButtons.set(def.path, { button, row, def });
          return row;
        })
      ),
    ])
  )
);

const swatchButtons: HTMLButtonElement[] = [];
const customInput = el("input", { type: "color", "aria-label": "Custom accent colour" }) as HTMLInputElement;
const customSwatch = el("label", { class: "swatch swatch-custom", title: "Custom colour" }, [customInput]);
$("#swatches").replaceChildren(
  ...ACCENTS.map((a) => {
    const b = el("button", { class: "swatch", type: "button", "aria-label": a.name, "aria-pressed": "false", style: `background: ${a.hex}` }) as HTMLButtonElement;
    b.dataset.hex = a.hex;
    b.addEventListener("click", () => update((s) => (s.accent = a.hex)));
    swatchButtons.push(b);
    return b;
  }),
  customSwatch
);
customInput.addEventListener("change", () => update((s) => (s.accent = customInput.value.toUpperCase())));

onSeg("theme", (value) => update((s) => (s.theme = value as Settings["theme"])));
onSeg("placement", (value) => update((s) => (s.placement = value as Settings["placement"])));

const fontInput = $<HTMLInputElement>("#font");
fontInput.addEventListener("change", () => update((s) => (s.font = fontInput.value.trim() || "Inter")));
fontInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") fontInput.blur();
});

$("#reset").addEventListener("click", () => {
  send({ type: "resetSettings" });
  replay($(".saved"), "pulse");
});

function renderSettings(moved?: { type: PropType; dir: number }): void {
  const s = state.settings ?? DEFAULT_SETTINGS;
  setSeg("theme", s.theme);
  setSeg("placement", s.placement);
  if (document.activeElement !== fontInput) fontInput.value = s.font;

  const preset = ACCENTS.some((a) => a.hex.toLowerCase() === s.accent.toLowerCase());
  for (const b of swatchButtons) b.setAttribute("aria-pressed", String(b.dataset.hex!.toLowerCase() === s.accent.toLowerCase()));
  customSwatch.style.boxShadow = preset ? "" : "0 0 0 2px var(--bg), 0 0 0 4px var(--fg)";
  if (!preset) customSwatch.style.background = s.accent;
  else customSwatch.style.background = "";
  customInput.value = s.accent;

  for (const { button, row, def } of toggleButtons.values()) {
    const disabled = !!def.dependsOn && !getPath(s, def.dependsOn);
    button.disabled = disabled;
    button.setAttribute("aria-checked", String(!disabled && !!getPath(s, def.path)));
    row.classList.toggle("is-off", disabled);
  }

  const order = s.typeOrder;
  $("#type-order").replaceChildren(
    ...order.map((t, i) => {
      const label = TYPE_LABELS[t];
      const up = el("button", { class: "icon-btn", type: "button", "aria-label": `Move ${label} up`, disabled: i === 0 }, [svg(ICON.up)]);
      const down = el("button", { class: "icon-btn", type: "button", "aria-label": `Move ${label} down`, disabled: i === order.length - 1 }, [svg(ICON.down)]);
      const move = (d: number) => {
        const next = [...order];
        [next[i], next[i + d]] = [next[i + d], next[i]];
        update((x) => (x.typeOrder = next), { type: t, dir: d });
      };
      up.addEventListener("click", () => move(-1));
      down.addEventListener("click", () => move(1));
      const li = el("li", { class: moved?.type === t ? "flash" : "" }, [svg(ICON.grip), el("span", { text: label }), up, down]);
      if (moved?.type === t) {
        // Keep keyboard focus on the row that moved.
        const preferred = moved.dir < 0 ? up : down;
        requestAnimationFrame(() => ((preferred as HTMLButtonElement).disabled ? (moved.dir < 0 ? down : up) : preferred).focus());
      }
      return li;
    })
  );
}

// --- Messages from the plugin ---

window.onmessage = (event: MessageEvent) => {
  const msg = event.data?.pluginMessage as ToUi | undefined;
  if (!msg) return;
  switch (msg.type) {
    case "init":
      state.mode = msg.mode;
      state.settings = msg.settings;
      $("#settings-tab").hidden = msg.mode === "dev";
      $("#dev-banner").hidden = msg.mode !== "dev";
      renderSettings();
      setTab(state.tab, false);
      break;
    case "settings":
      state.settings = msg.settings;
      renderSettings();
      break;
    case "selection": {
      // While the plugin reads a new selection, keep showing the previous one.
      if (msg.loading && state.selection.length) break;
      const prevId = state.selection[state.current]?.doc.id;
      state.selection = msg.items;
      state.loading = !!msg.loading;
      state.error = msg.error ?? "";
      const keep = msg.items.findIndex((i) => i.doc.id === prevId);
      state.current = keep === -1 ? 0 : keep;
      render();
      break;
    }
    case "pageIssues":
      state.pageIssues = msg.items;
      if (state.tab === "checks") renderChecks();
      break;
  }
};

// First paint before the plugin's init message arrives.
setSeg("format", state.format);
setSeg("scope", state.scope);
renderSettings();
setTab("export", false);
