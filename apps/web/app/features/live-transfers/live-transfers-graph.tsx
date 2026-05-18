import type { LiveTransferParty, LiveTransferRow } from "@stableflow/shared";
import { CircleDollarSign, GitBranch, Network } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Panel, PanelActions, PanelHead, PanelTitle } from "~/components";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { CATEGORY, type Category } from "~/styles/tokens";
import { fmtUSD } from "~/utils/format";
import {
  getEntityGlyph,
  getPartyCategory,
  getTransferAmount,
  getTransferMagnitude,
  isTransferFilter,
  largeTransferThreshold,
  transferFilterOptions,
  type TransferFilter,
  whaleThreshold,
} from "./live-transfers.utils";

const maxGraphNodes = 24;
const maxGraphEdges = 42;
const maxParticles = 80;
const minGraphWidth = 320;
const minGraphHeight = 320;
const unidentifiedWalletNodeId = "wallet:unidentified";
const unidentifiedWalletName = "Unidentified wallets";

const unidentifiedWalletParty: LiveTransferParty = {
  address: unidentifiedWalletNodeId,
  category: "unidentified",
  displayName: unidentifiedWalletName,
  entityId: null,
  entityName: null,
  isIdentified: false,
};

interface LiveTransfersGraphProps {
  bufferedCount: number;
  filter: TransferFilter;
  freshTransferIds: ReadonlySet<string>;
  matchingCount: number;
  onFilterChange: (filter: TransferFilter) => void;
  transfers: LiveTransferRow[];
}

interface GraphNode {
  category: Category;
  glyph: string;
  id: string;
  inflow: number;
  isAggregate: boolean;
  isIdentified: boolean;
  isWallet: boolean;
  name: string;
  outflow: number;
  party: LiveTransferParty;
  rank: number;
  total: number;
  transferCount: number;
}

interface GraphEdge {
  amount: number;
  count: number;
  fromId: string;
  id: string;
  latestTransferId: string;
  latestTimestamp: string;
  magnitude: "small" | "large" | "whale";
  rank: number;
  toId: string;
}

interface TransferGraph {
  edges: GraphEdge[];
  edgesById: Map<string, GraphEdge>;
  nodes: GraphNode[];
  nodesById: Map<string, GraphNode>;
}

interface Point {
  x: number;
  y: number;
}

interface PositionedPoint extends Point {
  anchorX: number;
  anchorY: number;
  vx: number;
  vy: number;
}

interface EdgeGeometry {
  control: Point;
  edge: GraphEdge;
  end: Point;
  label: Point;
  path: string;
  start: Point;
}

interface GraphGeometry {
  edges: EdgeGeometry[];
  height: number;
  positions: Map<string, Point>;
  radii: Map<string, number>;
  width: number;
}

interface GraphParticle {
  color: string;
  durationMs: number;
  edgeId: string;
  id: string;
  radius: number;
  startedAt: number;
}

interface TransferGraphBuildOptions {
  limitTopology?: boolean;
}

interface TopologyState {
  filter: TransferFilter;
  graph: TransferGraph;
}

