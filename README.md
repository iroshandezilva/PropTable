# PropTable

**Generate component property tables right on your Figma canvas.**

Select a component, component set, or instance, run PropTable, and get a clean reference table of every property: variants, booleans, text, and instance swaps, each with its type and default value.

**[Install from Figma Community →](https://www.figma.com/community/plugin/1607486611169964823/proptable)**

## Features

- **All property types.** Variants, booleans, text, and instance swaps.
- **Variant options as tags.** Every option is listed, with the default one marked.
- **Description and docs link.** Pulls in the component's description and documentation link.
- **Updates in place.** Run it again on the same component and the existing table is replaced where it sits.

## How to use

1. Select a component, component set, or instance.
2. Run **Plugins → PropTable**.
3. The table appears next to your selection. Run it again any time to refresh it.

## Development

```bash
npm install
npm run build   # or: npm run watch
```

Then in the Figma desktop app go to **Plugins → Development → Import plugin from manifest…** and pick `manifest.json`.

All the plugin code is in [`code.ts`](code.ts), which compiles to `code.js`.

## Credits

Built by [Iroshan De Zilva](https://github.com/iroshandezilva) and Thinuka De Mel. Inspired by Matt Rea's *Component Properties Documentation* file on Figma Community.

Questions or feedback: hello@iroshandezilva.com, or [open an issue](https://github.com/iroshandezilva/PropTable/issues).
