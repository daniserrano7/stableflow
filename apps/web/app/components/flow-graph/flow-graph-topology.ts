import { useState } from "react";
import type { FlowGraphData } from "./flow-graph.types";

/** Identifies a graph by its nodes and edges alone, ignoring the amounts on them. */
export function getFlowTopologySignature(graph: FlowGraphData) {
  const nodeIds = graph.nodes.map((node) => node.id).sort();
  const edgeIds = graph.edges.map((edge) => edge.id).sort();

  return `${nodeIds.join("|")}#${edgeIds.join("|")}`;
}

/**
 * Keeps returning the same graph until its set of nodes or edges changes. Pass the result as
 * FlowGraph's `topology` and the latest graph as `metrics`: refreshed amounts then update the
 * cards in place, and only a new or vanished route re-flows the layout.
 */
export function useStableFlowTopology(graph: FlowGraphData) {
  const signature = getFlowTopologySignature(graph);
  const [stable, setStable] = useState({ graph, signature });

  if (stable.signature !== signature) {
    setStable({ graph, signature });
  }

  return stable.signature === signature ? stable.graph : graph;
}
