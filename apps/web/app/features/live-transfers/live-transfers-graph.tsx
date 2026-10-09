import type {
  FlowGraphNode,
  FlowGraphResponse,
  LiveTransferParty,
  LiveTransferRow,
} from "@stableflow/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Panel, PanelActions, PanelHead, PanelTitle } from "~/components";
import {
  type FlowEdge,
  FlowGraph,
  type FlowGraphData,
  FlowGraphFooter,
  type FlowNode,
  flowWidthLegendItem,
  getFlowCategoryLegend,
  getFlowTopologySignature,
  useFlowParticles,
} from "~/components/flow-graph";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { getVisualIdentity } from "~/config/visuals";
import { cn } from "~/utils/cn";
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
import { getEntityGlyph, getTransferAmount } from "./live-transfers.utils";

const maxFallbackNodes = 24;
const maxFallbackEdges = 30;
const unidentifiedWalletNodeId = "wallet:unidentified";
const unidentifiedWalletName = "Unidentified wallets";

interface LiveTransfersGraphProps {
  bufferedCount: number;
  freshTransferIds: ReadonlySet<string>;
  initialGraph: FlowGraphResponse;
  transfers: LiveTransferRow[];
}

interface TopologyState {
  graph: FlowGraphData;
  signature: string;
  windowMinutes: LiveTransferGraphWindow;
}

export function LiveTransfersGraph({
  bufferedCount,
  freshTransferIds,
  initialGraph,
  transfers,
}: LiveTransfersGraphProps) {
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
  const responseGraph = useMemo(() => toFlowGraphData(graphResponse), [graphResponse]);
  const responseMatchesWindow =
    normalizeLiveTransferGraphWindow(graphResponse.meta.window.minutes.toString()) ===
    windowMinutes;
  const fallbackGraph = useMemo(() => buildFlowGraphFromTransfers(transfers), [transfers]);
  const candidateGraph =
    responseMatchesWindow && responseGraph.nodes.length > 0 ? responseGraph : fallbackGraph;
  const candidateSignature = useMemo(
    () => getFlowTopologySignature(candidateGraph),
    [candidateGraph],
  );
  const [topologyState, setTopologyState] = useState<TopologyState | null>(null);
  // The layout follows the set of nodes and edges, not their amounts: a 2s refresh that only
  // moves numbers keeps every card where it is, while a new route re-flows the graph.
  const topology =
    topologyState !== null &&
    (topologyState.windowMinutes === windowMinutes || !responseMatchesWindow)
      ? topologyState.graph
      : candidateGraph;
  const metrics = responseMatchesWindow ? candidateGraph : topology;
  const topologyEdgeIds = useMemo(
    () => new Set(topology.edges.map((edge) => edge.id)),
    [topology.edges],
  );
  const particles = useFlowParticles({
    edgeIds: topologyEdgeIds,
    freshTransferIds,
    getEdgeId: getTransferEdgeId,
    transfers,
  });
  const isSwitchingWindow = !responseMatchesWindow && graphQuery.isFetching;

  useEffect(() => {
    if (!responseMatchesWindow && topologyState !== null) {
      return;
    }

    if (
      topologyState !== null &&
      topologyState.windowMinutes === windowMinutes &&
      topologyState.signature === candidateSignature
    ) {
      return;
    }

    setTopologyState({ graph: candidateGraph, signature: candidateSignature, windowMinutes });
  }, [candidateGraph, candidateSignature, responseMatchesWindow, topologyState, windowMinutes]);

  const legendItems = useMemo(
    () => [...getFlowCategoryLegend(topology.nodes), flowWidthLegendItem],
    [topology.nodes],
  );

  return (
    <Panel className="flex flex-col">
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

      <FlowGraph
        ariaLabel={`USDC routes on Base over the last ${formatWindowLabel(windowMinutes)}`}
        className={cn(
          // Centred when the panel stretches to match the row, with the footer kept at the bottom.
          "flex flex-1 items-center transition-opacity duration-200",
          isSwitchingWindow && "opacity-60",
        )}
        emptyMessage="No graph data for this window yet."
        metrics={metrics}
        particles={particles}
        topology={topology}
      />

      <FlowGraphFooter items={legendItems}>
        {topology.nodes.length} nodes · {topology.edges.length} routes ·{" "}
        {formatWindowLabel(windowMinutes)} window · {bufferedCount} live
      </FlowGraphFooter>
    </Panel>
  );
}

function toFlowGraphData(response: FlowGraphResponse): FlowGraphData {
  return {
    edges: response.data.edges.map((edge) => ({
      amount: getGraphAmount(edge.amount),
      count: edge.count,
      fromId: edge.fromId,
      id: edge.id,
      kind: edge.kind,
      toId: edge.toId,
    })),
    nodes: response.data.nodes.map(toFlowNode),
  };
}

