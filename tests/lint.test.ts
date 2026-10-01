import { describe, expect, it } from "vitest";
import { extract } from "../src/model/extract";
import { lint } from "../src/model/lint";
import { rawButton } from "./fixtures";

const rules = (raw: ReturnType<typeof rawButton>) => lint(extract(raw)).map((i) => `${i.rule}${i.prop ? ":" + i.prop : ""}`);

describe("lint", () => {
  it("flags only the partially described variants on the fixture", () => {
    expect(rules(rawButton())).toEqual(["variant-missing-description"]);
  });

  it("flags missing description and doc link", () => {
    expect(rules(rawButton({ description: "  ", docLinks: [] }))).toEqual(
      expect.arrayContaining(["missing-description", "missing-doc-link"])
    );
  });

  it("does not flag variants when none or all are described", () => {
    const none = rawButton();
    none.variants = none.variants.map((v) => ({ ...v, description: "" }));
    expect(rules(none)).not.toContain("variant-missing-description");
    const all = rawButton();
    all.variants = all.variants.map((v) => ({ ...v, description: "x" }));
    expect(rules(all)).not.toContain("variant-missing-description");
  });

  it("flags mixed variant casing", () => {
    const raw = rawButton();
    raw.definitions["Size"] = { type: "VARIANT", defaultValue: "sm", variantOptions: ["sm", "Medium", "LG"] };
    expect(rules(raw)).toContain("variant-casing:Size");
  });

  it("accepts consistent variant casing", () => {
    const raw = rawButton();
    raw.definitions["State"] = { type: "VARIANT", defaultValue: "Default", variantOptions: ["Default", "Hover state", "Pressed"] };
    expect(rules(raw)).not.toContain("variant-casing:State");
  });

  it("flags unused booleans", () => {
    expect(rules(rawButton({ visibilityRefs: [] }))).toContain("boolean-unused:Show icon");
  });

  it("flags empty text defaults", () => {
    const raw = rawButton();
    raw.definitions["Label#1:0"] = { type: "TEXT", defaultValue: " " };
    expect(rules(raw)).toContain("text-empty-default:Label");
  });

  it("flags whitespace and duplicate names", () => {
    const raw = rawButton();
    raw.definitions["Label #9:0"] = { type: "TEXT", defaultValue: "x" };
    raw.definitions["Show  icon#8:0"] = { type: "BOOLEAN", defaultValue: true };
    raw.visibilityRefs.push("Show  icon#8:0");
    const r = rules(raw);
    expect(r).toContain("name-whitespace:Label ");
    expect(r).toContain("duplicate-name:Label");
    expect(r).toContain("duplicate-name:Label ");
    expect(r).toContain("name-whitespace:Show  icon");
  });
});
