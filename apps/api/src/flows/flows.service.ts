import { Injectable } from "@nestjs/common";
import {
  usdcBridgeFlowBuckets,
  usdcEntityFlowBuckets,
  usdcEntityPairFlowBuckets,
} from "@stableflow/indexer/ponder-schema";
import type {
  FlowGraphEdge,
  FlowGraphEdgeKind,
  FlowGraphNode,
  FlowGraphNodeKind,
  FlowGraphResponse,
  TopEntityFlowMode,
  TopEntityFlowRow,
  TopEntityFlowsResponse,
} from "@stableflow/shared";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { DatabaseService } from "../database/database.service.js";
import { toTokenAmount } from "../tokens/base-usdc.js";

const defaultLimit = 8;
const defaultMode = "net" satisfies TopEntityFlowMode;
const defaultWindowMinutes = 15;
const defaultGraphWindowMinutes = 5;
const graphCandidateBridgeEdgeLimit = 120;
const graphCandidatePairEdgeLimit = 240;
const graphMaxEdges = 30;
const graphMaxNodes = 24;
const includeUnidentified = true;
const maxLimit = 20;
const maxWindowMinutes = 24 * 60;
const minWindowMinutes = 1;
const oneMinuteBucketSize = "1m";

interface TopEntityFlowOptions {
  limit?: number;
  mode?: TopEntityFlowMode;
  windowMinutes?: number;
}

interface FlowGraphOptions {
  windowMinutes?: number;
}

interface EntityFlowAggregateRow {
  category: string;
  entityId: string;
  entityName: string;
  inflowTransferCount: string;
  inflowValue: string;
  outflowTransferCount: string;
  outflowValue: string;
}

interface EntityPairFlowAggregateRow {
  fromCategory: string;
  fromEntityId: string;
  fromEntityName: string;
  toCategory: string;
  toEntityId: string;
  toEntityName: string;
  totalValue: string;
  transferCount: string;
}

interface BridgeFlowAggregateRow {
  bridgeId: string;
  bridgeName: string;
  direction: string;
  eventCount: string;
  remoteNetworkEcosystem: string;
  remoteNetworkId: string;
  remoteNetworkName: string;
  totalValue: string;
}

interface GraphNodeDraft {
  category: string;
  ecosystem: string | null;
  id: string;
  inflow: bigint;
  kind: FlowGraphNodeKind;
  name: string;
  outflow: bigint;
  total: bigint;
  transferCount: bigint;
}

interface GraphEdgeDraft {
  amount: bigint;
  count: bigint;
  fromId: string;
  id: string;
  kind: FlowGraphEdgeKind;
  toId: string;
}

interface GraphNodeInput {
  category: string;
  ecosystem?: string | null;
  id: string;
  kind: FlowGraphNodeKind;
  name: string;
}

interface GraphWindow {
  bucketEndSeconds: number;
  bucketStartSeconds: number;
  minutes: number;
}

@Injectable()
export class FlowsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async listTopEntityFlows(options: TopEntityFlowOptions): Promise<TopEntityFlowsResponse> {
    const limit = normalizeLimit(options.limit);
    const mode = normalizeMode(options.mode);
    const windowMinutes = normalizeWindowMinutes(options.windowMinutes);
    const latestBucketStartSeconds = await this.getLatestBucketStartSeconds();
    const window = getBucketWindow(windowMinutes, latestBucketStartSeconds);

    if (latestBucketStartSeconds === null) {
      return {
        data: [],
        meta: {
          generatedAt: new Date().toISOString(),
          includeUnidentified,
          limit,
          mode,
          window: {
            bucketEnd: new Date(window.bucketEndSeconds * 1000).toISOString(),
            bucketStart: new Date(window.bucketStartSeconds * 1000).toISOString(),
            minutes: window.minutes,
          },
        },
      };
    }

