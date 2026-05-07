import type { StablecoinSymbol } from "@stableflow/shared";

const initialStablecoin: StablecoinSymbol = "USDC";

export function getInitialPageTitle() {
  return `StableFlow ${initialStablecoin} Overview`;
}
