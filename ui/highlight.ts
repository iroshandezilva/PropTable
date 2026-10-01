// Small, safe syntax highlighter for the export preview.
// Builds DOM nodes (never innerHTML), so exported text can't inject markup.

import type { ExportFormat } from "../src/model/export";

type Rule = { re: RegExp; cls: (m: RegExpExecArray) => string };

const RULES: Record<ExportFormat, Rule[]> = {
  typescript: [
    { re: /\/\*[\s\S]*?\*\//y, cls: () => "tc" },
    { re: /"(?:[^"\\\n]|\\.)*"/y, cls: () => "ts" },
    { re: /\b(?:export|interface|boolean|string|number|true|false)\b/y, cls: () => "tk" },
  ],
  json: [
    // A string followed by a colon is a key.
    { re: /"(?:[^"\\\n]|\\.)*"(?=\s*:)/y, cls: () => "tn" },
    { re: /"(?:[^"\\\n]|\\.)*"/y, cls: () => "ts" },
    { re: /\b(?:true|false|null)\b/y, cls: () => "tk" },
    { re: /-?\b\d+(?:\.\d+)?\b/y, cls: () => "tn" },
  ],
  markdown: [
    { re: /^#{1,6} .*$/my, cls: () => "tk" },
    { re: /\]\([^)\n]*\)/y, cls: () => "ts" },
    { re: /^\|(?: ?-{3,} ?\|)+$/my, cls: () => "tc" },
    { re: /\|/y, cls: () => "tc" },
  ],
};

export function highlight(code: string, format: ExportFormat): DocumentFragment {
  const frag = document.createDocumentFragment();
  const rules = RULES[format];
  let plain = "";
  let i = 0;

  const flush = () => {
    if (plain) frag.append(plain);
    plain = "";
  };

  while (i < code.length) {
    let matched = false;
    for (const rule of rules) {
      rule.re.lastIndex = i;
      const m = rule.re.exec(code);
      if (m && m[0].length) {
        flush();
        const span = document.createElement("span");
        span.className = rule.cls(m);
        span.textContent = m[0];
        frag.append(span);
        i += m[0].length;
        matched = true;
        break;
      }
    }
    if (!matched) plain += code[i++];
  }
  flush();
  return frag;
}
