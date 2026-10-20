import { transferThresholds } from "@stableflow/shared";
import type * as React from "react";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { VisualMark } from "~/components/visual-mark";
import { getVisualIdentity } from "~/config/visuals";
import { cn } from "~/utils/cn";
import { fmtUSD } from "~/utils/format";
import type { FlowEdge, FlowGraphData, FlowNode, FlowParticle } from "./flow-graph.types";
import { getFlowCategory } from "./flow-graph-categories";
import {
  type FlowEdgeGeometry,
  type FlowEdgeLayout,
  type FlowLayout,
  type FlowNodeLayout,
  type FlowPoint,
  type FlowRect,
  type FoldedFlowGraph,
  foldFlowGraph,
  getFlowEdgeGeometry,
  getPointOnFlowEdge,
  layoutFlowGraph,
} from "./flow-graph-layout";

export interface FlowGraphProps {
  ariaLabel: string;
  className?: string;
  /**
   * `category` blends each ribbon from its source's colour to its target's. `direction` paints
   * ribbons into `focusNodeId` as inflow and ribbons out of it as outflow.
   */
  edgeTone?: "category" | "direction";
  emptyMessage?: string;
  /** The node the graph is about, such as the entity whose page this is; its card stays lifted. */
  focusNodeId?: string;
  /**
   * Latest figures for cards and tooltips. Only `topology` drives the layout, so a refresh that
   * changes numbers but not the set of nodes and edges never reshuffles the graph.
   */
  metrics?: FlowGraphData;
  particles?: FlowParticle[];
  topology: FlowGraphData;
}

type FlowNodeFigures = Pick<FlowNode, "inflow" | "outflow" | "total" | "transferCount">;

interface FlowFigures {
  edges: Map<string, { amount: number; count: number }>;
  nodes: Map<string, FlowNodeFigures>;
}

interface FrameEdge {
  sourceOffset: number;
  targetOffset: number;
  width: number;
}

interface Frame {
  edges: Map<string, FrameEdge>;
  height: number;
  nodes: Map<string, FlowRect>;
}

type FlowFocus = { id: string; type: "edge" | "node" };

interface RenderedEdge {
  geometry: FlowEdgeGeometry;
  layout: FlowEdgeLayout;
  sourceColor: string;
  targetColor: string;
  width: number;
}

const defaultCanvasWidth = 880;
const layoutTransitionMs = 650;
const hubCardHeight = 84;
const minCategoryLabelCardWidth = 150;
const streakPeriod = 36;
const tooltipFlipMarginX = 260;
const tooltipFlipMarginY = 170;
const baseChainVisual = getVisualIdentity("chain", 8453);

