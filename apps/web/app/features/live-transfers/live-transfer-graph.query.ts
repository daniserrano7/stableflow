import type { FlowGraphResponse } from "@stableflow/shared";
import {
  appendLiveTransferGraphSearchParams,
  type LiveTransferGraphWindow,
} from "./live-transfer-graph.params";

export const liveTransferGraphRefreshIntervalMs = 2_000;

export const liveTransferGraphQueryKey = ({
  windowMinutes,
}: {
  windowMinutes: LiveTransferGraphWindow;
}) => ["live-transfer-graph", { windowMinutes }] as const;

export const getMatchingInitialLiveTransferGraph = (
  initialGraph: FlowGraphResponse,
  { windowMinutes }: { windowMinutes: LiveTransferGraphWindow },
) => {
  if (initialGraph.meta.window.minutes.toString() === windowMinutes) {
    return initialGraph;
  }

  return undefined;
};

export const fetchLiveTransferGraph = async ({
  signal,
  windowMinutes,
}: {
  signal: AbortSignal;
  windowMinutes: LiveTransferGraphWindow;
}) => {
  const url = new URL("/api/flows/live-graph", window.location.origin);
  appendLiveTransferGraphSearchParams(url, { windowMinutes });

  const response = await fetch(url, {
    headers: {
      accept: "application/json",
    },
    signal,
  });

  if (!response.ok) {
    throw new Error("Unable to load live transfer graph");
  }

  return response.json() as Promise<FlowGraphResponse>;
};
