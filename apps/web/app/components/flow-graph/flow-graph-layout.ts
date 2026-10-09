import type { FlowEdge, FlowGraphData, FlowNode } from "./flow-graph.types";
import {
  type FlowLaneId,
  flowLanes,
  getFlowCategory,
  getFlowLaneIndex,
} from "./flow-graph-categories";

export type FlowPortSide = "left" | "right";

export interface FlowPoint {
  x: number;
  y: number;
}

export interface FlowRect {
  height: number;
  width: number;
  x: number;
  y: number;
}

export interface FlowNodeLayout extends FlowRect {
  column: number;
  compact: boolean;
  id: string;
  node: FlowNode;
}

/** A slot an edge reserves in a lane it passes through, so it runs between cards, not under. */
export interface FlowWaypointLayout extends FlowRect {
  id: string;
}

/** Port offsets are measured from the node's vertical centre, so they survive the node moving. */
export interface FlowEdgeLayout {
  edge: FlowEdge;
  id: string;
  sourceOffset: number;
  sourceSide: FlowPortSide;
  targetOffset: number;
  targetSide: FlowPortSide;
  /** Waypoint ids in travel order, one per lane the edge crosses. */
  waypointIds: string[];
  width: number;
}

export interface FlowLaneLayout {
  categories: string[];
  count: number;
  external: boolean;
  id: FlowLaneId;
  label: string;
  width: number;
  x: number;
}

export interface FlowLayout {
  edges: FlowEdgeLayout[];
  height: number;
  lanes: FlowLaneLayout[];
  nodes: FlowNodeLayout[];
  waypoints: FlowWaypointLayout[];
  width: number;
}

interface FlowCubic {
  control1: FlowPoint;
  control2: FlowPoint;
  end: FlowPoint;
  start: FlowPoint;
}

export interface FlowEdgeGeometry {
  end: FlowPoint;
  lengths: number[];
  path: string;
  segments: FlowCubic[];
  start: FlowPoint;
  totalLength: number;
}

export interface FoldedFlowGraph {
  /** Original edge id → id of the edge that carries it after folding. */
  edgeAliases: Map<string, string>;
  graph: FlowGraphData;
  /** Folded node id → id of the "N more" node that absorbed it. */
  nodeAliases: Map<string, string>;
}

interface Port {
  edge: FlowEdge;
  /** The next stop along the edge: a waypoint, or the node at the other end. */
  nextId: string;
  width: number;
}

interface MutableNode {
  /** Null for waypoints. */
  category: string | null;
  column: number;
  compact: boolean;
  height: number;
  id: string;
  node: FlowNode | null;
  y: number;
}

interface Link {
  fromId: string;
  toId: string;
  weight: number;
}

export const defaultMaxNodesPerLane = 14;

const paddingX = 16;
const headerHeight = 44;
const paddingBottom = 20;
const minPlotHeight = 360;
const plotSlack = 32;
const nodeGap = 10;
const compactNodeGap = 6;
const groupGap = 12;
const waypointGap = 6;
const portGap = 2;
const portPadding = 7;
const minRibbonWidth = 2;
const maxRibbonWidth = 18;
const decadesShown = 5;
const regularNodeHeight = 48;
const compactNodeHeight = 30;
const compactLaneThreshold = 7;
const minCardWidth = 108;
const maxCardWidth = 184;
const minLaneGap = 52;
const laneGapRatio = 0.5;
const relaxIterations = 24;
const lengthSamples = 12;

/**
 * Keeps each lane readable by folding its smallest nodes into one "N more" node. Their edges are
 * merged onto it, and `edgeAliases` maps the original edge ids so live particles still find a path.
 */