    const rows = await this.databaseService.db
      .select({
        category: usdcEntityFlowBuckets.category,
        entityId: usdcEntityFlowBuckets.entityId,
        entityName: usdcEntityFlowBuckets.entityName,
        inflowTransferCount: sql<string>`coalesce(sum(${usdcEntityFlowBuckets.transferCount}) filter (where ${usdcEntityFlowBuckets.direction} = 'in'), 0)::text`,
        inflowValue: sql<string>`coalesce(sum(${usdcEntityFlowBuckets.totalValue}) filter (where ${usdcEntityFlowBuckets.direction} = 'in'), 0)::text`,
        outflowTransferCount: sql<string>`coalesce(sum(${usdcEntityFlowBuckets.transferCount}) filter (where ${usdcEntityFlowBuckets.direction} = 'out'), 0)::text`,
        outflowValue: sql<string>`coalesce(sum(${usdcEntityFlowBuckets.totalValue}) filter (where ${usdcEntityFlowBuckets.direction} = 'out'), 0)::text`,
      })
      .from(usdcEntityFlowBuckets)
      .where(
        and(
          eq(usdcEntityFlowBuckets.bucketSize, oneMinuteBucketSize),
          gte(usdcEntityFlowBuckets.bucketStart, BigInt(window.bucketStartSeconds)),
          lt(usdcEntityFlowBuckets.bucketStart, BigInt(window.bucketEndSeconds)),
        ),
      )
      .groupBy(
        usdcEntityFlowBuckets.entityId,
        usdcEntityFlowBuckets.entityName,
        usdcEntityFlowBuckets.category,
      );

