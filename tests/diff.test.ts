import { describe, expect, it } from "vitest";
import { diff, makeSnapshot, parseSnapshot } from "../src/model/diff";
import { extract } from "../src/model/extract";
import { rawButton } from "./fixtures";

describe("diff", () => {
  it("returns no marks without a previous snapshot", () => {
    expect(diff(extract(rawButton()), null)).toEqual({ marks: {}, removed: [] });
  });

  it("returns no marks when nothing changed", () => {
    const doc = extract(rawButton());
    expect(diff(doc, makeSnapshot(doc))).toEqual({ marks: {}, removed: [] });
  });

  it("detects new, changed and removed props", () => {
    const before = extract(rawButton());
    const raw = rawButton();
    delete raw.definitions["Label#1:0"];
    raw.definitions["Size"] = { type: "VARIANT", defaultValue: "md", variantOptions: ["sm", "md", "lg", "xl"] };
    raw.definitions["Disabled#5:0"] = { type: "BOOLEAN", defaultValue: false };
    const result = diff(extract(raw), makeSnapshot(before));
    expect(result.marks).toEqual({ Size: "changed", Disabled: "new" });
    expect(result.removed).toEqual(["Label"]);
  });

  it("scopes nested props by instance", () => {
    const before = extract(rawButton());
    const after = extract(rawButton({ nested: [{ instanceName: "Chip", definitions: { "Count#4:0": { type: "TEXT", defaultValue: "3" } } }] }));
    const result = diff(after, makeSnapshot(before));
    expect(result.marks).toEqual({ "Chip/Count": "new" });
    expect(result.removed).toEqual(["Badge/Count"]);
  });

  it("parses only valid v2 snapshots", () => {
    const snap = makeSnapshot(extract(rawButton()), new Date("2026-10-01T00:00:00Z"));
    expect(parseSnapshot(JSON.stringify(snap))).toEqual(snap);
    expect(parseSnapshot("")).toBeNull();
    expect(parseSnapshot("not json")).toBeNull();
    expect(parseSnapshot(JSON.stringify({ version: 1 }))).toBeNull();
  });
});