export function foldFlowGraph(
  graph: FlowGraphData,
  maxNodesPerLane = defaultMaxNodesPerLane,
): FoldedFlowGraph {
  const nodesByLane = new Map<number, FlowNode[]>();

  for (const node of graph.nodes) {
    const laneIndex = getFlowLaneIndex(node.category);
    const laneNodes = nodesByLane.get(laneIndex) ?? [];

    laneNodes.push(node);
    nodesByLane.set(laneIndex, laneNodes);
  }

  const nodeAliases = new Map<string, string>();
  const nodes: FlowNode[] = [];

  for (const [laneIndex, laneNodes] of nodesByLane) {
    if (laneNodes.length <= maxNodesPerLane) {
      nodes.push(...laneNodes);
      continue;
    }

    const sortedNodes = [...laneNodes].sort(compareNodesByTotal);
    const keptNodes = sortedNodes.slice(0, maxNodesPerLane - 1);
    const foldedNodes = sortedNodes.slice(maxNodesPerLane - 1);
    const firstFoldedNode = foldedNodes[0];

    if (firstFoldedNode === undefined) {
      nodes.push(...laneNodes);
      continue;
    }

    const aggregateId = `more:${flowLanes[laneIndex]?.id ?? laneIndex}`;

    for (const node of foldedNodes) {
      nodeAliases.set(node.id, aggregateId);
    }

    nodes.push(...keptNodes, {
      category: firstFoldedNode.category,
      glyph: `+${foldedNodes.length}`,
      id: aggregateId,
      inflow: sum(foldedNodes, (node) => node.inflow),
      kind: firstFoldedNode.kind,
      members: foldedNodes.map((node) => node.name),
      name: `${foldedNodes.length} more`,
      outflow: sum(foldedNodes, (node) => node.outflow),
      total: sum(foldedNodes, (node) => node.total),
      transferCount: sum(foldedNodes, (node) => node.transferCount),
    });
  }

  const edgeAliases = new Map<string, string>();
  const edgesById = new Map<string, FlowEdge>();

  for (const edge of graph.edges) {
    const fromId = nodeAliases.get(edge.fromId) ?? edge.fromId;
    const toId = nodeAliases.get(edge.toId) ?? edge.toId;

    if (fromId === toId) {
      continue;
    }

    const id = fromId === edge.fromId && toId === edge.toId ? edge.id : `${fromId}->${toId}`;
    const currentEdge = edgesById.get(id);

    edgeAliases.set(edge.id, id);
    edgesById.set(
      id,
      currentEdge === undefined
        ? { ...edge, fromId, id, toId }
        : {
            ...currentEdge,
            amount: currentEdge.amount + edge.amount,
            count: currentEdge.count + edge.count,
          },
    );
  }

  return { edgeAliases, graph: { edges: [...edgesById.values()], nodes }, nodeAliases };
}

/**
 * Lays the graph out in category lanes. Node order inside a lane comes from a Sankey-style
 * relaxation that pulls every node towards the weighted centre of its neighbours, then pushes
 * overlapping nodes apart; edges attach to stacked ports on the facing sides of their nodes.
 * An edge that skips a lane reserves a waypoint there, which takes part in the relaxation like a
 * thin node, so the ribbon threads between cards instead of disappearing behind one.
 */