    return {
      data: toTopEntityFlowRows(rows, mode, limit),
      meta: {
        generatedAt: new Date().toISOString(),
        includeUnidentified,
        limit,
        mode,
        window: {
          bucketEnd: new Date(window.bucketEndSeconds * 1000).toISOString(),
          bucketStart: new Date(window.bucketStartSeconds * 1000).toISOString(),
          minutes: window.minutes,
        },
      },
    };
  }

  async listFlowGraph(options: FlowGraphOptions): Promise<FlowGraphResponse> {
    const windowMinutes = normalizeWindowMinutes(options.windowMinutes, defaultGraphWindowMinutes);
    const latestBucketStartSeconds = await this.getLatestGraphBucketStartSeconds();
    const window = getBucketWindow(windowMinutes, latestBucketStartSeconds);

    if (latestBucketStartSeconds === null) {
      return toFlowGraphResponse([], [], window);
    }

    const [entityPairRows, bridgeRows] = await Promise.all([
      this.listEntityPairFlowRows(window),
      this.listBridgeFlowRows(window),
    ]);
    const graph = buildFlowGraph(entityPairRows, bridgeRows);

    return toFlowGraphResponse(graph.nodes, graph.edges, window);
  }

  private async getLatestBucketStartSeconds() {
    const latestBuckets = await this.databaseService.db
      .select({
        bucketStart: sql<string | null>`max(${usdcEntityFlowBuckets.bucketStart})::text`,
      })
      .from(usdcEntityFlowBuckets)
      .where(eq(usdcEntityFlowBuckets.bucketSize, oneMinuteBucketSize));

    const bucketStart = latestBuckets.at(0)?.bucketStart;

    if (bucketStart === undefined || bucketStart === null) {
      return null;
    }

    return Number(BigInt(bucketStart));
  }

  private async getLatestGraphBucketStartSeconds() {
    const [latestEntityPairBuckets, latestBridgeBuckets] = await Promise.all([
      this.databaseService.db
        .select({
          bucketStart: sql<string | null>`max(${usdcEntityPairFlowBuckets.bucketStart})::text`,
        })
        .from(usdcEntityPairFlowBuckets)
        .where(eq(usdcEntityPairFlowBuckets.bucketSize, oneMinuteBucketSize)),
      this.databaseService.db
        .select({
          bucketStart: sql<string | null>`max(${usdcBridgeFlowBuckets.bucketStart})::text`,
        })
        .from(usdcBridgeFlowBuckets)
        .where(eq(usdcBridgeFlowBuckets.bucketSize, oneMinuteBucketSize)),
    ]);

    const bucketStarts = [
      latestEntityPairBuckets.at(0)?.bucketStart,
      latestBridgeBuckets.at(0)?.bucketStart,
    ].flatMap((bucketStart) =>
      bucketStart === undefined || bucketStart === null ? [] : [bucketStart],
    );

    if (bucketStarts.length === 0) {
      return null;
    }

    return Math.max(...bucketStarts.map((bucketStart) => Number(BigInt(bucketStart))));
  }

  private async listEntityPairFlowRows(window: GraphWindow): Promise<EntityPairFlowAggregateRow[]> {
    return this.databaseService.db
      .select({
        fromCategory: usdcEntityPairFlowBuckets.fromCategory,
        fromEntityId: usdcEntityPairFlowBuckets.fromEntityId,
        fromEntityName: usdcEntityPairFlowBuckets.fromEntityName,
        toCategory: usdcEntityPairFlowBuckets.toCategory,
        toEntityId: usdcEntityPairFlowBuckets.toEntityId,
        toEntityName: usdcEntityPairFlowBuckets.toEntityName,
        totalValue: sql<string>`sum(${usdcEntityPairFlowBuckets.totalValue})::text`,
        transferCount: sql<string>`sum(${usdcEntityPairFlowBuckets.transferCount})::text`,
      })
      .from(usdcEntityPairFlowBuckets)
      .where(
        and(
          eq(usdcEntityPairFlowBuckets.bucketSize, oneMinuteBucketSize),
          gte(usdcEntityPairFlowBuckets.bucketStart, BigInt(window.bucketStartSeconds)),
          lt(usdcEntityPairFlowBuckets.bucketStart, BigInt(window.bucketEndSeconds)),
        ),
      )
      .groupBy(
        usdcEntityPairFlowBuckets.fromEntityId,
        usdcEntityPairFlowBuckets.fromEntityName,
        usdcEntityPairFlowBuckets.fromCategory,
        usdcEntityPairFlowBuckets.toEntityId,
        usdcEntityPairFlowBuckets.toEntityName,
        usdcEntityPairFlowBuckets.toCategory,
      )
      .orderBy(desc(sql`sum(${usdcEntityPairFlowBuckets.totalValue})`))
      .limit(graphCandidatePairEdgeLimit);
  }

  private async listBridgeFlowRows(window: GraphWindow): Promise<BridgeFlowAggregateRow[]> {
    return this.databaseService.db
      .select({
        bridgeId: usdcBridgeFlowBuckets.bridgeId,
        bridgeName: usdcBridgeFlowBuckets.bridgeName,
        direction: usdcBridgeFlowBuckets.direction,
        eventCount: sql<string>`sum(${usdcBridgeFlowBuckets.eventCount})::text`,
        remoteNetworkEcosystem: usdcBridgeFlowBuckets.remoteNetworkEcosystem,
        remoteNetworkId: usdcBridgeFlowBuckets.remoteNetworkId,
        remoteNetworkName: usdcBridgeFlowBuckets.remoteNetworkName,
        totalValue: sql<string>`sum(${usdcBridgeFlowBuckets.totalValue})::text`,
      })
      .from(usdcBridgeFlowBuckets)
      .where(
        and(
          eq(usdcBridgeFlowBuckets.bucketSize, oneMinuteBucketSize),
          gte(usdcBridgeFlowBuckets.bucketStart, BigInt(window.bucketStartSeconds)),
          lt(usdcBridgeFlowBuckets.bucketStart, BigInt(window.bucketEndSeconds)),
        ),
      )
      .groupBy(
        usdcBridgeFlowBuckets.bridgeId,
        usdcBridgeFlowBuckets.bridgeName,
        usdcBridgeFlowBuckets.direction,
        usdcBridgeFlowBuckets.remoteNetworkId,
        usdcBridgeFlowBuckets.remoteNetworkName,
        usdcBridgeFlowBuckets.remoteNetworkEcosystem,
      )
      .orderBy(desc(sql`sum(${usdcBridgeFlowBuckets.totalValue})`))
      .limit(graphCandidateBridgeEdgeLimit);
  }
}

