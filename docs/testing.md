# Manual test checklist

Run `npm run build`, then in the Figma desktop app go to **Plugins → Development → Import plugin from manifest…** and pick `manifest.json`.

Automated checks: `npm test` (model logic) and `npm run typecheck`.

## Generate table

- [ ] Local component: table appears to the right; "Update table" button shows in the right panel for the component and the table
- [ ] Component set: Variants section lists each variant with its description, doc link and preview
- [ ] Instance of a local component: table documents its main component
- [ ] Instance of a library component: table builds, header shows "Library"; preferred values show names or "Library component"
- [ ] Several components selected at once: one table each, no overlaps, summary says "Created N"
- [ ] Re-run with the table selected: table rebuilds in place (same position, same parent)
- [ ] Re-run with the component selected: table rebuilds in place
- [ ] Nothing selected, or a plain frame: friendly message, plugin closes
- [ ] Component inside a section: new table lands in the same section

## Notes and change marks

- [ ] Type a note in a Notes cell, re-run: note is kept
- [ ] Rename that property in Figma, re-run: note moves to "Notes for removed properties"; property shows "New", old name listed under "Removed since last update"
- [ ] Change a variant option, re-run: row shows "Changed"
- [ ] Run again without changes: no change marks

## Update all and overview

- [ ] Update all tables on page: every table on the page rebuilds; summary counts are right
- [ ] Update all tables in file: tables on other pages rebuild too
- [ ] Delete a component, update all: its table is left alone and counted as missing
- [ ] Table from v1.x: updates and upgrades without errors
- [ ] Create overview page: "PropTable Overview" page lists every component; names link to the component; running again replaces the frame

## Window (Open PropTable…)

- [ ] Export tab: Markdown, JSON and TypeScript all render for the selection; Copy shows a "Copied" toast and pastes correctly
- [ ] Several components selected: Component dropdown switches between them
- [ ] Checks tab: Selection and Page scopes list issues; clicking one selects the component
- [ ] Settings tab: each toggle, theme, accent, font, placement and type order change the next generated table
- [ ] Unknown font: table uses Inter and the toast says so
- [ ] Reset to defaults restores everything

## Dev Mode

- [ ] Open the plugin in Dev Mode: window shows Export and Checks only, with a property summary; no Settings tab