function toFlowNode(node: FlowGraphNode): FlowNode {
  const entityId = node.kind === "entity" ? stripPrefix(node.id, "entity:") : null;
  const networkId = node.kind === "network" ? stripPrefix(node.id, "network:") : null;
  const visual =
    entityId !== null
      ? getVisualIdentity("entity", entityId)
      : networkId !== null
        ? getVisualIdentity("network", networkId)
        : undefined;

  return {
    category: node.kind === "entity" ? node.category : node.kind,
    glyph: node.kind === "wallet" ? "0x" : getNameGlyph(node.name),
    href: entityId === null ? undefined : `/entities/${entityId}`,
    id: node.id,
    inflow: getGraphAmount(node.inflow),
    kind: node.kind,
    logoUrl: visual?.imageUrl,
    name: node.name,
    outflow: getGraphAmount(node.outflow),
    total: getGraphAmount(node.total),
    transferCount: node.transferCount,
  };
}

/** Graph from the buffered live transfers, for when the API has nothing for the window yet. */
function buildFlowGraphFromTransfers(transfers: LiveTransferRow[]): FlowGraphData {
  const nodesById = new Map<string, FlowNode>();
  const edgesById = new Map<string, FlowEdge>();

  for (const transfer of transfers) {
    const amount = getTransferAmount(transfer);

    if (amount <= 0) {
      continue;
    }

    const fromNode = upsertPartyNode(nodesById, transfer.from);
    const toNode = upsertPartyNode(nodesById, transfer.to);

    fromNode.outflow += amount;
    fromNode.total += amount;
    fromNode.transferCount += 1;
    toNode.inflow += amount;
    toNode.total += amount;
    toNode.transferCount += 1;

    if (fromNode.id === toNode.id) {
      continue;
    }

    const id = `${fromNode.id}->${toNode.id}`;
    const edge = edgesById.get(id);

    if (edge === undefined) {
      edgesById.set(id, {
        amount,
        count: 1,
        fromId: fromNode.id,
        id,
        kind: "transfer",
        toId: toNode.id,
      });
      continue;
    }

    edge.amount += amount;
    edge.count += 1;
  }

  const allNodes = [...nodesById.values()].sort(
    (a, b) => b.total - a.total || a.id.localeCompare(b.id),
  );
  const allEdges = [...edgesById.values()].sort(
    (a, b) => b.amount - a.amount || a.id.localeCompare(b.id),
  );
  const selectedNodeIds = new Set<string>();
  const selectedEdgeIds = new Set<string>();

  // Biggest routes first, as long as their endpoints fit; then fill up with the biggest nodes.
  for (const edge of allEdges) {
    if (selectedEdgeIds.size >= maxFallbackEdges) {
      break;
    }

    const missingNodeIds = [edge.fromId, edge.toId].filter((id) => !selectedNodeIds.has(id));

    if (selectedNodeIds.size + missingNodeIds.length > maxFallbackNodes) {
      continue;
    }

    for (const id of missingNodeIds) {
      selectedNodeIds.add(id);
    }

    selectedEdgeIds.add(edge.id);
  }

  for (const node of allNodes) {
    if (selectedNodeIds.size >= maxFallbackNodes) {
      break;
    }

    selectedNodeIds.add(node.id);
  }

  return {
    edges: allEdges.filter((edge) => selectedEdgeIds.has(edge.id)),
    nodes: allNodes.filter((node) => selectedNodeIds.has(node.id)),
  };
}

function upsertPartyNode(nodesById: Map<string, FlowNode>, party: LiveTransferParty) {
  const id = getPartyNodeId(party);
  const currentNode = nodesById.get(id);

  if (currentNode !== undefined) {
    return currentNode;
  }

  const isAggregate = id === unidentifiedWalletNodeId;
  const visual = party.entityId === null ? undefined : getVisualIdentity("entity", party.entityId);
  const node: FlowNode = {
    category: isAggregate ? "wallet" : party.category.toLowerCase(),
    glyph: isAggregate ? "0x" : getEntityGlyph(party),
    href: party.entityId === null || isAggregate ? undefined : `/entities/${party.entityId}`,
    id,
    inflow: 0,
    kind: isAggregate ? "wallet" : "entity",
    logoUrl: visual?.imageUrl,
    name: isAggregate ? unidentifiedWalletName : party.displayName,
    outflow: 0,
    total: 0,
    transferCount: 0,
  };

  nodesById.set(id, node);

  return node;
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

  return fromId === toId ? null : `${fromId}->${toId}`;
}

function getNameGlyph(name: string) {
  const glyph = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.at(0)?.toUpperCase())
    .join("");

  return glyph || "?";
}

function getGraphAmount(amount: { formatted: string }) {
  const value = Number.parseFloat(amount.formatted.replaceAll(",", ""));

  return Number.isFinite(value) ? value : 0;
}

function stripPrefix(value: string, prefix: string) {
  return value.startsWith(prefix) ? value.slice(prefix.length) : null;
}

function formatWindowLabel(windowMinutes: LiveTransferGraphWindow) {
  return (
    liveTransferGraphWindowOptions.find((option) => option.value === windowMinutes)?.label ?? "5m"
  );
}
