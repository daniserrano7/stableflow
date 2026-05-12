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

export type EntityCategory = string;

export interface EntityCategorySummary {
  category: EntityCategory;
  entityCount: number;
  labelCount: number;
}

export interface EntitySummary {
  entityId: string;
  entityName: string;
  category: EntityCategory;
  addressCount: number;
  labelCount: number;
  firstSeenBlock: string | null;
  latestSeenBlock: string | null;
  roles: string[];
  sourceTypes: string[];
}

export interface EntityListResponse {
  data: EntitySummary[];
  meta: {
    categories: EntityCategorySummary[];
    generatedAt: string;
    totalEntities: number;
    totalLabels: number;
  };
}
