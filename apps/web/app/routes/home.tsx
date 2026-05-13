import type {
  LiveTransferBatchEvent,
  LiveTransferCursor,
  LiveTransferParty,
  LiveTransferRow,
  RecentTransfersResponse,
} from "@stableflow/shared";
import {
  ArrowRight,
  BarChart3,
  Blocks,
  CircleDollarSign,
  Coins,
  Link2,
  Network,
  Search,
  Settings,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLoaderData } from "react-router";
import { getApiUrl } from "../config/api.server";
import {
  Amount,
  Chip,
  Entity,
  Panel,
  PanelActions,
  PanelHead,
  PanelTitle,
  Segmented,
  Tag,
} from "../design-system/components";
import type { Category } from "../design-system/tokens";
import type { Route } from "./+types/home";

const maxLiveTransferRows = 20;
const largeTransferThreshold = 10_000;
const whaleThreshold = 1_000_000;

const categoryLabels: Record<string, Category> = {
  bridge: "bridge",
  cex: "cex",
  dex: "dex",
  lending: "lending",
  mint: "mint",
  wallet: "wallet",
};

type TransferFilter = "all" | "large" | "whale";

const filterOptions: { label: string; value: TransferFilter }[] = [
  { label: "All", value: "all" },
  { label: ">= $10K", value: "large" },
  { label: "Whales", value: "whale" },
];

const sidebarItems = [
  { href: "/", icon: Network, isActive: true, label: "Flow" },
  { href: "/entities", icon: Blocks, label: "Entities" },
  { href: "/", icon: Coins, label: "Assets" },
  { href: "/", icon: Link2, label: "Chains" },
  { href: "/design-system", icon: BarChart3, hasBadge: true, label: "Stats" },
];

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
    <main className="sf-app-shell">
      <div className="bg-ambient" />
      <div className="bg-grid" />

      <Sidebar />

      <section className="sf-live-workspace" aria-labelledby="home-title">
        <header className="sf-topbar">
          <div className="sf-brand">
            <div>
              <h1 id="home-title">Stableflow</h1>
              <p>Flow / Base · USDC · Live</p>
            </div>
          </div>

          <div className="sf-search">
            <Search size={14} />
            <span>Search protocol, address, tx hash...</span>
            <kbd>⌘K</kbd>
          </div>

          <div className="sf-topbar__chips">
            <Chip>BASE · MAINNET</Chip>
            <Chip dotColor="var(--asset-usdc)">USDC</Chip>
          </div>
        </header>

        <LiveTransfersTable initialTransfers={initialTransfers} />

        <footer className="sf-footer-meta">
          <span>Stableflow · v0.1.0</span>
          <span>Scope: Base + USDC</span>
          <span>{initialTransfers.length} SSR rows · SSE live updates</span>
        </footer>
      </section>
    </main>
  );
}

function Sidebar() {
  return (
    <aside className="sf-sidebar" aria-label="Stableflow navigation">
      <Link className="sf-sidebar__brand" to="/" aria-label="Stableflow home">
        <img alt="" height="32" src="/brand-icon.svg" width="32" />
      </Link>

      <nav className="sf-sidebar__nav">
        {sidebarItems.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              aria-label={item.label}
              className="sf-sidebar__item"
              data-state={item.isActive ? "active" : undefined}
              key={item.label}
              to={item.href}
            >
              <Icon size={16} strokeWidth={1.6} />
              {item.hasBadge && <span className="sf-sidebar__badge" />}
              <span className="sf-sidebar__tooltip">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="sf-sidebar__spacer" />
      <div className="sf-sidebar__divider" />
      <Link className="sf-sidebar__item" to="/design-system" aria-label="Settings">
        <Settings size={16} strokeWidth={1.6} />
        <span className="sf-sidebar__tooltip">Settings</span>
      </Link>
    </aside>
  );
}

function LiveTransfersTable({ initialTransfers }: { initialTransfers: LiveTransferRow[] }) {
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
    <Panel className="sf-live-panel">
      <PanelHead>
        <PanelTitle live>Live Transfers</PanelTitle>
        <PanelActions>
          <Segmented value={filter} onChange={setFilter} options={filterOptions} />
        </PanelActions>
      </PanelHead>

      <div className="sf-table-wrap">
        <table className="sf-table sf-transfers-table">
          <thead>
            <tr>
              <th scope="col">From</th>
              <th aria-label="Direction" scope="col" />
              <th scope="col">To</th>
              <th className="sf-table-num" scope="col">
                Amount
              </th>
              <th className="sf-table-num" scope="col">
                Protocol
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredTransfers.map((transfer, index) => (
              <tr data-fresh={index === 0 ? "true" : undefined} key={transfer.id}>
                <td>
                  <TransferEntity party={transfer.from} />
                </td>
                <td>
                  <span className="sf-direction-arrow" aria-hidden>
                    <ArrowRight size={14} />
                  </span>
                </td>
                <td>
                  <TransferEntity party={transfer.to} />
                </td>
                <td className="sf-table-num">
                  <Amount
                    value={getTransferAmount(transfer)}
                    magnitude={getTransferMagnitude(transfer)}
                    unit={transfer.amount.currency}
                  />
                </td>
                <td className="sf-table-num">
                  <Tag category={getTransferCategory(transfer)} />
                </td>
              </tr>
            ))}
            {filteredTransfers.length === 0 && (
              <tr>
                <td className="sf-empty-state" colSpan={5}>
                  No transfers match this filter yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="sf-live-panel__meta">
        <span>
          <CircleDollarSign size={13} /> {filteredTransfers.length} visible
        </span>
        <span>{transfers.length} buffered</span>
      </div>
    </Panel>
  );
}

function TransferEntity({ party }: { party: LiveTransferParty }) {
  const category = getPartyCategory(party);

  return (
    <Entity
      category={category}
      glyph={getEntityGlyph(party, category)}
      isWallet={!party.isIdentified}
      name={party.displayName}
    />
  );
}

function getPartyCategory(party: LiveTransferParty): Category {
  if (!party.isIdentified) {
    return "wallet";
  }

  return categoryLabels[party.category.toLowerCase()] ?? "wallet";
}

function getTransferCategory(transfer: LiveTransferRow): Category {
  const toCategory = getPartyCategory(transfer.to);

  if (toCategory !== "wallet") {
    return toCategory;
  }

  return getPartyCategory(transfer.from);
}

function getEntityGlyph(party: LiveTransferParty, category: Category) {
  if (!party.isIdentified) {
    return "0x";
  }

  const source = party.entityName ?? party.displayName;
  const initials = source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.at(0)?.toUpperCase())
    .join("");

  return initials || category.slice(0, 2).toUpperCase();
}

function getTransferAmount(transfer: LiveTransferRow) {
  return Number.parseFloat(transfer.amount.formatted.replaceAll(",", ""));
}

function getTransferMagnitude(transfer: LiveTransferRow) {
  const amount = getTransferAmount(transfer);

  if (amount >= whaleThreshold) {
    return "whale";
  }

  if (amount >= largeTransferThreshold) {
    return "large";
  }

  return "small";
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