const buildFlowGraph = (
  entityPairRows: EntityPairFlowAggregateRow[],
  bridgeRows: BridgeFlowAggregateRow[],
): { edges: GraphEdgeDraft[]; nodes: GraphNodeDraft[] } => {
  const nodesById = new Map<string, GraphNodeDraft>();
  const edgesById = new Map<string, GraphEdgeDraft>();

  for (const row of entityPairRows) {
    const amount = BigInt(row.totalValue);
    const count = BigInt(row.transferCount);

    if (amount <= 0n || count <= 0n) {
      continue;
    }

    const fromNode = toEntityGraphNode(row.fromEntityId, row.fromEntityName, row.fromCategory);
    const toNode = toEntityGraphNode(row.toEntityId, row.toEntityName, row.toCategory);

    upsertGraphEdge({
      amount,
      count,
      edgesById,
      from: fromNode,
      kind: "transfer",
      nodesById,
      to: toNode,
    });
  }

  for (const row of bridgeRows) {
    const amount = BigInt(row.totalValue);
    const count = BigInt(row.eventCount);

    if (amount <= 0n || count <= 0n) {
      continue;
    }

    const bridgeNode = {
      category: "bridge",
      id: `entity:${row.bridgeId}`,
      kind: "entity",
      name: row.bridgeName,
    } satisfies GraphNodeInput;
    const networkNode = {
      category: "network",
      ecosystem: row.remoteNetworkEcosystem,
      id: `network:${row.remoteNetworkId}`,
      kind: "network",
      name: row.remoteNetworkName,
    } satisfies GraphNodeInput;

    upsertGraphEdge({
      amount,
      count,
      edgesById,
      from: row.direction === "inbound" ? networkNode : bridgeNode,
      kind: "bridge",
      nodesById,
      to: row.direction === "inbound" ? bridgeNode : networkNode,
    });
  }

  return selectFlowGraph([...nodesById.values()], [...edgesById.values()]);
};

const upsertGraphEdge = ({
  amount,
  count,
  edgesById,
  from,
  kind,
  nodesById,
  to,
}: {
  amount: bigint;
  count: bigint;
  edgesById: Map<string, GraphEdgeDraft>;
  from: GraphNodeInput;
  kind: FlowGraphEdgeKind;
  nodesById: Map<string, GraphNodeDraft>;
  to: GraphNodeInput;
}) => {
  const fromNode = upsertGraphNode(nodesById, from);
  const toNode = upsertGraphNode(nodesById, to);

  fromNode.outflow += amount;
  fromNode.total += amount;
  fromNode.transferCount += count;
  toNode.inflow += amount;
  toNode.total += amount;
  toNode.transferCount += count;

  if (from.id === to.id) {
    return;
  }

  const id = `${from.id}->${to.id}`;
  const edge = edgesById.get(id);

  if (edge === undefined) {
    edgesById.set(id, {
      amount,
      count,
      fromId: from.id,
      id,
      kind,
      toId: to.id,
    });
    return;
  }

  edge.amount += amount;
  edge.count += count;
};

const upsertGraphNode = (nodesById: Map<string, GraphNodeDraft>, input: GraphNodeInput) => {
  const currentNode = nodesById.get(input.id);

  if (currentNode !== undefined) {
    if (currentNode.kind === "wallet" && input.kind !== "wallet") {
      currentNode.kind = input.kind;
      currentNode.category = input.category;
      currentNode.name = input.name;
    }

    if (currentNode.ecosystem === null && input.ecosystem !== undefined) {
      currentNode.ecosystem = input.ecosystem;
    }

    return currentNode;
  }

  const node = {
    category: input.category,
    ecosystem: input.ecosystem ?? null,
    id: input.id,
    inflow: 0n,
    kind: input.kind,
    name: input.name,
    outflow: 0n,
    total: 0n,
    transferCount: 0n,
  };

  nodesById.set(input.id, node);

  return node;
};

const toEntityGraphNode = (
  entityId: string,
  entityName: string,
  category: string,
): GraphNodeInput => {
  if (entityId === "unidentified" || category === "unidentified") {
    return {
      category: "wallet",
      id: "wallet:unidentified",
      kind: "wallet",
      name: "Unidentified wallets",
    };
  }

  return {
    category,
    id: `entity:${entityId}`,
    kind: "entity",
    name: entityName,
  };
};

