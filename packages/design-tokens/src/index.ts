export const colors = {
  brand: "#4f46e5",
  background: "#ffffff",
  surface: "#f4f4f5",
  text: "#18181b",
  muted: "#71717a",
  danger: "#b91c1c",
  success: "#15803d",
} as const;
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;
export const typography = {
  size: { small: 14, body: 16, title: 24 },
  weight: { regular: "400", medium: "500", bold: "700" },
} as const;
export const radii = { small: 4, medium: 8, large: 16, pill: 9999 } as const;
export const shadows = {
  small: { color: "#000000", opacity: 0.08, radius: 4, offsetX: 0, offsetY: 2 },
} as const;
export const themes = {
  light: colors,
  dark: {
    ...colors,
    background: "#09090b",
    surface: "#18181b",
    text: "#fafafa",
    muted: "#a1a1aa",
  },
} as const;
