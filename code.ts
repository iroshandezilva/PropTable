// ============================================================
// Component Properties Documentation — Figma Plugin
// Generates a property table on the canvas for the selected component
// ============================================================

// --- Design tokens ---

const COLORS = {
  TEXT_PRIMARY: { r: 0x22 / 255, g: 0x22 / 255, b: 0x22 / 255 },
  TEXT_SECONDARY: { r: 0x5f / 255, g: 0x5f / 255, b: 0x5f / 255 },
  WHITE: { r: 1, g: 1, b: 1 },
  TEXT_ON_PRIMARY: { r: 0xf8 / 255, g: 0xf8 / 255, b: 0xf8 / 255 },
  BLUE_DEFAULT: { r: 0x1d / 255, g: 0x34 / 255, b: 0x70 / 255 },
  TAG_BG: { r: 1, g: 1, b: 1 },
  TAG_BORDER: { r: 0xe5 / 255, g: 0xe5 / 255, b: 0xe5 / 255 },
  TABLE_BORDER: { r: 0xdf / 255, g: 0xdf / 255, b: 0xdf / 255 },
  TOGGLE_OFF: { r: 0xa9 / 255, g: 0xa9 / 255, b: 0xa9 / 255 },
  CARD_BORDER: { r: 0x7c / 255, g: 0x3a / 255, b: 0xed / 255 },
  DESC_BG: { r: 0xfc / 255, g: 0xfc / 255, b: 0xfd / 255 },
  DESC_BORDER: { r: 0xf0 / 255, g: 0xec / 255, b: 0xec / 255 },
  DOC_LINK_BG: { r: 0xdc / 255, g: 0xe5 / 255, b: 0xf9 / 255 },
  DOC_LINK_TEXT: { r: 0x24 / 255, g: 0x59 / 255, b: 0xd6 / 255 },
};

const COL_1_WIDTH = 192;
const COL_2_WIDTH = 192;
const COL_3_WIDTH = 443;
const TABLE_WIDTH = COL_1_WIDTH + COL_2_WIDTH + COL_3_WIDTH;
const ROW_HEIGHT = 42;
const HEADER_HEIGHT = 48;
const CELL_PAD = 8;

const FONT_REGULAR: FontName = { family: "Inter", style: "Regular" };
const FONT_MEDIUM: FontName = { family: "Inter", style: "Medium" };
const FONT_SEMIBOLD: FontName = { family: "Inter", style: "Semi Bold" };

// --- Types ---

interface ParsedProperty {
  name: string;
  type: "VARIANT" | "BOOLEAN" | "TEXT" | "INSTANCE_SWAP";
  defaultValue: string | boolean;
  variantOptions?: string[];
}

// --- Entry point ---

