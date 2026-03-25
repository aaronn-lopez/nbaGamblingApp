export const courtTheme = {
  color: {
    background: "#f7f2e8",
    backgroundAlt: "#efe3d1",
    foreground: "#111111",
    accent: "#f05a28",
    accentDeep: "#b33a1f",
    cool: "#0a6c74",
    gold: "#d4a017",
    surface: "#fffaf3",
    outline: "rgba(17, 17, 17, 0.12)"
  },
  radius: {
    sm: 14,
    md: 24,
    lg: 36
  },
  shadow: {
    panel: "0 22px 44px rgba(17, 17, 17, 0.08)",
    lifted: "0 18px 28px rgba(240, 90, 40, 0.18)"
  }
} as const;

export type CourtTheme = typeof courtTheme;
