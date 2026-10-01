import { LIGHT_READ, NameResolver, readComponent } from "../figmaAdapter";
import { extract } from "../model/extract";
import { lint } from "../model/lint";
import { buildOverview, OverviewRow } from "../render/overview";
import { createEnv } from "./context";

const PAGE_NAME = "PropTable Overview";
const FRAME_NAME = "PropTable Overview";

export async function overview(): Promise<void> {
  await figma.loadAllPagesAsync();
  const { env, warning } = await createEnv();
  const resolver = new NameResolver();
  const rows: OverviewRow[] = [];
  let failed = 0;

  for (const page of figma.root.children) {
    if (page.name === PAGE_NAME) continue;
    const nodes = page.findAllWithCriteria({ types: ["COMPONENT", "COMPONENT_SET"] }).filter(
      (n) => !(n.type === "COMPONENT" && n.parent?.type === "COMPONENT_SET")
    );
    for (const node of nodes) {
      try {
        const doc = extract(await readComponent(node, LIGHT_READ, resolver), env.settings.typeOrder);
        rows.push({
          id: node.id,
          name: doc.name,
          page: page.name,
          props: doc.props.length,
          variants: doc.variants.length,
          hasDescription: !!doc.description.trim(),
          hasDocLink: doc.docLinks.length > 0,
          warnings: lint(doc).length,
        });
      } catch (err) {
        console.error(`PropTable: overview skipped ${node.name}`, err);
        failed++;
      }
    }
  }

  rows.sort((a, b) => a.page.localeCompare(b.page) || a.name.localeCompare(b.name));

  let page = figma.root.children.find((p) => p.name === PAGE_NAME);
  if (!page) {
    page = figma.createPage();
    page.name = PAGE_NAME;
  }
  const old = page.children.find((n) => n.name === FRAME_NAME && n.type === "FRAME");
  const frame = buildOverview(env.ctx, rows, new Date());
  frame.name = FRAME_NAME;
  page.appendChild(frame);
  if (old) {
    frame.x = old.x;
    frame.y = old.y;
    old.remove();
  }

  await figma.setCurrentPageAsync(page);
  figma.currentPage.selection = [frame];
  figma.viewport.scrollAndZoomIntoView([frame]);
  const extra = [failed ? `${failed} skipped (see console)` : "", warning ?? ""].filter(Boolean).join(" · ");
  figma.notify(`✓ Overview of ${rows.length} components${extra ? " · " + extra : ""}`);
}