async function main() {
  const selection = figma.currentPage.selection;

  if (selection.length !== 1) {
    figma.notify("Please select a single component, component set, or instance.");
    figma.closePlugin();
    return;
  }

  const node = selection[0];
  let targetNode: ComponentNode | ComponentSetNode;
  let positionRef: SceneNode = node;

  if (node.type === "COMPONENT_SET") {
    targetNode = node;
  } else if (node.type === "COMPONENT") {
    // If component is inside a component set, use the set
    targetNode =
      node.parent?.type === "COMPONENT_SET"
        ? (node.parent as ComponentSetNode)
        : node;
    positionRef = targetNode;
  } else if (node.type === "INSTANCE") {
    const mainComp = (node as InstanceNode).mainComponent;
    if (!mainComp) {
      figma.notify("Could not resolve instance to its main component.");
      figma.closePlugin();
      return;
    }
    targetNode =
      mainComp.parent?.type === "COMPONENT_SET"
        ? (mainComp.parent as ComponentSetNode)
        : mainComp;
    positionRef = node;
  } else {
    figma.notify("Please select a component, component set, or instance.");
    figma.closePlugin();
    return;
  }

  // Load fonts
  await Promise.all([
    figma.loadFontAsync(FONT_REGULAR),
    figma.loadFontAsync(FONT_MEDIUM),
    figma.loadFontAsync(FONT_SEMIBOLD),
  ]);

  // Read properties
  const properties = readProperties(targetNode);

  // Get component description and documentation link
  const description = targetNode.description || "";
  const docLinks = targetNode.documentationLinks || [];
  const docLink = docLinks.length > 0 ? docLinks[0].uri : "";

  // Check for existing table
  const existingTableId = targetNode.getPluginData("propTableId");
  let oldX: number | null = null;
  let oldY: number | null = null;

  if (existingTableId) {
    const existingNode = await figma.getNodeByIdAsync(existingTableId);
    if (existingNode && existingNode.type === "FRAME") {
      oldX = (existingNode as FrameNode).x;
      oldY = (existingNode as FrameNode).y;
      (existingNode as FrameNode).remove();
    }
  }

  // Build table
  const table = await buildTable(targetNode.name, properties, description, docLink);

  // Position: reuse old position if updating, otherwise place to the right
  if (oldX !== null && oldY !== null) {
    table.x = oldX;
    table.y = oldY;
  } else {
    table.x = positionRef.x + positionRef.width + 100;
    table.y = positionRef.y;
  }

  figma.currentPage.appendChild(table);

  // Store table ID on the component for future updates
  targetNode.setPluginData("propTableId", table.id);

  figma.currentPage.selection = [table];
  figma.viewport.scrollAndZoomIntoView([table]);

  const isUpdate = oldX !== null;
  figma.notify(isUpdate ? "✓ Documentation table updated!" : "✓ Documentation table created!");
  figma.closePlugin();
}

// --- Read component properties ---

function readProperties(node: ComponentNode | ComponentSetNode): ParsedProperty[] {
  const defs = node.componentPropertyDefinitions;
  const result: ParsedProperty[] = [];

  for (const [rawName, def] of Object.entries(defs)) {
    const displayName = rawName.includes("#")
      ? rawName.substring(0, rawName.indexOf("#"))
      : rawName;

    const prop: ParsedProperty = {
      name: displayName,
      type: def.type as ParsedProperty["type"],
      defaultValue: def.defaultValue as string | boolean,
    };

    if (def.type === "VARIANT" && def.variantOptions) {
      prop.variantOptions = def.variantOptions;
    }

    result.push(prop);
  }

  // Sort: VARIANT first, then BOOLEAN, INSTANCE_SWAP, TEXT
  const order: Record<string, number> = {
    VARIANT: 0,
    BOOLEAN: 1,
    INSTANCE_SWAP: 2,
    TEXT: 3,
  };
  result.sort((a, b) => (order[a.type] ?? 9) - (order[b.type] ?? 9));

  return result;
}

// --- Table builders ---

async function buildTable(componentName: string, properties: ParsedProperty[], description: string, docLink: string): Promise<FrameNode> {
  // Outer card wrapper with dashed purple border
  const card = figma.createFrame();
  card.name = `${componentName} Properties`;
  card.layoutMode = "VERTICAL";
  card.resize(TABLE_WIDTH + 86, 10); // 43px padding each side
  card.primaryAxisSizingMode = "AUTO";
  card.counterAxisSizingMode = "FIXED";
  card.paddingTop = 43;
  card.paddingBottom = 43;
  card.paddingLeft = 43;
  card.paddingRight = 43;
  card.fills = [{ type: "SOLID", color: COLORS.WHITE }];
  card.strokes = [{ type: "SOLID", color: COLORS.CARD_BORDER }];
  card.strokeWeight = 2;
  card.strokeAlign = "INSIDE";
  card.dashPattern = [8, 8];
  card.cornerRadius = 29;
  card.itemSpacing = 0;
  card.clipsContent = true;

  // Inner table
  const table = figma.createFrame();
  table.name = "Table";
  table.layoutMode = "VERTICAL";
  table.resize(TABLE_WIDTH, 10);
  table.primaryAxisSizingMode = "AUTO";
  table.counterAxisSizingMode = "FIXED";
  table.fills = [{ type: "SOLID", color: COLORS.WHITE }];
  table.itemSpacing = 0;
  table.clipsContent = true;

  // Title
  const titleRow = buildTitleRow(componentName, description, docLink);
  table.appendChild(titleRow);
  titleRow.layoutAlign = "STRETCH";

  // Header row
  const headerRow = buildHeaderRow();
  table.appendChild(headerRow);
  headerRow.layoutAlign = "STRETCH";

  // Property rows
  if (properties.length === 0) {
    const emptyRow = buildEmptyRow();
    table.appendChild(emptyRow);
    emptyRow.layoutAlign = "STRETCH";
  } else {
    for (const prop of properties) {
      const propRow = await buildPropertyRow(prop);
      table.appendChild(propRow);
      propRow.layoutAlign = "STRETCH";
    }
  }

  card.appendChild(table);
  table.layoutAlign = "STRETCH";

  return card;
}

