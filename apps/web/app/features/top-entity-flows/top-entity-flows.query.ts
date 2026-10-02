import type { TopEntityFlowMode, TopEntityFlowsResponse } from "@stableflow/shared";
import {
  appendTopEntityFlowSearchParams,
  type TopEntityFlowWindow,
  topEntityFlowLimit,
} from "./top-entity-flows.params";

export const topEntityFlowRefreshIntervalMs = 2_000;

interface TopEntityFlowsQueryOptions {
  mode: TopEntityFlowMode;
  windowMinutes: TopEntityFlowWindow;
}

export const topEntityFlowsQueryKey = ({ mode, windowMinutes }: TopEntityFlowsQueryOptions) =>
  ["top-entity-flows", { limit: topEntityFlowLimit, mode, windowMinutes }] as const;

export const getMatchingInitialTopEntityFlows = (
  initialFlows: TopEntityFlowsResponse,
  { mode, windowMinutes }: TopEntityFlowsQueryOptions,
) => {
  if (
    initialFlows.meta.limit === topEntityFlowLimit &&
    initialFlows.meta.mode === mode &&
    initialFlows.meta.window.minutes.toString() === windowMinutes
  ) {
    return initialFlows;
  }

  return undefined;
};

export const fetchTopEntityFlows = async ({
  mode,
  signal,
  windowMinutes,
}: TopEntityFlowsQueryOptions & {
  signal: AbortSignal;
}) => {
  const url = new URL("/api/flows/top-entities", window.location.origin);
  appendTopEntityFlowSearchParams(url, { mode, windowMinutes });

  const response = await fetch(url, {
    headers: {
      accept: "application/json",
    },
    signal,
  });

  if (!response.ok) {
    throw new Error("Unable to load top entity flows");
  }

  return response.json() as Promise<TopEntityFlowsResponse>;
};
