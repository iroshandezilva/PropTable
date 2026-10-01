import { describe, expect, it } from "vitest";
import { toJson, toMarkdown, toTypeScript } from "../src/model/export";
import { extract } from "../src/model/extract";
import { rawButton } from "./fixtures";

describe("export", () => {
  const doc = extract(rawButton());

  it("renders Markdown", () => {
    expect(toMarkdown(doc)).toMatchInlineSnapshot(`
      "## Button

      Triggers an action.

      [Documentation](https://example.com/button)

      | Property | Type | Default | Options |
      | --- | --- | --- | --- |
      | Size | Variant | md | sm, md, lg |
      | Show icon | Boolean | true |  |
      | Icon | Instance swap | Arrow | Arrow, Plus |
      | Label | Text | Click me |  |
      | Badge → Count | Text | 3 |  |

      ### Variants

      | Variant | Description |
      | --- | --- |
      | Size=sm | Dense tables. |
      | Size=lg | Page-level actions. [Docs](https://example.com/lg) |
      "
    `);
  });

  it("escapes pipes and newlines in Markdown cells", () => {
    const raw = rawButton({ nested: [] });
    raw.definitions["Label#1:0"] = { type: "TEXT", defaultValue: "a | b\nc" };
    expect(toMarkdown(extract(raw))).toContain("| Label | Text | a \\| b<br>c |  |");
  });

  it("renders JSON without internal ids", () => {
    const json = JSON.parse(toJson(doc));
    expect(json.properties[2]).toEqual({ name: "Icon", type: "INSTANCE_SWAP", default: "Arrow", preferred: ["Arrow", "Plus"] });
    expect(json.properties[4].nestedIn).toBe("Badge");
    expect(JSON.stringify(json)).not.toContain("1:1");
  });

  it("renders TypeScript props", () => {
    expect(toTypeScript(doc)).toMatchInlineSnapshot(`
      "export interface ButtonProps {
        /** @default "md" */
        size?: "sm" | "md" | "lg";
        /** @default true */
        showIcon?: boolean;
        /** @default Arrow */
        icon?: React.ReactNode;
        /** @default "Click me" */
        label?: string;
        badge?: {
          /** @default "3" */
          count?: string;
        };
      }
      "
    `);
  });

  it("dedupes clashing TypeScript names", () => {
    const raw = rawButton({ nested: [], name: "icon button" });
    raw.definitions = {
      "Label#1:0": { type: "TEXT", defaultValue: "a" },
      "label#2:0": { type: "TEXT", defaultValue: "b" },
    };
    const ts = toTypeScript(extract(raw));
    expect(ts).toContain("export interface IconButtonProps");
    expect(ts).toContain("label?: string;");
    expect(ts).toContain("label2?: string;");
  });
});