function buildTitleRow(name: string, description: string, docLink: string): FrameNode {
  const wrapper = figma.createFrame();
  wrapper.name = "Title";
  wrapper.layoutMode = "VERTICAL";
  wrapper.resize(TABLE_WIDTH, 10);
  wrapper.primaryAxisSizingMode = "AUTO"; // HUG height
  wrapper.counterAxisSizingMode = "FIXED";
  wrapper.paddingLeft = CELL_PAD;
  wrapper.paddingRight = CELL_PAD;
  wrapper.paddingTop = 24;
  wrapper.paddingBottom = 16;
  wrapper.itemSpacing = 8;
  wrapper.fills = [];
  wrapper.clipsContent = true;

  // Title line: icon + name
  const titleLine = figma.createFrame();
  titleLine.name = "Title Line";
  titleLine.layoutMode = "HORIZONTAL";
  titleLine.resize(100, 10);
  titleLine.primaryAxisSizingMode = "AUTO";
  titleLine.counterAxisSizingMode = "AUTO";
  titleLine.counterAxisAlignItems = "CENTER";
  titleLine.itemSpacing = 8;
  titleLine.paddingBottom = 16;
  titleLine.fills = [];
  titleLine.clipsContent = true;

  const icon = createSvgIcon(SVG_ICONS.COMPONENT, 24);
  titleLine.appendChild(icon);

  const titleText = figma.createText();
  titleText.fontName = FONT_SEMIBOLD;
  titleText.characters = name + " properties";
  titleText.fontSize = 24;
  titleText.lineHeight = { value: 28, unit: "PIXELS" };
  titleText.fills = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }];
  titleLine.appendChild(titleText);

  wrapper.appendChild(titleLine);
  titleLine.layoutAlign = "STRETCH";

  // Description & link box
  if (description || docLink) {
    const descBox = figma.createFrame();
    descBox.name = "Description Box";
    descBox.layoutMode = "VERTICAL";
    descBox.resize(100, 10);
    descBox.primaryAxisSizingMode = "AUTO";
    descBox.counterAxisSizingMode = "FIXED";
    descBox.paddingTop = 20;
    descBox.paddingBottom = 20;
    descBox.paddingLeft = 20;
    descBox.paddingRight = 20;
    descBox.itemSpacing = 16;
    descBox.cornerRadius = 20;
    descBox.fills = [{ type: "SOLID", color: COLORS.DESC_BG }];
    descBox.strokes = [{ type: "SOLID", color: COLORS.DESC_BORDER }];
    descBox.strokeWeight = 1;
    descBox.strokeAlign = "INSIDE";

    // Description content
    if (description) {
      const descContent = figma.createFrame();
      descContent.name = "Description Content";
      descContent.layoutMode = "VERTICAL";
      descContent.resize(100, 10);
      descContent.primaryAxisSizingMode = "AUTO";
      descContent.counterAxisSizingMode = "FIXED";
      descContent.itemSpacing = 4;
      descContent.fills = [];

      const descLabel = figma.createText();
      descLabel.fontName = FONT_MEDIUM;
      descLabel.characters = "DESCRIPTION";
      descLabel.fontSize = 14;
      descLabel.lineHeight = { value: 23, unit: "PIXELS" };
      descLabel.textCase = "UPPER";
      descLabel.fills = [{ type: "SOLID", color: COLORS.TEXT_PRIMARY }];
      descContent.appendChild(descLabel);

      const descText = figma.createText();
      descText.fontName = FONT_REGULAR;
      descText.characters = description;
      descText.fontSize = 14;
      descText.lineHeight = { value: 20, unit: "PIXELS" };
      descText.fills = [{ type: "SOLID", color: COLORS.TEXT_SECONDARY }];
      descContent.appendChild(descText);
      descText.layoutAlign = "STRETCH";
      descText.textAutoResize = "HEIGHT";

      descBox.appendChild(descContent);
      descContent.layoutAlign = "STRETCH";
    }

    // Documentation link badge
    if (docLink) {
      const linkBadge = figma.createFrame();
      linkBadge.name = "Doc Link";
      linkBadge.layoutMode = "HORIZONTAL";
      linkBadge.resize(100, 10);
      linkBadge.primaryAxisSizingMode = "AUTO";
      linkBadge.counterAxisSizingMode = "AUTO";
      linkBadge.counterAxisAlignItems = "CENTER";
      linkBadge.primaryAxisAlignItems = "CENTER";
      linkBadge.paddingTop = 4;
      linkBadge.paddingBottom = 4;
      linkBadge.paddingLeft = 6;
      linkBadge.paddingRight = 6;
      linkBadge.itemSpacing = 4;
      linkBadge.cornerRadius = 6;
      linkBadge.fills = [{ type: "SOLID", color: COLORS.DOC_LINK_BG }];

      const linkIcon = createSvgIcon(SVG_ICONS.DOCUMENTATION, 16);
      linkBadge.appendChild(linkIcon);

      const linkText = figma.createText();
      linkText.fontName = FONT_REGULAR;
      linkText.characters = "Documentation";
      linkText.fontSize = 12;
      linkText.lineHeight = { value: 16, unit: "PIXELS" };
      linkText.fills = [{ type: "SOLID", color: COLORS.DOC_LINK_TEXT }];
      linkText.hyperlink = { type: "URL", value: docLink };
      linkBadge.appendChild(linkText);

      descBox.appendChild(linkBadge);
    }

    wrapper.appendChild(descBox);
    descBox.layoutAlign = "STRETCH";
  }

  return wrapper;
}

