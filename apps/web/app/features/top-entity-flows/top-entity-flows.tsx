import type {
  TopEntityFlowMode,
  TopEntityFlowRow,
  TopEntityFlowsResponse,
} from "@stableflow/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, CircleDotDashed } from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { Entity, FlowBar, Panel, PanelActions, PanelHead, PanelTitle } from "~/components";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { CATEGORY, type Category } from "~/styles/tokens";
import {
  normalizeTopEntityFlowMode,
  normalizeTopEntityFlowWindow,
  type TopEntityFlowWindow,
  topEntityFlowModeOptions,
  topEntityFlowWindowOptions,
} from "./top-entity-flows.params";
import {
  fetchTopEntityFlows,
  getMatchingInitialTopEntityFlows,
  topEntityFlowRefreshIntervalMs,
  topEntityFlowsQueryKey,
} from "./top-entity-flows.query";

interface TopEntityFlowsProps {
  initialFlows: TopEntityFlowsResponse;
}

export function TopEntityFlows({ initialFlows }: TopEntityFlowsProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const mode = normalizeTopEntityFlowMode(searchParams.get("mode") ?? initialFlows.meta.mode);
  const windowMinutes = normalizeTopEntityFlowWindow(
    searchParams.get("windowMinutes") ?? initialFlows.meta.window.minutes.toString(),
  );
  const initialData = getMatchingInitialTopEntityFlows(initialFlows, {
    mode,
    windowMinutes,
  });
  const flowsQuery = useQuery({
    initialData,
    initialDataUpdatedAt:
      initialData === undefined ? undefined : Date.parse(initialData.meta.generatedAt),
    placeholderData: keepPreviousData,
    queryFn: ({ signal }) => fetchTopEntityFlows({ mode, signal, windowMinutes }),
    queryKey: topEntityFlowsQueryKey({ mode, windowMinutes }),
    refetchInterval: topEntityFlowRefreshIntervalMs,
    retry: 2,
    staleTime: 10_000,
  });
  const flows = flowsQuery.data ?? initialFlows;
  const isRefreshing = flowsQuery.isFetching && !flowsQuery.isPending;

  const updateFlowSearchParams = ({
    mode: nextMode,
    windowMinutes: nextWindowMinutes,
  }: {
    mode?: TopEntityFlowMode;
    windowMinutes?: TopEntityFlowWindow;
  }) => {
    setSearchParams(
      (currentSearchParams) => {
        const nextSearchParams = new URLSearchParams(currentSearchParams);

        if (nextMode !== undefined) {
          nextSearchParams.set("mode", nextMode);
        }

        if (nextWindowMinutes !== undefined) {
          nextSearchParams.set("windowMinutes", nextWindowMinutes);
        }

        return nextSearchParams;
      },
      { preventScrollReset: true },
    );
  };

  return (
    <Panel>
      <PanelHead>
        <PanelTitle live>Top Entity Flows</PanelTitle>
        <PanelActions className="flex-wrap">
          <ToggleGroup
            aria-label="Flow window"
            type="single"
            value={windowMinutes}
            onValueChange={(nextWindowMinutes) => {
              if (isTopEntityFlowWindow(nextWindowMinutes) && nextWindowMinutes !== windowMinutes) {
                updateFlowSearchParams({ windowMinutes: nextWindowMinutes });
              }
            }}
          >
            {topEntityFlowWindowOptions.map((option) => (
              <ToggleGroupItem key={option.value} value={option.value}>
                {option.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <ToggleGroup
            aria-label="Flow mode"
            type="single"
            value={mode}
            onValueChange={(nextMode) => {
              if (isTopEntityFlowMode(nextMode) && nextMode !== mode) {
                updateFlowSearchParams({ mode: nextMode });
              }
            }}
          >
            {topEntityFlowModeOptions.map((option) => (
              <ToggleGroupItem key={option.value} value={option.value}>
                {option.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </PanelActions>
      </PanelHead>

      <div
        className={isRefreshing ? "divide-y divide-border opacity-75" : "divide-y divide-border"}
      >
        {flows.data.map((flow) => (
          <TopEntityFlowItem key={flow.entityId} flow={flow} mode={flows.meta.mode} />
        ))}

        {flows.data.length === 0 && (
          <div className="flex h-40 items-center justify-center gap-2 font-mono text-xs text-muted-foreground">
            <CircleDotDashed size={14} />
            No entity flow data for this window yet.
          </div>
        )}
      </div>
    </Panel>
  );
}

function TopEntityFlowItem({ flow, mode }: { flow: TopEntityFlowRow; mode: TopEntityFlowMode }) {
  const category = getKnownCategory(flow.category);
  const selectedAmount = formatCompactUsdc(flow.selected.formatted);
  const trend = getFlowTrend(flow, mode);

  return (
    <div className="grid min-h-20 grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3 md:grid-cols-[2rem_minmax(10rem,1fr)_minmax(8rem,1.4fr)_minmax(7rem,auto)] md:gap-4">
      <span className="font-mono text-sm text-muted-foreground">
        {flow.rank.toString().padStart(2, "0")}
      </span>

      <Link
        className="min-w-0 text-foreground no-underline hover:text-accent"
        to={`/entities/${flow.entityId}`}
      >
        <Entity
          category={category}
          entityId={flow.entityId}
          glyph={getEntityGlyph(flow)}
          name={flow.entityName}
          className="min-w-0"
        />
      </Link>

      <div className="col-span-2 col-start-2 flex min-w-0 flex-col gap-2 md:col-span-1 md:col-start-auto">
        <FlowBar trend={trend} value={flow.relativeShare} />
        <div className="flex items-center gap-2 font-mono text-2xs text-muted-foreground">
          <span>{formatInteger(flow.selectedTransferCount)} transfers</span>
          <span className="h-1 w-1 rounded-full bg-muted-foreground/50" aria-hidden />
          <span>{formatCategory(flow.category)}</span>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1 font-mono">
        <span
          className={trend === "net-pos" || trend === "inflow" ? "text-inflow" : "text-outflow"}
        >
          {selectedAmount}
          <span className="ml-1 text-2xs text-muted-foreground">USDC</span>
        </span>
        <span className="flex items-center gap-1 text-2xs text-muted-foreground">
          {trend === "net-pos" || trend === "inflow" ? (
            <ArrowDownLeft size={12} />
          ) : (
            <ArrowUpRight size={12} />
          )}
          {mode}
        </span>
      </div>
    </div>
  );
}

const getFlowTrend = (
  flow: TopEntityFlowRow,
  mode: TopEntityFlowMode,
): "inflow" | "outflow" | "net-pos" | "net-neg" => {
  if (mode === "inflow") {
    return "inflow";
  }

  if (mode === "outflow") {
    return "outflow";
  }

  return flow.selected.raw.startsWith("-") ? "net-neg" : "net-pos";
};

const isTopEntityFlowWindow = (value: string): value is TopEntityFlowWindow => {
  return value === "5" || value === "15" || value === "60";
};

const isTopEntityFlowMode = (value: string): value is TopEntityFlowMode => {
  return value === "inflow" || value === "outflow" || value === "net";
};

const getKnownCategory = (category: string): Category | undefined => {
  return category in CATEGORY ? (category as Category) : undefined;
};

const getEntityGlyph = (flow: TopEntityFlowRow) => {
  const words = flow.entityName.split(/\s+/).filter(Boolean);
  const first = words.at(0)?.at(0) ?? flow.entityName.at(0) ?? "?";
  const second = words.length > 1 ? words.at(1)?.at(0) : undefined;

  return `${first}${second ?? ""}`.toUpperCase();
};

const formatCategory = (category: string) => {
  if (category === "dex") {
    return "DEX";
  }

  if (category === "cex") {
    return "CEX";
  }

  return category
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const formatCompactUsdc = (formattedAmount: string) => {
  const value = Number(formattedAmount);
  const sign = value < 0 ? "-" : "";
  const absoluteValue = Math.abs(value);

  if (absoluteValue >= 1_000_000_000) {
    return `${sign}${(absoluteValue / 1_000_000_000).toFixed(2)}B`;
  }

  if (absoluteValue >= 1_000_000) {
    return `${sign}${(absoluteValue / 1_000_000).toFixed(2)}M`;
  }

  if (absoluteValue >= 1_000) {
    return `${sign}${(absoluteValue / 1_000).toFixed(1)}K`;
  }

  return `${sign}${absoluteValue.toFixed(0)}`;
};

const formatInteger = (value: number) => {
  return Math.trunc(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};
