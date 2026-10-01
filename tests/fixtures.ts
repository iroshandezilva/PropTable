import { RawComponent } from "../src/model/types";

export function rawButton(overrides: Partial<RawComponent> = {}): RawComponent {
  return {
    id: "1:1",
    name: "Button",
    kind: "COMPONENT_SET",
    remote: false,
    page: "Components",
    description: "Triggers an action.",
    docLinks: ["https://example.com/button"],
    definitions: {
      "Label#1:0": { type: "TEXT", defaultValue: "Click me" },
      Size: { type: "VARIANT", defaultValue: "md", variantOptions: ["sm", "md", "lg"] },
      "Show icon#2:0": { type: "BOOLEAN", defaultValue: true },
      "Icon#3:0": {
        type: "INSTANCE_SWAP",
        defaultValue: "9:9",
        defaultName: "Arrow",
        preferred: [{ id: "k1", name: "Arrow" }, { id: "k2", name: "Plus" }],
      },
    },
    visibilityRefs: ["Show icon#2:0"],
    variants: [
      { id: "2:1", name: "Size=sm", description: "Dense tables.", docLinks: [] },
      { id: "2:2", name: "Size=md", description: "", docLinks: [] },
      { id: "2:3", name: "Size=lg", description: "Page-level actions.", docLinks: ["https://example.com/lg"] },
    ],
    nested: [
      { instanceName: "Badge", definitions: { "Count#4:0": { type: "TEXT", defaultValue: "3" } } },
    ],
    tokens: [
      { collection: "Color", variable: "bg/primary", field: "fill", layer: "Background" },
      { collection: "Color", variable: "bg/primary", field: "fill", layer: "Border" },
      { collection: "Color", variable: "bg/primary", field: "fill", layer: "Background" },
      { collection: "Spacing", variable: "space/2", field: "paddingLeft", layer: "Button" },
    ],
    ...overrides,
  };
}
