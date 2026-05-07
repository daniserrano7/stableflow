export type ChainId = "base";

export type StablecoinSymbol = "USDC";

export type ProtocolSlug = "aave" | "morpho";

export type MovementKind =
  | "token_transfer"
  | "protocol_inflow"
  | "protocol_outflow"
  | "protocol_deposit"
  | "protocol_withdrawal";

export type MovementDirection = "inflow" | "outflow" | "neutral";

export type ClassificationConfidence = "low" | "medium" | "high";