export function layoutFlowGraph(graph: FlowGraphData, availableWidth: number): FlowLayout {
  const laneBuckets = flowLanes.map(() => [] as FlowNode[]);

  for (const node of graph.nodes) {
    laneBuckets[getFlowLaneIndex(node.category)]?.push(node);
  }

  const activeLanes = flowLanes
    .map((lane, index) => ({ lane, nodes: laneBuckets[index] ?? [] }))
    .filter(({ nodes }) => nodes.length > 0);
  const columnCount = activeLanes.length;
  const { columnWidths, columnXs, width } = getColumnMetrics(
    activeLanes.map(({ lane }) => lane.widthWeight),
    availableWidth,
  );
  const columnByNodeId = new Map<string, number>();

  activeLanes.forEach(({ nodes }, column) => {
    for (const node of nodes) {
      columnByNodeId.set(node.id, column);
    }
  });

  const edges = graph.edges.filter(
    (edge) =>
      edge.fromId !== edge.toId && columnByNodeId.has(edge.fromId) && columnByNodeId.has(edge.toId),
  );
  const getRibbonWidth = createRibbonScale(edges);
  const portsByKey = new Map<string, Port[]>();
  const routesByEdgeId = new Map<
    string,
    { source: FlowPortSide; target: FlowPortSide; waypointIds: string[] }
  >();
  const waypointNodes: MutableNode[] = [];
  const links: Link[] = [];

  for (const edge of edges) {
    const sourceColumn = columnByNodeId.get(edge.fromId) ?? 0;
    const targetColumn = columnByNodeId.get(edge.toId) ?? 0;
    const sides = getEdgeSides(sourceColumn, targetColumn, columnCount);
    const ribbonWidth = getRibbonWidth(edge.amount);
    const step = Math.sign(targetColumn - sourceColumn);
    const waypointIds: string[] = [];

    for (let column = sourceColumn + step; step !== 0 && column !== targetColumn; column += step) {
      const id = `${edge.id}@${column}`;

      waypointIds.push(id);
      waypointNodes.push({
        category: null,
        column,
        compact: false,
        height: ribbonWidth,
        id,
        node: null,
        y: 0,
      });
    }

    const stops = [edge.fromId, ...waypointIds, edge.toId];

    if (step !== 0) {
      for (let index = 1; index < stops.length; index += 1) {
        links.push({
          fromId: stops[index - 1] ?? edge.fromId,
          toId: stops[index] ?? edge.toId,
          weight: ribbonWidth,
        });
      }
    }

    routesByEdgeId.set(edge.id, { ...sides, waypointIds });
    pushPort(portsByKey, getPortKey(edge.fromId, sides.source), {
      edge,
      nextId: stops[1] ?? edge.toId,
      width: ribbonWidth,
    });
    pushPort(portsByKey, getPortKey(edge.toId, sides.target), {
      edge,
      nextId: stops.at(-2) ?? edge.fromId,
      width: ribbonWidth,
    });
  }

  const columns: MutableNode[][] = activeLanes.map(({ nodes }, column) => {
    const compact = nodes.length > compactLaneThreshold;
    const baseHeight = compact ? compactNodeHeight : regularNodeHeight;
    const cards = [...nodes].sort(compareNodesInitially).map((node) => {
      const stackHeight = Math.max(
        getPortStackHeight(portsByKey.get(getPortKey(node.id, "left"))),
        getPortStackHeight(portsByKey.get(getPortKey(node.id, "right"))),
      );

      return {
        category: node.category,
        column,
        compact,
        height: Math.max(baseHeight, Math.ceil(stackHeight + portPadding * 2)),
        id: node.id,
        node,
        y: 0,
      };
    });

    return [...cards, ...waypointNodes.filter((waypoint) => waypoint.column === column)];
  });
  const tallestColumn = Math.max(0, ...columns.map(getColumnExtent));
  const plotHeight = Math.max(minPlotHeight, tallestColumn + plotSlack);
  const top = headerHeight;
  const bottom = top + plotHeight;

  for (const column of columns) {
    let y = top + (plotHeight - getColumnExtent(column)) / 2;

    column.forEach((node, index) => {
      const previousNode = column[index - 1];

      y += previousNode === undefined ? 0 : getNodeGap(previousNode, node);
      node.y = y;
      y += node.height;
    });
  }

  relaxColumns(columns, links, top, bottom);

  const placed = columns.flat();
  const centerById = new Map(placed.map((node) => [node.id, getCenter(node)]));
  const offsetsByPortKey = new Map<string, Map<string, number>>();

  for (const [key, ports] of portsByKey) {
    const sortedPorts = [...ports].sort(
      (a, b) =>
        (centerById.get(a.nextId) ?? 0) - (centerById.get(b.nextId) ?? 0) ||
        a.edge.id.localeCompare(b.edge.id),
    );
    const offsets = new Map<string, number>();
    let cursor = -getPortStackHeight(sortedPorts) / 2;

    for (const port of sortedPorts) {
      offsets.set(port.edge.id, round(cursor + port.width / 2));
      cursor += port.width + portGap;
    }

    offsetsByPortKey.set(key, offsets);
  }

  const nodes: FlowNodeLayout[] = [];
  const waypoints: FlowWaypointLayout[] = [];

  for (const placedNode of placed) {
    const rect = {
      height: placedNode.height,
      width: columnWidths[placedNode.column] ?? minCardWidth,
      x: columnXs[placedNode.column] ?? paddingX,
      y: round(placedNode.y),
    };

    if (placedNode.node === null) {
      waypoints.push({ ...rect, id: placedNode.id });
    } else {
      nodes.push({
        ...rect,
        column: placedNode.column,
        compact: placedNode.compact,
        id: placedNode.id,
        node: placedNode.node,
      });
    }
  }

  const edgeLayouts = edges.map((edge) => {
    const route = routesByEdgeId.get(edge.id) ?? {
      source: "right",
      target: "left",
      waypointIds: [],
    };

    return {
      edge,
      id: edge.id,
      sourceOffset: offsetsByPortKey.get(getPortKey(edge.fromId, route.source))?.get(edge.id) ?? 0,
      sourceSide: route.source,
      targetOffset: offsetsByPortKey.get(getPortKey(edge.toId, route.target))?.get(edge.id) ?? 0,
      targetSide: route.target,
      waypointIds: route.waypointIds,
      width: getRibbonWidth(edge.amount),
    } satisfies FlowEdgeLayout;
  });
  const lanes = activeLanes.map(({ lane, nodes: laneNodes }, column) => {
    const categories = [...new Set(laneNodes.map((node) => getFlowCategory(node.category).key))]
      .map((key) => getFlowCategory(key))
      .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
    const onlyCategory = categories.length === 1 ? categories[0] : undefined;

    return {
      categories: categories.map((category) => category.key),
      count: sum(laneNodes, (node) => node.members?.length ?? 1),
      external: lane.external,
      id: lane.id,
      label: onlyCategory?.plural ?? lane.label,
      width: columnWidths[column] ?? minCardWidth,
      x: columnXs[column] ?? paddingX,
    };
  });

  return {
    edges: edgeLayouts,
    height: bottom + paddingBottom,
    lanes,
    nodes,
    waypoints,
    width,
  };
}

