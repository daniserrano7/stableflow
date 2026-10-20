export type FlowNodeKind = "entity" | "network" | "wallet";

export type FlowEdgeKind = "bridge" | "transfer";

export interface FlowNode {
  /** Raw category key (dex, lending, bridge, cex, network, wallet, ...). Unknown keys still render. */
  category: string;
  glyph: string;
  href?: string;
  id: string;
  inflow: number;
  kind: FlowNodeKind;
  logoUrl?: string;
  /** Names of the nodes folded into this one when a lane overflows. */
  members?: string[];
  name: string;
  outflow: number;
  total: number;
  transferCount: number;
}

export interface FlowEdge {
  amount: number;
  count: number;
  fromId: string;
  id: string;
  kind: FlowEdgeKind;
  toId: string;
}

export interface FlowGraphData {
  edges: FlowEdge[];
  nodes: FlowNode[];
}

/** One live transfer travelling along an edge, started at a `performance.now()` timestamp. */
export interface FlowParticle {
  amount: number;
  durationMs: number;
  edgeId: string;
  id: string;
  startedAt: number;
}
