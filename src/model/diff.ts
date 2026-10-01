import { ComponentDoc, DiffResult, PropDoc, Snapshot, propId } from "./types";

export function signature(p: PropDoc): string {
  return JSON.stringify([
    p.type,
    p.defaultValue,
    p.options ?? [],
    (p.preferred ?? []).map((x) => x.id),
  ]);
}

export function makeSnapshot(doc: ComponentDoc, now: Date = new Date()): Snapshot {
  return {
    version: 2,
    props: doc.props.map((p) => ({ name: propId(p), type: p.type, signature: signature(p) })),
    builtAt: now.toISOString(),
  };
}

/** Compare the current doc with the snapshot saved on the previous build. */
export function diff(doc: ComponentDoc, previous: Snapshot | null): DiffResult {
  const result: DiffResult = { marks: {}, removed: [] };
  if (!previous) return result;

  const before = new Map(previous.props.map((p) => [p.name, p]));
  const current = new Set<string>();
  for (const p of doc.props) {
    const id = propId(p);
    current.add(id);
    const old = before.get(id);
    if (!old) result.marks[id] = "new";
    else if (old.signature !== signature(p)) result.marks[id] = "changed";
  }
  result.removed = previous.props.map((p) => p.name).filter((n) => !current.has(n));
  return result;
}

export function parseSnapshot(json: string): Snapshot | null {
  if (!json) return null;
  try {
    const s = JSON.parse(json);
    return s && s.version === 2 && Array.isArray(s.props) ? (s as Snapshot) : null;
  } catch {
    return null;
  }
}