/**
 * Ribbons run between the facing sides of their nodes, so direction is carried by motion and
 * colour rather than by which side a ribbon leaves from. They cross skipped lanes straight through
 * their waypoints, and edges inside one lane loop out to the side, away from the neighbouring
 * lane where possible.
 */
export function getFlowEdgeGeometry(
  edge: Pick<FlowEdgeLayout, "sourceOffset" | "sourceSide" | "targetOffset" | "targetSide">,
  source: FlowRect,
  target: FlowRect,
  waypoints: FlowRect[] = [],
): FlowEdgeGeometry {
  const start = {
    x: round(edge.sourceSide === "right" ? source.x + source.width : source.x),
    y: round(source.y + source.height / 2 + edge.sourceOffset),
  };
  const end = {
    x: round(edge.targetSide === "right" ? target.x + target.width : target.x),
    y: round(target.y + target.height / 2 + edge.targetOffset),
  };
  const segments: FlowCubic[] = [];

  if (edge.sourceSide === edge.targetSide) {
    const direction = edge.sourceSide === "right" ? 1 : -1;
    const reach = clamp(Math.abs(end.y - start.y) * 0.5, 28, 84);

    segments.push({
      control1: { x: start.x + direction * reach, y: start.y },
      control2: { x: end.x + direction * reach, y: end.y },
      end,
      start,
    });
  } else {
    const direction = edge.sourceSide === "right" ? 1 : -1;
    let cursor = start;

    for (const waypoint of waypoints) {
      const y = waypoint.y + waypoint.height / 2;
      const entry = { x: direction > 0 ? waypoint.x : waypoint.x + waypoint.width, y };
      const exit = { x: direction > 0 ? waypoint.x + waypoint.width : waypoint.x, y };

      segments.push(getCurve(cursor, entry), getLine(entry, exit));
      cursor = exit;
    }

    segments.push(getCurve(cursor, end));
  }

  const lengths = segments.map(getCubicLength);
  const [firstSegment] = segments;
  const path = [
    `M ${round(start.x)} ${round(start.y)}`,
    ...segments.map(
      (segment) =>
        `C ${round(segment.control1.x)} ${round(segment.control1.y)} ${round(segment.control2.x)} ${round(segment.control2.y)} ${round(segment.end.x)} ${round(segment.end.y)}`,
    ),
  ].join(" ");

  return {
    end,
    lengths,
    path: firstSegment === undefined ? "" : path,
    segments,
    start,
    totalLength: sum(lengths, (length) => length),
  };
}