export function LiveTransfersGraph({
  bufferedCount,
  filter,
  freshTransferIds,
  matchingCount,
  onFilterChange,
  transfers,
}: LiveTransfersGraphProps) {
  const rawMarkerId = useId();
  const markerId = useMemo(
    () => `live-transfer-arrow-${rawMarkerId.replace(/:/g, "")}`,
    [rawMarkerId],
  );
  const [topologyState, setTopologyState] = useState<TopologyState>(() => ({
    filter,
    graph: buildTransferGraph(transfers),
  }));
  const topologyGraph =
    topologyState.filter === filter ? topologyState.graph : buildTransferGraph(transfers);
  const liveGraph = useMemo(
    () => applyLiveMetricsToTopology(topologyGraph, transfers),
    [topologyGraph, transfers],
  );
  const visibleEdgeIds = useMemo(
    () => new Set(topologyGraph.edges.map((edge) => edge.id)),
    [topologyGraph.edges],
  );
  const [wrapRef, size] = useElementSize();
  const geometry = useMemo(
    () => createGraphGeometry(topologyGraph, size.width, size.height),
    [topologyGraph, size.height, size.width],
  );
  const edgeGeometryById = useMemo(
    () => new Map(geometry.edges.map((edgeGeometry) => [edgeGeometry.edge.id, edgeGeometry])),
    [geometry.edges],
  );
  const [particles, setParticles] = useState<GraphParticle[]>([]);
  const seenFreshTransferIdsRef = useRef(new Set<string>());

  useEffect(() => {
    const shouldRebuildTopology =
      topologyState.filter !== filter ||
      (topologyState.graph.nodes.length === 0 && transfers.length > 0);

    if (!shouldRebuildTopology) {
      return;
    }

    setTopologyState({
      filter,
      graph: buildTransferGraph(transfers),
    });
    setParticles([]);
    seenFreshTransferIdsRef.current.clear();
  }, [filter, topologyState.filter, topologyState.graph.nodes.length, transfers]);

  useEffect(() => {
    const retainedTransferIds = new Set(transfers.map((transfer) => transfer.id));

    for (const transferId of seenFreshTransferIdsRef.current) {
      if (!retainedTransferIds.has(transferId)) {
        seenFreshTransferIdsRef.current.delete(transferId);
      }
    }

    const now = getHighResNow();
    const nextParticles: GraphParticle[] = [];

    for (const transfer of transfers) {
      if (
        !freshTransferIds.has(transfer.id) ||
        seenFreshTransferIdsRef.current.has(transfer.id)
      ) {
        continue;
      }

      seenFreshTransferIdsRef.current.add(transfer.id);

      const edgeId = getTransferEdgeId(transfer);

      if (edgeId === null || !visibleEdgeIds.has(edgeId)) {
        continue;
      }

      nextParticles.push({
        color: getMagnitudeColor(getTransferAmount(transfer)),
        durationMs: 1_100 + hashToUnit(transfer.id) * 500,
        edgeId,
        id: transfer.id,
        radius: getParticleRadius(getTransferAmount(transfer)),
        startedAt: now,
      });
    }

    if (nextParticles.length > 0) {
      setParticles((currentParticles) => [
        ...currentParticles.filter((particle) => now - particle.startedAt < particle.durationMs),
        ...nextParticles,
      ].slice(-maxParticles));
    }
  }, [freshTransferIds, transfers, visibleEdgeIds]);

  useEffect(() => {
    if (particles.length === 0) {
      return;
    }

    const interval = window.setInterval(() => {
      const now = getHighResNow();
      setParticles((currentParticles) =>
        currentParticles.filter((particle) => now - particle.startedAt < particle.durationMs),
      );
    }, 2_000);

    return () => window.clearInterval(interval);
  }, [particles.length]);

  const now = useAnimationFrameTime(particles.length > 0);
  const liveParticles = particles.filter((particle) => now - particle.startedAt < particle.durationMs);
  const activeEdgeIds = new Set(liveParticles.map((particle) => particle.edgeId));
  const activeNodeIds = new Set<string>();

  for (const particle of liveParticles) {
    const edge = topologyGraph.edgesById.get(particle.edgeId);

    if (edge !== undefined) {
      activeNodeIds.add(edge.fromId);
      activeNodeIds.add(edge.toId);
    }
  }

  const edgeLabelLimit = size.width < 520 ? 4 : 8;

  return (
    <Panel className="min-h-[430px]">
      <PanelHead className="flex-wrap gap-2">
        <PanelTitle live>Flow Graph</PanelTitle>
        <PanelActions>
          <ToggleGroup
            aria-label="Graph transfer filter"
            type="single"
            value={filter}
            onValueChange={(nextFilter) => {
              if (isTransferFilter(nextFilter)) {
                onFilterChange(nextFilter);
              }
            }}
          >
            {transferFilterOptions.map((option) => (
              <ToggleGroupItem key={option.value} value={option.value}>
                {option.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </PanelActions>
      </PanelHead>

      <div ref={wrapRef} className="h-[360px] min-h-[360px] md:h-[410px]">
        {topologyGraph.nodes.length === 0 ? (
          <div className="flex h-full items-center justify-center px-4 text-center font-mono text-muted-foreground text-xs">
            No transfers match this filter yet.
          </div>
        ) : (
          <svg
            aria-label="Live transfer flow graph"
            className="block h-full w-full"
            height={geometry.height}
            role="img"
            viewBox={`0 0 ${geometry.width} ${geometry.height}`}
            width={geometry.width}
          >
            <defs>
              <radialGradient id="live-transfer-node-glow" cx="45%" cy="35%" r="65%">
                <stop offset="0%" stopColor="white" stopOpacity="0.5" />
                <stop offset="100%" stopColor="white" stopOpacity="0" />
              </radialGradient>
              <marker
                id={markerId}
                markerHeight="5"
                markerUnits="strokeWidth"
                markerWidth="5"
                orient="auto"
                refX="4.4"
                refY="2.5"
                viewBox="0 0 5 5"
              >
                <path d="M 0 0 L 5 2.5 L 0 5 z" fill="var(--foreground)" opacity="0.78" />
              </marker>
            </defs>

            <g>
              {[...geometry.edges].reverse().map((edgeGeometry) => {
                const topologyEdge = edgeGeometry.edge;
                const edge = liveGraph.edgesById.get(topologyEdge.id) ?? topologyEdge;
                const isActive = activeEdgeIds.has(edge.id);

                return (
                  <g key={topologyEdge.id}>
                    <path
                      d={edgeGeometry.path}
                      fill="none"
                      markerEnd={`url(#${markerId})`}
                      opacity={isActive ? 0.82 : 0.46}
                      stroke={getMagnitudeColor(edge.amount)}
                      strokeLinecap="round"
                      strokeWidth={getEdgeWidth(edge, liveGraph.edges) + (isActive ? 1.25 : 0)}
                      style={{ transition: "opacity 180ms ease, stroke-width 220ms ease" }}
                    >
                      <title>{getEdgeTitle(edge, liveGraph.nodesById)}</title>
                    </path>
                    {topologyEdge.rank <= edgeLabelLimit && edge.amount > 0 && (
                      <text
                        fill="var(--foreground)"
                        fontFamily="var(--font-mono)"
                        fontSize={10}
                        fontWeight={600}
                        stroke="var(--background)"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        style={{ paintOrder: "stroke" }}
                        textAnchor="middle"
                        x={edgeGeometry.label.x}
                        y={edgeGeometry.label.y - 5}
                      >
                        {formatGraphUSD(edge.amount)}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>

            <g>
              {liveParticles.map((particle) => {
                const edgeGeometry = edgeGeometryById.get(particle.edgeId);

                if (edgeGeometry === undefined) {
                  return null;
                }

                const t = clamp(
                  (now - particle.startedAt) / Math.max(1, particle.durationMs),
                  0,
                  1,
                );
                const easedT = easeInOutQuad(t);
                const point = getPointOnQuadratic(
                  edgeGeometry.start,
                  edgeGeometry.control,
                  edgeGeometry.end,
                  easedT,
                );
                const opacity = t < 0.12 ? t / 0.12 : t > 0.88 ? (1 - t) / 0.12 : 1;

                return (
                  <g key={particle.id} pointerEvents="none">
                    <circle
                      cx={point.x}
                      cy={point.y}
                      fill={particle.color}
                      opacity={opacity * 0.18}
                      r={particle.radius * 3}
                    />
                    <circle
                      cx={point.x}
                      cy={point.y}
                      fill={particle.color}
                      opacity={opacity}
                      r={particle.radius}
                    />
                    <circle
                      cx={point.x}
                      cy={point.y}
                      fill="white"
                      opacity={opacity * 0.85}
                      r={particle.radius * 0.42}
                    />
                  </g>
                );
              })}
            </g>

            <g>
              {topologyGraph.nodes.map((node) => {
                const position = geometry.positions.get(node.id);
                const radius = geometry.radii.get(node.id) ?? 10;
                const liveNode = liveGraph.nodesById.get(node.id) ?? node;

                if (position === undefined) {
                  return null;
                }

                const isActive = activeNodeIds.has(node.id);
                const nodeColor = getNodeColor(node.category);

                return (
                  <g key={node.id} transform={`translate(${position.x}, ${position.y})`}>
                    <title>{getNodeTitle(liveNode)}</title>
                    <circle
                      fill={nodeColor}
                      opacity={isActive ? 0.22 : 0.1}
                      r={radius + (isActive ? 22 : 12)}
                    />
                    <circle
                      fill={node.isWallet ? "var(--surface-2)" : nodeColor}
                      opacity={node.isWallet ? 0.98 : 0.94}
                      r={radius}
                      stroke={nodeColor}
                      strokeOpacity={node.isWallet ? 0.7 : 0.95}
                      strokeWidth={node.isWallet ? 1.25 : 1}
                    />
                    <circle
                      cx={-radius * 0.18}
                      cy={-radius * 0.2}
                      fill="url(#live-transfer-node-glow)"
                      opacity={node.isWallet ? 0.2 : 0.75}
                      r={radius * 0.58}
                    />
                    <text
                      dominantBaseline="middle"
                      fill={node.isWallet ? "var(--muted-foreground)" : "oklch(0.13 0.012 254)"}
                      fontFamily="var(--font-mono)"
                      fontSize={Math.max(9, radius * 0.48)}
                      fontWeight={700}
                      textAnchor="middle"
                    >
                      {node.glyph}
                    </text>
                    <text
                      fill="var(--foreground)"
                      fontFamily="var(--font-mono)"
                      fontSize={10}
                      fontWeight={600}
                      stroke="var(--background)"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      style={{ paintOrder: "stroke" }}
                      textAnchor="middle"
                      x={0}
                      y={radius + 15}
                    >
                      {truncateLabel(node.name, node.isAggregate ? 22 : node.isWallet ? 14 : 18)}
                    </text>
                    {!node.isWallet && (
                      <text
                        fill="var(--muted-foreground)"
                        fontFamily="var(--font-mono)"
                        fontSize={9}
                        stroke="var(--background)"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        style={{ paintOrder: "stroke" }}
                        textAnchor="middle"
                        x={0}
                        y={radius + 27}
                      >
                        {CATEGORY[node.category].label}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-border border-t px-3.5 py-2.5 font-mono text-2xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Network size={13} /> {topologyGraph.nodes.length} nodes
        </span>
        <span className="inline-flex items-center gap-1.5">
          <GitBranch size={13} /> {topologyGraph.edges.length} routes
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CircleDollarSign size={13} /> {matchingCount} matching · {bufferedCount} buffered
        </span>
      </div>
    </Panel>
  );
}

function applyLiveMetricsToTopology(
  topologyGraph: TransferGraph,
  transfers: LiveTransferRow[],
): TransferGraph {
  const metricsGraph = buildTransferGraph(transfers, { limitTopology: false });
  const nodes = topologyGraph.nodes.map((node) => {
    const metrics = metricsGraph.nodesById.get(node.id);

    return {
      ...node,
      inflow: metrics?.inflow ?? 0,
      outflow: metrics?.outflow ?? 0,
      total: metrics?.total ?? 0,
      transferCount: metrics?.transferCount ?? 0,
    };
  });
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const edges = topologyGraph.edges.map((edge) => {
    const metrics = metricsGraph.edgesById.get(edge.id);

    return {
      ...edge,
      amount: metrics?.amount ?? 0,
      count: metrics?.count ?? 0,
      latestTransferId: metrics?.latestTransferId ?? edge.latestTransferId,
      latestTimestamp: metrics?.latestTimestamp ?? edge.latestTimestamp,
      magnitude: metrics?.magnitude ?? "small",
    };
  });
  const edgesById = new Map(edges.map((edge) => [edge.id, edge]));

  return {
    edges,
    edgesById,
    nodes,
    nodesById,
  };
}

function buildTransferGraph(
  transfers: LiveTransferRow[],
  { limitTopology = true }: TransferGraphBuildOptions = {},
): TransferGraph {
  const mutableNodesById = new Map<string, Omit<GraphNode, "rank">>();
  const mutableEdgesById = new Map<string, Omit<GraphEdge, "rank">>();

  for (const transfer of transfers) {
    const amount = getTransferAmount(transfer);

    if (amount <= 0) {
      continue;
    }

    const fromNode = upsertNode(mutableNodesById, transfer.from);
    const toNode = upsertNode(mutableNodesById, transfer.to);

    fromNode.outflow += amount;
    fromNode.total += amount;
    fromNode.transferCount += 1;
    toNode.inflow += amount;
    toNode.total += amount;
    toNode.transferCount += 1;

    if (fromNode.id === toNode.id) {
      continue;
    }

    const edgeId = `${fromNode.id}->${toNode.id}`;
    const currentEdge = mutableEdgesById.get(edgeId);

    if (currentEdge === undefined) {
      mutableEdgesById.set(edgeId, {
        amount,
        count: 1,
        fromId: fromNode.id,
        id: edgeId,
        latestTransferId: transfer.id,
        latestTimestamp: transfer.blockTimestamp,
        magnitude: getTransferMagnitude(transfer),
        toId: toNode.id,
      });
      continue;
    }

    currentEdge.amount += amount;
    currentEdge.count += 1;

    if (transfer.blockTimestamp > currentEdge.latestTimestamp) {
      currentEdge.latestTransferId = transfer.id;
      currentEdge.latestTimestamp = transfer.blockTimestamp;
    }

    currentEdge.magnitude = getAmountMagnitude(currentEdge.amount);
  }

  const allNodes = [...mutableNodesById.values()].sort(compareNodes);
  const allEdges = [...mutableEdgesById.values()].sort(compareEdges);

  if (!limitTopology) {
    return createTransferGraph(allNodes, allEdges);
  }

  const selectedNodeIds = new Set<string>();
  const selectedEdgeIds = new Set<string>();

  for (const edge of allEdges) {
    if (selectedEdgeIds.size >= maxGraphEdges) {
      break;
    }

    const missingNodeIds = [edge.fromId, edge.toId].filter((nodeId) => !selectedNodeIds.has(nodeId));

    if (selectedNodeIds.size + missingNodeIds.length > maxGraphNodes) {
      continue;
    }

    for (const nodeId of missingNodeIds) {
      selectedNodeIds.add(nodeId);
    }

    selectedEdgeIds.add(edge.id);
  }

  for (const node of allNodes) {
    if (selectedNodeIds.size >= maxGraphNodes) {
      break;
    }

    selectedNodeIds.add(node.id);
  }

  for (const edge of allEdges) {
    if (selectedEdgeIds.size >= maxGraphEdges) {
      break;
    }

    if (selectedNodeIds.has(edge.fromId) && selectedNodeIds.has(edge.toId)) {
      selectedEdgeIds.add(edge.id);
    }
  }

  const nodes = allNodes.filter((node) => selectedNodeIds.has(node.id));
  const edges = allEdges.filter(
    (edge) =>
      selectedEdgeIds.has(edge.id) &&
      selectedNodeIds.has(edge.fromId) &&
      selectedNodeIds.has(edge.toId),
  );

  return createTransferGraph(nodes, edges);
}

function createTransferGraph(
  nodesWithoutRank: Omit<GraphNode, "rank">[],
  edgesWithoutRank: Omit<GraphEdge, "rank">[],
): TransferGraph {
  const nodes = nodesWithoutRank.map((node, index) => ({ ...node, rank: index + 1 }));
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const edges = edgesWithoutRank
    .filter(
      (edge) =>
        edge.fromId !== edge.toId && nodesById.has(edge.fromId) && nodesById.has(edge.toId),
    )
    .map((edge, index) => ({ ...edge, rank: index + 1 }));
  const edgesById = new Map(edges.map((edge) => [edge.id, edge]));

  return {
    edges,
    edgesById,
    nodes,
    nodesById,
  };
}

function upsertNode(
  nodesById: Map<string, Omit<GraphNode, "rank">>,
  party: LiveTransferParty,
) {
  const id = getPartyNodeId(party);
  const currentNode = nodesById.get(id);

  if (currentNode !== undefined) {
    return currentNode;
  }

  const isAggregate = id === unidentifiedWalletNodeId;
  const category = isAggregate ? "wallet" : getPartyCategory(party);
  const node = {
    category,
    glyph: isAggregate ? "0x" : getEntityGlyph(party, category),
    id,
    inflow: 0,
    isAggregate,
    isIdentified: isAggregate ? false : party.isIdentified,
    isWallet: category === "wallet",
    name: isAggregate ? unidentifiedWalletName : party.displayName,
    outflow: 0,
    party: isAggregate ? unidentifiedWalletParty : party,
    total: 0,
    transferCount: 0,
  };

  nodesById.set(id, node);

  return node;
}

function createGraphGeometry(graph: TransferGraph, width: number, height: number): GraphGeometry {
  const safeWidth = Math.max(minGraphWidth, width);
  const safeHeight = Math.max(minGraphHeight, height);
  const radii = new Map(
    graph.nodes.map((node) => [node.id, getNodeRadius(node, graph.nodes)] as const),
  );
  const positions = layoutTransferGraph(graph.nodes, graph.edges, radii, safeWidth, safeHeight);
  const edgeIds = new Set(graph.edges.map((edge) => edge.id));
  const edges = graph.edges
    .map((edge) => {
      const from = positions.get(edge.fromId);
      const to = positions.get(edge.toId);
      const fromRadius = radii.get(edge.fromId) ?? 10;
      const toRadius = radii.get(edge.toId) ?? 10;

      if (from === undefined || to === undefined) {
        return null;
      }

      return createEdgeGeometry(edge, from, to, fromRadius, toRadius, edgeIds);
    })
    .filter((edgeGeometry): edgeGeometry is EdgeGeometry => edgeGeometry !== null);

  return {
    edges,
    height: safeHeight,
    positions,
    radii,
    width: safeWidth,
  };
}

function layoutTransferGraph(
  nodes: GraphNode[],
  edges: GraphEdge[],
  radii: Map<string, number>,
  width: number,
  height: number,
) {
  const positions = new Map<string, PositionedPoint>();

  if (nodes.length === 0) {
    return new Map<string, Point>();
  }

  if (nodes.length === 1) {
    const node = nodes[0];

    return node === undefined
      ? new Map<string, Point>()
      : new Map([[node.id, { x: width / 2, y: height / 2 }]]);
  }

  const categorySlots = getCategorySlots(nodes);
  const maxAbsNet = Math.max(1, ...nodes.map((node) => Math.abs(node.inflow - node.outflow)));

  for (const node of nodes) {
    const slot = categorySlots.get(node.id) ?? { count: 1, index: 0, lane: 0, laneCount: 1 };
    const radius = radii.get(node.id) ?? 10;
    const laneY = 54 + ((height - 108) * (slot.lane + 0.5)) / slot.laneCount;
    const laneSpread = Math.min(82, Math.max(26, height / Math.max(3, slot.laneCount) * 0.28));
    const relativeIndex =
      slot.count <= 1 ? 0 : (slot.index - (slot.count - 1) / 2) / Math.max(1, slot.count - 1);
    const balance = clamp((node.inflow - node.outflow) / maxAbsNet, -1, 1);
    const anchorX = clamp(
      width * 0.5 + balance * width * 0.33 + getCategoryXBias(node.category) * width * 0.14,
      Math.max(76, radius + 52),
      width - Math.max(76, radius + 52),
    );
    const anchorY = clamp(
      laneY + relativeIndex * laneSpread * 2 + (hashToUnit(node.id) - 0.5) * 18,
      radius + 44,
      height - radius - 44,
    );

    positions.set(node.id, {
      anchorX,
      anchorY,
      vx: 0,
      vy: 0,
      x: anchorX,
      y: anchorY,
    });
  }

  const k = Math.sqrt((width * height) / nodes.length) * 0.58;
  let temperature = Math.min(width, height) / 7;
  const maxEdgeAmount = Math.max(1, ...edges.map((edge) => edge.amount));

  for (let iteration = 0; iteration < 180; iteration += 1) {
    for (const point of positions.values()) {
      point.vx = 0;
      point.vy = 0;
    }

    for (let i = 0; i < nodes.length; i += 1) {
      const sourceNode = nodes[i];

      if (sourceNode === undefined) {
        continue;
      }

      const a = positions.get(sourceNode.id);

      if (a === undefined) {
        continue;
      }

      for (let j = i + 1; j < nodes.length; j += 1) {
        const targetNode = nodes[j];

        if (targetNode === undefined) {
          continue;
        }

        const b = positions.get(targetNode.id);

        if (b === undefined) {
          continue;
        }

        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const distance = Math.max(0.01, Math.sqrt(dx * dx + dy * dy));
        const force = (k * k) / distance;
        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;

        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }
    }

    for (const edge of edges) {
      const a = positions.get(edge.fromId);
      const b = positions.get(edge.toId);

      if (a === undefined || b === undefined) {
        continue;
      }

      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const distance = Math.max(0.01, Math.sqrt(dx * dx + dy * dy));
      const edgeWeight = Math.log1p(edge.amount) / Math.log1p(maxEdgeAmount);
      const fromRadius = radii.get(edge.fromId) ?? 10;
      const toRadius = radii.get(edge.toId) ?? 10;
      const targetDistance = fromRadius + toRadius + 120 + edgeWeight * 36;
      const stretch = distance - targetDistance;
      const force =
        stretch > 0 ? stretch * (0.025 + edgeWeight * 0.025) : stretch * 0.006;
      const fx = (dx / distance) * force;
      const fy = (dy / distance) * force;

      a.vx -= fx;
      a.vy -= fy;
      b.vx += fx;
      b.vy += fy;
    }

    for (const node of nodes) {
      const point = positions.get(node.id);

      if (point === undefined) {
        continue;
      }

      point.vx += (point.anchorX - point.x) * 0.55;
      point.vy += (point.anchorY - point.y) * 0.42;
    }

    for (const node of nodes) {
      const point = positions.get(node.id);
      const radius = radii.get(node.id) ?? 10;

      if (point === undefined) {
        continue;
      }

      const displacement = Math.max(0.01, Math.sqrt(point.vx * point.vx + point.vy * point.vy));
      const step = Math.min(displacement, temperature);

      point.x += (point.vx / displacement) * step;
      point.y += (point.vy / displacement) * step;
      point.x = clamp(point.x, Math.max(78, radius + 56), width - Math.max(78, radius + 56));
      point.y = clamp(point.y, radius + 42, height - radius - 48);
    }

    temperature *= 0.975;
  }

  return new Map(
    [...positions.entries()].map(([nodeId, point]) => [nodeId, { x: point.x, y: point.y }]),
  );
}

function createEdgeGeometry(
  edge: GraphEdge,
  from: Point,
  to: Point,
  fromRadius: number,
  toRadius: number,
  edgeIds: ReadonlySet<string>,
): EdgeGeometry {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
  const ux = dx / distance;
  const uy = dy / distance;
  const start = {
    x: from.x + ux * (fromRadius + 5),
    y: from.y + uy * (fromRadius + 5),
  };
  const end = {
    x: to.x - ux * (toRadius + 11),
    y: to.y - uy * (toRadius + 11),
  };
  const reverseEdgeId = `${edge.toId}->${edge.fromId}`;
  const hasReverseEdge = edgeIds.has(reverseEdgeId);
  const curveSign = hasReverseEdge ? (edge.id < reverseEdgeId ? 1 : -1) : hashToUnit(edge.id) > 0.5 ? 1 : -1;
  const curvature = hasReverseEdge ? 0.24 : 0.14;
  const edgeDx = end.x - start.x;
  const edgeDy = end.y - start.y;
  const edgeDistance = Math.max(1, Math.sqrt(edgeDx * edgeDx + edgeDy * edgeDy));
  const mid = {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };
  const control = {
    x: mid.x + (-edgeDy / edgeDistance) * edgeDistance * curvature * curveSign,
    y: mid.y + (edgeDx / edgeDistance) * edgeDistance * curvature * curveSign,
  };
  const label = getPointOnQuadratic(start, control, end, 0.52);

  return {
    control,
    edge,
    end,
    label,
    path: `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`,
    start,
  };
}

function useElementSize() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ height: 410, width: 900 });

  useEffect(() => {
    const node = ref.current;

    if (node === null) {
      return;
    }

    const updateSize = (width: number, height: number) => {
      setSize({
        height: Math.max(minGraphHeight, Math.round(height)),
        width: Math.max(minGraphWidth, Math.round(width)),
      });
    };
    const rect = node.getBoundingClientRect();

    updateSize(rect.width, rect.height);

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        updateSize(entry.contentRect.width, entry.contentRect.height);
      }
    });

    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  return [ref, size] as const;
}

function useAnimationFrameTime(enabled: boolean) {
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let frame = 0;
    const tick = () => {
      setNow(getHighResNow());
      frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);

    return () => window.cancelAnimationFrame(frame);
  }, [enabled]);

  return now === 0 ? getHighResNow() : now;
}

function getCategorySlots(nodes: GraphNode[]) {
  const categoryOrder: Category[] = ["mint", "cex", "dex", "lending", "bridge", "wallet"];
  const groups = new Map<Category, GraphNode[]>();

  for (const node of nodes) {
    const group = groups.get(node.category) ?? [];
    group.push(node);
    groups.set(node.category, group);
  }

  const lanes = categoryOrder.filter((category) => groups.has(category));
  const slots = new Map<string, { count: number; index: number; lane: number; laneCount: number }>();

  lanes.forEach((category, lane) => {
    const group = groups.get(category) ?? [];

    group.forEach((node, index) => {
      slots.set(node.id, {
        count: group.length,
        index,
        lane,
        laneCount: lanes.length,
      });
    });
  });

  return slots;
}

function getPartyNodeId(party: LiveTransferParty) {
  if (!party.isIdentified) {
    return unidentifiedWalletNodeId;
  }

  return party.entityId !== null ? `entity:${party.entityId}` : `address:${party.address.toLowerCase()}`;
}

function getTransferEdgeId(transfer: LiveTransferRow) {
  const fromId = getPartyNodeId(transfer.from);
  const toId = getPartyNodeId(transfer.to);

  if (fromId === toId) {
    return null;
  }

  return `${fromId}->${toId}`;
}

function getNodeRadius(node: GraphNode, nodes: GraphNode[]) {
  const positiveTotals = nodes.map((candidate) => candidate.total).filter((total) => total > 0);
  const minTotal = Math.min(...positiveTotals);
  const maxTotal = Math.max(...positiveTotals);
  const minRadius = node.isWallet ? 8 : 11;
  const maxRadius = node.isWallet ? 24 : 32;

  return scaleLog(node.total, minTotal, maxTotal, minRadius, maxRadius);
}

function getEdgeWidth(edge: GraphEdge, edges: GraphEdge[]) {
  const minAmount = Math.min(...edges.map((candidate) => candidate.amount));
  const maxAmount = Math.max(...edges.map((candidate) => candidate.amount));

  return scaleLog(edge.amount, minAmount, maxAmount, 1.4, 8.5);
}

function getMagnitudeColor(amount: number) {
  if (amount >= whaleThreshold) {
    return "var(--anomaly)";
  }

  if (amount >= largeTransferThreshold) {
    return "var(--accent)";
  }

  return "var(--inflow)";
}

function getParticleRadius(amount: number) {
  if (amount >= whaleThreshold) {
    return 5.4;
  }

  if (amount >= largeTransferThreshold) {
    return 3.8;
  }

  return 2.5;
}

function getAmountMagnitude(amount: number): "small" | "large" | "whale" {
  if (amount >= whaleThreshold) {
    return "whale";
  }

  if (amount >= largeTransferThreshold) {
    return "large";
  }

  return "small";
}

function getNodeColor(category: Category) {
  return `var(--cat-${category})`;
}

function getCategoryXBias(category: Category) {
  if (category === "mint" || category === "cex") {
    return -0.35;
  }

  if (category === "bridge") {
    return 0.28;
  }

  if (category === "lending") {
    return 0.08;
  }

  return 0;
}

function getNodeTitle(node: GraphNode) {
  return `${node.name}\nIn ${formatGraphUSD(node.inflow)}\nOut ${formatGraphUSD(node.outflow)}\n${node.transferCount} transfers`;
}

function getEdgeTitle(edge: GraphEdge, nodesById: Map<string, GraphNode>) {
  const fromName = nodesById.get(edge.fromId)?.name ?? "Unknown";
  const toName = nodesById.get(edge.toId)?.name ?? "Unknown";

  return `${fromName} -> ${toName}\n${formatGraphUSD(edge.amount)} across ${edge.count} transfers`;
}

function formatGraphUSD(value: number) {
  const amount = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (amount > 0 && amount < 1) {
    return `${sign}<$1`;
  }

  if (amount < 10) {
    return `${sign}$${trimTrailingZeros(amount.toFixed(2))}`;
  }

  if (amount < 1_000) {
    return `${sign}$${amount.toFixed(0)}`;
  }

  return `${sign}${fmtUSD(amount)}`;
}

function compareNodes(a: Omit<GraphNode, "rank">, b: Omit<GraphNode, "rank">) {
  return b.total - a.total || b.transferCount - a.transferCount || a.name.localeCompare(b.name);
}

function compareEdges(a: Omit<GraphEdge, "rank">, b: Omit<GraphEdge, "rank">) {
  return b.amount - a.amount || b.count - a.count || a.id.localeCompare(b.id);
}

function scaleLog(value: number, min: number, max: number, outputMin: number, outputMax: number) {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return (outputMin + outputMax) / 2;
  }

  const t = (Math.log1p(value) - Math.log1p(min)) / (Math.log1p(max) - Math.log1p(min));

  return outputMin + clamp(t, 0, 1) * (outputMax - outputMin);
}

function getPointOnQuadratic(a: Point, c: Point, b: Point, t: number): Point {
  const mt = 1 - t;

  return {
    x: mt * mt * a.x + 2 * mt * t * c.x + t * t * b.x,
    y: mt * mt * a.y + 2 * mt * t * c.y + t * t * b.y,
  };
}

function easeInOutQuad(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function truncateLabel(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

function trimTrailingZeros(value: string) {
  return value.replace(/\.?0+$/, "");
}

function hashToUnit(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) / 4294967295;
}

function getHighResNow() {
  if (typeof performance === "undefined") {
    return Date.now();
  }

  return performance.now();
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
