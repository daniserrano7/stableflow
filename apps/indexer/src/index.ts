import type { ProtocolSlug } from "@stableflow/shared";

const initialProtocols: ProtocolSlug[] = ["aave", "morpho"];

export function getInitialProtocols() {
  return initialProtocols;
}