/** Point at `t` of the edge's length, so particles keep a steady pace across segments. */
export function getPointOnFlowEdge(geometry: FlowEdgeGeometry, t: number): FlowPoint {
  let distance = clamp(t, 0, 1) * geometry.totalLength;

  for (const [index, segment] of geometry.segments.entries()) {
    const length = geometry.lengths[index] ?? 0;

    if (distance <= length || index === geometry.segments.length - 1) {
      return getPointOnCubic(segment, length === 0 ? 0 : clamp(distance / length, 0, 1));
    }

    distance -= length;
  }

  return geometry.start;
}

function getCurve(start: FlowPoint, end: FlowPoint): FlowCubic {
  const reach = (end.x - start.x) * 0.5;

  return {
    control1: { x: start.x + reach, y: start.y },
    control2: { x: end.x - reach, y: end.y },
    end,
    start,
  };
}

function getLine(start: FlowPoint, end: FlowPoint): FlowCubic {
  return {
    control1: { x: lerp(start.x, end.x, 1 / 3), y: lerp(start.y, end.y, 1 / 3) },
    control2: { x: lerp(start.x, end.x, 2 / 3), y: lerp(start.y, end.y, 2 / 3) },
    end,
    start,
  };
}

function getPointOnCubic(segment: FlowCubic, t: number): FlowPoint {
  const { control1: b, control2: c, end: d, start: a } = segment;
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;

  return {
    x: mt2 * mt * a.x + 3 * mt2 * t * b.x + 3 * mt * t2 * c.x + t2 * t * d.x,
    y: mt2 * mt * a.y + 3 * mt2 * t * b.y + 3 * mt * t2 * c.y + t2 * t * d.y,
  };
}

function getCubicLength(segment: FlowCubic) {
  let length = 0;
  let previous = segment.start;

  for (let index = 1; index <= lengthSamples; index += 1) {
    const point = getPointOnCubic(segment, index / lengthSamples);

    length += Math.hypot(point.x - previous.x, point.y - previous.y);
    previous = point;
  }

  return length;
}

function relaxColumns(columns: MutableNode[][], links: Link[], top: number, bottom: number) {
  const nodeById = new Map(columns.flat().map((node) => [node.id, node]));
  const neighborsById = new Map<string, { id: string; weight: number }[]>();

  for (const link of links) {
    pushNeighbor(neighborsById, link.fromId, { id: link.toId, weight: link.weight });
    pushNeighbor(neighborsById, link.toId, { id: link.fromId, weight: link.weight });
  }

  // Repeated multiplication instead of `0.99 ** n`: identical on server and client, so the
  // server-rendered layout hydrates without float mismatches.
  let alpha = 1;

  for (let iteration = 0; iteration < relaxIterations; iteration += 1, alpha *= 0.99) {
    const sweep = iteration % 2 === 0 ? columns : [...columns].reverse();

    for (const column of sweep) {
      for (const node of column) {
        const neighbors = neighborsById.get(node.id);

        if (neighbors === undefined) {
          continue;
        }

        let weightedCenter = 0;
        let totalWeight = 0;

        for (const neighbor of neighbors) {
          const neighborNode = nodeById.get(neighbor.id);

          if (neighborNode !== undefined) {
            weightedCenter += getCenter(neighborNode) * neighbor.weight;
            totalWeight += neighbor.weight;
          }
        }

        if (totalWeight > 0) {
          node.y += (weightedCenter / totalWeight - getCenter(node)) * alpha;
        }
      }

      sortColumn(column);
      resolveCollisions(column, top, bottom);
      centerColumn(column, top, bottom);
    }
  }
}