export function FlowGraph({
  ariaLabel,
  className,
  edgeTone = "category",
  emptyMessage = "No flows for this window yet.",
  focusNodeId,
  metrics,
  particles = [],
  topology,
}: FlowGraphProps) {
  const idPrefix = useId().replace(/[^\w-]/g, "");
  const [scrollRef, availableWidth] = useElementWidth(defaultCanvasWidth);
  const canvasRef = useRef<HTMLElement | null>(null);
  const folded = useMemo(() => foldFlowGraph(topology), [topology]);
  const layout = useMemo(
    () => layoutFlowGraph(folded.graph, availableWidth),
    [availableWidth, folded],
  );
  const frame = useFrameTransition(layout, folded);
  const figures = useMemo(() => getFlowFigures(folded, metrics), [folded, metrics]);
  const [focus, setFocus] = useState<FlowFocus | null>(null);
  const [pointer, setPointer] = useState<FlowPoint | null>(null);
  const nodesById = useMemo(
    () => new Map(layout.nodes.map((node) => [node.id, node])),
    [layout.nodes],
  );
  const waypointsById = useMemo(
    () => new Map(layout.waypoints.map((waypoint) => [waypoint.id, waypoint])),
    [layout.waypoints],
  );

  const renderedEdges: RenderedEdge[] = [];

  for (const edgeLayout of layout.edges) {
    const source = nodesById.get(edgeLayout.edge.fromId);
    const target = nodesById.get(edgeLayout.edge.toId);

    if (source === undefined || target === undefined) {
      continue;
    }

    const frameEdge = frame.edges.get(edgeLayout.id) ?? edgeLayout;
    const directionColor = getDirectionColor(edgeLayout.edge, edgeTone, focusNodeId);

    renderedEdges.push({
      geometry: getFlowEdgeGeometry(
        { ...edgeLayout, ...frameEdge },
        frame.nodes.get(source.id) ?? source,
        frame.nodes.get(target.id) ?? target,
        edgeLayout.waypointIds.flatMap((id) => frame.nodes.get(id) ?? waypointsById.get(id) ?? []),
      ),
      layout: edgeLayout,
      sourceColor: directionColor ?? getFlowCategory(source.node.category).color,
      targetColor: directionColor ?? getFlowCategory(target.node.category).color,
      width: frameEdge.width,
    });
  }

  const geometryById = new Map(renderedEdges.map((edge) => [edge.layout.id, edge.geometry]));
  const focusSet = getFocusSet(focus, layout);
  const activeNodeIds = getActiveNodeIds(particles, folded.edgeAliases, layout);
  const localLanes = layout.lanes.filter((lane) => !lane.external);
  const hasExternalLane = localLanes.length > 0 && localLanes.length < layout.lanes.length;
  const firstLocalLane = localLanes[0];
  const lastLocalLane = localLanes.at(-1);

  // The measured container stays mounted while empty, so the graph sizes itself once data lands.
  if (layout.nodes.length === 0) {
    return (
      <div ref={scrollRef} className={className}>
        <div className="flex min-h-[420px] w-full items-center justify-center px-4 text-center font-mono text-muted-foreground text-xs">
          {emptyMessage}
        </div>
      </div>
    );
  }

  const updatePointer = (event: React.PointerEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();

    if (rect !== undefined) {
      setPointer({ x: event.clientX - rect.left, y: event.clientY - rect.top });
    }
  };
  const clearFocus = () => setFocus(null);

  return (
    <div ref={scrollRef} className={cn("relative overflow-x-auto overflow-y-hidden", className)}>
      <figure
        ref={canvasRef}
        aria-label={ariaLabel}
        className="relative m-0 shrink-0 bg-[radial-gradient(circle,var(--grid-line)_1px,transparent_1.25px)] [background-size:18px_18px]"
        style={{ height: frame.height, width: layout.width }}
      >
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 block overflow-visible"
          height={frame.height}
          viewBox={`0 0 ${layout.width} ${frame.height}`}
          width={layout.width}
        >
          <defs>
            {renderedEdges.map(({ geometry, layout: edge, sourceColor, targetColor }) => (
              <linearGradient
                key={edge.id}
                gradientUnits="userSpaceOnUse"
                id={getGradientId(idPrefix, edge.id)}
                x1={geometry.start.x}
                x2={geometry.end.x}
                y1={geometry.start.y}
                y2={geometry.end.y}
              >
                <stop offset="0%" style={{ stopColor: sourceColor, stopOpacity: 0.5 }} />
                <stop offset="100%" style={{ stopColor: targetColor, stopOpacity: 1 }} />
              </linearGradient>
            ))}
          </defs>

          {hasExternalLane && firstLocalLane !== undefined && lastLocalLane !== undefined && (
            <rect
              height={frame.height - 12}
              rx={16}
              style={{
                fill: "color-mix(in oklch, var(--chain-base) 5%, transparent)",
                stroke: "color-mix(in oklch, var(--chain-base) 22%, transparent)",
              }}
              width={lastLocalLane.x + lastLocalLane.width - firstLocalLane.x + 24}
              x={firstLocalLane.x - 12}
              y={6}
            />
          )}

          <g>
            {renderedEdges.map(({ geometry, layout: edge, width }) => (
              <path
                key={edge.id}
                className="animate-fade-in"
                d={geometry.path}
                fill="none"
                stroke={`url(#${getGradientId(idPrefix, edge.id)})`}
                strokeOpacity={getEdgeOpacity(edge.id, focusSet, 0.4, 0.88, 0.06)}
                strokeWidth={width}
                style={{ transition: "stroke-opacity 200ms ease" }}
              />
            ))}
          </g>

          <g className="motion-reduce:hidden">
            {renderedEdges.map(({ geometry, layout: edge, width }) => {
              const durationSeconds = getStreakDurationSeconds(edge.edge.count);

              return (
                <path
                  key={edge.id}
                  className="animate-flow-dash"
                  d={geometry.path}
                  fill="none"
                  stroke={`url(#${getGradientId(idPrefix, edge.id)})`}
                  strokeDasharray={`10 ${streakPeriod - 10}`}
                  strokeLinecap="round"
                  strokeOpacity={getEdgeOpacity(edge.id, focusSet, 0.9, 1, 0)}
                  strokeWidth={Math.max(1.25, width * 0.42)}
                  style={{
                    animationDelay: `${-hashToUnit(edge.id) * durationSeconds}s`,
                    animationDuration: `${durationSeconds}s`,
                    transition: "stroke-opacity 200ms ease",
                  }}
                />
              );
            })}
          </g>

          <FlowParticles
            edgeAliases={folded.edgeAliases}
            geometryById={geometryById}
            particles={particles}
          />

          <g>
            {renderedEdges.map(({ geometry, layout: edge, width }) => (
              <path
                key={edge.id}
                d={geometry.path}
                fill="none"
                onPointerEnter={(event) => {
                  updatePointer(event);
                  setFocus({ id: edge.id, type: "edge" });
                }}
                onPointerLeave={clearFocus}
                onPointerMove={updatePointer}
                pointerEvents="stroke"
                stroke="transparent"
                strokeWidth={Math.max(14, width + 10)}
              />
            ))}
          </g>
        </svg>

        {hasExternalLane && firstLocalLane !== undefined && (
          <span
            aria-hidden
            className="pointer-events-none absolute inline-flex items-center gap-1.5 font-mono text-2xs text-muted-foreground uppercase tracking-[0.08em]"
            style={{ left: firstLocalLane.x, top: frame.height - 30 }}
          >
            {baseChainVisual !== undefined && (
              <VisualMark
                className="size-3.5 rounded-full"
                fallback={null}
                imageName={baseChainVisual.name}
                imageSize={14}
                imageUrl={baseChainVisual.imageUrl}
              />
            )}
            On Base
          </span>
        )}

        {layout.lanes.map((lane) => (
          <div
            key={lane.id}
            aria-hidden
            className="pointer-events-none absolute top-4 flex items-baseline gap-1.5 font-mono text-2xs text-muted-foreground uppercase tracking-[0.08em]"
            style={{ left: lane.x, width: lane.width }}
          >
            <span className="truncate">{lane.label}</span>
            <span className="text-muted-foreground/60 tabular-nums">{lane.count}</span>
          </div>
        ))}

        {layout.nodes.map((nodeLayout) => (
          <FlowNodeCard
            key={nodeLayout.id}
            figures={figures.nodes.get(nodeLayout.id)}
            isActive={activeNodeIds.has(nodeLayout.id)}
            isDimmed={focusSet !== null && !focusSet.nodeIds.has(nodeLayout.id)}
            isFocus={nodeLayout.id === focusNodeId}
            layout={nodeLayout}
            onBlur={clearFocus}
            onFocus={() => setFocus({ id: nodeLayout.id, type: "node" })}
            rect={frame.nodes.get(nodeLayout.id) ?? nodeLayout}
            showCategory={
              isMixedLane(layout, nodeLayout) && nodeLayout.width >= minCategoryLabelCardWidth
            }
          />
        ))}

        {focus !== null && (
          <FlowTooltip
            canvasHeight={frame.height}
            canvasWidth={layout.width}
            edgeTone={edgeTone}
            figures={figures}
            focus={focus}
            focusNodeId={focusNodeId}
            frame={frame}
            layout={layout}
            nodesById={nodesById}
            pointer={pointer}
          />
        )}
      </figure>

      <FlowRouteTable caption={ariaLabel} figures={figures} layout={layout} nodesById={nodesById} />
    </div>
  );
}

