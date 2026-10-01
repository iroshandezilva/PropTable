import { ExportFormat, TYPE_LABELS, defaultLabel, exportDoc } from "../src/model/export";
import { DEFAULT_TYPE_ORDER, LintIssue, PropType, Settings } from "../src/model/types";
import type { PageIssueItem, SelectionItem, ToPlugin, ToUi } from "../src/messages";

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;
const $$ = <T extends HTMLElement>(sel: string) => Array.from(document.querySelectorAll(sel)) as T[];

function send(msg: ToPlugin): void {
  parent.postMessage({ pluginMessage: msg }, "*");
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, children: (Node | string)[] = []) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

const state = {
  mode: "figma" as "figma" | "dev",
  settings: null as Settings | null,
  selection: [] as SelectionItem[],
  loading: false,
  error: "",
  current: 0,
  format: "markdown" as ExportFormat,
  scope: "selection" as "selection" | "page",
  pageIssues: null as PageIssueItem[] | null,
};

// --- Tabs ---

for (const tab of $$<HTMLButtonElement>(".tabs button")) {
  tab.addEventListener("click", () => {
    for (const t of $$<HTMLButtonElement>(".tabs button")) t.setAttribute("aria-selected", String(t === tab));
    for (const p of $$<HTMLElement>(".panel")) p.hidden = p.id !== tab.dataset.tab;
    if (tab.dataset.tab === "checks" && state.scope === "page") send({ type: "requestPageIssues" });
  });
}

function pressed(group: HTMLElement[], active: HTMLElement): void {
  for (const b of group) b.setAttribute("aria-pressed", String(b === active));
}

// --- Export ---

const formatButtons = $$<HTMLButtonElement>("[data-format]");
for (const b of formatButtons) {
  b.addEventListener("click", () => {
    state.format = b.dataset.format as ExportFormat;
    pressed(formatButtons, b);
    renderExport();
  });
}

$<HTMLSelectElement>("#component-select").addEventListener("change", (e) => {
  state.current = Number((e.target as HTMLSelectElement).value);
  renderExport();
});

$<HTMLButtonElement>("#copy").addEventListener("click", () => {
  const output = $<HTMLTextAreaElement>("#output");
  output.focus();
  output.select();
  // navigator.clipboard is blocked in plugin iframes; execCommand still works.
  const ok = document.execCommand("copy");
  output.setSelectionRange(0, 0);
  const label = { markdown: "Markdown", json: "JSON", typescript: "TypeScript" }[state.format];
  send({ type: "copied", what: ok ? label : `${label} failed, select the text and copy it` });
});

function renderExport(): void {
  const items = state.selection;
  const empty = $<HTMLElement>("#export-empty");
  const body = $<HTMLElement>("#export-body");
  if (state.loading || state.error || items.length === 0) {
    empty.textContent = state.loading ? "Reading selection…" : state.error || "Select a component to export.";
    empty.hidden = false;
    body.hidden = true;
    return;
  }
  empty.hidden = true;
  body.hidden = false;
  if (state.current >= items.length) state.current = 0;

  const select = $<HTMLSelectElement>("#component-select");
  $<HTMLElement>("#component-field").hidden = items.length < 2;
  select.replaceChildren(...items.map((it, i) => el("option", { value: String(i), textContent: it.doc.name, selected: i === state.current })));

  const doc = items[state.current].doc;
  $<HTMLTextAreaElement>("#output").value = exportDoc(doc, state.format);

  const summary = $<HTMLElement>("#summary");
  summary.hidden = state.mode !== "dev";
  if (state.mode === "dev") {
    summary.replaceChildren(
      el("table", {}, [
        el("thead", {}, [el("tr", {}, [el("th", { textContent: "Property" }), el("th", { textContent: "Type" }), el("th", { textContent: "Default" })])]),
        el(
          "tbody",
          {},
          doc.props.map((p) =>
            el("tr", {}, [
              el("td", { textContent: p.nestedPath ? `${p.nestedPath} → ${p.name}` : p.name }),
              el("td", { textContent: TYPE_LABELS[p.type] }),
              el("td", { textContent: defaultLabel(p) }),
            ])
          )
        ),
      ])
    );
  }
}

// --- Checks ---

const scopeButtons = $$<HTMLButtonElement>("[data-scope]");
for (const b of scopeButtons) {
  b.addEventListener("click", () => {
    state.scope = b.dataset.scope as "selection" | "page";
    pressed(scopeButtons, b);
    if (state.scope === "page") {
      state.pageIssues = null;
      send({ type: "requestPageIssues" });
    }
    renderChecks();
  });
}