/**
 * Keeps every lane balanced around the middle of the plot. Without it, lanes drift towards
 * whichever side their busiest neighbours pull them and leave an empty band behind.
 */
function centerColumn(column: MutableNode[], top: number, bottom: number) {
  const firstNode = column[0];
  const lastNode = column.at(-1);

  if (firstNode === undefined || lastNode === undefined) {
    return;
  }

  const shift = (top + bottom) / 2 - (firstNode.y + lastNode.y + lastNode.height) / 2;

  for (const node of column) {
    node.y += shift;
  }

  resolveCollisions(column, top, bottom);
}

/**
 * Card widths follow each lane's weight, and the space left over becomes the gaps the ribbons
 * cross. Below the minimum the canvas keeps its width and its container scrolls sideways.
 */
function getColumnMetrics(weights: number[], availableWidth: number) {
  const totalWeight = sum(weights, (weight) => weight);
  const gapCount = Math.max(0, weights.length - 1);
  const minimumWidth = Math.ceil(paddingX * 2 + totalWeight * minCardWidth + gapCount * minLaneGap);
  const width = Math.max(Math.round(availableWidth), minimumWidth);
  const innerWidth = width - paddingX * 2;
  let baseWidth = clamp(
    innerWidth / (totalWeight + gapCount * laneGapRatio),
    minCardWidth,
    maxCardWidth,
  );

  if (gapCount > 0 && (innerWidth - baseWidth * totalWeight) / gapCount < minLaneGap) {
    baseWidth = Math.max(minCardWidth, (innerWidth - gapCount * minLaneGap) / totalWeight);
  }

  const columnWidths = weights.map((weight) => Math.round(baseWidth * weight));
  const columnXs: number[] = [];

  if (gapCount === 0) {
    columnXs.push((width - (columnWidths[0] ?? 0)) / 2);
  } else {
    const laneGap = (innerWidth - sum(columnWidths, (columnWidth) => columnWidth)) / gapCount;
    let x = paddingX;

    for (const columnWidth of columnWidths) {
      columnXs.push(round(x));
      x += columnWidth + laneGap;
    }
  }

  return { columnWidths, columnXs, width };
}

/**
 * Mixed lanes keep each category together, with groups and members ordered by position.
 * Waypoints sort by their own position, so they settle between groups rather than inside one.
 */
function sortColumn(column: MutableNode[]) {
  const categoryCenters = new Map<string, { count: number; total: number }>();

  for (const node of column) {
    if (node.category === null) {
      continue;
    }

    const key = getFlowCategory(node.category).key;
    const current = categoryCenters.get(key) ?? { count: 0, total: 0 };

    current.count += 1;
    current.total += getCenter(node);
    categoryCenters.set(key, current);
  }

  const getSortCenter = (node: MutableNode) => {
    const group =
      node.category === null ? undefined : categoryCenters.get(getFlowCategory(node.category).key);

    return group === undefined ? getCenter(node) : group.total / group.count;
  };
  const getOrder = (node: MutableNode) =>
    node.category === null ? 0 : getFlowCategory(node.category).order;

  column.sort(
    (a, b) =>
      getSortCenter(a) - getSortCenter(b) ||
      getOrder(a) - getOrder(b) ||
      getCenter(a) - getCenter(b) ||
      a.id.localeCompare(b.id),
  );
}

