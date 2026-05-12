// ─────────────────────────────────────────────────────────────────────────
// Stableflow · Typed token export
//
// For use in TS code where you need design tokens as values (SVG/canvas
// charts, D3 scales, animation libraries, postMessage payloads, etc.).
//
// These mirror the CSS variables in `tokens.css`. Prefer `var(--token)`
// in stylesheets so theme switches Just Work — only use these when CSS
// vars aren't an option (e.g. you need a literal string for canvas).
// ─────────────────────────────────────────────────────────────────────────

export type ThemeMode = "dark" | "light";

export const CSS_VAR = {
  /* shadcn semantic */
  background: "var(--background)",
  foreground: "var(--foreground)",
  card: "var(--card)",
  cardForeground: "var(--card-foreground)",
  popover: "var(--popover)",
  popoverForeground: "var(--popover-foreground)",
  primary: "var(--primary)",
  primaryForeground: "var(--primary-foreground)",
  secondary: "var(--secondary)",
  secondaryForeground: "var(--secondary-foreground)",
  muted: "var(--muted)",
  mutedForeground: "var(--muted-foreground)",
  accent: "var(--accent)",
  accentForeground: "var(--accent-foreground)",
  destructive: "var(--destructive)",
  border: "var(--border)",
  input: "var(--input)",
  ring: "var(--ring)",

  /* surfaces */
  surface0: "var(--surface-0)",
  surface1: "var(--surface-1)",
  surface2: "var(--surface-2)",
  surface3: "var(--surface-3)",
  glass: "var(--glass)",
  glassStrong: "var(--glass-strong)",
  gridLine: "var(--grid-line)",

  /* flow */
  inflow: "var(--inflow)",
  inflowSoft: "var(--inflow-soft)",
  outflow: "var(--outflow)",
  outflowSoft: "var(--outflow-soft)",
  anomaly: "var(--anomaly)",
  anomalySoft: "var(--anomaly-soft)",
  whale: "var(--whale)",
  whaleSoft: "var(--whale-soft)",
  neutralFlow: "var(--neutral-flow)",
} as const;

export const CATEGORY = {
  dex: { color: "var(--cat-dex)", soft: "var(--cat-dex-soft)", label: "DEX" },
  lending: { color: "var(--cat-lending)", soft: "var(--cat-lending-soft)", label: "Lending" },
  bridge: { color: "var(--cat-bridge)", soft: "var(--cat-bridge-soft)", label: "Bridge" },
  cex: { color: "var(--cat-cex)", soft: "var(--cat-cex-soft)", label: "CEX" },
  mint: { color: "var(--cat-mint)", soft: "var(--cat-mint-soft)", label: "Mint" },
  wallet: { color: "var(--cat-wallet)", soft: "var(--cat-wallet-soft)", label: "Wallet" },
} as const;

export type Category = keyof typeof CATEGORY;

export const CHAIN = {
  base: { color: "var(--chain-base)", label: "Base" },
  ethereum: { color: "var(--chain-ethereum)", label: "Ethereum" },
  arbitrum: { color: "var(--chain-arbitrum)", label: "Arbitrum" },
  optimism: { color: "var(--chain-optimism)", label: "Optimism" },
  polygon: { color: "var(--chain-polygon)", label: "Polygon" },
  solana: { color: "var(--chain-solana)", label: "Solana" },
} as const;

export type Chain = keyof typeof CHAIN;

export const ASSET = {
  usdc: { color: "var(--asset-usdc)", label: "USDC", decimals: 6 },
  usdt: { color: "var(--asset-usdt)", label: "USDT", decimals: 6 },
  dai: { color: "var(--asset-dai)", label: "DAI", decimals: 18 },
  pyusd: { color: "var(--asset-pyusd)", label: "PYUSD", decimals: 6 },
  usds: { color: "var(--asset-usds)", label: "USDS", decimals: 18 },
} as const;

export type Asset = keyof typeof ASSET;

/* Magnitude thresholds, used to colour amounts in tables / charts. */
export const MAGNITUDE = {
  small: { min: 0, color: CSS_VAR.foreground },
  large: { min: 100_000, color: CSS_VAR.accent },
  whale: { min: 1_000_000, color: CSS_VAR.anomaly },
} as const;

export function classifyAmount(n: number): keyof typeof MAGNITUDE {
  if (n >= MAGNITUDE.whale.min) return "whale";
  if (n >= MAGNITUDE.large.min) return "large";
  return "small";
}

/* Read a resolved CSS variable from :root (after the theme is applied).
   Useful for canvas/D3 where a literal hex/rgb is required. */
export function readVar(name: string, el: HTMLElement = document.documentElement): string {
  return getComputedStyle(el).getPropertyValue(name).trim();
}

/* Toggle the document theme. Mirrors both `data-theme` and `.dark` class so
   both shadcn and Stableflow tokens stay in sync. */
export function setTheme(mode: ThemeMode) {
  const html = document.documentElement;
  html.dataset.theme = mode;
  html.classList.toggle("dark", mode === "dark");
}
