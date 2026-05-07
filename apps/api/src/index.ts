import type { ChainId } from "@stableflow/shared";

const supportedChains: ChainId[] = ["base"];

export function getSupportedChains() {
  return supportedChains;
}