function resolveCollisions(column: MutableNode[], top: number, bottom: number) {
  let floor = top;

  column.forEach((node, index) => {
    const previousNode = column[index - 1];
    const minimumY = previousNode === undefined ? floor : floor + getNodeGap(previousNode, node);

    node.y = Math.max(node.y, minimumY);
    floor = node.y + node.height;
  });

  let ceiling = bottom;

  for (let index = column.length - 1; index >= 0; index -= 1) {
    const node = column[index];
    const previousNode = column[index - 1];

    if (node === undefined) {
      continue;
    }

    node.y = Math.min(node.y, ceiling - node.height);
    ceiling = node.y - (previousNode === undefined ? 0 : getNodeGap(previousNode, node));
  }
}

function getEdgeSides(
  sourceColumn: number,
  targetColumn: number,
  columnCount: number,
): { source: FlowPortSide; target: FlowPortSide } {
  if (sourceColumn < targetColumn) {
    return { source: "right", target: "left" };
  }

  if (sourceColumn > targetColumn) {
    return { source: "left", target: "right" };
  }

  const side = sourceColumn === columnCount - 1 && columnCount > 1 ? "left" : "right";

  return { source: side, target: side };
}

/**
 * Log scale anchored to the biggest route: it gets the full width and routes `decadesShown`
 * orders of magnitude smaller bottom out at the thinnest. Volumes span from a few dollars to
 * billions, so linear widths would vanish, and stretching between the smallest and biggest route
 * would turn two near-equal routes into the thickest and thinnest ribbon.
 */
function createRibbonScale(edges: FlowEdge[]) {
  const maxAmount = Math.max(0, ...edges.map((edge) => edge.amount));

  if (maxAmount <= 0) {
    return () => minRibbonWidth;
  }

  const floor = Math.log10(maxAmount) - decadesShown;

  return (amount: number) => {
    if (amount <= 0) {
      return minRibbonWidth;
    }

    const t = (Math.log10(amount) - floor) / decadesShown;

    return round(minRibbonWidth + clamp(t, 0, 1) * (maxRibbonWidth - minRibbonWidth));
  };
}

function getColumnExtent(column: MutableNode[]) {
  return column.reduce((extent, node, index) => {
    const previousNode = column[index - 1];

    return extent + node.height + (previousNode === undefined ? 0 : getNodeGap(previousNode, node));
  }, 0);
}

function getNodeGap(previousNode: MutableNode, node: MutableNode) {
  if (previousNode.category === null || node.category === null) {
    return waypointGap;
  }

  const gap = node.compact ? compactNodeGap : nodeGap;
  const isNewGroup =
    getFlowCategory(previousNode.category).key !== getFlowCategory(node.category).key;

  return isNewGroup ? gap + groupGap : gap;
}

function getPortStackHeight(ports: Port[] | undefined) {
  if (ports === undefined || ports.length === 0) {
    return 0;
  }

  return sum(ports, (port) => port.width) + portGap * (ports.length - 1);
}

function getPortKey(nodeId: string, side: FlowPortSide) {
  return `${nodeId}|${side}`;
}

function pushPort(portsByKey: Map<string, Port[]>, key: string, port: Port) {
  const ports = portsByKey.get(key) ?? [];

  ports.push(port);
  portsByKey.set(key, ports);
}

function pushNeighbor(
  neighborsById: Map<string, { id: string; weight: number }[]>,
  id: string,
  neighbor: { id: string; weight: number },
) {
  const neighbors = neighborsById.get(id) ?? [];

  neighbors.push(neighbor);
  neighborsById.set(id, neighbors);
}

function getCenter(node: MutableNode) {
  return node.y + node.height / 2;
}

function compareNodesInitially(a: FlowNode, b: FlowNode) {
  return (
    getFlowCategory(a.category).order - getFlowCategory(b.category).order ||
    compareNodesByTotal(a, b)
  );
}

function compareNodesByTotal(a: FlowNode, b: FlowNode) {
  return b.total - a.total || b.transferCount - a.transferCount || a.id.localeCompare(b.id);
}

function sum<T>(items: T[], getValue: (item: T) => number) {
  return items.reduce((total, item) => total + getValue(item), 0);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function lerp(from: number, to: number, t: number) {
  return from + (to - from) * t;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
