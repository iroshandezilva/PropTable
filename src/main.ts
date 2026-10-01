// PropTable — Figma plugin entry point.
// Sends each menu command (and Dev Mode) to its handler.

import { UserError } from "./figmaAdapter";
import { generate } from "./commands/generate";
import { openUi } from "./commands/openUi";
import { overview } from "./commands/overview";
import { updateAll } from "./commands/updateAll";

async function run(command: string): Promise<boolean> {
  // Dev Mode is read-only: always show the export window.
  if (figma.editorType === "dev") {
    openUi("dev");
    return false;
  }
  switch (command) {
    case "open":
      openUi("figma");
      return false;
    case "update-page":
      await updateAll("page");
      return true;
    case "update-file":
      await updateAll("file");
      return true;
    case "overview":
      await overview();
      return true;
    case "generate":
    default:
      // "generate", relaunch buttons, and runs without a command
      await generate();
      return true;
  }
}

run(figma.command)
  .then((close) => {
    if (close) figma.closePlugin();
  })
  .catch((err) => {
    if (err instanceof UserError) {
      figma.notify(err.message);
    } else {
      console.error(err);
      const message = err instanceof Error ? err.message : String(err);
      figma.notify(`PropTable failed: ${message}`, { error: true });
    }
    figma.closePlugin();
  });
