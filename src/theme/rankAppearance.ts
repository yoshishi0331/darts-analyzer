export type Rank = "SS" | "S" | "A+" | "A" | "B+" | "B" | "C";

export type RankAppearance = {
  text: string;
  glow: string;
  glowStrong: string;
  edge: string;
  accent: string;
};

export const rankAppearanceMap: Record<Rank, RankAppearance> = {
  SS: {
    text: "#F4D46A",
    glow: "rgba(244, 212, 106, 0.14)",
    glowStrong: "rgba(244, 212, 106, 0.28)",
    edge: "rgba(244, 212, 106, 0.30)",
    accent: "#FFD45B",
  },
  S: {
    text: "#C58BFF",
    glow: "rgba(197, 139, 255, 0.13)",
    glowStrong: "rgba(197, 139, 255, 0.26)",
    edge: "rgba(197, 139, 255, 0.28)",
    accent: "#B45CFF",
  },
  "A+": {
    text: "#D4D8FF",
    glow: "rgba(128, 109, 255, 0.13)",
    glowStrong: "rgba(128, 109, 255, 0.26)",
    edge: "rgba(128, 109, 255, 0.28)",
    accent: "#7D67FF",
  },
  A: {
    text: "#D8E2FF",
    glow: "rgba(84, 104, 255, 0.12)",
    glowStrong: "rgba(84, 104, 255, 0.24)",
    edge: "rgba(84, 104, 255, 0.26)",
    accent: "#425BFF",
  },
  "B+": {
    text: "#A9EEFF",
    glow: "rgba(82, 218, 255, 0.12)",
    glowStrong: "rgba(82, 218, 255, 0.24)",
    edge: "rgba(82, 218, 255, 0.26)",
    accent: "#42D5FF",
  },
  B: {
    text: "#A6FFD8",
    glow: "rgba(67, 227, 159, 0.12)",
    glowStrong: "rgba(67, 227, 159, 0.24)",
    edge: "rgba(67, 227, 159, 0.26)",
    accent: "#31D98F",
  },
  C: {
    text: "#D7DDED",
    glow: "rgba(198, 207, 229, 0.10)",
    glowStrong: "rgba(198, 207, 229, 0.20)",
    edge: "rgba(198, 207, 229, 0.22)",
    accent: "#B9C3DB",
  },
};
