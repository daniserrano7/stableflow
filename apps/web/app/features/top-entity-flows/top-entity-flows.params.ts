import type { TopEntityFlowMode } from "@stableflow/shared";

export type TopEntityFlowWindow = "5" | "15" | "60";

export const topEntityFlowLimit = 8;

export const defaultTopEntityFlowMode = "net" satisfies TopEntityFlowMode;
export const defaultTopEntityFlowWindow = "15" satisfies TopEntityFlowWindow;

export const topEntityFlowSearchParamNames = ["mode", "windowMinutes"] as const;

export const topEntityFlowModeOptions: { label: string; value: TopEntityFlowMode }[] = [
  { label: "Net", value: "net" },
  { label: "Inflow", value: "inflow" },
  { label: "Outflow", value: "outflow" },
];

export const topEntityFlowWindowOptions: { label: string; value: TopEntityFlowWindow }[] = [
  { label: "5m", value: "5" },
  { label: "15m", value: "15" },
  { label: "1h", value: "60" },
];

interface TopEntityFlowsQueryOptions {
  mode: TopEntityFlowMode;
  windowMinutes: TopEntityFlowWindow;
}

export const normalizeTopEntityFlowMode = (mode: string | null | undefined): TopEntityFlowMode => {
  if (mode === "inflow" || mode === "outflow" || mode === "net") {
    return mode;
  }

  return defaultTopEntityFlowMode;
};

export const normalizeTopEntityFlowWindow = (
  windowMinutes: string | null | undefined,
): TopEntityFlowWindow => {
  if (windowMinutes === "5" || windowMinutes === "15" || windowMinutes === "60") {
    return windowMinutes;
  }

  return defaultTopEntityFlowWindow;
};

export const appendTopEntityFlowSearchParams = (
  url: URL,
  { mode, windowMinutes }: TopEntityFlowsQueryOptions,
) => {
  url.searchParams.set("limit", topEntityFlowLimit.toString());
  url.searchParams.set("mode", mode);
  url.searchParams.set("windowMinutes", windowMinutes);
};