function buildHeaderRow(): FrameNode {
  const row = createRow("Header", HEADER_HEIGHT);
  const headers = ["PROPERTY", "TYPE", "DEFAULT / OPTIONS"];
  const widths = [COL_1_WIDTH, COL_2_WIDTH, COL_3_WIDTH];

  for (let i = 0; i < 3; i++) {
    const cell = createCell(widths[i], HEADER_HEIGHT);
    const content = getCellContent(cell);
    const text = figma.createText();
    text.fontName = FONT_MEDIUM;
    text.characters = headers[i];
    text.fontSize = 14;
    text.lineHeight = { value: 23, unit: "PIXELS" };
    text.textCase = "UPPER";
    text.fills = [{ type: "SOLID", color: COLORS.TEXT_PRIMARY }];
    content.appendChild(text);
    row.appendChild(cell);
    cell.layoutAlign = "STRETCH"; // stretch vertically in row
    if (i === 2) {
      cell.layoutGrow = 1; // last column fills remaining width
      cell.counterAxisSizingMode = "AUTO"; // allow width to be driven by row layout
    }
  }

  applyBottomBorder(row);
  return row;
}

function buildEmptyRow(): FrameNode {
  const row = createRow("Empty", ROW_HEIGHT);
  const cell = createCell(TABLE_WIDTH, ROW_HEIGHT);
  const content = getCellContent(cell);
  const text = figma.createText();
  text.fontName = FONT_REGULAR;
  text.characters = "No properties defined";
  text.fontSize = 14;
  text.fills = [{ type: "SOLID", color: COLORS.TOGGLE_OFF }];
  content.appendChild(text);
  row.appendChild(cell);
  cell.layoutAlign = "STRETCH";
  applyBottomBorder(row);
  return row;
}