function renderChecks(): void {
  const container = $<HTMLElement>("#issues");
  let groups: { id: string; name: string; issues: LintIssue[] }[];
  if (state.scope === "page") {
    if (!state.pageIssues) {
      container.replaceChildren(el("p", { className: "ok", textContent: "Checking components on this page…" }));
      return;
    }
    groups = state.pageIssues;
  } else {
    if (state.selection.length === 0) {
      container.replaceChildren(el("p", { className: "ok", textContent: state.loading ? "Reading selection…" : "Select a component to check it." }));
      return;
    }
    groups = state.selection.filter((s) => s.issues.length).map((s) => ({ id: s.doc.id, name: s.doc.name, issues: s.issues }));
  }
  if (groups.length === 0) {
    container.replaceChildren(el("p", { className: "ok", textContent: "No issues found." }));
    return;
  }
  container.replaceChildren(
    ...groups.map((g) =>
      el("div", { className: "group" }, [
        el("h3", { textContent: `${g.name} · ${g.issues.length}` }),
        ...g.issues.map((issue) => {
          const btn = el("button", { className: "issue", title: "Select component" }, [
            el("span", { className: "icon", textContent: "⚠" }),
            el("span", {}, [issue.prop ? el("span", { className: "prop", textContent: `${issue.prop}: ` }) : "", issue.message]),
          ]);
          btn.addEventListener("click", () => send({ type: "select", id: g.id }));
          return btn;
        }),
      ])
    )
  );
}

// --- Settings ---

const form = $<HTMLFormElement>("#settings-form");

function getPath(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], obj);
}

function setPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split(".");
  const last = keys.pop()!;
  const target = keys.reduce<Record<string, unknown>>((o, k) => o[k] as Record<string, unknown>, obj);
  target[last] = value;
}

function renderSettings(): void {
  const s = state.settings;
  if (!s) return;
  for (const input of Array.from(form.elements) as HTMLInputElement[]) {
    if (!input.name) continue;
    const value = getPath(s as unknown as Record<string, unknown>, input.name);
    if (input.type === "checkbox") input.checked = !!value;
    else input.value = String(value ?? "");
  }
  renderTypeOrder(s.typeOrder);
}

function renderTypeOrder(order: PropType[]): void {
  const list = $<HTMLOListElement>("#type-order");
  list.replaceChildren(
    ...order.map((t, i) => {
      const up = el("button", { type: "button", textContent: "↑", disabled: i === 0, title: "Move up" });
      const down = el("button", { type: "button", textContent: "↓", disabled: i === order.length - 1, title: "Move down" });
      up.setAttribute("aria-label", `Move ${TYPE_LABELS[t]} up`);
      down.setAttribute("aria-label", `Move ${TYPE_LABELS[t]} down`);
      const move = (delta: number) => {
        const next = [...order];
        [next[i], next[i + delta]] = [next[i + delta], next[i]];
        update((s) => (s.typeOrder = next));
      };
      up.addEventListener("click", () => move(-1));
      down.addEventListener("click", () => move(1));
      return el("li", {}, [el("span", { textContent: TYPE_LABELS[t] }), up, down]);
    })
  );
}

function update(mutate: (s: Settings) => void): void {
  if (!state.settings) return;
  const next = JSON.parse(JSON.stringify(state.settings)) as Settings;
  mutate(next);
  state.settings = next;
  renderSettings();
  send({ type: "saveSettings", settings: next });
}

form.addEventListener("change", (e) => {
  const input = e.target as HTMLInputElement;
  if (!input.name) return;
  const value = input.type === "checkbox" ? input.checked : input.value;
  update((s) => setPath(s as unknown as Record<string, unknown>, input.name, value));
});

$<HTMLButtonElement>("#reset").addEventListener("click", () => send({ type: "resetSettings" }));

// --- Messages from the plugin ---

window.onmessage = (event: MessageEvent) => {
  const msg = event.data?.pluginMessage as ToUi | undefined;
  if (!msg) return;
  switch (msg.type) {
    case "init":
      state.mode = msg.mode;
      state.settings = msg.settings;
      $<HTMLElement>("#settings-tab").hidden = msg.mode === "dev";
      renderSettings();
      break;
    case "settings":
      state.settings = msg.settings;
      renderSettings();
      break;
    case "selection":
      state.selection = msg.items;
      state.loading = !!msg.loading;
      state.error = msg.error ?? "";
      renderExport();
      renderChecks();
      break;
    case "pageIssues":
      state.pageIssues = msg.items;
      renderChecks();
      break;
  }
};

// Initial render before the first message arrives.
state.settings = null;
renderTypeOrder(DEFAULT_TYPE_ORDER);
renderExport();
renderChecks();
