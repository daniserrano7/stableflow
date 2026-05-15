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

export interface LiveTransferParty {
  address: string;
  category: EntityCategory;
  displayName: string;
  entityId: string | null;
  entityName: string | null;
  isIdentified: boolean;
}

export interface LiveTransferAmount {
  currency: "USDC";
  formatted: string;
  raw: string;
}

export interface LiveTransferCursor {
  blockNumber: string;
  logIndex: number;
}

export interface LiveTransferRow {
  id: string;
  amount: LiveTransferAmount;
  blockNumber: string;
  blockTimestamp: string;
  cursor: LiveTransferCursor;
  entityType: string;
  from: LiveTransferParty;
  logIndex: number;
  to: LiveTransferParty;
  transactionHash: string;
}

export interface RecentTransfersResponse {
  data: LiveTransferRow[];
  meta: {
    generatedAt: string;
    limit: number;
  };
}

export interface LiveTransferBatchEvent {
  cursor: LiveTransferCursor | null;
  generatedAt: string;
  transfers: LiveTransferRow[];
}

export type TopEntityFlowMode = "net" | "inflow" | "outflow";

export interface TopEntityFlowAmount {
  currency: "USDC";
  formatted: string;
  raw: string;
}

export interface TopEntityFlowRow {
  rank: number;
  entityId: string;
  entityName: string;
  category: EntityCategory;
  inflow: TopEntityFlowAmount;
  inflowTransferCount: number;
  outflow: TopEntityFlowAmount;
  outflowTransferCount: number;
  net: TopEntityFlowAmount;
  netTransferCount: number;
  selected: TopEntityFlowAmount;
  selectedTransferCount: number;
  relativeShare: number;
  transferCount: number;
}

export interface TopEntityFlowsResponse {
  data: TopEntityFlowRow[];
  meta: {
    generatedAt: string;
    includeUnidentified: boolean;
    limit: number;
    mode: TopEntityFlowMode;
    window: {
      bucketEnd: string;
      bucketStart: string;
      minutes: number;
    };
  };
}
