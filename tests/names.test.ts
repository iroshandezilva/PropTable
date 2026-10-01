import { describe, expect, it } from "vitest";
import { camelCase, casingStyle, displayName, hasBadWhitespace, pascalCase, truncate } from "../src/model/names";

describe("names", () => {
  it("strips property key suffixes", () => {
    expect(displayName("Label#12:3")).toBe("Label");
    expect(displayName("Size")).toBe("Size");
  });

  it("camelCases", () => {
    expect(camelCase("Show icon")).toBe("showIcon");
    expect(camelCase("has-Left_icon")).toBe("hasLeftIcon");
    expect(camelCase("iconPosition")).toBe("iconPosition");
    expect(camelCase("2nd line")).toBe("_2ndLine");
    expect(camelCase("✨")).toBe("prop");
  });

  it("PascalCases", () => {
    expect(pascalCase("primary button")).toBe("PrimaryButton");
    expect(pascalCase("3d card")).toBe("3dCard");
  });

  it("detects casing styles", () => {
    expect(casingStyle("small")).toBe("lower");
    expect(casingStyle("LARGE")).toBe("upper");
    expect(casingStyle("Hover state")).toBe("title");
    expect(casingStyle("Medium")).toBe("title");
    expect(casingStyle("hoverState")).toBe("camel");
    expect(casingStyle("42")).toBe("other");
  });

  it("detects bad whitespace", () => {
    expect(hasBadWhitespace(" a")).toBe(true);
    expect(hasBadWhitespace("a  b")).toBe(true);
    expect(hasBadWhitespace("a b")).toBe(false);
  });

  it("truncates", () => {
    expect(truncate("abcdef", 4)).toBe("abc…");
    expect(truncate("abc", 4)).toBe("abc");
  });
});
