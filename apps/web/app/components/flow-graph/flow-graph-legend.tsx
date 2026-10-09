import type * as React from "react";
import type { FlowNode } from "./flow-graph.types";
import { getFlowCategory } from "./flow-graph-categories";

export interface FlowLegendItem {
  color: string;
  key: string;
  label: string;
  /** Swatches key card colours; lines key ribbon colours. */
  mark: "line" | "swatch";
}

export const flowWidthLegendItem: FlowLegendItem = {
  color:
    "linear-gradient(90deg,color-mix(in oklch,var(--foreground) 25%,transparent),var(--foreground))",
  key: "width",
  label: "Width = volume (log)",
  mark: "line",
};

/** One swatch per category on the graph, in lane order, so the legend matches what is drawn. */
export function getFlowCategoryLegend(nodes: FlowNode[]): FlowLegendItem[] {
  const categories = new Map(nodes.map((node) => [getFlowCategory(node.category).key, node]));

  return [...categories.keys()]
    .map((key) => getFlowCategory(key))
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
    .map((category) => ({
      color: category.color,
      key: category.key,
      label: category.plural,
      mark: "swatch",
    }));
}

/** The strip under a flow graph: what the colours mean on the left, totals on the right. */
export function FlowGraphFooter({
  children,
  items,
}: {
  children: React.ReactNode;
  items: FlowLegendItem[];
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-border border-t px-3.5 py-2.5 font-mono text-2xs text-muted-foreground">
      <ul
        aria-label="Legend"
        className="m-0 flex list-none flex-wrap items-center gap-x-3.5 gap-y-1.5 p-0"
      >
        {items.map((item) => (
          <li key={item.key} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className={item.mark === "line" ? "h-[3px] w-4 rounded-full" : "size-2 rounded-[3px]"}
              style={{ background: item.color }}
            />
            {item.label}
          </li>
        ))}
      </ul>
      <span className="tabular-nums">{children}</span>
    </div>
  );
}