function FlowNodeCard({
  figures,
  isActive,
  isDimmed,
  isFocus,
  layout,
  onBlur,
  onFocus,
  rect,
  showCategory,
}: {
  figures: FlowNodeFigures | undefined;
  isActive: boolean;
  isDimmed: boolean;
  isFocus: boolean;
  layout: FlowNodeLayout;
  onBlur: () => void;
  onFocus: () => void;
  rect: FlowRect;
  showCategory: boolean;
}) {
  const { node } = layout;
  const variant = getCardVariant(layout);
  const category = getFlowCategory(node.category);
  const total = figures?.total ?? node.total;
  const isRound = node.kind !== "entity";
  const markSize = variant === "compact" ? 18 : variant === "hub" ? 26 : 22;
  const className = cn(
    "group/node absolute top-0 left-0 flex rounded-[10px] border text-left no-underline outline-none",
    variant === "hub"
      ? "flex-col items-start justify-center gap-2 px-3"
      : variant === "compact"
        ? "items-center gap-1.5 px-2"
        : "items-center gap-2 px-2.5",
    "border-[color-mix(in_oklch,var(--node-color)_34%,var(--border))] shadow-sm",
    "[background:linear-gradient(180deg,color-mix(in_oklch,var(--node-color)_14%,var(--card)),color-mix(in_oklch,var(--node-color)_5%,var(--card)))]",
    "animate-[sf-graph-node-in_420ms_var(--ease-out-quart)_both] motion-reduce:animate-none",
    "transition-[opacity,border-color,box-shadow] duration-200",
    "hover:border-[color-mix(in_oklch,var(--node-color)_75%,transparent)] focus-visible:ring-2 focus-visible:ring-ring",
    isFocus &&
      "border-[color-mix(in_oklch,var(--node-color)_70%,transparent)] shadow-[0_0_0_1px_color-mix(in_oklch,var(--node-color)_30%,transparent),0_16px_40px_-16px_var(--node-color)]",
    isActive &&
      "border-[color-mix(in_oklch,var(--node-color)_80%,transparent)] shadow-[0_0_0_3px_color-mix(in_oklch,var(--node-color)_20%,transparent),0_0_28px_-6px_var(--node-color)]",
    isDimmed && "opacity-30",
  );
  const style = {
    "--node-color": category.color,
    height: rect.height,
    transform: `translate(${rect.x}px, ${rect.y}px)`,
    width: rect.width,
  } as React.CSSProperties;
  const amount = (
    <span
      className={cn(
        "font-mono text-[11px] text-muted-foreground leading-4 tabular-nums",
        variant === "compact" ? "shrink-0" : "block truncate",
      )}
    >
      {formatFlowUSD(total)}
      {variant !== "compact" && showCategory && ` · ${category.label}`}
    </span>
  );
  const content = (
    <>
      <VisualMark
        className={cn(
          "font-mono font-semibold text-[9px] text-[oklch(0.13_0.012_254)]",
          isRound ? "rounded-full" : "rounded-[6px]",
        )}
        fallback={node.glyph}
        imageName={node.name}
        imageSize={markSize}
        imageUrl={node.logoUrl}
        style={{ background: category.color, height: markSize, width: markSize }}
      />
      <span className={cn("min-w-0", variant === "hub" ? "w-full" : "flex-1")}>
        <span
          className={cn(
            "block font-medium text-[12px] text-foreground leading-4",
            variant === "hub" ? "line-clamp-2" : "truncate",
          )}
        >
          {node.name}
        </span>
        {variant !== "compact" && amount}
      </span>
      {variant === "compact" && amount}
    </>
  );
  const handlers = {
    onBlur,
    onFocus,
    onPointerEnter: onFocus,
    onPointerLeave: onBlur,
  };

  if (node.href !== undefined) {
    return (
      <Link
        aria-label={`${node.name}, ${category.label}, ${formatFlowUSD(total)} volume`}
        className={cn(className, "cursor-pointer")}
        style={style}
        to={node.href}
        {...handlers}
      >
        {content}
      </Link>
    );
  }

  return (
    <div aria-hidden className={className} style={style} {...handlers}>
      {content}
    </div>
  );
}

