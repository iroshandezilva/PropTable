import { DocTarget, UserError, resolveTarget } from "../figmaAdapter";
import { findTableAncestor } from "../storage";
import { buildFor } from "./build";
import { RunSummary, createEnv, summarize } from "./context";

/** Generate or update tables for everything selected. */
export async function generate(): Promise<void> {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    throw new UserError("Select a component, component set, instance, or PropTable table.");
  }

  // Map selection to unique components, keeping the first reference node for placement.
  const targets = new Map<string, { target: DocTarget; ref: SceneNode; table: FrameNode | null }>();
  let unsupported = 0;
  for (const node of selection) {
    const target = await resolveTarget(node);
    if (!target) {
      unsupported++;
      continue;
    }
    if (!targets.has(target.id)) {
      targets.set(target.id, { target, ref: node.type === "COMPONENT" ? target : node, table: findTableAncestor(node) });
    }
  }
  if (targets.size === 0) {
    throw new UserError(
      selection.length === 1 && findTableAncestor(selection[0])
        ? "The component for this table could not be found."
        : "Select a component, component set, instance, or PropTable table."
    );
  }

  const { env, warning } = await createEnv();
  const summary: RunSummary = { created: 0, updated: 0, missing: 0, failed: [] };
  const built: FrameNode[] = [];

  for (const { target, ref, table } of targets.values()) {
    try {
      const result = await buildFor(target, env, ref, table ?? undefined);
      built.push(result.table);
      if (result.updated) summary.updated++;
      else summary.created++;
    } catch (err) {
      if (targets.size === 1) throw err;
      console.error(`PropTable: failed on ${target.name}`, err);
      summary.failed.push(target.name);
    }
  }

  if (built.length) {
    figma.currentPage.selection = built.filter((t) => t.parent && pageOfNode(t) === figma.currentPage);
    figma.viewport.scrollAndZoomIntoView(built);
  }
  const skipped = unsupported ? ` · ${unsupported} unsupported layer${unsupported === 1 ? "" : "s"} skipped` : "";
  figma.notify(`✓ ${summarize(summary, warning)}${skipped}`);
}

function pageOfNode(node: BaseNode): BaseNode | null {
  let n: BaseNode | null = node;
  while (n && n.type !== "PAGE") n = n.parent;
  return n;
}
