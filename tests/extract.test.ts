import { describe, expect, it } from "vitest";
import { extract, groupTokens } from "../src/model/extract";
import { rawButton } from "./fixtures";

describe("extract", () => {
  it("strips # suffixes and sorts by type order", () => {
    const doc = extract(rawButton());
    expect(doc.props.map((p) => p.name)).toEqual(["Size", "Show icon", "Icon", "Label", "Count"]);
  });

  it("respects a custom type order", () => {
    const doc = extract(rawButton(), ["TEXT", "VARIANT", "BOOLEAN", "INSTANCE_SWAP", "SLOT"]);
    expect(doc.props.slice(0, 2).map((p) => p.name)).toEqual(["Label", "Size"]);
  });

  it("keeps nested props after own props, scoped by instance", () => {
    const doc = extract(rawButton());
    const count = doc.props.find((p) => p.name === "Count")!;
    expect(count.nestedPath).toBe("Badge");
  });

  it("records preferred values and resolved default names", () => {
    const icon = extract(rawButton()).props.find((p) => p.name === "Icon")!;
    expect(icon.defaultName).toBe("Arrow");
    expect(icon.preferred?.map((p) => p.name)).toEqual(["Arrow", "Plus"]);
  });

  it("marks whether booleans control any layer", () => {
    const raw = rawButton({ visibilityRefs: [] });
    expect(extract(raw).props.find((p) => p.name === "Show icon")!.controlsLayers).toBe(false);
    expect(extract(rawButton()).props.find((p) => p.name === "Show icon")!.controlsLayers).toBe(true);
  });

  it("keeps variant docs for sets and drops them for single components", () => {
    expect(extract(rawButton()).variants).toHaveLength(3);
    expect(extract(rawButton({ kind: "COMPONENT" })).variants).toHaveLength(0);
  });

  it("ignores unknown property types", () => {
    const raw = rawButton({ definitions: { Weird: { type: "FUTURE", defaultValue: "x" } }, nested: [] });
    expect(extract(raw).props).toEqual([]);
  });

  it("dedupes and groups tokens", () => {
    const doc = extract(rawButton());
    expect(doc.tokens).toHaveLength(3);
    expect(groupTokens(doc.tokens)).toEqual([
      { collection: "Color", items: [{ variable: "bg/primary", uses: "fill on Background, Border" }] },
      { collection: "Spacing", items: [{ variable: "space/2", uses: "paddingLeft on Button" }] },
    ]);
  });
});