function FlowTooltip({
  canvasHeight,
  canvasWidth,
  edgeTone,
  figures,
  focus,
  focusNodeId,
  frame,
  layout,
  nodesById,
  pointer,
}: {
  canvasHeight: number;
  canvasWidth: number;
  edgeTone: FlowGraphProps["edgeTone"];
  figures: FlowFigures;
  focus: FlowFocus;
  focusNodeId: string | undefined;
  frame: Frame;
  layout: FlowLayout;
  nodesById: Map<string, FlowNodeLayout>;
  pointer: FlowPoint | null;
}) {
  let anchor: FlowPoint;
  let flipX: boolean;
  let flipY: boolean;
  let content: React.ReactNode;

  if (focus.type === "node") {
    const nodeLayout = nodesById.get(focus.id);

    if (nodeLayout === undefined) {
      return null;
    }

    const rect = frame.nodes.get(nodeLayout.id) ?? nodeLayout;
    const node = { ...nodeLayout.node, ...figures.nodes.get(nodeLayout.id) };
    const category = getFlowCategory(node.category);
    const net = node.inflow - node.outflow;

    flipX = rect.x + rect.width + tooltipFlipMarginX > canvasWidth;
    flipY = rect.y + tooltipFlipMarginY > canvasHeight;
    anchor = {
      x: flipX ? rect.x - 10 : rect.x + rect.width + 10,
      y: flipY ? rect.y + rect.height : rect.y,
    };
    content = (
      <>
        <TooltipEyebrow color={category.color} label={category.label} />
        <div className="font-medium text-foreground text-sm">{node.name}</div>
        <div className="mt-1.5 flex items-baseline gap-1.5">
          <span className="font-semibold text-foreground text-md">{formatFlowUSD(node.total)}</span>
          <span className="text-muted-foreground">volume</span>
        </div>
        <dl className="mt-1.5 grid grid-cols-3 gap-2 font-mono text-[11px]">
          <TooltipFigure label="In" value={formatFlowUSD(node.inflow)} />
          <TooltipFigure label="Out" value={formatFlowUSD(node.outflow)} />
          <TooltipFigure label="Net" value={`${net > 0 ? "+" : ""}${formatFlowUSD(net)}`} />
        </dl>
        <div className="mt-1.5 font-mono text-[11px] text-muted-foreground">
          {formatCount(node.transferCount)}{" "}
          {node.kind === "network" ? "bridge events" : "transfers"}
        </div>
        {node.members !== undefined && (
          <div className="mt-1.5 line-clamp-3 text-[11px] text-muted-foreground">
            {node.members.join(", ")}
          </div>
        )}
        {node.href !== undefined && (
          <div className="mt-2 border-border border-t pt-1.5 text-[11px] text-muted-foreground">
            Open entity →
          </div>
        )}
      </>
    );
  } else {
    const edgeLayout = layout.edges.find((edge) => edge.id === focus.id);
    const source = edgeLayout && nodesById.get(edgeLayout.edge.fromId);
    const target = edgeLayout && nodesById.get(edgeLayout.edge.toId);

    if (edgeLayout === undefined || source === undefined || target === undefined || !pointer) {
      return null;
    }

    const edge = { ...edgeLayout.edge, ...figures.edges.get(edgeLayout.id) };
    const directionColor = getDirectionColor(edge, edgeTone, focusNodeId);

    flipX = pointer.x + tooltipFlipMarginX > canvasWidth;
    flipY = pointer.y + tooltipFlipMarginY > canvasHeight;
    anchor = { x: pointer.x + (flipX ? -14 : 14), y: pointer.y + (flipY ? -14 : 14) };
    content = (
      <>
        <TooltipEyebrow
          color={directionColor ?? getFlowCategory(target.node.category).color}
          label={
            directionColor !== null
              ? edge.toId === focusNodeId
                ? "Inflow"
                : "Outflow"
              : edge.kind === "bridge"
                ? "Bridge route"
                : "Transfer route"
          }
        />
        <div className="font-semibold text-foreground text-md">{formatFlowUSD(edge.amount)}</div>
        <div className="mt-1 text-foreground text-sm">
          {source.node.name} <span className="text-muted-foreground">→</span> {target.node.name}
        </div>
        <div className="mt-1.5 font-mono text-[11px] text-muted-foreground">
          {formatCount(edge.count)} {edge.kind === "bridge" ? "bridge events" : "transfers"}
        </div>
      </>
    );
  }

  return (
    <div
      className="pointer-events-none absolute z-tooltip w-max max-w-[232px] rounded-md border border-border bg-popover/95 px-3 py-2.5 shadow-lg [backdrop-filter:var(--blur-glass)]"
      role="tooltip"
      style={{
        left: anchor.x,
        top: anchor.y,
        transform: `translate(${flipX ? "-100%" : "0"}, ${flipY ? "-100%" : "0"})`,
      }}
    >
      {content}
    </div>
  );
}

