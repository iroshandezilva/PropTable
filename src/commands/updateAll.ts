import { findAllTables, SOURCE_ID_KEY } from "../storage";
import { buildFor } from "./build";
import { RunSummary, createEnv, summarize } from "./context";

/** Rebuild every table on the current page, or in the whole file. */
export async function updateAll(scope: "page" | "file"): Promise<void> {
  if (scope === "file") await figma.loadAllPagesAsync();
  const pages = scope === "file" ? figma.root.children : [figma.currentPage];
  const tables = await findAllTables(pages);

  if (tables.length === 0) {
    figma.notify(scope === "file" ? "No PropTable tables in this file." : "No PropTable tables on this page.");
    return;
  }

  const { env, warning } = await createEnv();
  const summary: RunSummary = { created: 0, updated: 0, missing: 0, failed: [] };

  for (const table of tables) {
    const source = await figma.getNodeByIdAsync(table.getPluginData(SOURCE_ID_KEY));
    if (!source || (source.type !== "COMPONENT" && source.type !== "COMPONENT_SET")) {
      summary.missing++; // leave the table alone
      continue;
    }
    try {
      await buildFor(source, env, table, table);
      summary.updated++;
    } catch (err) {
      console.error(`PropTable: failed on ${source.name}`, err);
      summary.failed.push(source.name);
    }
  }

  figma.notify(`✓ ${summarize(summary, warning)}`);
}
