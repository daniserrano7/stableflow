import type {
  EntityCounterpartyFlow,
  EntityDetailAmount,
  EntityDetailSummary,
  EntityFlowSummary,
  LiveTransferParty,
  LiveTransferRow,
} from "@stableflow/shared";
import { Network } from "lucide-react";
import type * as React from "react";
import { useMemo } from "react";
import { Panel, PanelActions, PanelHead, PanelTitle } from "~/components";
import {
  type FlowEdge,
  FlowGraph,
  type FlowGraphData,
  FlowGraphFooter,
  type FlowLegendItem,
  type FlowNode,
  flowWidthLegendItem,
  getFlowCategoryLegend,
  useFlowParticles,
  useStableFlowTopology,
} from "~/components/flow-graph";
import { getVisualIdentity } from "~/config/visuals";
import { fmtUSD } from "~/utils/format";

const unidentifiedEntityId = "unidentified";
const unidentifiedWalletNodeId = "wallet:unidentified";
const unidentifiedWalletName = "Unidentified wallets";

// Ribbons on this page are coloured by direction, matching the inflow / outflow figures above.
const directionLegend: FlowLegendItem[] = [
  { color: "var(--inflow)", key: "inflow", label: "Inflow", mark: "line" },
  { color: "var(--outflow)", key: "outflow", label: "Outflow", mark: "line" },
];

/**
 * The entity and its top counterparties, laid out in the same category lanes as the overview
 * graph. Every counterparty gets a ribbon per direction it trades in, so a two-way relationship
 * reads as two lanes of traffic.
 */
export function EntityFlowGraph({
  actions,
  counterparties,
  entity,
  flow,
  freshTransferIds,
  recentTransfers,
}: {
  actions?: React.ReactNode;
  counterparties: EntityCounterpartyFlow[];
  entity: EntityDetailSummary;
  flow: EntityFlowSummary;
  freshTransferIds: ReadonlySet<string>;
  recentTransfers: LiveTransferRow[];
}) {
  const graph = useMemo(
    () => toEntityFlowGraph(entity, flow, counterparties),
    [counterparties, entity, flow],
  );
  const topology = useStableFlowTopology(graph);
  const edgeIds = useMemo(() => new Set(topology.edges.map((edge) => edge.id)), [topology.edges]);
  const particles = useFlowParticles({
    edgeIds,
    freshTransferIds,
    getEdgeId: getTransferEdgeId,
    transfers: recentTransfers,
  });
  const legendItems = useMemo(
    () => [...directionLegend, ...getFlowCategoryLegend(topology.nodes), flowWidthLegendItem],
    [topology.nodes],
  );
  const windowLabel = formatWindowMinutes(flow.window.minutes);

  return (
    <Panel className="flex min-h-[34rem] flex-col">
      <PanelHead className="flex-wrap gap-3">
        <PanelTitle>
          <Network size={14} />
          Entity Flow Graph
        </PanelTitle>
        <PanelActions className="flex-wrap">{actions}</PanelActions>
      </PanelHead>

      {/* The graph keeps its natural height and sits centred when the row beside it is taller. */}
      <FlowGraph
        ariaLabel={`${entity.entityName} USDC flows with its top counterparties over the last ${windowLabel}`}
        className="flex flex-1 items-center"
        edgeTone="direction"
        emptyMessage="No counterparty flow for this window yet."
        focusNodeId={getEntityNodeId(entity.entityId)}
        metrics={graph}
        particles={particles}
        topology={topology}
      />

      <FlowGraphFooter items={legendItems}>
        {counterparties.length} counterparties ·{" "}
        {fmtUSD(getAmount(flow.inflow) + getAmount(flow.outflow))} moved · {windowLabel} window
      </FlowGraphFooter>
    </Panel>
  );
}

function toEntityFlowGraph(
  entity: EntityDetailSummary,
  flow: EntityFlowSummary,
  counterparties: EntityCounterpartyFlow[],
): FlowGraphData {
  const entityNodeId = getEntityNodeId(entity.entityId);
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];

  for (const counterparty of counterparties) {
    const counterpartyNodeId = getEntityNodeId(counterparty.entityId);
    const inflow = getAmount(counterparty.inflow);
    const outflow = getAmount(counterparty.outflow);

    if (counterpartyNodeId === entityNodeId || inflow + outflow <= 0) {
      continue;
    }

    // Counterparty figures are from the entity's side; the card speaks from the counterparty's.
    nodes.push({
      ...getNodeIdentity(counterparty.entityId, counterparty.entityName, counterparty.category),
      href: `/entities/${encodeURIComponent(counterparty.entityId)}`,
      inflow: outflow,
      outflow: inflow,
      total: inflow + outflow,
      transferCount: counterparty.transferCount,
    });

    if (inflow > 0) {
      edges.push({
        amount: inflow,
        count: counterparty.inflowTransferCount,
        fromId: counterpartyNodeId,
        id: `${counterpartyNodeId}->${entityNodeId}`,
        kind: "transfer",
        toId: entityNodeId,
      });
    }

    if (outflow > 0) {
      edges.push({
        amount: outflow,
        count: counterparty.outflowTransferCount,
        fromId: entityNodeId,
        id: `${entityNodeId}->${counterpartyNodeId}`,
        kind: "transfer",
        toId: counterpartyNodeId,
      });
    }
  }

  // With no counterparty flow there is nothing to draw; the graph shows its empty state.
  if (edges.length === 0) {
    return { edges, nodes: [] };
  }

  const inflow = getAmount(flow.inflow);
  const outflow = getAmount(flow.outflow);

  nodes.unshift({
    ...getNodeIdentity(entity.entityId, entity.entityName, entity.category),
    inflow,
    outflow,
    total: inflow + outflow,
    transferCount: flow.transferCount,
  });

  return { edges, nodes };
}

function getNodeIdentity(
  entityId: string,
  entityName: string,
  category: string,
): Pick<FlowNode, "category" | "glyph" | "id" | "kind" | "logoUrl" | "name"> {
  if (entityId === unidentifiedEntityId) {
    return {
      category: "wallet",
      glyph: "0x",
      id: unidentifiedWalletNodeId,
      kind: "wallet",
      name: unidentifiedWalletName,
    };
  }

  return {
    category,
    glyph: getNameGlyph(entityName),
    id: getEntityNodeId(entityId),
    kind: "entity",
    logoUrl: getVisualIdentity("entity", entityId)?.imageUrl,
    name: entityName,
  };
}

/** Node ids match the overview graph, so a route has the same id on both pages. */
function getEntityNodeId(entityId: string) {
  return entityId === unidentifiedEntityId ? unidentifiedWalletNodeId : `entity:${entityId}`;
}

function getPartyNodeId(party: LiveTransferParty) {
  if (!party.isIdentified) {
    return unidentifiedWalletNodeId;
  }

  return party.entityId === null ? null : getEntityNodeId(party.entityId);
}

function getTransferEdgeId(transfer: LiveTransferRow) {
  const fromId = getPartyNodeId(transfer.from);
  const toId = getPartyNodeId(transfer.to);

  return fromId === null || toId === null || fromId === toId ? null : `${fromId}->${toId}`;
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

function getAmount(amount: Pick<EntityDetailAmount, "formatted">) {
  const value = Number(amount.formatted);

  return Number.isFinite(value) ? value : 0;
}

function formatWindowMinutes(minutes: number) {
  if (minutes === 1440) {
    return "24h";
  }

  return minutes === 60 ? "1h" : `${minutes}m`;
}
