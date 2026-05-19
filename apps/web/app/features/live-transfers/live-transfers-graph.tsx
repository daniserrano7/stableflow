import type { FlowGraphResponse, LiveTransferParty, LiveTransferRow } from "@stableflow/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { CircleDollarSign, GitBranch, Network } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Panel, PanelActions, PanelHead, PanelTitle } from "~/components";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { CATEGORY, type Category, CHAIN, type Chain } from "~/styles/tokens";
import { fmtUSD } from "~/utils/format";
import {
  isLiveTransferGraphWindow,
  type LiveTransferGraphWindow,
  liveTransferGraphWindowOptions,
  normalizeLiveTransferGraphWindow,
} from "./live-transfer-graph.params";
import {
  fetchLiveTransferGraph,
  getMatchingInitialLiveTransferGraph,
  liveTransferGraphQueryKey,
  liveTransferGraphRefreshIntervalMs,
} from "./live-transfer-graph.query";
import {
  getEntityGlyph,
  getPartyCategory,
  getTransferAmount,
  getTransferMagnitude,
  largeTransferThreshold,
  whaleThreshold,
} from "./live-transfers.utils";

const maxGraphNodes = 24;
const maxGraphEdges = 30;
const maxParticles = 80;
const minGraphWidth = 320;
const minGraphHeight = 460;
const graphBottomInset = 44;
const graphMinimumRowGap = 10;
const graphTopInset = 32;
const graphVerticalInset = graphTopInset + graphBottomInset;
const unidentifiedWalletNodeId = "wallet:unidentified";
const unidentifiedWalletName = "Unidentified wallets";

type GraphNodeCategory = Category | "network";

interface LiveTransfersGraphProps {
  bufferedCount: number;
  freshTransferIds: ReadonlySet<string>;
  initialGraph: FlowGraphResponse;
  transfers: LiveTransferRow[];
}

interface GraphNode {
  category: GraphNodeCategory;
  ecosystem: string | null;
  glyph: string;
  id: string;
  inflow: number;
  isAggregate: boolean;
  isIdentified: boolean;
  isNetwork: boolean;
  isWallet: boolean;
  name: string;
  outflow: number;
  rank: number;
  total: number;
  transferCount: number;
}

