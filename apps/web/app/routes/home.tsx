import type {
  LiveTransferBatchEvent,
  LiveTransferCursor,
  LiveTransferRow,
  RecentTransfersResponse,
} from "@stableflow/shared";
import { useEffect, useRef, useState } from "react";
import { useLoaderData } from "react-router";
import { AppHeader } from "../components/header";
import {
  getTransferAmount,
  LiveTransfersTable,
  type TransferFilter,
} from "../components/live-transfers-table";
import { AppSidebar } from "../components/sidebar";
import { getApiUrl } from "../config/api.server";
import type { Route } from "./+types/home";

const maxLiveTransferRows = 20;
const largeTransferThreshold = 10_000;
const whaleThreshold = 1_000_000;

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Stableflow" },
    {
      content: "USDC flow intelligence on Base.",
      name: "description",
    },
  ];
}

export async function loader(): Promise<RecentTransfersResponse> {
  const response = await fetch(getApiUrl("/transfers/recent?limit=20"), {
    headers: {
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Response("Unable to load recent transfers", {
      status: response.status,
      statusText: response.statusText,
    });
  }

  return response.json() as Promise<RecentTransfersResponse>;
}

export default function Home() {
  const initialTransfers = useLoaderData<typeof loader>().data;
  const [transfers, setTransfers] = useState(initialTransfers);
  const [filter, setFilter] = useState<TransferFilter>("all");
  const latestCursor = useRef(getLatestCursor(initialTransfers));

  useEffect(() => {
    const streamUrl = new URL("/events/transfers", window.location.origin);

    if (latestCursor.current !== null) {
      streamUrl.searchParams.set("afterBlockNumber", latestCursor.current.blockNumber);
      streamUrl.searchParams.set("afterLogIndex", latestCursor.current.logIndex.toString());
    }

    const events = new EventSource(streamUrl);

    events.addEventListener("transfers", (event) => {
      const batch = JSON.parse(event.data) as LiveTransferBatchEvent;

      latestCursor.current = getNewestCursor(latestCursor.current, batch.cursor);

      setTransfers((currentTransfers) =>
        mergeTransfers(currentTransfers, batch.transfers).slice(0, maxLiveTransferRows),
      );
    });

    return () => {
      events.close();
    };
  }, []);

  const filteredTransfers = transfers.filter((transfer) => {
    const amount = getTransferAmount(transfer);

    if (filter === "whale") {
      return amount >= whaleThreshold;
    }

    if (filter === "large") {
      return amount >= largeTransferThreshold;
    }

    return true;
  });

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

        <LiveTransfersTable
          bufferedCount={transfers.length}
          filter={filter}
          onFilterChange={setFilter}
          transfers={filteredTransfers}
        />

        <footer className="flex flex-col items-start justify-between gap-3 p-1 font-mono text-2xs text-muted-foreground md:flex-row md:items-center">
          <span>Stableflow · v0.1.0</span>
          <span>Scope: Base + USDC</span>
          <span>{initialTransfers.length} SSR rows · SSE live updates</span>
        </footer>
      </section>
    </main>
  );
}

const mergeTransfers = (currentTransfers: LiveTransferRow[], nextTransfers: LiveTransferRow[]) => {
  const transfersById = new Map<string, LiveTransferRow>();

  for (const transfer of [...currentTransfers, ...nextTransfers]) {
    transfersById.set(transfer.id, transfer);
  }

  return [...transfersById.values()].sort(compareTransfersNewestFirst);
};

const compareTransfersNewestFirst = (a: LiveTransferRow, b: LiveTransferRow) => {
  const blockDelta = BigInt(b.blockNumber) - BigInt(a.blockNumber);

  if (blockDelta !== 0n) {
    return blockDelta > 0n ? 1 : -1;
  }

  return b.logIndex - a.logIndex;
};

const getLatestCursor = (transfers: LiveTransferRow[]): LiveTransferCursor | null => {
  return [...transfers].sort(compareTransfersNewestFirst).at(0)?.cursor ?? null;
};

const getNewestCursor = (
  currentCursor: LiveTransferCursor | null,
  nextCursor: LiveTransferCursor | null,
) => {
  if (currentCursor === null || nextCursor === null) {
    return nextCursor ?? currentCursor;
  }

  const currentBlockNumber = BigInt(currentCursor.blockNumber);
  const nextBlockNumber = BigInt(nextCursor.blockNumber);

  if (nextBlockNumber > currentBlockNumber) {
    return nextCursor;
  }

  if (nextBlockNumber === currentBlockNumber && nextCursor.logIndex > currentCursor.logIndex) {
    return nextCursor;
  }

  return currentCursor;
};