function TooltipEyebrow({ color, label }: { color: string; label: string }) {
  return (
    <div className="mb-1 flex items-center gap-1.5 font-mono text-[10.5px] text-muted-foreground uppercase tracking-[0.08em]">
      <span aria-hidden className="h-0.5 w-3 rounded-full" style={{ background: color }} />
      {label}
    </div>
  );
}

function TooltipFigure({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="m-0 truncate text-foreground">{value}</dd>
    </div>
  );
}

function FlowRouteTable({
  caption,
  figures,
  layout,
  nodesById,
}: {
  caption: string;
  figures: FlowFigures;
  layout: FlowLayout;
  nodesById: Map<string, FlowNodeLayout>;
}) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">From</th>
          <th scope="col">To</th>
          <th scope="col">Volume</th>
          <th scope="col">Count</th>
        </tr>
      </thead>
      <tbody>
        {layout.edges.map(({ edge, id }) => {
          const liveEdge = figures.edges.get(id);

          return (
            <tr key={id}>
              <td>{nodesById.get(edge.fromId)?.node.name}</td>
              <td>{nodesById.get(edge.toId)?.node.name}</td>
              <td>{formatFlowUSD(liveEdge?.amount ?? edge.amount)}</td>
              <td>{formatCount(liveEdge?.count ?? edge.count)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function FlowParticles({
  edgeAliases,
  geometryById,
  particles,
}: {
  edgeAliases: Map<string, string>;
  geometryById: Map<string, FlowEdgeGeometry>;
  particles: FlowParticle[];
}) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const now = useAnimationFrameTime(particles.length > 0 && !prefersReducedMotion);

  if (prefersReducedMotion || particles.length === 0) {
    return null;
  }

  return (
    <g pointerEvents="none">
      {particles.map((particle) => {
        const geometry = geometryById.get(edgeAliases.get(particle.edgeId) ?? particle.edgeId);
        const progress = (now - particle.startedAt) / Math.max(1, particle.durationMs);

        if (geometry === undefined || progress < 0 || progress >= 1) {
          return null;
        }

        const color = getParticleColor(particle.amount);
        const radius = getParticleRadius(particle.amount);
        const fade = progress < 0.1 ? progress / 0.1 : progress > 0.9 ? (1 - progress) / 0.1 : 1;
        const head = getPointOnFlowEdge(geometry, easeInOutCubic(progress));

        return (
          <g key={particle.id} opacity={fade}>
            {[0.09, 0.06, 0.03].map((lag, index) => {
              const point = getPointOnFlowEdge(
                geometry,
                easeInOutCubic(Math.max(0, progress - lag)),
              );

              return (
                <circle
                  key={lag}
                  cx={point.x}
                  cy={point.y}
                  fill={color}
                  opacity={0.12 + index * 0.12}
                  r={radius * (0.5 + index * 0.15)}
                />
              );
            })}
            <circle cx={head.x} cy={head.y} fill={color} opacity={0.22} r={radius * 2.8} />
            <circle cx={head.x} cy={head.y} fill={color} r={radius} />
            <circle cx={head.x} cy={head.y} fill="white" opacity={0.85} r={radius * 0.42} />
          </g>
        );
      })}
    </g>
  );
}

/** Tweens nodes and ports to a new layout when the topology changes; resizes snap. */
function useFrameTransition(layout: FlowLayout, topologyKey: FoldedFlowGraph): Frame {
  const target = useMemo(() => toFrame(layout), [layout]);
  const [frame, setFrame] = useState(target);
  const frameRef = useRef(frame);
  const topologyKeyRef = useRef(topologyKey);

  useLayoutEffect(() => {
    const topologyChanged = topologyKeyRef.current !== topologyKey;

    topologyKeyRef.current = topologyKey;

    if (!topologyChanged || getPrefersReducedMotion()) {
      frameRef.current = target;
      setFrame(target);
      return;
    }

    const from = frameRef.current;
    const startedAt = performance.now();
    let animationFrame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - startedAt) / layoutTransitionMs));
      const nextFrame = t >= 1 ? target : interpolateFrame(from, target, easeInOutCubic(t));

      frameRef.current = nextFrame;
      setFrame(nextFrame);

      if (t < 1) {
        animationFrame = window.requestAnimationFrame(tick);
      }
    };

    animationFrame = window.requestAnimationFrame(tick);

    return () => window.cancelAnimationFrame(animationFrame);
  }, [target, topologyKey]);

  return frame;
}