async function buildPropertyRow(prop: ParsedProperty): Promise<FrameNode> {
  const row = createRow(prop.name, ROW_HEIGHT);

  // Col 1: Property name
  const nameCell = createCell(COL_1_WIDTH, ROW_HEIGHT);
  const nameContent = getCellContent(nameCell);
  const nameText = figma.createText();
  nameText.fontName = FONT_REGULAR;
  nameText.characters = prop.name;
  nameText.fontSize = 14;
  nameText.lineHeight = { value: 22, unit: "PIXELS" };
  nameText.fills = [{ type: "SOLID", color: COLORS.TEXT_PRIMARY }];
  nameContent.appendChild(nameText);
  row.appendChild(nameCell);
  nameCell.layoutAlign = "STRETCH";

  // Col 2: Type with icon
  const typeCell = createCell(COL_2_WIDTH, ROW_HEIGHT);
  const typeContent = getCellContent(typeCell);
  typeContent.appendChild(createTypeIcon(prop.type));
  const typeText = figma.createText();
  typeText.fontName = FONT_REGULAR;
  typeText.characters = getTypeLabel(prop.type);
  typeText.fontSize = 14;
  typeText.lineHeight = { value: 22, unit: "PIXELS" };
  typeText.fills = [{ type: "SOLID", color: COLORS.TEXT_PRIMARY }];
  typeContent.appendChild(typeText);
  row.appendChild(typeCell);
  typeCell.layoutAlign = "STRETCH";

  // Col 3: Default / Options — fills remaining width
  const valueCell = createCell(COL_3_WIDTH, ROW_HEIGHT);
  const valueContent = getCellContent(valueCell);
  valueContent.itemSpacing = 4; // horizontal gap
  valueContent.counterAxisSpacing = 4; // vertical gap between wrapped lines
  await fillValueCell(valueContent, prop);
  row.appendChild(valueCell);
  valueCell.layoutAlign = "STRETCH";
  valueCell.layoutGrow = 1;
  valueCell.counterAxisSizingMode = "AUTO"; // allow width to be driven by row layout

  applyBottomBorder(row);
  return row;
}

// --- Value cell renderers ---

async function fillValueCell(cell: FrameNode, prop: ParsedProperty): Promise<void> {
  switch (prop.type) {
    case "VARIANT":
      renderVariantTags(cell, prop);
      break;
    case "BOOLEAN":
      renderBooleanToggle(cell, prop);
      break;
    case "INSTANCE_SWAP":
      await renderInstanceSwap(cell, prop);
      break;
    case "TEXT":
      renderTextDefault(cell, prop);
      break;
  }
}

function renderVariantTags(cell: FrameNode, prop: ParsedProperty): void {
  if (!prop.variantOptions) return;
  cell.itemSpacing = 4;

  for (const option of prop.variantOptions) {
    const isDefault = option === String(prop.defaultValue);
    cell.appendChild(createTag(option, isDefault));
  }
}

function renderBooleanToggle(cell: FrameNode, prop: ParsedProperty): void {
  const isOn = prop.defaultValue === true;
  cell.itemSpacing = 4;

  // Toggle from SVG
  const toggleSvg = isOn ? SVG_ICONS.TOGGLE_ON : SVG_ICONS.TOGGLE_OFF;
  const toggle = figma.createNodeFromSvg(toggleSvg);
  toggle.name = "Toggle";
  cell.appendChild(toggle);

  // Label
  const label = figma.createText();
  label.fontName = FONT_REGULAR;
  label.characters = isOn ? "True" : "False";
  label.fontSize = 14;
  label.lineHeight = { value: 22, unit: "PIXELS" };
  label.fills = [{ type: "SOLID", color: COLORS.TEXT_PRIMARY }];
  cell.appendChild(label);
}