interface GraphEdge {
  amount: number;
  count: number;
  fromId: string;
  id: string;
  kind: "bridge" | "transfer";
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

interface EdgeGeometry {
  control: Point;
  edge: GraphEdge;
  end: Point;
  label: Point;
  path: string;
  start: Point;
}

interface Rect {
  height: number;
  width: number;
  x: number;
  y: number;
}

interface EdgeLabelGeometry {
  edgeId: string;
  height: number;
  text: string;
  width: number;
  x: number;
  y: number;
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
  graph: TransferGraph;
  nodeSignature: string;
  windowMinutes: LiveTransferGraphWindow;
}

export function LiveTransfersGraph({
  bufferedCount,
  freshTransferIds,
  initialGraph,
  transfers,
}: LiveTransfersGraphProps) {
  const rawMarkerId = useId();
  const markerId = useMemo(
    () => `live-transfer-arrow-${rawMarkerId.replace(/:/g, "")}`,
    [rawMarkerId],
  );
  const [windowMinutes, setWindowMinutes] = useState<LiveTransferGraphWindow>(() =>
    normalizeLiveTransferGraphWindow(initialGraph.meta.window.minutes.toString()),
  );
  const initialData = getMatchingInitialLiveTransferGraph(initialGraph, { windowMinutes });
  const graphQuery = useQuery({
    initialData,
    initialDataUpdatedAt:
      initialData === undefined ? undefined : Date.parse(initialData.meta.generatedAt),
    placeholderData: keepPreviousData,
    queryFn: ({ signal }) => fetchLiveTransferGraph({ signal, windowMinutes }),
    queryKey: liveTransferGraphQueryKey({ windowMinutes }),
    refetchInterval: liveTransferGraphRefreshIntervalMs,
    retry: 2,
    staleTime: 10_000,
  });
  const graphResponse = graphQuery.data ?? initialGraph;
  const responseGraph = useMemo(
    () => buildTransferGraphFromResponse(graphResponse),
    [graphResponse],
  );
  const responseMatchesWindow =
    normalizeLiveTransferGraphWindow(graphResponse.meta.window.minutes.toString()) ===
    windowMinutes;
  const fallbackLiveGraph = useMemo(() => buildTransferGraph(transfers), [transfers]);
  const candidateGraph =
    responseMatchesWindow && responseGraph.nodes.length > 0 ? responseGraph : fallbackLiveGraph;
  const candidateNodeSignature = useMemo(() => getNodeSignature(candidateGraph), [candidateGraph]);
  const [topologyState, setTopologyState] = useState<TopologyState | null>(null);
  const topologyGraph =
    topologyState !== null &&
    (topologyState.windowMinutes === windowMinutes || !responseMatchesWindow)
      ? topologyState.graph
      : candidateGraph;
  const metricsGraph = responseMatchesWindow ? candidateGraph : topologyGraph;
  const liveGraph = useMemo(
    () => applyGraphMetricsToTopology(topologyGraph, metricsGraph),
    [metricsGraph, topologyGraph],
  );
  const visibleEdgeIds = useMemo(
    () => new Set(topologyGraph.edges.map((edge) => edge.id)),
    [topologyGraph.edges],
  );
  const graphCanvasHeight = useMemo(
    () => getGraphCanvasHeight(topologyGraph.nodes),
    [topologyGraph.nodes],
  );
  const [wrapRef, size] = useElementSize(graphCanvasHeight);
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
    if (!responseMatchesWindow && topologyState !== null) {
      return;
    }

    const shouldRebuildTopology =
      topologyState === null ||
      topologyState.windowMinutes !== windowMinutes ||
      hasNewGraphNodes(candidateGraph, topologyState.graph);

    if (!shouldRebuildTopology) {
      return;
    }

    setTopologyState({
      graph: candidateGraph,
      nodeSignature: candidateNodeSignature,
      windowMinutes,
    });
    setParticles([]);
    seenFreshTransferIdsRef.current.clear();
  }, [candidateGraph, candidateNodeSignature, responseMatchesWindow, topologyState, windowMinutes]);

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
      if (!freshTransferIds.has(transfer.id) || seenFreshTransferIdsRef.current.has(transfer.id)) {
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
      setParticles((currentParticles) =>
        [
          ...currentParticles.filter((particle) => now - particle.startedAt < particle.durationMs),
          ...nextParticles,
        ].slice(-maxParticles),
      );
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
  const liveParticles = particles.filter(
    (particle) => now - particle.startedAt < particle.durationMs,
  );
  const activeEdgeIds = new Set(liveParticles.map((particle) => particle.edgeId));
  const activeNodeIds = new Set<string>();

  for (const particle of liveParticles) {
    const edge = topologyGraph.edgesById.get(particle.edgeId);

    if (edge !== undefined) {
      activeNodeIds.add(edge.fromId);
      activeNodeIds.add(edge.toId);
    }
  }

  const edgeLabelLimit = size.width < 520 ? 3 : 6;
  const edgeLabels = useMemo(
    () => createEdgeLabels(geometry, liveGraph, edgeLabelLimit),
    [edgeLabelLimit, geometry, liveGraph],
  );

  return (
    <Panel className="min-h-[580px]">
      <PanelHead className="flex-wrap gap-2">
        <PanelTitle live>Flow Graph</PanelTitle>
        <PanelActions>
          <ToggleGroup
            aria-label="Graph window"
            type="single"
            value={windowMinutes}
            onValueChange={(nextWindowMinutes) => {
              if (
                isLiveTransferGraphWindow(nextWindowMinutes) &&
                nextWindowMinutes !== windowMinutes
              ) {
                setWindowMinutes(nextWindowMinutes);
              }
            }}
          >
            {liveTransferGraphWindowOptions.map((option) => (
              <ToggleGroupItem key={option.value} value={option.value}>
                {option.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </PanelActions>
      </PanelHead>

      <div ref={wrapRef} className="min-h-[480px]" style={{ height: graphCanvasHeight }}>
        {topologyGraph.nodes.length === 0 ? (
          <div className="flex h-full items-center justify-center px-4 text-center font-mono text-muted-foreground text-xs">
            No graph data for this window yet.
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
                      opacity={isActive ? 0.84 : 0.34}
                      stroke={getEdgeColor(edge)}
                      strokeDasharray={edge.kind === "bridge" ? "5 5" : undefined}
                      strokeLinecap="round"
                      strokeWidth={getEdgeWidth(edge, liveGraph.edges) + (isActive ? 1.25 : 0)}
                      style={{ transition: "opacity 180ms ease, stroke-width 220ms ease" }}
                    >
                      <title>{getEdgeTitle(edge, liveGraph.nodesById)}</title>
                    </path>
                  </g>
                );
              })}
            </g>

            <g>
              {edgeLabels.map((label) => (
                <g key={label.edgeId} transform={`translate(${label.x}, ${label.y})`}>
                  <rect
                    fill="var(--background)"
                    height={label.height}
                    opacity={0.86}
                    rx={4}
                    stroke="var(--border)"
                    strokeOpacity={0.78}
                    width={label.width}
                    x={-label.width / 2}
                    y={-label.height / 2}
                  />
                  <text
                    dominantBaseline="middle"
                    fill="var(--foreground)"
                    fontFamily="var(--font-mono)"
                    fontSize={10}
                    fontWeight={700}
                    textAnchor="middle"
                    y={0.5}
                  >
                    {label.text}
                  </text>
                </g>
              ))}
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
                const nodeColor = getNodeColor(node);

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
                      {truncateLabel(
                        node.name,
                        node.isAggregate || node.isNetwork ? 22 : node.isWallet ? 14 : 18,
                      )}
                    </text>
                    {!node.isWallet && shouldRenderNodeCategoryLabel(node, topologyGraph.nodes) && (
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
                        {getNodeCategoryLabel(node)}
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
          <CircleDollarSign size={13} /> {formatWindowLabel(windowMinutes)} window · {bufferedCount}{" "}
          live buffered
        </span>
      </div>
    </Panel>
  );
}

function applyGraphMetricsToTopology(
  topologyGraph: TransferGraph,
  metricsGraph: TransferGraph,
): TransferGraph {
  const nodes = topologyGraph.nodes.map((node) => {
    const metrics = metricsGraph.nodesById.get(node.id);

    return {
      ...node,
      inflow: metrics?.inflow ?? node.inflow,
      outflow: metrics?.outflow ?? node.outflow,
      total: metrics?.total ?? node.total,
      transferCount: metrics?.transferCount ?? node.transferCount,
    };
  });
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const edges = topologyGraph.edges.map((edge) => {
    const metrics = metricsGraph.edgesById.get(edge.id);

    return {
      ...edge,
      amount: metrics?.amount ?? edge.amount,
      count: metrics?.count ?? edge.count,
      kind: metrics?.kind ?? edge.kind,
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

function buildTransferGraphFromResponse(response: FlowGraphResponse): TransferGraph {
  const nodes = response.data.nodes.map((node) => {
    const category = getGraphNodeCategory(node.category, node.kind);
    const isWallet = node.kind === "wallet" || category === "wallet";
    const isNetwork = node.kind === "network";

    return {
      category,
      ecosystem: node.ecosystem,
      glyph: getGraphNodeGlyph(node.name, category, isNetwork),
      id: node.id,
      inflow: getGraphAmount(node.inflow),
      isAggregate: node.kind === "wallet",
      isIdentified: node.kind !== "wallet",
      isNetwork,
      isWallet,
      name: node.name,
      outflow: getGraphAmount(node.outflow),
      total: getGraphAmount(node.total),
      transferCount: node.transferCount,
    };
  });
  const edges = response.data.edges.map((edge) => {
    const amount = getGraphAmount(edge.amount);

    return {
      amount,
      count: edge.count,
      fromId: edge.fromId,
      id: edge.id,
      kind: edge.kind,
      latestTransferId: edge.id,
      latestTimestamp: response.meta.window.bucketEnd,
      magnitude: getAmountMagnitude(amount),
      toId: edge.toId,
    };
  });

  return createTransferGraph(nodes, edges);
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
        kind: "transfer",
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

    const missingNodeIds = [edge.fromId, edge.toId].filter(
      (nodeId) => !selectedNodeIds.has(nodeId),
    );

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
      (edge) => edge.fromId !== edge.toId && nodesById.has(edge.fromId) && nodesById.has(edge.toId),
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

function upsertNode(nodesById: Map<string, Omit<GraphNode, "rank">>, party: LiveTransferParty) {
  const id = getPartyNodeId(party);
  const currentNode = nodesById.get(id);

  if (currentNode !== undefined) {
    return currentNode;
  }

  const isAggregate = id === unidentifiedWalletNodeId;
  const category = isAggregate ? "wallet" : getPartyCategory(party);
  const node = {
    category,
    ecosystem: null,
    glyph: isAggregate ? "0x" : getEntityGlyph(party, category),
    id,
    inflow: 0,
    isAggregate,
    isIdentified: isAggregate ? false : party.isIdentified,
    isNetwork: false,
    isWallet: category === "wallet",
    name: isAggregate ? unidentifiedWalletName : party.displayName,
    outflow: 0,
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

function createEdgeLabels(
  geometry: GraphGeometry,
  graph: TransferGraph,
  edgeLabelLimit: number,
): EdgeLabelGeometry[] {
  const reservedRects = createNodeReservedRects(geometry, graph.nodes);
  const labels: EdgeLabelGeometry[] = [];
  const candidates = geometry.edges
    .map((edgeGeometry) => ({
      edge: graph.edgesById.get(edgeGeometry.edge.id) ?? edgeGeometry.edge,
      edgeGeometry,
    }))
    .filter(({ edge, edgeGeometry }) => edgeGeometry.edge.rank <= edgeLabelLimit && edge.amount > 0)
    .sort((a, b) => a.edgeGeometry.edge.rank - b.edgeGeometry.edge.rank);

  for (const { edge, edgeGeometry } of candidates) {
    const text = formatGraphUSD(edge.amount);
    const width = Math.max(44, text.length * 6.4 + 14);
    const height = 18;
    const normal = getEdgeNormal(edgeGeometry);
    const base = {
      x: edgeGeometry.label.x,
      y: edgeGeometry.label.y - 6,
    };
    const offsetCandidates = [0, 18, -18, 34, -34, 52, -52];
    let placedLabel: EdgeLabelGeometry | null = null;

    for (const offset of offsetCandidates) {
      const x = clamp(base.x + normal.x * offset, width / 2 + 8, geometry.width - width / 2 - 8);
      const y = clamp(base.y + normal.y * offset, height / 2 + 8, geometry.height - height / 2 - 8);
      const rect = {
        height,
        width,
        x: x - width / 2,
        y: y - height / 2,
      };

      if (reservedRects.some((reservedRect) => rectsOverlap(rect, reservedRect))) {
        continue;
      }

      placedLabel = {
        edgeId: edge.id,
        height,
        text,
        width,
        x,
        y,
      };
      reservedRects.push(expandRect(rect, 5));
      break;
    }

    if (placedLabel !== null) {
      labels.push(placedLabel);
    }
  }

  return labels;
}

function createNodeReservedRects(geometry: GraphGeometry, nodes: GraphNode[]) {
  const rects: Rect[] = [];

  for (const node of nodes) {
    const position = geometry.positions.get(node.id);
    const radius = geometry.radii.get(node.id) ?? 10;

    if (position === undefined) {
      continue;
    }

    rects.push(
      expandRect(
        {
          height: (radius + 14) * 2,
          width: (radius + 14) * 2,
          x: position.x - radius - 14,
          y: position.y - radius - 14,
        },
        4,
      ),
    );

    rects.push(
      expandRect(
        {
          height: node.isWallet || !shouldRenderNodeCategoryLabel(node, nodes) ? 22 : 34,
          width: Math.min(148, Math.max(72, node.name.length * 6.2)),
          x: position.x - Math.min(148, Math.max(72, node.name.length * 6.2)) / 2,
          y: position.y + radius + 6,
        },
        4,
      ),
    );
  }

  return rects;
}

function getEdgeNormal(edgeGeometry: EdgeGeometry): Point {
  const dx = edgeGeometry.end.x - edgeGeometry.start.x;
  const dy = edgeGeometry.end.y - edgeGeometry.start.y;
  const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));

  return {
    x: -dy / distance,
    y: dx / distance,
  };
}

function rectsOverlap(a: Rect, b: Rect) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function expandRect(rect: Rect, amount: number): Rect {
  return {
    height: rect.height + amount * 2,
    width: rect.width + amount * 2,
    x: rect.x - amount,
    y: rect.y - amount,
  };
}

function layoutTransferGraph(
  nodes: GraphNode[],
  edges: GraphEdge[],
  radii: Map<string, number>,
  width: number,
  height: number,
) {
  if (nodes.length === 0) {
    return new Map<string, Point>();
  }

  if (nodes.length === 1) {
    const node = nodes[0];

    return node === undefined
      ? new Map<string, Point>()
      : new Map([[node.id, { x: width / 2, y: height / 2 }]]);
  }

  const columns = new Map<number, GraphNode[]>();
  const columnsByNodeId = new Map<string, number>();
  const adjacency = new Map<string, { id: string; weight: number }[]>();

  for (const node of nodes) {
    const column = getLayoutColumn(node);
    const group = columns.get(column) ?? [];

    group.push(node);
    columns.set(column, group);
    columnsByNodeId.set(node.id, column);
  }

  for (const edge of edges) {
    const weight = Math.max(1, Math.log1p(edge.amount));
    const fromNeighbors = adjacency.get(edge.fromId) ?? [];
    const toNeighbors = adjacency.get(edge.toId) ?? [];

    fromNeighbors.push({ id: edge.toId, weight });
    toNeighbors.push({ id: edge.fromId, weight });
    adjacency.set(edge.fromId, fromNeighbors);
    adjacency.set(edge.toId, toNeighbors);
  }

  const columnIds = [...columns.keys()].sort((a, b) => a - b);
  const orderedColumns = new Map(
    columnIds.map((column) => [
      column,
      [...(columns.get(column) ?? [])].sort(compareNodesWithStableTie),
    ]),
  );
  let yByNodeId = getColumnYMap(orderedColumns, height, radii);

  for (let iteration = 0; iteration < 8; iteration += 1) {
    for (const column of columnIds) {
      const group = orderedColumns.get(column) ?? [];

      group.sort(
        (a, b) =>
          getNeighborBarycenter(a, column, adjacency, columnsByNodeId, yByNodeId) -
            getNeighborBarycenter(b, column, adjacency, columnsByNodeId, yByNodeId) ||
          compareNodesWithStableTie(a, b),
      );
    }

    yByNodeId = getColumnYMap(orderedColumns, height, radii);
  }

  const positions = new Map<string, Point>();
  const activeColumnCount = columnIds.length;

  for (const node of nodes) {
    const radius = radii.get(node.id) ?? 10;
    const column = columnsByNodeId.get(node.id) ?? 1;
    const x = getLayoutColumnX(column, activeColumnCount, width, radius);
    const y = clamp(
      yByNodeId.get(node.id) ?? height / 2,
      radius + graphTopInset,
      height - radius - graphBottomInset,
    );

    positions.set(node.id, { x, y });
  }

  return positions;
}

function getLayoutColumn(node: GraphNode) {
  if (node.isNetwork) {
    return 3;
  }

  if (node.category === "bridge") {
    return 2;
  }

  if (node.category === "dex" || node.category === "lending") {
    return 1;
  }

  return 0;
}

function getLayoutColumnX(
  column: number,
  activeColumnCount: number,
  width: number,
  radius: number,
) {
  const fallbackColumnX = activeColumnCount <= 1 ? 0.5 : 0.15 + column * 0.24;
  const columnXById = new Map([
    [0, 0.09],
    [1, 0.34],
    [2, 0.64],
    [3, 0.91],
  ]);
  const x = width * (columnXById.get(column) ?? fallbackColumnX);

  return clamp(x, Math.max(66, radius + 42), width - Math.max(66, radius + 42));
}

function getColumnYMap(
  columns: Map<number, GraphNode[]>,
  height: number,
  radii: Map<string, number>,
) {
  const yByNodeId = new Map<string, number>();
  const top = graphTopInset;
  const bottom = height - graphBottomInset;
  const availableHeight = Math.max(80, bottom - top);

  for (const group of columns.values()) {
    if (group.length === 1) {
      const node = group[0];

      if (node !== undefined) {
        yByNodeId.set(node.id, top + availableHeight / 2);
      }

      continue;
    }

    const rowHeights = group.map((node) =>
      getNodeVerticalFootprint(node, radii.get(node.id) ?? 10, group),
    );
    const rowHeightTotal = rowHeights.reduce((total, rowHeight) => total + rowHeight, 0);
    const gap = Math.max(
      graphMinimumRowGap,
      (availableHeight - rowHeightTotal) / (group.length + 1),
    );
    let cursor = top + gap;

    group.forEach((node, index) => {
      const rowHeight = rowHeights[index] ?? 64;

      yByNodeId.set(node.id, cursor + rowHeight / 2);
      cursor += rowHeight + gap;
    });
  }

  return yByNodeId;
}

function getNeighborBarycenter(
  node: GraphNode,
  column: number,
  adjacency: Map<string, { id: string; weight: number }[]>,
  columnsByNodeId: Map<string, number>,
  yByNodeId: Map<string, number>,
) {
  const neighbors = adjacency.get(node.id) ?? [];
  let total = 0;
  let weight = 0;

  for (const neighbor of neighbors) {
    if (columnsByNodeId.get(neighbor.id) === column) {
      continue;
    }

    const neighborY = yByNodeId.get(neighbor.id);

    if (neighborY === undefined) {
      continue;
    }

    total += neighborY * neighbor.weight;
    weight += neighbor.weight;
  }

  return weight === 0 ? (yByNodeId.get(node.id) ?? 0) : total / weight;
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
  const curveSign = hasReverseEdge ? (edge.id < reverseEdgeId ? 1 : -1) : start.y <= end.y ? 1 : -1;
  const curvature = hasReverseEdge ? 0.2 : 0.035;
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

function useElementSize(initialHeight: number) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({
    height: Math.max(minGraphHeight, Math.round(initialHeight)),
    width: 900,
  });

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

function getPartyNodeId(party: LiveTransferParty) {
  if (!party.isIdentified) {
    return unidentifiedWalletNodeId;
  }

  return party.entityId !== null
    ? `entity:${party.entityId}`
    : `address:${party.address.toLowerCase()}`;
}

function getTransferEdgeId(transfer: LiveTransferRow) {
  const fromId = getPartyNodeId(transfer.from);
  const toId = getPartyNodeId(transfer.to);

  if (fromId === toId) {
    return null;
  }

  return `${fromId}->${toId}`;
}

function getGraphNodeCategory(category: string, kind: string): GraphNodeCategory {
  if (kind === "network") {
    return "network";
  }

  if (category in CATEGORY) {
    return category as Category;
  }

  return "wallet";
}

function getGraphNodeGlyph(name: string, category: GraphNodeCategory, isNetwork: boolean) {
  if (isNetwork) {
    return getNameGlyph(name, "NW");
  }

  if (category === "network") {
    return "NW";
  }

  return getNameGlyph(name, category.slice(0, 2).toUpperCase());
}

function getNameGlyph(name: string, fallback: string) {
  const glyph = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.at(0)?.toUpperCase())
    .join("");

  return glyph || fallback;
}

function getGraphAmount(amount: { formatted: string }) {
  const value = Number.parseFloat(amount.formatted.replaceAll(",", ""));

  return Number.isFinite(value) ? value : 0;
}

function getNodeRadius(node: GraphNode, nodes: GraphNode[]) {
  const positiveTotals = nodes.map((candidate) => candidate.total).filter((total) => total > 0);
  const minTotal = Math.min(...positiveTotals);
  const maxTotal = Math.max(...positiveTotals);
  const minRadius = node.isWallet ? 8 : node.isNetwork ? 10 : 11;
  const maxRadius = node.isWallet ? 24 : node.isNetwork ? 28 : 32;

  return scaleLog(node.total, minTotal, maxTotal, minRadius, maxRadius);
}

function getEdgeWidth(edge: GraphEdge, edges: GraphEdge[]) {
  const minAmount = Math.min(...edges.map((candidate) => candidate.amount));
  const maxAmount = Math.max(...edges.map((candidate) => candidate.amount));

  return scaleLog(edge.amount, minAmount, maxAmount, 1.2, 6.8);
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

function getEdgeColor(edge: GraphEdge) {
  if (edge.kind === "bridge") {
    return "var(--cat-bridge)";
  }

  return getMagnitudeColor(edge.amount);
}

function getParticleRadius(amount: number) {
  return scaleLog(Math.max(1, amount), 1, 10_000_000, 2.2, 8.2);
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

function getNodeColor(node: GraphNode) {
  if (node.isNetwork) {
    return getNetworkColor(node.id);
  }

  return `var(--cat-${node.category})`;
}

function getNetworkColor(nodeId: string) {
  const networkId = nodeId.startsWith("network:") ? nodeId.slice("network:".length) : "";

  if (networkId in CHAIN) {
    return CHAIN[networkId as Chain].color;
  }

  return "var(--neutral-flow)";
}

function getNodeCategoryLabel(node: GraphNode) {
  if (node.isNetwork) {
    return node.ecosystem === null ? "Network" : `${formatCategoryLabel(node.ecosystem)} Network`;
  }

  return CATEGORY[node.category as Category].label;
}

function shouldRenderNodeCategoryLabel(node: GraphNode, nodes: GraphNode[]) {
  if (node.isNetwork) {
    return false;
  }

  const columnNodeCount = nodes.filter(
    (candidateNode) => getLayoutColumn(candidateNode) === getLayoutColumn(node),
  ).length;

  return columnNodeCount < 8 || node.category === "bridge";
}

function getGraphCanvasHeight(nodes: GraphNode[]) {
  if (nodes.length === 0) {
    return 480;
  }

  const columns = new Map<number, GraphNode[]>();
  const radii = new Map(nodes.map((node) => [node.id, getNodeRadius(node, nodes)] as const));

  for (const node of nodes) {
    const column = getLayoutColumn(node);
    const columnNodes = columns.get(column) ?? [];

    columnNodes.push(node);
    columns.set(column, columnNodes);
  }

  const requiredColumnHeights = [...columns.values()].map((columnNodes) => {
    const rowHeightTotal = columnNodes.reduce(
      (total, node) =>
        total + getNodeVerticalFootprint(node, radii.get(node.id) ?? 10, columnNodes),
      0,
    );

    return rowHeightTotal + (columnNodes.length + 1) * graphMinimumRowGap;
  });
  const requiredHeight =
    Math.max(...requiredColumnHeights, minGraphHeight - graphVerticalInset) + graphVerticalInset;

  return Math.min(1040, Math.max(480, Math.ceil(requiredHeight)));
}

function getNodeVerticalFootprint(node: GraphNode, radius: number, columnNodes: GraphNode[]) {
  const labelHeight = node.isWallet || !shouldRenderNodeCategoryLabel(node, columnNodes) ? 34 : 46;

  return radius * 2 + labelHeight;
}

function getNodeTitle(node: GraphNode) {
  const countLabel = node.isNetwork ? "bridge events" : "transfers";

  return `${node.name}\nIn ${formatGraphUSD(node.inflow)}\nOut ${formatGraphUSD(node.outflow)}\n${node.transferCount} ${countLabel}`;
}

function getEdgeTitle(edge: GraphEdge, nodesById: Map<string, GraphNode>) {
  const fromName = nodesById.get(edge.fromId)?.name ?? "Unknown";
  const toName = nodesById.get(edge.toId)?.name ?? "Unknown";
  const countLabel = edge.kind === "bridge" ? "bridge events" : "transfers";

  return `${fromName} -> ${toName}\n${formatGraphUSD(edge.amount)} across ${edge.count} ${countLabel}`;
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

function formatWindowLabel(windowMinutes: LiveTransferGraphWindow) {
  if (windowMinutes === "1440") {
    return "24h";
  }

  if (windowMinutes === "60") {
    return "1h";
  }

  return "5m";
}

function formatCategoryLabel(value: string) {
  if (value === "evm") {
    return "EVM";
  }

  if (value === "svm") {
    return "SVM";
  }

  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getNodeSignature(graph: TransferGraph) {
  return graph.nodes
    .map((node) => node.id)
    .sort()
    .join("|");
}

function hasNewGraphNodes(candidateGraph: TransferGraph, topologyGraph: TransferGraph) {
  for (const node of candidateGraph.nodes) {
    if (!topologyGraph.nodesById.has(node.id)) {
      return true;
    }
  }

  return false;
}

function compareNodes(a: Omit<GraphNode, "rank">, b: Omit<GraphNode, "rank">) {
  return b.total - a.total || b.transferCount - a.transferCount || a.name.localeCompare(b.name);
}

function compareNodesWithStableTie(a: GraphNode, b: GraphNode) {
  return compareNodes(a, b) || a.id.localeCompare(b.id);
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
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
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
