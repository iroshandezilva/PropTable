import { Settings } from "../model/types";

export interface Palette {
  bg: RGB;
  surface: RGB;
  surfaceBorder: RGB;
  border: RGB;
  text: RGB;
  textMuted: RGB;
  tagBg: RGB;
  tagBorder: RGB;
  defaultTagBg: RGB;
  defaultTagText: RGB;
  accent: RGB;
  linkBg: RGB;
  linkText: RGB;
  warnText: RGB;
  newBg: RGB;
  newText: RGB;
  changedBg: RGB;
  changedText: RGB;
  toggleOn: RGB;
  toggleOff: RGB;
  placeholder: RGB;
}

export function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255,
  };
}

export function rgbToHex(c: RGB): string {
  const p = (v: number) => Math.round(v * 255).toString(16).padStart(2, "0");
  return `#${p(c.r)}${p(c.g)}${p(c.b)}`;
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t };
}

const WHITE = { r: 1, g: 1, b: 1 };

export function palette(settings: Pick<Settings, "theme" | "accent">): Palette {
  const accent = hexToRgb(settings.accent);
  if (settings.theme === "dark") {
    const bg = hexToRgb("#1E1E1E");
    return {
      bg,
      surface: hexToRgb("#262626"),
      surfaceBorder: hexToRgb("#333333"),
      border: hexToRgb("#3A3A3A"),
      text: hexToRgb("#F2F2F2"),
      textMuted: hexToRgb("#A8A8A8"),
      tagBg: hexToRgb("#2C2C2C"),
      tagBorder: hexToRgb("#444444"),
      defaultTagBg: mix(bg, accent, 0.35),
      defaultTagText: WHITE,
      accent,
      linkBg: hexToRgb("#22314F"),
      linkText: hexToRgb("#8AB4FF"),
      warnText: hexToRgb("#F5B556"),
      newBg: hexToRgb("#1F3B2A"),
      newText: hexToRgb("#7EE2A0"),
      changedBg: hexToRgb("#3D3220"),
      changedText: hexToRgb("#F5C26B"),
      toggleOn: hexToRgb("#0F8EFF"),
      toggleOff: hexToRgb("#5C5C5C"),
      placeholder: hexToRgb("#6E6E6E"),
    };
  }
  return {
    bg: WHITE,
    surface: hexToRgb("#FCFCFD"),
    surfaceBorder: hexToRgb("#F0ECEC"),
    border: hexToRgb("#DFDFDF"),
    text: hexToRgb("#222222"),
    textMuted: hexToRgb("#5F5F5F"),
    tagBg: WHITE,
    tagBorder: hexToRgb("#E5E5E5"),
    defaultTagBg: mix(WHITE, accent, 0.12),
    defaultTagText: mix(accent, { r: 0, g: 0, b: 0 }, 0.35),
    accent,
    linkBg: hexToRgb("#DCE5F9"),
    linkText: hexToRgb("#2459D6"),
    warnText: hexToRgb("#B25E00"),
    newBg: hexToRgb("#DDF5E5"),
    newText: hexToRgb("#16723A"),
    changedBg: hexToRgb("#FDF1D8"),
    changedText: hexToRgb("#8A5A00"),
    toggleOn: hexToRgb("#0F8EFF"),
    toggleOff: hexToRgb("#A9A9A9"),
    placeholder: hexToRgb("#B0B0B0"),
  };
}

// --- Fonts ---

export interface Fonts {
  regular: FontName;
  medium: FontName;
  semibold: FontName;
}

const INTER: Fonts = {
  regular: { family: "Inter", style: "Regular" },
  medium: { family: "Inter", style: "Medium" },
  semibold: { family: "Inter", style: "Semi Bold" },
};

async function tryLoad(fonts: Fonts): Promise<boolean> {
  try {
    await Promise.all([fonts.regular, fonts.medium, fonts.semibold].map((f) => figma.loadFontAsync(f)));
    return true;
  } catch {
    return false;
  }
}

/** Load the chosen font family, falling back to Inter. */
export async function loadFonts(family: string): Promise<{ fonts: Fonts; warning?: string }> {
  if (family !== "Inter") {
    for (const semibold of ["Semi Bold", "SemiBold"]) {
      const fonts: Fonts = {
        regular: { family, style: "Regular" },
        medium: { family, style: "Medium" },
        semibold: { family, style: semibold },
      };
      if (await tryLoad(fonts)) return { fonts };
    }
  }
  if (!(await tryLoad(INTER))) throw new Error("Could not load the Inter font");
  return { fonts: INTER, warning: family !== "Inter" ? `Font "${family}" unavailable, used Inter` : undefined };
}