async function renderInstanceSwap(cell: FrameNode, prop: ParsedProperty): Promise<void> {
  cell.itemSpacing = 8;

  // Instance icon from SVG
  const icon = createSvgIcon(SVG_ICONS.INSTANCE, 16);
  cell.appendChild(icon);

  // Instance name
  const name = figma.createText();
  name.fontName = FONT_REGULAR;
  const defaultStr = String(prop.defaultValue);
  // Instance swap default value is a node ID — resolve to component name
  const resolvedNode = await figma.getNodeByIdAsync(defaultStr);
  name.characters = resolvedNode ? resolvedNode.name : defaultStr;
  name.fontSize = 14;
  name.lineHeight = { value: 22, unit: "PIXELS" };
  name.fills = [{ type: "SOLID", color: COLORS.TEXT_PRIMARY }];
  cell.appendChild(name);

  // Caret
  const caret = figma.createText();
  caret.fontName = FONT_REGULAR;
  caret.characters = "\u25BE";
  caret.fontSize = 12;
  caret.fills = [{ type: "SOLID", color: COLORS.TEXT_PRIMARY }];
  cell.appendChild(caret);
}

function renderTextDefault(cell: FrameNode, prop: ParsedProperty): void {
  const text = figma.createText();
  text.fontName = FONT_REGULAR;
  text.characters = String(prop.defaultValue);
  text.fontSize = 14;
  text.lineHeight = { value: 22, unit: "PIXELS" };
  text.fills = [{ type: "SOLID", color: COLORS.TEXT_PRIMARY }];
  cell.appendChild(text);
}

// --- SVG Icons ---

