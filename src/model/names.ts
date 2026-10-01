/** "Label#12:3" → "Label" */
export function displayName(rawKey: string): string {
  const hash = rawKey.indexOf("#");
  return hash === -1 ? rawKey : rawKey.substring(0, hash);
}

function words(input: string): string[] {
  return input
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
}

/** "Show icon" → "showIcon", "2nd line" → "_2ndLine" */
export function camelCase(input: string): string {
  const parts = words(input);
  if (parts.length === 0) return "prop";
  const result = parts
    .map((w, i) => (i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()))
    .join("");
  return /^[0-9]/.test(result) ? `_${result}` : result;
}

/** "primary button" → "PrimaryButton" */
export function pascalCase(input: string): string {
  const c = camelCase(input).replace(/^_/, "");
  return c[0].toUpperCase() + c.slice(1);
}

export type CasingStyle = "lower" | "upper" | "title" | "camel" | "other";

export function casingStyle(value: string): CasingStyle {
  const letters = value.replace(/[^A-Za-z]/g, "");
  if (!letters) return "other";
  if (letters === letters.toLowerCase()) return "lower";
  if (letters === letters.toUpperCase()) return letters.length > 1 ? "upper" : "title";
  if (/^[a-z]/.test(letters)) return "camel";
  // Capitalised: "Medium", "Hover state", "Hover State"
  if (/^[A-Z]/.test(letters)) return "title";
  return "other";
}

export function hasBadWhitespace(name: string): boolean {
  return name !== name.trim() || /\s{2,}/.test(name);
}

/** Truncate long text to `max` characters, ending with an ellipsis. */
export function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}