/** Width of whichever element the returned callback ref is attached to, kept in sync on resize. */
function useElementWidth(initialWidth: number) {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(initialWidth);

  useLayoutEffect(() => {
    if (element === null) {
      return;
    }

    const update = () => setWidth(Math.round(element.clientWidth));
    const observer = new ResizeObserver(update);

    update();
    observer.observe(element);

    return () => observer.disconnect();
  }, [element]);

  return [setElement, width] as const;
}

function useAnimationFrameTime(enabled: boolean) {
  const [now, setNow] = useState(getHighResNow);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let animationFrame = 0;
    const tick = () => {
      setNow(getHighResNow());
      animationFrame = window.requestAnimationFrame(tick);
    };

    animationFrame = window.requestAnimationFrame(tick);

    return () => window.cancelAnimationFrame(animationFrame);
  }, [enabled]);

  return enabled ? now : getHighResNow();
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(query.matches);

    update();
    query.addEventListener("change", update);

    return () => query.removeEventListener("change", update);
  }, []);

  return prefersReducedMotion;
}

function toFrame(layout: FlowLayout): Frame {
  return {
    edges: new Map(
      layout.edges.map((edge) => [
        edge.id,
        { sourceOffset: edge.sourceOffset, targetOffset: edge.targetOffset, width: edge.width },
      ]),
    ),
    height: layout.height,
    // Waypoints tween with the cards, so ribbons that cross a lane glide along with them.
    nodes: new Map(
      [...layout.nodes, ...layout.waypoints].map((rect) => [
        rect.id,
        { height: rect.height, width: rect.width, x: rect.x, y: rect.y },
      ]),
    ),
  };
}