const SVG_ICONS = {
  BOOLEAN: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 10C9.105 10 10 9.105 10 8C10 6.895 9.105 6 8 6C6.896 6 6 6.895 6 8C6 9.105 6.896 10 8 10Z" fill="#222222"/><path fill-rule="evenodd" clip-rule="evenodd" d="M7.86499 4C10.6844 4 13.1336 5.58802 14.365 7.91861C13.1336 10.2492 10.6844 11.8372 7.86499 11.8372C5.04555 11.8372 2.59739 10.2492 1.36499 7.91861C2.59739 5.58802 5.04555 4 7.86499 4ZM7.86499 10.8576C5.61179 10.8576 3.63093 9.68787 2.49845 7.91861C3.63093 6.14936 5.61179 4.97965 7.86499 4.97965C10.1182 4.97965 12.0991 6.14936 13.2325 7.91861C12.0991 9.68787 10.1182 10.8576 7.86499 10.8576Z" fill="#222222"/></svg>',
  COMPONENT: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5.49926 4.32335L8.16663 1.66663L10.834 4.32335L8.16663 6.98008L5.49926 4.32335ZM4.32335 10.8352L1.66663 8.16663L4.32335 5.49926L6.98008 8.16663L4.32335 10.834V10.8352ZM10.8352 12.0099L8.16663 14.6666L5.49926 12.0099L8.16663 9.35317L10.834 12.0099H10.8352ZM14.6666 8.16663L12.0099 5.49926L9.35317 8.16663L12.0099 10.834L14.6666 8.16663Z" fill="#222222"/></svg>',
  INSTANCE: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M1.94629 7.94629L7.94629 1.94629L13.9463 7.94629L7.94629 13.9463L1.94629 7.94629ZM7.94629 12.6397L12.6397 7.94629L7.94629 3.25283L3.25283 7.94629L7.94629 12.6397Z" fill="#222222"/></svg>',
  VARIANT: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M1.94629 7.94629L7.94629 1.94629L13.9463 7.94629L7.94629 13.9463L1.94629 7.94629ZM7.94629 12.6397L12.6397 7.94629L7.94629 3.25283L3.25283 7.94629L7.94629 12.6397Z" fill="#222222"/><path d="M7.94629 12.6397L12.6397 7.94629L7.94629 3.25283L3.25283 7.94629L7.94629 12.6397Z" fill="#222222"/></svg>',
  INSTANCE_SWAP: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M6.26306 10.4279L6.528 10.6936L8.55521 12.72C8.70157 12.8671 8.93949 12.8671 9.08584 12.72L13.1395 8.6671C13.2859 8.51999 13.2859 8.28207 13.1395 8.13572L9.08659 4.0828C8.93949 3.9357 8.70157 3.9357 8.55521 4.0828L6.52876 6.10926L6.26306 6.3742L5.73243 5.84357L5.99737 5.57863L8.02383 3.55142C8.4644 3.1116 9.17666 3.1116 9.61647 3.55142L13.6701 7.60508C14.11 8.0449 14.11 8.75791 13.6701 9.19698L9.61723 13.2514C9.17666 13.6905 8.4644 13.6905 8.02458 13.2514L5.99812 11.2242L5.73243 10.9585L6.26306 10.4279ZM8.82015 9.68032C9.52641 9.68032 10.0991 9.10766 10.0991 8.40141C10.0991 7.69515 9.52641 7.12249 8.82015 7.12249C8.24449 7.12249 7.75739 7.50301 7.59677 8.02614H2V8.77668H7.59752C7.75739 9.2998 8.24449 9.68032 8.8209 9.68032H8.82015Z" fill="#222222"/></svg>',
  TEXT: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 2H14V5.6H12.8V3.2H8.6V12.8H10.4V14H5.6V12.8H7.4V3.2H3.2V5.6H2V2Z" fill="#222222"/></svg>',
  TOGGLE_OFF: '<svg width="24" height="13" viewBox="0 0 24 13" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="13" rx="6.5" fill="#A9A9A9"/><circle cx="6.5" cy="6.5" r="5.5" fill="white"/></svg>',
  TOGGLE_ON: '<svg width="24" height="13" viewBox="0 0 24 13" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="13" rx="6.5" fill="#0F8EFF"/><circle cx="17.5" cy="6.5" r="5.5" fill="white"/></svg>',
  DOCUMENTATION: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><g clip-path="url(#clip0_405_34945)"><path d="M7.46857 0.5H4.02083C3.28445 0.5 2.6875 1.09695 2.6875 1.83333V11.5C2.6875 12.2364 3.28445 12.8333 4.02083 12.8333H11.0208C11.7572 12.8333 12.3542 12.2364 12.3542 11.5V5.3856C12.3542 5.03199 12.2137 4.69286 11.9636 4.44281L8.41137 0.890527C8.1613 0.640473 7.82217 0.5 7.46857 0.5Z" stroke="#2459D6" stroke-width="1.25" stroke-linecap="round"/><path d="M8.5 2.16699V4.83366C8.5 5.57004 9.09693 6.16699 9.83333 6.16699H12.5" stroke="#2459D6" stroke-width="1.25"/><path d="M5.83594 8.83301H8.16927" stroke="#2459D6" stroke-width="1.25" stroke-linecap="round"/><path d="M5.83594 11.5H10.1693" stroke="#2459D6" stroke-width="1.25" stroke-linecap="round"/></g><defs><clipPath id="clip0_405_34945"><rect width="16" height="16" fill="white"/></clipPath></defs></svg>',
};

function createSvgIcon(svgString: string, size: number): FrameNode {
  const svgNode = figma.createNodeFromSvg(svgString);
  svgNode.resize(size, size);
  return svgNode;
}

// --- Visual element creators ---

