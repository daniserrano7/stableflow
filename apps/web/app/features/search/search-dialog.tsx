import type { SearchResult } from "@stableflow/shared";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Blocks,
  CircleDollarSign,
  Coins,
  ExternalLink,
  FileText,
  Hash,
  Home,
  LoaderCircle,
  Search,
  WalletCards,
  X,
} from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router";
import { selectedAssetChain } from "~/features/assets/assets.config";
import { cn } from "~/utils/cn";
import { fetchSearchResults, searchQueryKey } from "./search.query";
import { SearchDialogContext } from "./search-dialog-context";

type SearchItemKind = "address" | "asset" | "entity" | "page" | "transaction";

interface SearchItem {
  external?: boolean;
  group: string;
  href: string;
  id: string;
  keywords: string;
  kind: SearchItemKind;
  subtitle: string;
  title: string;
}

const navigationItems: SearchItem[] = [
  {
    group: "Navigation",
    href: "/",
    id: "page:overview",
    keywords: "home dashboard flow network live transfers",
    kind: "page",
    subtitle: "USDC flow intelligence on Base",
    title: "Overview",
  },
  {
    group: "Navigation",
    href: "/entities",
    id: "page:entities",
    keywords: "protocols addresses labels registry",
    kind: "page",
    subtitle: "Browse protocols and labeled addresses",
    title: "Entities",
  },
  {
    group: "Navigation",
    href: "/assets",
    id: "page:assets",
    keywords: "tokens stablecoins coins catalog",
    kind: "page",
    subtitle: "Explore tracked stablecoins",
    title: "Assets",
  },
];

const assetItems: SearchItem[] = selectedAssetChain.assets.map((asset) => ({
  group: "Assets",
  href: `/assets?q=${encodeURIComponent(asset.symbol)}`,
  id: `asset:${asset.symbol.toLowerCase()}`,
  keywords: `${asset.symbol} ${asset.name} ${asset.contract ?? ""} ${asset.status}`,
  kind: "asset",
  subtitle: `${asset.name} · ${asset.status === "tracked" ? "Tracked on Base" : "Preview"}`,
  title: asset.symbol,
}));

const predefinedItems = [...navigationItems, ...assetItems];
const groupOrder = ["Navigation", "Assets", "Entities", "Addresses", "Transactions"];
const emptyRemoteResults: SearchResult[] = [];

export function SearchDialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openSearch = useCallback(() => setOpen(true), []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <SearchDialogContext.Provider value={{ openSearch }}>
      {children}
      <SearchDialog open={open} onOpenChange={setOpen} />
    </SearchDialogContext.Provider>
  );
}

function SearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const listboxId = useId();
  const normalizedQuery = query.trim().toLowerCase();
  const debouncedQuery = useDebouncedValue(normalizedQuery, 160);
  const searchQuery = useQuery({
    enabled: open && debouncedQuery.length > 0,
    queryFn: ({ signal }) => fetchSearchResults({ query: debouncedQuery, signal }),
    queryKey: searchQueryKey(debouncedQuery),
    retry: 1,
    staleTime: 30_000,
  });
  const isSettledQuery =
    debouncedQuery === normalizedQuery &&
    searchQuery.data?.meta.query.toLowerCase() === normalizedQuery;
  const remoteResults = isSettledQuery
    ? (searchQuery.data?.data ?? emptyRemoteResults)
    : emptyRemoteResults;
  const items = useMemo(() => {
    const localItems =
      normalizedQuery.length === 0
        ? predefinedItems
        : predefinedItems
            .map((item) => ({ item, score: scoreSearchItem(item, normalizedQuery) }))
            .filter((entry) => entry.score !== null)
            .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
            .map(({ item }) => item);

    return [...localItems, ...remoteResults.map(toSearchItem)];
  }, [normalizedQuery, remoteResults]);
  const groups = useMemo(
    () =>
      groupOrder
        .map((group) => ({ group, items: items.filter((item) => item.group === group) }))
        .filter(({ items: groupItems }) => groupItems.length > 0),
    [items],
  );
  const activeIndex = items.findIndex((item) => item.id === activeId);
  const isSearching =
    normalizedQuery.length > 0 &&
    (normalizedQuery !== debouncedQuery || searchQuery.isFetching) &&
    remoteResults.length === 0;

  useEffect(() => {
    setActiveId(items.at(0)?.id ?? null);
  }, [items]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setActiveId(null);
    }
  }, [open]);

  const selectItem = useCallback(
    (item: SearchItem) => {
      onOpenChange(false);

      if (item.external) {
        window.open(item.href, "_blank", "noopener,noreferrer");
        return;
      }

      navigate(item.href);
    },
    [navigate, onOpenChange],
  );

  const handleInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing || items.length === 0) return;

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const nextIndex =
        activeIndex < 0 ? 0 : (activeIndex + direction + items.length) % items.length;
      const nextItem = items[nextIndex];
      if (nextItem !== undefined) setActiveId(nextItem.id);
      return;
    }

    if (event.key === "Enter") {
      const activeItem = items[activeIndex];
      if (activeItem !== undefined) {
        event.preventDefault();
        selectItem(activeItem);
      }
    }
  };

  const resultCountLabel =
    normalizedQuery.length === 0
      ? "Suggested destinations"
      : `${items.length.toString()} result${items.length === 1 ? "" : "s"} for ${query.trim()}`;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-modal bg-black/55 backdrop-blur-sm data-[state=closed]:opacity-0 data-[state=open]:animate-in" />
        <DialogPrimitive.Content
          className="fixed top-[min(14vh,7rem)] left-1/2 z-modal flex max-h-[min(42rem,80vh)] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 flex-col overflow-hidden rounded-xl border border-[var(--border-strong)] bg-surface-1 shadow-lg outline-none data-[state=closed]:opacity-0 data-[state=open]:animate-slide-in"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            inputRef.current?.focus();
          }}
        >
          <DialogPrimitive.Title className="sr-only">Search Stableflow</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Search pages, assets, entities, addresses, and transactions.
          </DialogPrimitive.Description>

          <div className="flex min-h-15 items-center gap-3 border-border border-b px-4">
            {isSearching ? (
              <LoaderCircle
                aria-hidden="true"
                className="shrink-0 animate-spin text-accent"
                size={18}
              />
            ) : (
              <Search aria-hidden="true" className="shrink-0 text-muted-foreground" size={18} />
            )}
            <input
              aria-activedescendant={activeId === null ? undefined : optionDomId(activeId)}
              aria-autocomplete="list"
              aria-controls={listboxId}
              aria-expanded={open}
              aria-label="Search Stableflow"
              autoComplete="off"
              className="h-15 min-w-0 flex-1 bg-transparent text-md text-foreground outline-none placeholder:text-muted-foreground"
              maxLength={128}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Search entities, addresses, transactions, assets..."
              ref={inputRef}
              role="combobox"
              spellCheck={false}
              type="text"
              value={query}
            />
            {query.length > 0 ? (
              <button
                aria-label="Clear search"
                className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground"
                onClick={() => setQuery("")}
                type="button"
              >
                <X size={15} />
              </button>
            ) : (
              <DialogPrimitive.Close className="cursor-pointer rounded-sm border border-border bg-surface-2 px-1.5 py-1 font-mono text-2xs text-muted-foreground">
                ESC
              </DialogPrimitive.Close>
            )}
          </div>

          <p aria-live="polite" className="sr-only">
            {resultCountLabel}
          </p>

          <div className="min-h-0 flex-1 overflow-y-auto p-2" id={listboxId} role="listbox">
            {groups.map(({ group, items: groupItems }) => (
              <section aria-label={group} className="mb-2 last:mb-0" key={group}>
                <h2 className="px-2.5 pt-2 pb-1.5 font-mono text-2xs text-muted-foreground uppercase tracking-[0.1em]">
                  {group}
                </h2>
                <div className="flex flex-col gap-0.5">
                  {groupItems.map((item) => (
                    <SearchResultItem
                      active={item.id === activeId}
                      item={item}
                      key={item.id}
                      onHover={setActiveId}
                      onSelect={selectItem}
                    />
                  ))}
                </div>
              </section>
            ))}

            {isSearching && items.length === 0 ? <SearchSkeleton /> : null}

            {!isSearching && normalizedQuery.length > 0 && items.length === 0 ? (
              <div className="flex min-h-48 flex-col items-center justify-center px-6 text-center">
                <div className="mb-3 flex size-10 items-center justify-center rounded-lg border border-border bg-surface-2 text-muted-foreground">
                  <Search size={17} />
                </div>
                <p className="m-0 text-sm font-medium text-foreground">No results found</p>
                <p className="mt-1.5 mb-0 max-w-sm text-sm text-muted-foreground">
                  Try an entity name, token symbol, contract address, or transaction hash.
                </p>
              </div>
            ) : null}

            {searchQuery.isError && normalizedQuery === debouncedQuery ? (
              <div className="m-2 rounded-md border border-anomaly/30 bg-anomaly-soft px-3 py-2.5 text-sm text-foreground">
                Live index results are unavailable. Navigation and asset search still work.
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-4 border-border border-t px-4 py-2.5 font-mono text-2xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Keycap>↑</Keycap>
              <Keycap>↓</Keycap>
              Navigate
            </span>
            <span className="flex items-center gap-1.5">
              <Keycap>↵</Keycap>
              Open
            </span>
            <span className="ml-auto hidden sm:inline">Base · Mainnet</span>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function SearchResultItem({
  active,
  item,
  onHover,
  onSelect,
}: {
  active: boolean;
  item: SearchItem;
  onHover: (id: string) => void;
  onSelect: (item: SearchItem) => void;
}) {
  const Icon = getItemIcon(item);

  return (
    <button
      aria-selected={active}
      className={cn(
        "group flex w-full cursor-pointer items-center gap-3 rounded-lg border-0 bg-transparent px-2.5 py-2.5 text-left transition-colors duration-fast",
        active ? "bg-surface-3 text-foreground" : "text-muted-foreground hover:bg-surface-2",
      )}
      id={optionDomId(item.id)}
      onClick={() => onSelect(item)}
      onMouseMove={() => onHover(item.id)}
      role="option"
      type="button"
    >
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-surface-2 transition-colors",
          active && "border-accent/25 bg-accent-soft text-accent",
        )}
      >
        <Icon size={15} strokeWidth={1.7} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{item.title}</span>
        <span className="mt-0.5 block truncate font-mono text-2xs text-muted-foreground">
          {item.subtitle}
        </span>
      </span>
      {item.external ? (
        <ExternalLink className="shrink-0 opacity-50" size={13} />
      ) : (
        <ArrowRight
          className={cn(
            "shrink-0 transition-[transform,opacity] duration-fast",
            active ? "translate-x-0 opacity-80" : "-translate-x-1 opacity-0",
          )}
          size={14}
        />
      )}
    </button>
  );
}

function SearchSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-1 px-2 py-3">
      {["w-2/5", "w-3/5", "w-1/2"].map((width) => (
        <div className="flex items-center gap-3 rounded-lg px-1 py-2" key={width}>
          <div className="size-8 animate-pulse rounded-md bg-surface-3" />
          <div className="flex flex-1 flex-col gap-2">
            <div className={cn("h-2.5 animate-pulse rounded-full bg-surface-3", width)} />
            <div className="h-2 w-1/3 animate-pulse rounded-full bg-surface-2" />
          </div>
        </div>
      ))}
    </div>
  );
}

function Keycap({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex min-w-5 items-center justify-center rounded-xs border border-border bg-surface-2 px-1 py-0.5 text-2xs text-muted-foreground">
      {children}
    </kbd>
  );
}

function toSearchItem(result: SearchResult): SearchItem {
  switch (result.type) {
    case "entity":
      return {
        group: "Entities",
        href: `/entities/${encodeURIComponent(result.entityId)}`,
        id: `entity:${result.entityId}`,
        keywords: `${result.entityName} ${result.entityId} ${result.category}`,
        kind: "entity",
        subtitle: `${formatCategory(result.category)} · ${result.addressCount.toString()} address${result.addressCount === 1 ? "" : "es"}`,
        title: result.entityName,
      };
    case "address":
      return {
        external: true,
        group: "Addresses",
        href: `https://basescan.org/address/${result.address}`,
        id: `address:${result.address.toLowerCase()}`,
        keywords: `${result.address} ${result.label ?? ""} ${result.entityName ?? ""}`,
        kind: "address",
        subtitle: `${shortHex(result.address)}${result.role ? ` · ${formatCategory(result.role)}` : " · Base address"}`,
        title: result.label ?? result.entityName ?? "Unlabeled address",
      };
    case "transaction":
      return {
        external: true,
        group: "Transactions",
        href: `https://basescan.org/tx/${result.transactionHash}`,
        id: `transaction:${result.transactionHash.toLowerCase()}`,
        keywords: result.transactionHash,
        kind: "transaction",
        subtitle: `${formatAmount(result.amount.formatted)} USDC · Block ${Number(result.blockNumber).toLocaleString("en-US")}`,
        title: shortHex(result.transactionHash, 10, 8),
      };
  }
}

function getItemIcon(item: SearchItem) {
  if (item.id === "page:entities") return Blocks;
  if (item.id === "page:assets") return Coins;

  switch (item.kind) {
    case "page":
      return Home;
    case "asset":
      return CircleDollarSign;
    case "entity":
      return Blocks;
    case "address":
      return WalletCards;
    case "transaction":
      return Hash;
    default:
      return FileText;
  }
}

function scoreSearchItem(item: SearchItem, query: string) {
  const title = item.title.toLowerCase();
  const haystack = `${title} ${item.keywords.toLowerCase()}`;

  if (title === query) return 0;
  if (title.startsWith(query)) return 10;
  if (haystack.split(/\s+/).some((part) => part.startsWith(query))) return 20;
  if (haystack.includes(query)) return 30;
  return null;
}

function useDebouncedValue<T>(value: T, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(timeout);
  }, [delay, value]);

  return debouncedValue;
}

const formatCategory = (value: string) =>
  value
    .split("_")
    .map((part) =>
      part.toLowerCase() === "dex" ? "DEX" : part.charAt(0).toUpperCase() + part.slice(1),
    )
    .join(" ");

const formatAmount = (value: string) =>
  Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 });

const shortHex = (value: string, start = 8, end = 6) =>
  value.length <= start + end + 1 ? value : `${value.slice(0, start)}…${value.slice(-end)}`;

const optionDomId = (id: string) => `search-option-${id.replace(/[^a-z0-9_-]/gi, "-")}`;
