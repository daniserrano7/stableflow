export type VisualScope = "asset" | "chain" | "entity" | "protocol";

export interface VisualIdentity {
  imageUrl: string;
  name: string;
}

const catalog = {
  asset: {
    DAI: {
      imageUrl: "https://coin-images.coingecko.com/coins/images/9956/small/Badge_Dai.png",
      name: "Dai",
    },
    USDC: {
      imageUrl: "https://coin-images.coingecko.com/coins/images/6319/small/usdc.png",
      name: "USD Coin",
    },
    USDT: {
      imageUrl: "https://coin-images.coingecko.com/coins/images/325/small/Tether.png",
      name: "Tether",
    },
  },
  chain: {
    "8453": {
      imageUrl: "https://icons.llamao.fi/icons/chains/rsz_base.jpg",
      name: "Base",
    },
  },
  protocol: {
    "aave-v3": protocolVisual("aave-v3", "Aave V3"),
    across: protocolVisual("across", "Across"),
    aerodrome: protocolVisual("aerodrome", "Aerodrome"),
    "compound-v3": protocolVisual("compound-v3", "Compound V3"),
    "morpho-blue": protocolVisual("morpho-blue", "Morpho Blue"),
    "pancakeswap-v3": protocolVisual("pancakeswap-amm-v3", "PancakeSwap V3"),
    "uniswap-v3": protocolVisual("uniswap-v3", "Uniswap V3"),
  },
  entity: {
    circle: protocolVisual("circle", "Circle"),
    "circle-cctp": protocolVisual("circle", "Circle CCTP"),
  },
} satisfies Partial<Record<VisualScope, Record<string, VisualIdentity>>>;

const entityAliases: Record<string, { id: string; scope: VisualScope }> = {
  "aave-v3": { id: "aave-v3", scope: "protocol" },
  across: { id: "across", scope: "protocol" },
  aerodrome: { id: "aerodrome", scope: "protocol" },
  base: { id: "8453", scope: "chain" },
  "base-native-bridge": { id: "8453", scope: "chain" },
  "compound-v3": { id: "compound-v3", scope: "protocol" },
  "morpho-blue": { id: "morpho-blue", scope: "protocol" },
  "pancakeswap-v3": { id: "pancakeswap-v3", scope: "protocol" },
  "uniswap-v3": { id: "uniswap-v3", scope: "protocol" },
};

export function getVisualIdentity(scope: VisualScope, id: number | string) {
  const normalizedId = String(id);

  if (scope === "entity") {
    const directIdentity = getCatalogIdentity("entity", normalizedId);
    if (directIdentity) return directIdentity;

    const alias = entityAliases[normalizedId];
    if (alias) return getCatalogIdentity(alias.scope, alias.id);
  }

  return getCatalogIdentity(scope, normalizedId);
}

function getCatalogIdentity(scope: VisualScope, id: string): VisualIdentity | undefined {
  const scopeCatalog = catalog[scope] as Record<string, VisualIdentity> | undefined;
  return scopeCatalog?.[id];
}

function protocolVisual(slug: string, name: string): VisualIdentity {
  return {
    imageUrl: `https://icons.llamao.fi/icons/protocols/${slug}`,
    name,
  };
}
