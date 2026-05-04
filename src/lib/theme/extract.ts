export type AmbientPalette = {
  bg: string;
  bgAlt: string;
  fg: string;
  muted: string;
  edge: string;
  accent: string;
  accentSoft: string;
};

export const DEFAULT_AMBIENT_PALETTE: AmbientPalette = {
  bg: "#F4EFE9",
  bgAlt: "#EAE3DA",
  fg: "#1F1B17",
  muted: "#6B645C",
  edge: "#D9D2C8",
  accent: "#7A6244",
  accentSoft: "#9A805F"
};

export async function extractPaletteFromAlbumArt(_imageUrl: string): Promise<AmbientPalette> {
  return DEFAULT_AMBIENT_PALETTE;
}
