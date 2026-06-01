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

export interface EntityDetailWindow {
  bucketEnd: string;
  bucketStart: string;
  minutes: number;
}

export interface EntityDetailAmount {
  currency: StablecoinSymbol;
  formatted: string;
  raw: string;
}

export interface EntityAddressLabel {
  address: string;
  attributionGroup: string;
  category: EntityCategory;
  confidence: string;
  countingPolicy: string;
  entityId: string;
  entityName: string;
  firstSeenBlock: string | null;
  label: string | null;
  logIndex: number | null;
  poolKind: string | null;
  role: string;
  sourceAddress: string | null;
  sourceEvent: string;
  sourceType: string;
  token0: string | null;
  token1: string | null;
  transactionHash: string | null;
}

export interface EntityFlowSummary {
  inflow: EntityDetailAmount;
  inflowTransferCount: number;
  net: EntityDetailAmount;
  outflow: EntityDetailAmount;
  outflowTransferCount: number;
  transferCount: number;
  window: EntityDetailWindow;
}

export interface EntityCounterpartyFlow {
  category: EntityCategory;
  entityId: string;
  entityName: string;
  inflow: EntityDetailAmount;
  net: EntityDetailAmount;
  outflow: EntityDetailAmount;
  rank: number;
  relativeShare: number;
  transferCount: number;
}

export interface EntityDetailSummary extends EntitySummary {
  attributionGroups: string[];
}

export interface EntityDetailResponse {
  data: {
    addressLabels: EntityAddressLabel[];
    counterparties: EntityCounterpartyFlow[];
    entity: EntityDetailSummary;
    flow: EntityFlowSummary;
    recentTransfers: LiveTransferRow[];
  };
  meta: {
    generatedAt: string;
    limits: {
      counterparties: number;
      recentTransfers: number;
    };
    window: EntityDetailWindow;
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
  currency: StablecoinSymbol;
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

export type FlowGraphNodeKind = "entity" | "network" | "wallet";

export type FlowGraphEdgeKind = "bridge" | "transfer";

export interface FlowGraphAmount {
  currency: StablecoinSymbol;
  formatted: string;
  raw: string;
}

export interface FlowGraphNode {
  category: EntityCategory;
  ecosystem: string | null;
  id: string;
  inflow: FlowGraphAmount;
  kind: FlowGraphNodeKind;
  name: string;
  outflow: FlowGraphAmount;
  total: FlowGraphAmount;
  transferCount: number;
}

export interface FlowGraphEdge {
  amount: FlowGraphAmount;
  count: number;
  fromId: string;
  id: string;
  kind: FlowGraphEdgeKind;
  toId: string;
}

export interface FlowGraphResponse {
  data: {
    edges: FlowGraphEdge[];
    nodes: FlowGraphNode[];
  };
  meta: {
    generatedAt: string;
    limit: {
      edges: number;
      nodes: number;
    };
    window: {
      bucketEnd: string;
      bucketStart: string;
      minutes: number;
    };
  };
}

export type FlowKpiCardId =
  | "usdc-volume-24h"
  | "transfers-1h"
  | "top-net-mover-15m"
  | "bridge-net-flow-24h";

export type FlowKpiTone = "accent" | "inflow" | "outflow" | "neutral";

export type FlowKpiTrend = "down" | "flat" | "up";

export type FlowKpiValueKind = "count" | "usdc";

export interface FlowKpiValue {
  formatted: string;
  kind: FlowKpiValueKind;
  raw: string;
}

export interface FlowKpiDelta {
  label: string;
  trend: FlowKpiTrend;
}

export interface FlowKpiSeriesPoint {
  timestamp: string;
  value: string;
}

export interface FlowKpiCard {
  delta: FlowKpiDelta | null;
  id: FlowKpiCardId;
  label: string;
  series: FlowKpiSeriesPoint[];
  tone: FlowKpiTone;
  value: FlowKpiValue;
  window: {
    bucketEnd: string;
    bucketStart: string;
    minutes: number;
  };
}

export interface FlowKpisResponse {
  data: FlowKpiCard[];
  meta: {
    generatedAt: string;
  };
}

export type TopEntityFlowMode = "net" | "inflow" | "outflow";

export interface TopEntityFlowAmount {
  currency: StablecoinSymbol;
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
