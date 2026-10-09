/**
 * Where each category sits in the flow graph. Lanes run left to right in the order money usually
 * travels: wallets on Base, the protocols they use, the gateways that move USDC off Base, and the
 * chains on the other side. Lanes without nodes collapse, so the graph adapts to whatever the
 * window contains.
 */
export type FlowLaneId = "wallets" | "protocols" | "gateways" | "networks";

export interface FlowLane {
  /** True for lanes outside Base; the graph draws the Base boundary between the two. */
  external: boolean;
  id: FlowLaneId;
  label: string;
  /** Relative card width; chains need room for a name and an amount on one line. */
  widthWeight: number;
}

export interface FlowCategory {
  color: string;
  key: string;
  label: string;
  lane: FlowLaneId;
  order: number;
  plural: string;
}

export const flowLanes: FlowLane[] = [
  { external: false, id: "wallets", label: "Wallets", widthWeight: 1 },
  { external: false, id: "protocols", label: "Protocols", widthWeight: 1.05 },
  { external: false, id: "gateways", label: "Bridges & exchanges", widthWeight: 1 },
  { external: true, id: "networks", label: "Other chains", widthWeight: 1.3 },
];

const knownCategories: Record<string, Omit<FlowCategory, "key">> = {
  wallet: {
    color: "var(--cat-wallet)",
    label: "Wallet",
    lane: "wallets",
    order: 0,
    plural: "Wallets",
  },
  dex: { color: "var(--cat-dex)", label: "DEX", lane: "protocols", order: 1, plural: "DEXs" },
  lending: {
    color: "var(--cat-lending)",
    label: "Lending",
    lane: "protocols",
    order: 2,
    plural: "Lending",
  },
  mint: { color: "var(--cat-mint)", label: "Mint", lane: "protocols", order: 3, plural: "Mints" },
  stablecoin_issuer: {
    color: "var(--cat-mint)",
    label: "Issuer",
    lane: "protocols",
    order: 3,
    plural: "Issuers",
  },
  bridge: {
    color: "var(--cat-bridge)",
    label: "Bridge",
    lane: "gateways",
    order: 5,
    plural: "Bridges",
  },
  cex: { color: "var(--cat-cex)", label: "CEX", lane: "gateways", order: 6, plural: "Exchanges" },
  network: {
    color: "var(--cat-network)",
    label: "Network",
    lane: "networks",
    order: 7,
    plural: "Other chains",
  },
};

/** Categories the graph has no rule for sit with the protocols, in a neutral colour. */
const unknownCategoryOrder = 4;

export function getFlowCategory(key: string): FlowCategory {
  const normalizedKey = key.toLowerCase();
  const known = knownCategories[normalizedKey];

  if (known !== undefined) {
    return { ...known, key: normalizedKey };
  }

  const label = formatCategoryKey(normalizedKey);

  return {
    color: "var(--neutral-flow)",
    key: normalizedKey,
    label,
    lane: "protocols",
    order: unknownCategoryOrder,
    plural: label,
  };
}

export function getFlowLaneIndex(category: string) {
  const laneId = getFlowCategory(category).lane;

  return flowLanes.findIndex((lane) => lane.id === laneId);
}

function formatCategoryKey(key: string) {
  if (key.length <= 3) {
    return key.toUpperCase();
  }

  return key
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
