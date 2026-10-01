import { NameResolver } from "../figmaAdapter";
import { loadSettings } from "../storage";
import { palette, loadFonts } from "../render/theme";
import { BuildEnv } from "./build";

/** Load settings and fonts once per run. */
export async function createEnv(): Promise<{ env: BuildEnv; warning?: string }> {
  const settings = loadSettings();
  const { fonts, warning } = await loadFonts(settings.font);
  return {
    env: { settings, ctx: { fonts, colors: palette(settings) }, resolver: new NameResolver(), placed: [] },
    warning,
  };
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export interface RunSummary {
  created: number;
  updated: number;
  missing: number;
  failed: string[];
}

export function summarize(s: RunSummary, warning?: string): string {
  const parts: string[] = [];
  if (s.created) parts.push(`Created ${s.created}`);
  if (s.updated) parts.push(`Updated ${s.updated}`);
  if (!s.created && !s.updated) parts.push("No tables changed");
  if (s.missing) parts.push(`${plural(s.missing, "component")} missing`);
  if (s.failed.length) parts.push(`${s.failed.length} failed: ${s.failed.slice(0, 3).join(", ")}${s.failed.length > 3 ? "…" : ""} (see console)`);
  if (warning) parts.push(warning);
  return parts.join(" · ");
}
