interface Asset {
  symbol: string;
  name: string;
  status: "tracked" | "preview";
  color: string;
  contract?: string;
}

interface AssetChain {
  id: number;
  name: string;
  network: string;
  assets: Asset[];
}

// Preview entries illustrate the catalog only; they have no indexer or metrics.
export const selectedAssetChain: AssetChain = {
  id: 8453,
  name: "Base",
  network: "Mainnet",
  assets: [
    {
      symbol: "USDC",
      name: "USD Coin",
      status: "tracked",
      color: "var(--asset-usdc)",
      contract: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    },
    { symbol: "USDT", name: "Tether", status: "preview", color: "var(--inflow)" },
    { symbol: "DAI", name: "Dai", status: "preview", color: "var(--anomaly)" },
  ],
};
