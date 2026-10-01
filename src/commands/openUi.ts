import { FULL_READ, LIGHT_READ, NameResolver, pageOf, readComponent, resolveTarget } from "../figmaAdapter";
import { extract } from "../model/extract";
import { lint } from "../model/lint";
import { PageIssueItem, SelectionItem, ToPlugin, ToUi } from "../messages";
import { loadSettings, resetSettings, saveSettings } from "../storage";

const MAX_SELECTION = 10;

function post(msg: ToUi): void {
  figma.ui.postMessage(msg);
}

/** Opens the window. Used for "Open PropTable…" and for Dev Mode. */
export function openUi(mode: "figma" | "dev"): void {
  figma.showUI(__html__, { width: 360, height: 520, themeColors: true, title: "PropTable" });
  post({ type: "init", settings: loadSettings(), mode });

  let run = 0;
  const sendSelection = async () => {
    const current = ++run;
    post({ type: "selection", items: [], loading: true });
    try {
      const items = await readSelection();
      if (current === run) post({ type: "selection", items });
    } catch (err) {
      if (current === run) post({ type: "selection", items: [], error: err instanceof Error ? err.message : String(err) });
    }
  };

  figma.on("selectionchange", sendSelection);
  void sendSelection();

  figma.ui.onmessage = async (msg: ToPlugin) => {
    try {
      await handle(msg, mode);
    } catch (err) {
      console.error(err);
      figma.notify(`PropTable failed: ${err instanceof Error ? err.message : String(err)}`, { error: true });
    }
  };
}

async function handle(msg: ToPlugin, mode: "figma" | "dev"): Promise<void> {
  switch (msg.type) {
    case "saveSettings":
      if (mode === "figma") post({ type: "settings", settings: saveSettings(msg.settings) });
      break;
    case "resetSettings":
      if (mode === "figma") post({ type: "settings", settings: resetSettings() });
      break;
    case "select":
      await selectNode(msg.id);
      break;
    case "requestPageIssues":
      post({ type: "pageIssues", items: await readPageIssues() });
      break;
    case "copied":
      figma.notify(`Copied ${msg.what}`);
      break;
  }
}

async function readSelection(): Promise<SelectionItem[]> {
  const settings = loadSettings();
  const resolver = new NameResolver();
  const seen = new Set<string>();
  const items: SelectionItem[] = [];
  for (const node of figma.currentPage.selection) {
    const target = await resolveTarget(node);
    if (!target || seen.has(target.id)) continue;
    seen.add(target.id);
    const doc = extract(await readComponent(target, FULL_READ, resolver), settings.typeOrder);
    items.push({ doc, issues: lint(doc) });
    if (items.length >= MAX_SELECTION) break;
  }
  return items;
}

async function readPageIssues(): Promise<PageIssueItem[]> {
  const settings = loadSettings();
  const resolver = new NameResolver();
  const nodes = figma.currentPage
    .findAllWithCriteria({ types: ["COMPONENT", "COMPONENT_SET"] })
    .filter((n) => !(n.type === "COMPONENT" && n.parent?.type === "COMPONENT_SET"));
  const items: PageIssueItem[] = [];
  for (const node of nodes) {
    try {
      const doc = extract(await readComponent(node, LIGHT_READ, resolver), settings.typeOrder);
      const issues = lint(doc);
      if (issues.length) items.push({ id: node.id, name: node.name, issues });
    } catch (err) {
      console.error(`PropTable: checks skipped ${node.name}`, err);
    }
  }
  return items.sort((a, b) => a.name.localeCompare(b.name));
}

async function selectNode(id: string): Promise<void> {
  const node = await figma.getNodeByIdAsync(id);
  if (!node || node.type === "PAGE" || node.type === "DOCUMENT") {
    figma.notify("That component no longer exists.");
    return;
  }
  const page = pageOf(node);
  if (page && page !== figma.currentPage) await figma.setCurrentPageAsync(page);
  const scene = node as SceneNode;
  figma.currentPage.selection = [scene];
  figma.viewport.scrollAndZoomIntoView([scene]);
}
