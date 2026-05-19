import type { FlowKpisResponse } from "@stableflow/shared";

export const flowKpisRefreshIntervalMs = 2_000;

export const flowKpisQueryKey = ["flow-kpis"] as const;

export const fetchFlowKpis = async ({ signal }: { signal: AbortSignal }) => {
  const response = await fetch(new URL("/api/flows/kpis", window.location.origin), {
    headers: {
      accept: "application/json",
    },
    signal,
  });

  if (!response.ok) {
    throw new Error("Unable to load flow KPI cards");
  }

  return response.json() as Promise<FlowKpisResponse>;
};
