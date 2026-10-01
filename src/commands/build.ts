// Builds or rebuilds the table for one component. Shared by every command.

import { DocTarget, FULL_READ, NameResolver, readComponent } from "../figmaAdapter";
import { diff, makeSnapshot } from "../model/diff";
import { extract } from "../model/extract";
import { lint } from "../model/lint";
import { Settings } from "../model/types";
import { Ctx } from "../render/primitives";
import { buildTable } from "../render/table";
import { findExistingTable, getSnapshot, linkTable, readNotes } from "../storage";

export interface BuildEnv {
  settings: Settings;
  ctx: Ctx;
  resolver: NameResolver;
  /** Absolute rects of tables placed during this run, to avoid overlaps. */
  placed: Rect[];
}

export interface BuildResult {
  table: FrameNode;
  updated: boolean;
}

const GAP = 100;

export async function buildFor(
  target: DocTarget,
  env: BuildEnv,
  positionRef: SceneNode,
  existing?: FrameNode | null
): Promise<BuildResult> {
  const old = existing === undefined ? await findExistingTable(target) : existing;
  const previous = old ? getSnapshot(old) : null;
  const notes = old ? readNotes(old) : {};

  const raw = await readComponent(target, FULL_READ, env.resolver);
  const doc = extract(raw, env.settings.typeOrder);
  const builtAt = new Date();

  const table = await buildTable({
    doc,
    settings: env.settings,
    ctx: env.ctx,
    changes: diff(doc, previous),
    issues: lint(doc),
    notes,
    builtAt,
  });

  if (old && old.parent) {
    // Rebuild in place: same parent, same position, same layer order.
    const parent = old.parent;
    const index = parent.children.indexOf(old);
    parent.insertChild(index, table);
    table.x = old.x;
    table.y = old.y;
    old.remove();
  } else {
    place(table, positionRef, env);
  }

  linkTable(table, target, makeSnapshot(doc, builtAt));
  return { table, updated: !!old };
}

function place(table: FrameNode, ref: SceneNode, env: BuildEnv): void {
  const parent = ref.parent && (ref.parent.type === "SECTION" || ref.parent.type === "PAGE") ? ref.parent : null;
  const page = figma.currentPage;
  const box = ref.absoluteBoundingBox ?? { x: ref.x, y: ref.y, width: ref.width, height: ref.height };

  let x = env.settings.placement === "below" ? box.x : box.x + box.width + GAP;
  let y = env.settings.placement === "below" ? box.y + box.height + GAP : box.y;

  // Stack below any table already placed in this run that we would overlap.
  let moved = true;
  while (moved) {
    moved = false;
    for (const r of env.placed) {
      const overlaps = x < r.x + r.width && x + table.width > r.x && y < r.y + r.height && y + table.height > r.y;
      if (overlaps) {
        y = r.y + r.height + GAP;
        moved = true;
      }
    }
  }
  env.placed.push({ x, y, width: table.width, height: table.height });

  if (parent && parent.type === "SECTION") {
    parent.appendChild(table);
    const origin = parent.absoluteBoundingBox ?? { x: parent.x, y: parent.y };
    table.x = x - origin.x;
    table.y = y - origin.y;
  } else {
    page.appendChild(table);
    table.x = x;
    table.y = y;
  }
}