const selectFlowGraph = (
  allNodes: GraphNodeDraft[],
  allEdges: GraphEdgeDraft[],
): { edges: GraphEdgeDraft[]; nodes: GraphNodeDraft[] } => {
  const sortedNodes = allNodes.sort(compareGraphNodes);
  const sortedEdges = allEdges.sort(compareGraphEdges);
  const selectedNodeIds = new Set<string>();
  const selectedEdgeIds = new Set<string>();

  for (const edge of sortedEdges) {
    if (selectedEdgeIds.size >= graphMaxEdges) {
      break;
    }

    const missingNodeIds = [edge.fromId, edge.toId].filter(
      (nodeId) => !selectedNodeIds.has(nodeId),
    );

    if (selectedNodeIds.size + missingNodeIds.length > graphMaxNodes) {
      continue;
    }

    for (const nodeId of missingNodeIds) {
      selectedNodeIds.add(nodeId);
    }

    selectedEdgeIds.add(edge.id);
  }

  for (const node of sortedNodes) {
    if (selectedNodeIds.size >= graphMaxNodes) {
      break;
    }

    selectedNodeIds.add(node.id);
  }

  for (const edge of sortedEdges) {
    if (selectedEdgeIds.size >= graphMaxEdges) {
      break;
    }

    if (selectedNodeIds.has(edge.fromId) && selectedNodeIds.has(edge.toId)) {
      selectedEdgeIds.add(edge.id);
    }
  }

  return {
    edges: sortedEdges.filter(
      (edge) =>
        selectedEdgeIds.has(edge.id) &&
        selectedNodeIds.has(edge.fromId) &&
        selectedNodeIds.has(edge.toId),
    ),
    nodes: sortedNodes.filter((node) => selectedNodeIds.has(node.id)),
  };
};

const toFlowGraphResponse = (
  nodes: GraphNodeDraft[],
  edges: GraphEdgeDraft[],
  window: GraphWindow,
): FlowGraphResponse => ({
  data: {
    edges: edges.map(toFlowGraphEdge),
    nodes: nodes.map(toFlowGraphNode),
  },
  meta: {
    generatedAt: new Date().toISOString(),
    limit: {
      edges: graphMaxEdges,
      nodes: graphMaxNodes,
    },
    window: {
      bucketEnd: new Date(window.bucketEndSeconds * 1000).toISOString(),
      bucketStart: new Date(window.bucketStartSeconds * 1000).toISOString(),
      minutes: window.minutes,
    },
  },
});

const toFlowGraphNode = (node: GraphNodeDraft): FlowGraphNode => ({
  category: node.category,
  ecosystem: node.ecosystem,
  id: node.id,
  inflow: toTokenAmount(node.inflow),
  kind: node.kind,
  name: node.name,
  outflow: toTokenAmount(node.outflow),
  total: toTokenAmount(node.total),
  transferCount: Number(node.transferCount),
});

const toFlowGraphEdge = (edge: GraphEdgeDraft): FlowGraphEdge => ({
  amount: toTokenAmount(edge.amount),
  count: Number(edge.count),
  fromId: edge.fromId,
  id: edge.id,
  kind: edge.kind,
  toId: edge.toId,
});