function createTag(label: string, isDefault: boolean): FrameNode {
  const tag = figma.createFrame();
  tag.name = `Tag: ${label}`;
  tag.layoutMode = "HORIZONTAL";
  tag.primaryAxisSizingMode = "AUTO";
  tag.counterAxisSizingMode = "AUTO";
  tag.paddingLeft = 8;
  tag.paddingRight = 8;
  tag.paddingTop = 4;
  tag.paddingBottom = 4;
  tag.cornerRadius = 6;
  tag.counterAxisAlignItems = "CENTER";
  tag.primaryAxisAlignItems = "CENTER";
  tag.clipsContent = true;

  tag.fills = [{ type: "SOLID", color: COLORS.TAG_BG }];
  tag.strokes = [{ type: "SOLID", color: COLORS.TAG_BORDER }];
  tag.strokeWeight = 1;
  tag.strokeAlign = "INSIDE";

  const text = figma.createText();
  text.fontName = FONT_MEDIUM;
  text.characters = label;
  text.fontSize = 12;
  text.lineHeight = { value: 16, unit: "PIXELS" };
  text.fills = [
    { type: "SOLID", color: COLORS.TEXT_PRIMARY },
  ];
  tag.appendChild(text);

  return tag;
}

function createTypeIcon(type: ParsedProperty["type"]): FrameNode {
  switch (type) {
    case "VARIANT":
      return createSvgIcon(SVG_ICONS.VARIANT, 16);
    case "BOOLEAN":
      return createSvgIcon(SVG_ICONS.BOOLEAN, 16);
    case "INSTANCE_SWAP":
      return createSvgIcon(SVG_ICONS.INSTANCE_SWAP, 16);
    case "TEXT":
      return createSvgIcon(SVG_ICONS.TEXT, 16);
    default:
      return createSvgIcon(SVG_ICONS.VARIANT, 16);
  }
}

// --- Helpers ---

function createRow(name: string, minHeight: number): FrameNode {
  const row = figma.createFrame();
  row.name = `Row: ${name}`;
  row.layoutMode = "HORIZONTAL";
  row.resize(TABLE_WIDTH, minHeight);
  row.primaryAxisSizingMode = "FIXED";
  row.counterAxisSizingMode = "AUTO"; // HUG height
  row.minHeight = minHeight;
  row.fills = [{ type: "SOLID", color: COLORS.WHITE }];
  row.itemSpacing = 0;
  return row;
}

function createCell(width: number, _height: number): FrameNode {
  // Outer cell: VERTICAL layout, centers content vertically
  const cell = figma.createFrame();
  cell.name = "Cell";
  cell.layoutMode = "VERTICAL";
  cell.resize(width, _height);
  cell.primaryAxisSizingMode = "AUTO"; // HUG height — grows with content
  cell.counterAxisSizingMode = "FIXED";
  cell.primaryAxisAlignItems = "CENTER"; // vertical center
  cell.counterAxisAlignItems = "MIN"; // align left
  cell.paddingTop = 8;
  cell.paddingBottom = 8;
  cell.fills = [];

  // Inner content: HORIZONTAL layout with padding and gap
  const content = figma.createFrame();
  content.name = "Content";
  content.layoutMode = "HORIZONTAL";
  content.resize(width, 10);
  content.counterAxisSizingMode = "AUTO";
  content.paddingLeft = CELL_PAD;
  content.paddingRight = CELL_PAD;
  content.counterAxisAlignItems = "CENTER";
  content.fills = [];
  content.itemSpacing = 8;
  content.layoutWrap = "WRAP";

  cell.appendChild(content);
  // After appending to VERTICAL parent, stretch horizontally (counter axis)
  content.layoutAlign = "STRETCH";

  return cell;
}

/** Get the inner content frame of a cell created by createCell() */
function getCellContent(cell: FrameNode): FrameNode {
  return cell.children[0] as FrameNode;
}

function applyBottomBorder(row: FrameNode): void {
  row.strokes = [{ type: "SOLID", color: COLORS.TABLE_BORDER }];
  row.strokeTopWeight = 0;
  row.strokeRightWeight = 0;
  row.strokeLeftWeight = 0;
  row.strokeBottomWeight = 1;
  row.strokeAlign = "INSIDE";
}

function getTypeLabel(type: ParsedProperty["type"]): string {
  switch (type) {
    case "VARIANT":
      return "Variant";
    case "BOOLEAN":
      return "Boolean";
    case "INSTANCE_SWAP":
      return "Instance swap";
    case "TEXT":
      return "Text";
    default:
      return type;
  }
}

// --- Run ---
main();
