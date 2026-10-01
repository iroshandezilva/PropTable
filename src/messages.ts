// Messages between the plugin (code.js) and the window (ui.html).

import { ComponentDoc, LintIssue, Settings } from "./model/types";

export interface SelectionItem {
  doc: ComponentDoc;
  issues: LintIssue[];
}

export interface PageIssueItem {
  id: string;
  name: string;
  issues: LintIssue[];
}

export type ToUi =
  | { type: "init"; settings: Settings; mode: "figma" | "dev" }
  | { type: "settings"; settings: Settings }
  | { type: "selection"; items: SelectionItem[]; loading?: boolean; error?: string }
  | { type: "pageIssues"; items: PageIssueItem[] };

export type ToPlugin =
  | { type: "saveSettings"; settings: Settings }
  | { type: "resetSettings" }
  | { type: "select"; id: string }
  | { type: "requestPageIssues" }
  | { type: "copied"; what: string };