function interpolateFrame(from: Frame, to: Frame, t: number): Frame {
  const nodes = new Map<string, FlowRect>();
  const edges = new Map<string, FrameEdge>();

  for (const [id, rect] of to.nodes) {
    const previous = from.nodes.get(id);

    nodes.set(
      id,
      previous === undefined
        ? rect
        : {
            height: lerp(previous.height, rect.height, t),
            width: lerp(previous.width, rect.width, t),
            x: lerp(previous.x, rect.x, t),
            y: lerp(previous.y, rect.y, t),
          },
    );
  }

  for (const [id, edge] of to.edges) {
    const previous = from.edges.get(id);

    edges.set(
      id,
      previous === undefined
        ? edge
        : {
            sourceOffset: lerp(previous.sourceOffset, edge.sourceOffset, t),
            targetOffset: lerp(previous.targetOffset, edge.targetOffset, t),
            width: lerp(previous.width, edge.width, t),
          },
    );
  }

  return { edges, height: lerp(from.height, to.height, t), nodes };
}

/** Live figures re-keyed onto the folded graph, so "N more" nodes show their members' sums. */
function getFlowFigures(folded: FoldedFlowGraph, metrics: FlowGraphData | undefined): FlowFigures {
  const nodes: FlowFigures["nodes"] = new Map();
  const edges: FlowFigures["edges"] = new Map();

  if (metrics === undefined) {
    return { edges, nodes };
  }

  for (const node of metrics.nodes) {
    const id = folded.nodeAliases.get(node.id) ?? node.id;
    const current = nodes.get(id) ?? { inflow: 0, outflow: 0, total: 0, transferCount: 0 };

    nodes.set(id, {
      inflow: current.inflow + node.inflow,
      outflow: current.outflow + node.outflow,
      total: current.total + node.total,
      transferCount: current.transferCount + node.transferCount,
    });
  }

  for (const edge of metrics.edges) {
    const id = folded.edgeAliases.get(edge.id) ?? edge.id;
    const current = edges.get(id) ?? { amount: 0, count: 0 };

    edges.set(id, { amount: current.amount + edge.amount, count: current.count + edge.count });
  }

  return { edges, nodes };
}

