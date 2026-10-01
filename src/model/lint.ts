import { casingStyle, hasBadWhitespace } from "./names";
import { ComponentDoc, LintIssue, propId } from "./types";

export function lint(doc: ComponentDoc): LintIssue[] {
  const issues: LintIssue[] = [];

  if (!doc.description.trim()) {
    issues.push({ rule: "missing-description", message: "Component has no description" });
  }
  if (doc.docLinks.length === 0) {
    issues.push({ rule: "missing-doc-link", message: "Component has no documentation link" });
  }

  if (doc.variants.length > 0) {
    const described = doc.variants.filter((v) => v.description.trim()).length;
    const missing = doc.variants.length - described;
    if (described > 0 && missing > 0) {
      issues.push({
        rule: "variant-missing-description",
        message: `${missing} of ${doc.variants.length} variants ${missing === 1 ? "has" : "have"} no description`,
      });
    }
  }

  const seen = new Map<string, number>();
  for (const p of doc.props) {
    const scoped = propId({ name: p.name.trim(), nestedPath: p.nestedPath });
    seen.set(scoped, (seen.get(scoped) ?? 0) + 1);
  }

  for (const p of doc.props) {
    const id = propId(p);

    if (hasBadWhitespace(p.name)) {
      issues.push({ rule: "name-whitespace", message: "Name has extra spaces", prop: id });
    }
    if ((seen.get(propId({ name: p.name.trim(), nestedPath: p.nestedPath })) ?? 0) > 1) {
      issues.push({ rule: "duplicate-name", message: "Another property has the same name", prop: id });
    }
    if (p.type === "VARIANT" && p.options && p.options.length > 1) {
      const styles = new Set(p.options.map(casingStyle).filter((s) => s !== "other"));
      if (styles.size > 1) {
        issues.push({ rule: "variant-casing", message: "Options mix letter casing", prop: id });
      }
    }
    if (p.type === "BOOLEAN" && p.controlsLayers === false) {
      issues.push({ rule: "boolean-unused", message: "No layer uses this for visibility", prop: id });
    }
    if (p.type === "TEXT" && !String(p.defaultValue).trim()) {
      issues.push({ rule: "text-empty-default", message: "Default text is empty", prop: id });
    }
  }

  return issues;
}
