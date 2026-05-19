import type {
  FlowGraphResponse,
  FlowKpisResponse,
  RecentTransfersResponse,
  TopEntityFlowsResponse,
} from "@stableflow/shared";
import { useState } from "react";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { AppHeader } from "../../components/header";
import { AppSidebar } from "../../components/sidebar";
import { getApiUrl } from "../../config/api.server";
import { FlowKpis } from "../flow-kpis/flow-kpis";
import {
  appendLiveTransferGraphSearchParams,
  defaultLiveTransferGraphWindow,
} from "../live-transfers/live-transfer-graph.params";
import { type TransferFilter, transferMatchesFilter } from "../live-transfers/live-transfers.utils";
import { LiveTransfersGraph } from "../live-transfers/live-transfers-graph";
import { LiveTransfersTable } from "../live-transfers/live-transfers-table";
import { useLiveTransfers } from "../live-transfers/use-live-transfers";
import { TopEntityFlows } from "../top-entity-flows/top-entity-flows";
import {
  appendTopEntityFlowSearchParams,
  normalizeTopEntityFlowMode,
  normalizeTopEntityFlowWindow,
  topEntityFlowSearchParamNames,
} from "../top-entity-flows/top-entity-flows.params";

const maxVisibleTransferRows = 20;

export function meta() {
  return [
    { title: "Stableflow" },
    {
      content: "USDC flow intelligence on Base.",
      name: "description",
    },
  ];
}

interface HomeLoaderData {
  flowKpis: FlowKpisResponse;
  liveTransferGraph: FlowGraphResponse;
  topEntityFlows: TopEntityFlowsResponse;
  transfers: RecentTransfersResponse;
}

export async function loader({ request }: { request: Request }): Promise<HomeLoaderData> {
  const requestUrl = new URL(request.url);
  const flowKpisUrl = new URL(getApiUrl("/flows/kpis"));
  const liveTransferGraphUrl = new URL(getApiUrl("/flows/live-graph"));
  const topEntityFlowsUrl = new URL(getApiUrl("/flows/top-entities"));

  appendLiveTransferGraphSearchParams(liveTransferGraphUrl, {
    windowMinutes: defaultLiveTransferGraphWindow,
  });

  appendTopEntityFlowSearchParams(topEntityFlowsUrl, {
    mode: normalizeTopEntityFlowMode(requestUrl.searchParams.get("mode")),
    windowMinutes: normalizeTopEntityFlowWindow(requestUrl.searchParams.get("windowMinutes")),
  });

  const [transfersResponse, topEntityFlowsResponse, liveTransferGraphResponse, flowKpisResponse] =
    await Promise.all([
      fetch(getApiUrl("/transfers/recent?limit=20"), {
        headers: {
          accept: "application/json",
        },
        signal: request.signal,
      }),
      fetch(topEntityFlowsUrl, {
        headers: {
          accept: "application/json",
        },
        signal: request.signal,
      }),
      fetch(liveTransferGraphUrl, {
        headers: {
          accept: "application/json",
        },
        signal: request.signal,
      }),
      fetch(flowKpisUrl, {
        headers: {
          accept: "application/json",
        },
        signal: request.signal,
      }),
    ]);

  if (!transfersResponse.ok) {
    throw new Response("Unable to load recent transfers", {
      status: transfersResponse.status,
      statusText: transfersResponse.statusText,
    });
  }

  if (!topEntityFlowsResponse.ok) {
    throw new Response("Unable to load top entity flows", {
      status: topEntityFlowsResponse.status,
      statusText: topEntityFlowsResponse.statusText,
    });
  }

  if (!liveTransferGraphResponse.ok) {
    throw new Response("Unable to load live transfer graph", {
      status: liveTransferGraphResponse.status,
      statusText: liveTransferGraphResponse.statusText,
    });
  }

  if (!flowKpisResponse.ok) {
    throw new Response("Unable to load flow KPI cards", {
      status: flowKpisResponse.status,
      statusText: flowKpisResponse.statusText,
    });
  }

  return {
    flowKpis: (await flowKpisResponse.json()) as FlowKpisResponse,
    liveTransferGraph: (await liveTransferGraphResponse.json()) as FlowGraphResponse,
    topEntityFlows: (await topEntityFlowsResponse.json()) as TopEntityFlowsResponse,
    transfers: (await transfersResponse.json()) as RecentTransfersResponse,
  };
}

export function shouldRevalidate({
  currentUrl,
  defaultShouldRevalidate,
  nextUrl,
}: ShouldRevalidateFunctionArgs) {
  if (currentUrl.pathname !== nextUrl.pathname) {
    return defaultShouldRevalidate;
  }

  const currentNonFlowSearch = getSearchWithoutTopEntityFlowParams(currentUrl);
  const nextNonFlowSearch = getSearchWithoutTopEntityFlowParams(nextUrl);
  const hasFlowSearchChange = topEntityFlowSearchParamNames.some(
    (name) => currentUrl.searchParams.get(name) !== nextUrl.searchParams.get(name),
  );

  if (hasFlowSearchChange && currentNonFlowSearch === nextNonFlowSearch) {
    return false;
  }

  return defaultShouldRevalidate;
}

export default function Home() {
  const loaderData = useLoaderData<typeof loader>();
  const initialTransfers = loaderData.transfers.data;
  const { freshTransferIds, transfers } = useLiveTransfers({
    initialTransfers,
  });
  const [filter, setFilter] = useState<TransferFilter>("all");

  const matchingTransfers = transfers.filter((transfer) => transferMatchesFilter(transfer, filter));
  const visibleTransfers = matchingTransfers.slice(0, maxVisibleTransferRows);

  return (
    <main className="grid min-h-screen grid-cols-[3.5rem_minmax(0,1fr)] bg-background text-foreground">
      <div className="bg-ambient" />
      <div className="bg-grid" />

      <AppSidebar />

      <section
        className="flex min-h-screen min-w-0 flex-col gap-3.5 px-3 pt-4 pb-6 lg:px-6"
        aria-labelledby="home-title"
      >
        <AppHeader />

        <FlowKpis initialKpis={loaderData.flowKpis} />

        <div className="grid gap-3.5 2xl:grid-cols-[minmax(0,1.2fr)_minmax(28rem,0.8fr)]">
          <div className="flex min-w-0 flex-col gap-3.5">
            <LiveTransfersGraph
              bufferedCount={transfers.length}
              freshTransferIds={freshTransferIds}
              initialGraph={loaderData.liveTransferGraph}
              transfers={transfers}
            />
            <LiveTransfersTable
              bufferedCount={transfers.length}
              filter={filter}
              freshTransferIds={freshTransferIds}
              matchingCount={matchingTransfers.length}
              onFilterChange={setFilter}
              transfers={visibleTransfers}
            />
          </div>
          <TopEntityFlows initialFlows={loaderData.topEntityFlows} />
        </div>

        <footer className="flex flex-col items-start justify-between gap-3 p-1 font-mono text-2xs text-muted-foreground md:flex-row md:items-center">
          <span>Stableflow · v0.1.0</span>
          <span>Scope: Base + USDC</span>
          <span>{initialTransfers.length} SSR rows · SSE live updates</span>
        </footer>
      </section>
    </main>
  );
}

const getSearchWithoutTopEntityFlowParams = (url: URL) => {
  const params = new URLSearchParams(url.search);

  for (const name of topEntityFlowSearchParamNames) {
    params.delete(name);
  }

  params.sort();

  return params.toString();
};