const toTopEntityFlowRows = (
  rows: EntityFlowAggregateRow[],
  mode: TopEntityFlowMode,
  limit: number,
): TopEntityFlowRow[] => {
  const sortedRows = rows
    .map((row) => {
      const inflowValue = BigInt(row.inflowValue);
      const outflowValue = BigInt(row.outflowValue);
      const netValue = inflowValue - outflowValue;
      const selectedValue = getSelectedValue(mode, inflowValue, outflowValue, netValue);
      const inflowTransferCount = BigInt(row.inflowTransferCount);
      const outflowTransferCount = BigInt(row.outflowTransferCount);
      const netTransferCount = inflowTransferCount + outflowTransferCount;

      return {
        category: row.category,
        entityId: row.entityId,
        entityName: row.entityName,
        inflowTransferCount,
        inflowValue,
        netValue,
        netTransferCount,
        outflowTransferCount,
        outflowValue,
        selectedMagnitude: abs(selectedValue),
        selectedTransferCount: getSelectedTransferCount(
          mode,
          inflowTransferCount,
          outflowTransferCount,
          netTransferCount,
        ),
        selectedValue,
      };
    })
    .filter((row) => row.selectedMagnitude > 0n)
    .sort((a, b) => compareBigIntDesc(a.selectedMagnitude, b.selectedMagnitude))
    .slice(0, limit);

  const topMagnitude = sortedRows.at(0)?.selectedMagnitude ?? 0n;

  return sortedRows.map((row, index) => ({
    category: row.category,
    entityId: row.entityId,
    entityName: row.entityName,
    inflow: toTokenAmount(row.inflowValue),
    inflowTransferCount: Number(row.inflowTransferCount),
    net: toTokenAmount(row.netValue),
    netTransferCount: Number(row.netTransferCount),
    outflow: toTokenAmount(row.outflowValue),
    outflowTransferCount: Number(row.outflowTransferCount),
    rank: index + 1,
    relativeShare:
      topMagnitude === 0n ? 0 : Number((row.selectedMagnitude * 10_000n) / topMagnitude) / 100,
    selected: toTokenAmount(row.selectedValue),
    selectedTransferCount: Number(row.selectedTransferCount),
    transferCount: Number(row.selectedTransferCount),
  }));
};

const getSelectedValue = (
  mode: TopEntityFlowMode,
  inflowValue: bigint,
  outflowValue: bigint,
  netValue: bigint,
) => {
  if (mode === "inflow") {
    return inflowValue;
  }

  if (mode === "outflow") {
    return outflowValue;
  }

  return netValue;
};

const getSelectedTransferCount = (
  mode: TopEntityFlowMode,
  inflowTransferCount: bigint,
  outflowTransferCount: bigint,
  netTransferCount: bigint,
) => {
  if (mode === "inflow") {
    return inflowTransferCount;
  }

  if (mode === "outflow") {
    return outflowTransferCount;
  }

  return netTransferCount;
};

const normalizeLimit = (limit: number | undefined) => {
  if (limit === undefined || !Number.isFinite(limit)) {
    return defaultLimit;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), maxLimit);
};

const normalizeMode = (mode: TopEntityFlowMode | undefined): TopEntityFlowMode => {
  if (mode === "inflow" || mode === "outflow" || mode === "net") {
    return mode;
  }

  return defaultMode;
};

const normalizeWindowMinutes = (
  windowMinutes: number | undefined,
  defaultMinutes = defaultWindowMinutes,
) => {
  if (windowMinutes === undefined || !Number.isFinite(windowMinutes)) {
    return defaultMinutes;
  }

  return Math.min(Math.max(Math.trunc(windowMinutes), minWindowMinutes), maxWindowMinutes);
};

const getBucketWindow = (minutes: number, latestBucketStartSeconds: number | null) => {
  const bucketEndSeconds =
    latestBucketStartSeconds === null
      ? Math.floor(Date.now() / 60_000) * 60
      : latestBucketStartSeconds + 60;

  return {
    bucketEndSeconds,
    bucketStartSeconds: bucketEndSeconds - minutes * 60,
    minutes,
  };
};

const abs = (value: bigint) => (value < 0n ? -value : value);

const compareGraphNodes = (a: GraphNodeDraft, b: GraphNodeDraft) =>
  compareBigIntDesc(a.total, b.total) ||
  compareBigIntDesc(a.transferCount, b.transferCount) ||
  a.name.localeCompare(b.name);

const compareGraphEdges = (a: GraphEdgeDraft, b: GraphEdgeDraft) =>
  compareBigIntDesc(a.amount, b.amount) ||
  compareBigIntDesc(a.count, b.count) ||
  a.id.localeCompare(b.id);

const compareBigIntDesc = (a: bigint, b: bigint) => {
  if (a === b) {
    return 0;
  }

  return a > b ? -1 : 1;
};