function getFocusSet(focus: FlowFocus | null, layout: FlowLayout) {
  if (focus === null) {
    return null;
  }

  const edgeIds = new Set<string>();
  const nodeIds = new Set<string>();

  for (const { edge, id } of layout.edges) {
    const isFocused =
      focus.type === "edge" ? id === focus.id : edge.fromId === focus.id || edge.toId === focus.id;

    if (isFocused) {
      edgeIds.add(id);
      nodeIds.add(edge.fromId);
      nodeIds.add(edge.toId);
    }
  }

  if (focus.type === "node") {
    nodeIds.add(focus.id);
  }

  return { edgeIds, nodeIds };
}

function getActiveNodeIds(
  particles: FlowParticle[],
  edgeAliases: Map<string, string>,
  layout: FlowLayout,
) {
  const activeNodeIds = new Set<string>();

  if (particles.length === 0) {
    return activeNodeIds;
  }

  const edgesById = new Map(layout.edges.map((edge) => [edge.id, edge.edge]));

  for (const particle of particles) {
    const edge = edgesById.get(edgeAliases.get(particle.edgeId) ?? particle.edgeId);

    if (edge !== undefined) {
      activeNodeIds.add(edge.toId);
    }
  }

  return activeNodeIds;
}

function getDirectionColor(
  edge: Pick<FlowEdge, "fromId" | "toId">,
  edgeTone: FlowGraphProps["edgeTone"],
  focusNodeId: string | undefined,
) {
  if (edgeTone !== "direction" || focusNodeId === undefined) {
    return null;
  }

  if (edge.toId === focusNodeId) {
    return "var(--inflow)";
  }

  return edge.fromId === focusNodeId ? "var(--outflow)" : null;
}

function getEdgeOpacity(
  edgeId: string,
  focusSet: ReturnType<typeof getFocusSet>,
  rest: number,
  focused: number,
  dimmed: number,
) {
  if (focusSet === null) {
    return rest;
  }

  return focusSet.edgeIds.has(edgeId) ? focused : dimmed;
}

/**
 * Lanes with many nodes get one-line cards. Nodes tall enough from their stacked ribbons (hubs
 * such as the wallet aggregate or a busy bridge) stack the mark above the name instead.
 */
function getCardVariant(layout: FlowNodeLayout) {
  if (layout.compact) {
    return "compact";
  }

  return layout.height >= hubCardHeight ? "hub" : "regular";
}

function isMixedLane(layout: FlowLayout, node: FlowNodeLayout) {
  const lane = layout.lanes[node.column];

  return lane !== undefined && lane.categories.length > 1;
}

/** Busier routes stream faster: 26px/s for a single transfer up to 64px/s for 10K+. */
function getStreakDurationSeconds(count: number) {
  const intensity = Math.min(1, Math.log10(Math.max(1, count) + 1) / 4);

  return streakPeriod / (26 + intensity * 38);
}

function getParticleColor(amount: number) {
  if (amount >= transferThresholds.whale) {
    return "var(--whale)";
  }

  if (amount >= transferThresholds.large) {
    return "var(--magnitude-large)";
  }

  return "var(--foreground)";
}

function getParticleRadius(amount: number) {
  const t = Math.log1p(Math.max(1, amount)) / Math.log1p(10_000_000);

  return 2 + Math.min(1, t) * 4;
}

function getGradientId(prefix: string, edgeId: string) {
  return `${prefix}-flow-${Math.floor(hashToUnit(edgeId) * 4294967295).toString(36)}`;
}

function formatFlowUSD(value: number) {
  const amount = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (amount > 0 && amount < 1) {
    return `${sign}<$1`;
  }

  if (amount < 1_000) {
    return `${sign}$${amount.toFixed(0)}`;
  }

  return `${sign}${fmtUSD(amount)}`;
}

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function hashToUnit(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) / 4294967295;
}

function getPrefersReducedMotion() {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function getHighResNow() {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function lerp(from: number, to: number, t: number) {
  return from + (to - from) * t;
}
