# PropTable

**Component documentation, generated on your Figma canvas.**

Select a component, component set, or instance, run PropTable, and get a reference table of every property: variants, booleans, text, instance swaps and slots, with types, defaults, notes, variant descriptions, previews and the tokens it uses.

**[Install from Figma Community →](https://www.figma.com/community/plugin/1607486611169964823/proptable)**

## Features

- **Every property type.** Variants as tags with the default marked, booleans as toggles, text defaults, and instance swaps with their preferred components.
- **Nested properties.** Properties exposed from nested instances are listed under the instance they belong to.
- **Variant descriptions.** Each variant's own description and doc link, with a small preview image.
- **Notes.** Type notes straight into the table. They're kept when the table is rebuilt, even when a property is renamed.
- **Change marks.** Rebuilding marks new and changed properties and lists removed ones.
- **Lint warnings.** Flags missing descriptions and doc links, mixed variant casing, unused booleans, empty text defaults, and duplicate or badly spaced names.
- **Tokens.** Lists the variables the component uses, grouped by collection.
- **Export.** Copy any component as Markdown, JSON or TypeScript props.
- **Dev Mode.** Developers can open the export view while inspecting.
- **Your style.** Light or dark tables, accent colour, font, columns, sections, type order and placement, saved per file.

## How to use

Select one or more components, component sets, instances or existing tables, then pick a command from **Plugins → PropTable**:

| Command | What it does |
| --- | --- |
| **Generate table** | Creates or updates a table for each selected component |
| **Update all tables on page / in file** | Rebuilds every PropTable table in place |
| **Create overview page** | Adds a "PropTable Overview" page listing every component and its documentation status |
| **Open PropTable…** | Opens the window with export, checks and settings |

Once a component has a table, an **Update table** button appears in the right-hand panel when you select either one.

## Development

```bash
npm install
npm run build      # or: npm run watch
npm test           # unit tests for the model logic
npm run typecheck
```

Then in the Figma desktop app go to **Plugins → Development → Import plugin from manifest…** and pick `manifest.json`.

| Folder | Contents |
| --- | --- |
| `src/model/` | Pure logic with no Figma API: data model, extraction, change detection, lint and export. Unit-tested in `tests/` |
| `src/figmaAdapter.ts` | Reads Figma nodes into the model |
| `src/render/` | Draws tables and the overview on the canvas |
| `src/commands/` | Menu commands and the window bridge |
| `ui/` | Plugin window, inlined into `ui.html` by `build.mjs` |

The manual test checklist is in [docs/testing.md](docs/testing.md).

## Credits

Built by [Iroshan De Zilva](https://github.com/iroshandezilva) and Thinuka De Mel. Inspired by Matt Rea's *Component Properties Documentation* file on Figma Community.

Questions or feedback: hello@iroshandezilva.com, or [open an issue](https://github.com/iroshandezilva/PropTable/issues).

## License

[MIT](LICENSE)
