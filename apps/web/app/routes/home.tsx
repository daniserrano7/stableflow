import type {
  LiveTransferBatchEvent,
  LiveTransferCursor,
  LiveTransferRow,
  RecentTransfersResponse,
} from "@stableflow/shared";
import { useEffect, useRef, useState } from "react";
import { Link, useLoaderData } from "react-router";
import { getApiUrl } from "../config/api.server";
import type { Route } from "./+types/home";

const maxLiveTransferRows = 20;

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

  return (
    <main className="shell">
      <section className="hero" aria-labelledby="home-title">
        <div className="hero__content">
          <p className="eyebrow">Stableflow</p>
          <h1 id="home-title">USDC flow intelligence on Base.</h1>
          <p className="lede">
            A live view of token movement across users, protocols, bridges, and venues.
          </p>
          <Link className="button-link" to="/entities">
            View tracked entities
          </Link>
        </div>

        <dl className="status-grid" aria-label="Current scaffold status">
          <div>
            <dt>Frontend</dt>
            <dd>React Router</dd>
          </div>
          <div>
            <dt>Rendering</dt>
            <dd>SSR ready</dd>
          </div>
          <div>
            <dt>Data</dt>
            <dd>Live transfers</dd>
          </div>
        </dl>
      </section>

      <LiveTransfersTable initialTransfers={initialTransfers} />
    </main>
  );
}

function LiveTransfersTable({ initialTransfers }: { initialTransfers: LiveTransferRow[] }) {
  const [transfers, setTransfers] = useState(initialTransfers);
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

  return (
    <section className="live-section" aria-labelledby="live-transfers-title">
      <div className="live-section__header">
        <div>
          <p className="eyebrow">Live table</p>
          <h2 id="live-transfers-title">Recent USDC transfers</h2>
        </div>
        <span>{transfers.length} rows</span>
      </div>

      <table className="live-table">
        <thead>
          <tr>
            <th scope="col">From</th>
            <th scope="col">To</th>
            <th scope="col">Amount</th>
            <th scope="col">Entity type</th>
          </tr>
        </thead>
        <tbody>
          {transfers.map((transfer) => (
            <tr key={transfer.id}>
              <td>{transfer.from.displayName}</td>
              <td>{transfer.to.displayName}</td>
              <td>
                {transfer.amount.formatted} {transfer.amount.currency}
              </td>
              <td>{transfer.entityType}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
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
