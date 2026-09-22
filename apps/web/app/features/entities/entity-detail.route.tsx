import type {
  EntityAddressLabel,
  EntityCounterpartyFlow,
  EntityDetailAmount,
  EntityDetailResponse,
  EntityDetailSummary,
  EntityFlowSummary,
  LiveTransferParty,
  LiveTransferRow,
} from "@stableflow/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Blocks,
  CircleDotDashed,
  CircleHelp,
  Copy,
  Database,
  ExternalLink,
  Hash,
  Network,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  Link,
  type ShouldRevalidateFunctionArgs,
  useLoaderData,
  useParams,
  useSearchParams,
} from "react-router";
import {
  Amount,
  Entity,
  FlowBar,
  Panel,
  PanelActions,
  PanelBody,
  PanelHead,
  PanelTitle,
  Tag,
  VisualMark,
} from "~/components";
import { AppHeader } from "~/components/header";
import { AppSidebar } from "~/components/sidebar";
import { Button } from "~/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { getApiUrl } from "~/config/api.server";
import { getVisualIdentity } from "~/config/visuals";
import { CATEGORY, type Category } from "~/styles/tokens";
import { cn } from "~/utils/cn";
import { shortAddr } from "~/utils/format";
import {
  appendEntityDetailSearchParams,
  type EntityDetailWindow,
  entityDetailSearchParamNames,
  entityDetailWindowOptions,
  normalizeEntityDetailWindow,
} from "./entity-detail.params";
import {
  entityDetailQueryKey,
  entityDetailRefreshIntervalMs,
  fetchEntityDetail,
  getMatchingInitialEntityDetail,
} from "./entity-detail.query";

type FlowMode = "net";

const entityTransferFreshDurationMs = 900;

export function meta() {
  return [
    { title: "Entity Detail | Stableflow" },
    {
      content: "Entity-level USDC flow intelligence on Base.",
      name: "description",
    },
  ];
}

export async function loader({
  params,
  request,
}: {
  params: { entityId?: string };
  request: Request;
}): Promise<EntityDetailResponse> {
  const entityId = params.entityId;

  if (entityId === undefined) {
    throw new Response("Entity not found", { status: 404 });
  }

  const requestUrl = new URL(request.url);
  const apiUrl = new URL(getApiUrl(`/entities/${encodeURIComponent(entityId)}`));

  appendEntityDetailSearchParams(apiUrl, {
    windowMinutes: normalizeEntityDetailWindow(requestUrl.searchParams.get("windowMinutes")),
  });

  const response = await fetch(apiUrl, {
    headers: {
      accept: "application/json",
    },
    signal: request.signal,
  });

  if (!response.ok) {
    throw new Response(response.status === 404 ? "Entity not found" : "Unable to load entity", {
      status: response.status,
      statusText: response.statusText,
    });
  }

  return response.json() as Promise<EntityDetailResponse>;
}

export function shouldRevalidate({
  currentUrl,
  defaultShouldRevalidate,
  nextUrl,
}: ShouldRevalidateFunctionArgs) {
  if (currentUrl.pathname !== nextUrl.pathname) {
    return defaultShouldRevalidate;
  }

  const currentNonEntityDetailSearch = getSearchWithoutEntityDetailParams(currentUrl);
  const nextNonEntityDetailSearch = getSearchWithoutEntityDetailParams(nextUrl);
  const hasEntityDetailSearchChange = entityDetailSearchParamNames.some(
    (name) => currentUrl.searchParams.get(name) !== nextUrl.searchParams.get(name),
  );

  if (hasEntityDetailSearchChange && currentNonEntityDetailSearch === nextNonEntityDetailSearch) {
    return false;
  }

  return defaultShouldRevalidate;
}

export default function EntityDetail() {
  const initialDetail = useLoaderData<typeof loader>();
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const entityId = params.entityId ?? initialDetail.data.entity.entityId;
  const windowMinutes = normalizeEntityDetailWindow(
    searchParams.get("windowMinutes") ?? initialDetail.meta.window.minutes.toString(),
  );
  const initialData = getMatchingInitialEntityDetail(initialDetail, {
    entityId,
    windowMinutes,
  });
  const detailQuery = useQuery({
    initialData,
    initialDataUpdatedAt:
      initialData === undefined ? undefined : Date.parse(initialData.meta.generatedAt),
    placeholderData: keepPreviousData,
    queryFn: ({ signal }) => fetchEntityDetail({ entityId, signal, windowMinutes }),
    queryKey: entityDetailQueryKey({ entityId, windowMinutes }),
    refetchInterval: entityDetailRefreshIntervalMs,
    retry: 2,
    staleTime: 10_000,
  });
  const detail = detailQuery.data ?? initialDetail;
  const entity = detail.data.entity;
  const flow = detail.data.flow;
  const mode: FlowMode = "net";
  const freshTransferIds = useFreshEntityTransferIds({
    resetKey: `${entityId}:${windowMinutes}`,
    transfers: detail.data.recentTransfers,
  });

  const updateWindow = (nextWindow: EntityDetailWindow) => {
    setSearchParams(
      (currentSearchParams) => {
        const nextSearchParams = new URLSearchParams(currentSearchParams);
        nextSearchParams.set("windowMinutes", nextWindow);

        return nextSearchParams;
      },
      { preventScrollReset: true },
    );
  };

  return (
    <main className="grid min-h-screen grid-cols-[3.5rem_minmax(0,1fr)] bg-background text-foreground">
      <div className="bg-ambient" />
      <div className="bg-grid" />

      <AppSidebar />

      <section
        className="flex min-h-screen min-w-0 flex-col gap-3.5 px-3 pt-4 pb-6 lg:px-6"
        aria-labelledby="entity-title"
      >
        <AppHeader
          backLink={{ label: "Back to Entities", to: "/entities" }}
          breadcrumbs={[{ label: "Entities", to: "/entities" }, { label: entity.entityName }]}
          headingId="entity-app-title"
          searchPlaceholder="Search entities..."
        />

        <EntityHero entity={entity} />

        <div className="flex flex-col gap-3.5">
          <EntityKpiBand flow={flow} onWindowChange={updateWindow} windowMinutes={windowMinutes} />

          <div className="grid gap-3.5 xl:grid-cols-[minmax(0,1.35fr)_minmax(24rem,0.65fr)]">
            <EntityFlowGraph
              counterparties={detail.data.counterparties}
              entity={entity}
              flow={flow}
              mode={mode}
              onWindowChange={updateWindow}
              windowMinutes={windowMinutes}
            />

            <div className="grid min-w-0 gap-3.5 md:grid-cols-2 xl:h-full xl:grid-cols-1">
              <CounterpartiesPanel counterparties={detail.data.counterparties} mode={mode} />
              <EvidencePanel
                className="xl:flex-1"
                labels={detail.data.addressLabels}
                entity={entity}
              />
            </div>
          </div>

          <RecentTransfersPanel
            freshTransferIds={freshTransferIds}
            transfers={detail.data.recentTransfers}
          />
        </div>

        <AddressLabelsPanel labels={detail.data.addressLabels} />

        <footer className="flex flex-col items-start justify-between gap-3 p-1 font-mono text-2xs text-muted-foreground md:flex-row md:items-center">
          <span>Stableflow · v0.1.0</span>
          <Link className="hover:text-accent" to="/methodology">
            Methodology · Base / USDC coverage
          </Link>
          <span>
            {entity.labelCount} labels · {detail.data.counterparties.length} counterparties
          </span>
        </footer>
      </section>
    </main>
  );
}

function useFreshEntityTransferIds({
  resetKey,
  transfers,
}: {
  resetKey: string;
  transfers: LiveTransferRow[];
}) {
  const [freshTransferIds, setFreshTransferIds] = useState<ReadonlySet<string>>(() => new Set());
  const resetKeyRef = useRef(resetKey);
  const transferIdsRef = useRef(getTransferIds(transfers));
  const freshTransferTimeoutsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    return () => {
      for (const timeout of freshTransferTimeoutsRef.current) {
        window.clearTimeout(timeout);
      }
    };
  }, []);

  useEffect(() => {
    if (resetKeyRef.current !== resetKey) {
      resetKeyRef.current = resetKey;
      transferIdsRef.current = getTransferIds(transfers);
      setFreshTransferIds(new Set());

      for (const timeout of freshTransferTimeoutsRef.current) {
        window.clearTimeout(timeout);
      }

      freshTransferTimeoutsRef.current.clear();
      return;
    }

    const nextFreshTransferIds = transfers
      .filter((transfer) => !transferIdsRef.current.has(transfer.id))
      .map((transfer) => transfer.id);

    transferIdsRef.current = getTransferIds(transfers);

    if (nextFreshTransferIds.length === 0) {
      return;
    }

    setFreshTransferIds((currentFreshIds) => {
      return new Set([...currentFreshIds, ...nextFreshTransferIds]);
    });

    const timeout = window.setTimeout(() => {
      freshTransferTimeoutsRef.current.delete(timeout);
      setFreshTransferIds((currentFreshIds) => {
        const nextFreshIds = new Set(currentFreshIds);

        for (const transferId of nextFreshTransferIds) {
          nextFreshIds.delete(transferId);
        }

        return nextFreshIds;
      });
    }, entityTransferFreshDurationMs);

    freshTransferTimeoutsRef.current.add(timeout);
  }, [resetKey, transfers]);

  return freshTransferIds;
}

function EntityHero({ entity }: { entity: EntityDetailSummary }) {
  const [copied, setCopied] = useState(false);
  const category = getKnownCategory(entity.category);
  const glyph = getEntityGlyph(entity.entityName);
  const visual = getVisualIdentity("entity", entity.entityId);

  const copyEntityId = async () => {
    await navigator.clipboard?.writeText(entity.entityId);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <header className="grid gap-4 overflow-hidden rounded-lg border border-border bg-glass p-4 backdrop-blur-xl backdrop-saturate-150 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-start lg:p-5">
      <VisualMark
        className="size-14 rounded-lg font-mono text-xl font-semibold text-background shadow-sm"
        fallback={glyph}
        imageName={visual?.name}
        imageUrl={visual?.imageUrl}
        style={{ background: `var(--cat-${category ?? "wallet"})` }}
      />

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 font-mono text-2xs text-muted-foreground uppercase tracking-[0.08em]">
          <span>Entity registry</span>
          <span className="text-muted-foreground/50">/</span>
          <Tag category={category}>{formatCategory(entity.category)}</Tag>
        </div>

        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
          <h1 id="entity-title" className="m-0 text-2xl font-medium leading-tight tracking-normal">
            {entity.entityName}
          </h1>
          <span className="inline-flex min-w-0 items-center gap-2 rounded-md border border-border bg-surface-2 px-2.5 py-1 font-mono text-xs text-muted-foreground">
            <Hash size={12} />
            <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
              {entity.entityId}
            </span>
          </span>
        </div>

        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <HeroMetric label="Labels" value={formatInteger(entity.labelCount)} />
          <HeroMetric label="Addresses" value={formatInteger(entity.addressCount)} />
          <HeroMetric label="First label block" value={formatBlock(entity.firstSeenBlock)} />
          <HeroMetric label="Latest label block" value={formatBlock(entity.latestSeenBlock)} />
          <HeroMetric
            label="Attribution groups"
            value={formatInteger(entity.attributionGroups.length)}
          />
        </dl>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {entity.roles.slice(0, 6).map((role) => (
            <span
              className="rounded-sm border border-border bg-surface-3 px-2 py-1 font-mono text-2xs text-muted-foreground uppercase tracking-[0.04em]"
              key={role}
            >
              {formatToken(role)}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 lg:justify-end">
        <Button
          className="rounded-full font-mono text-2xs uppercase tracking-[0.04em]"
          onClick={copyEntityId}
          size="sm"
          variant="secondary"
        >
          <Copy size={13} />
          {copied ? "Copied" : "Copy ID"}
        </Button>
        <Button
          asChild
          className="rounded-full font-mono text-2xs uppercase tracking-[0.04em]"
          size="sm"
          variant="outline"
        >
          <a href="#addresses">
            <Database size={13} />
            Labels
          </a>
        </Button>
      </div>
    </header>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[9px] text-muted-foreground uppercase tracking-[0.08em]">
        {label}
      </dt>
      <dd className="m-0 mt-1 truncate font-mono text-sm text-foreground">{value}</dd>
    </div>
  );
}

function EntityKpiBand({
  flow,
  onWindowChange,
  windowMinutes,
}: {
  flow: EntityFlowSummary;
  onWindowChange: (windowMinutes: EntityDetailWindow) => void;
  windowMinutes: EntityDetailWindow;
}) {
  const netValue = amountToNumber(flow.net);

  return (
    <section
      className="overflow-hidden rounded-lg border border-border bg-glass backdrop-blur-xl backdrop-saturate-150"
      aria-label="Entity flow summary"
    >
      <div className="flex items-center justify-start border-border border-b bg-card px-3.5 py-2.5">
        <WindowToggle
          ariaLabel="Flow summary window"
          onWindowChange={onWindowChange}
          windowMinutes={windowMinutes}
        />
      </div>

      <div className="grid md:grid-cols-4">
        <KpiCell
          label="Inflow"
          sub={`${formatInteger(flow.inflowTransferCount)} transfers`}
          tone="inflow"
          value={amountToNumber(flow.inflow)}
        />
        <KpiCell
          label="Outflow"
          sub={`${formatInteger(flow.outflowTransferCount)} transfers`}
          tone="outflow"
          value={amountToNumber(flow.outflow)}
        />
        <KpiCell
          label="Net"
          sub="Inflow minus outflow"
          tone={netValue >= 0 ? "inflow" : "outflow"}
          value={netValue}
        />
        <div className="border-border border-t p-4 md:border-t-0 md:border-l">
          <p className="m-0 font-mono text-2xs text-muted-foreground uppercase tracking-[0.08em]">
            Transfer count
          </p>
          <p className="m-0 mt-1 font-mono text-2xl font-medium tabular-nums">
            {formatInteger(flow.transferCount)}
          </p>
          <p className="m-0 mt-1 font-mono text-2xs text-muted-foreground">
            {formatWindowLabel(flow.window.minutes)} bucket window
          </p>
        </div>
      </div>
    </section>
  );
}

function KpiCell({
  label,
  sub,
  tone,
  value,
}: {
  label: string;
  sub: string;
  tone: "inflow" | "outflow";
  value: number;
}) {
  return (
    <div className="border-border border-t p-4 first:border-t-0 md:border-t-0 md:border-l md:first:border-l-0">
      <p className="m-0 font-mono text-2xs text-muted-foreground uppercase tracking-[0.08em]">
        {label}
      </p>
      <p
        className={cn(
          "m-0 mt-1 text-2xl font-medium tabular-nums",
          tone === "inflow" ? "text-inflow" : "text-outflow",
        )}
      >
        <Amount className="text-2xl" magnitude="small" value={value} />
      </p>
      <p className="m-0 mt-1 font-mono text-2xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function EntityFlowGraph({
  counterparties,
  entity,
  flow,
  mode,
  onWindowChange,
  windowMinutes,
}: {
  counterparties: EntityCounterpartyFlow[];
  entity: EntityDetailSummary;
  flow: EntityFlowSummary;
  mode: FlowMode;
  onWindowChange: (windowMinutes: EntityDetailWindow) => void;
  windowMinutes: EntityDetailWindow;
}) {
  const graphEdges = buildGraphEdges(counterparties, mode);
  const maxEdge = Math.max(...graphEdges.map((edge) => Math.abs(edge.value)), 1);
  const category = getKnownCategory(entity.category);

  return (
    <Panel className="flex min-h-[34rem] flex-col">
      <PanelHead className="flex-wrap gap-3">
        <PanelTitle>
          <Network size={14} />
          Entity Flow Graph
        </PanelTitle>
        <PanelActions className="flex-wrap">
          <WindowToggle
            ariaLabel="Entity graph window"
            onWindowChange={onWindowChange}
            windowMinutes={windowMinutes}
          />
        </PanelActions>
      </PanelHead>

      <div className="relative min-h-[28rem] flex-1 overflow-hidden">
        {graphEdges.length === 0 ? (
          <div className="flex h-full min-h-[28rem] items-center justify-center gap-2 font-mono text-muted-foreground text-xs">
            <CircleDotDashed size={14} />
            No counterparty flow for this window yet.
          </div>
        ) : (
          <svg
            className="absolute inset-0 size-full"
            role="img"
            viewBox="0 0 820 440"
            aria-label={`${entity.entityName} counterparty flow graph`}
          >
            <defs>
              <marker
                id="entity-arrow-inflow"
                markerHeight="8"
                markerWidth="8"
                orient="auto"
                refX="7"
                refY="4"
              >
                <path d="M0,0 L8,4 L0,8 z" fill="var(--inflow)" />
              </marker>
              <marker
                id="entity-arrow-outflow"
                markerHeight="8"
                markerWidth="8"
                orient="auto"
                refX="7"
                refY="4"
              >
                <path d="M0,0 L8,4 L0,8 z" fill="var(--outflow)" />
              </marker>
            </defs>

            {graphEdges.map((edge) => {
              const width = 1.5 + (Math.abs(edge.value) / maxEdge) * 5;
              const stroke = edge.direction === "in" ? "var(--inflow)" : "var(--outflow)";
              const marker =
                edge.direction === "in"
                  ? "url(#entity-arrow-inflow)"
                  : "url(#entity-arrow-outflow)";
              const start = edge.direction === "in" ? edge.point : centerPoint;
              const end = edge.direction === "in" ? centerPoint : edge.point;
              const midX = (start.x + end.x) / 2;
              const midY = (start.y + end.y) / 2;

              return (
                <g key={edge.entityId}>
                  <path
                    d={`M ${start.x} ${start.y} Q ${midX} ${midY - 32} ${end.x} ${end.y}`}
                    fill="none"
                    markerEnd={marker}
                    opacity="0.78"
                    stroke={stroke}
                    strokeLinecap="round"
                    strokeWidth={width}
                  />
                  <text
                    className="fill-muted-foreground font-mono text-[10px]"
                    textAnchor="middle"
                    x={midX}
                    y={midY - 38}
                  >
                    {formatCompact(edge.value)}
                  </text>
                </g>
              );
            })}

            <g>
              <circle
                cx={centerPoint.x}
                cy={centerPoint.y}
                fill={`var(--cat-${category ?? "wallet"}-soft)`}
                r="68"
                stroke={`var(--cat-${category ?? "wallet"})`}
                strokeWidth="2"
              />
              <circle
                cx={centerPoint.x}
                cy={centerPoint.y}
                fill={`var(--cat-${category ?? "wallet"})`}
                r="30"
              />
              <text
                className="fill-background font-mono text-[15px] font-semibold"
                textAnchor="middle"
                x={centerPoint.x}
                y={centerPoint.y + 5}
              >
                {getEntityGlyph(entity.entityName)}
              </text>
              <text
                className="fill-foreground font-mono text-[13px] font-medium"
                textAnchor="middle"
                x={centerPoint.x}
                y={centerPoint.y + 58}
              >
                {truncate(entity.entityName, 18)}
              </text>
              <text
                className="fill-muted-foreground font-mono text-[9px] uppercase tracking-[0.1em]"
                textAnchor="middle"
                x={centerPoint.x}
                y={centerPoint.y + 74}
              >
                {formatCategory(entity.category)}
              </text>
            </g>

            {graphEdges.map((edge) => {
              const edgeCategory = getKnownCategory(edge.category);

              return (
                <a href={`/entities/${edge.entityId}`} key={edge.entityId}>
                  <g className="cursor-pointer">
                    <circle
                      cx={edge.point.x}
                      cy={edge.point.y}
                      fill={`var(--cat-${edgeCategory ?? "wallet"})`}
                      r="22"
                    />
                    <text
                      className="fill-background font-mono text-[10px] font-semibold"
                      textAnchor="middle"
                      x={edge.point.x}
                      y={edge.point.y + 4}
                    >
                      {getEntityGlyph(edge.entityName)}
                    </text>
                    <text
                      className="fill-foreground font-mono text-[11px] font-medium"
                      textAnchor="middle"
                      x={edge.point.x}
                      y={edge.point.y + 38}
                    >
                      {truncate(edge.entityName, 16)}
                    </text>
                    <text
                      className="fill-muted-foreground font-mono text-[8px] uppercase tracking-[0.1em]"
                      textAnchor="middle"
                      x={edge.point.x}
                      y={edge.point.y + 52}
                    >
                      {formatCategory(edge.category)}
                    </text>
                  </g>
                </a>
              );
            })}
          </svg>
        )}

        <div className="absolute bottom-3.5 left-3.5 flex gap-3 rounded-md border border-border bg-card px-3 py-2 font-mono text-2xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-inflow" />
            Inflow
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-outflow" />
            Outflow
          </span>
        </div>

        <div className="absolute top-3.5 right-3.5 rounded-md border border-border bg-card px-3 py-2 text-right font-mono text-2xs text-muted-foreground">
          <div>
            <span className="text-foreground">{counterparties.length}</span> counterparties
          </div>
          <div>
            <span className="text-foreground">
              {formatCompact(amountToNumber(flow.inflow) + amountToNumber(flow.outflow))}
            </span>{" "}
            USDC moved
          </div>
        </div>
      </div>
    </Panel>
  );
}

function CounterpartiesPanel({
  counterparties,
  mode,
}: {
  counterparties: EntityCounterpartyFlow[];
  mode: FlowMode;
}) {
  return (
    <Panel>
      <PanelHead>
        <PanelTitle>
          <Blocks size={14} />
          Top Counterparties
        </PanelTitle>
      </PanelHead>

      <div className="divide-y divide-border">
        {counterparties.map((counterparty) => {
          const category = getKnownCategory(counterparty.category);
          const value = amountToNumber(counterparty.net);
          const trend = value >= 0 ? "net-pos" : "net-neg";

          return (
            <Link
              className="grid min-h-20 grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-foreground no-underline transition-colors hover:bg-surface-2"
              key={counterparty.entityId}
              to={`/entities/${counterparty.entityId}`}
            >
              <span className="font-mono text-sm text-muted-foreground">
                {counterparty.rank.toString().padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <Entity
                  category={category}
                  entityId={counterparty.entityId}
                  glyph={getEntityGlyph(counterparty.entityName)}
                  name={counterparty.entityName}
                />
                <div className="mt-2 flex items-center gap-2 font-mono text-2xs text-muted-foreground">
                  <span>{formatInteger(counterparty.transferCount)} transfers</span>
                  <span className="size-1 rounded-full bg-muted-foreground/50" />
                  <span>{formatCategory(counterparty.category)}</span>
                </div>
                <FlowBar className="mt-2" trend={trend} value={counterparty.relativeShare} />
              </div>
              <div className="text-right">
                <Amount
                  className={trend === "net-pos" ? "text-inflow" : "text-outflow"}
                  magnitude="small"
                  value={value}
                />
                <div className="mt-1 flex items-center justify-end gap-1 font-mono text-2xs text-muted-foreground">
                  {trend === "net-pos" ? <ArrowDownLeft size={12} /> : <ArrowUpRight size={12} />}
                  {mode}
                </div>
              </div>
            </Link>
          );
        })}

        {counterparties.length === 0 && (
          <div className="flex h-40 items-center justify-center gap-2 font-mono text-xs text-muted-foreground">
            <CircleDotDashed size={14} />
            No counterparty flow for this window yet.
          </div>
        )}
      </div>
    </Panel>
  );
}

function RecentTransfersPanel({
  freshTransferIds,
  transfers,
}: {
  freshTransferIds: ReadonlySet<string>;
  transfers: LiveTransferRow[];
}) {
  return (
    <Panel>
      <PanelHead>
        <PanelTitle live>Recent Entity Transfers</PanelTitle>
      </PanelHead>

      <div className="divide-y divide-border lg:hidden">
        {transfers.map((transfer) => (
          <div
            className="px-4 py-3 data-[fresh=true]:animate-[sf-row-in_0.9s_ease-out] motion-reduce:data-[fresh=true]:animate-none"
            data-fresh={freshTransferIds.has(transfer.id) ? "true" : undefined}
            key={transfer.id}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="grid min-w-0 flex-1 gap-2">
                <TransferPartyLine label="From" party={transfer.from} />
                <TransferPartyLine label="To" party={transfer.to} />
              </div>
              <Amount className="shrink-0 text-right" value={amountToNumber(transfer.amount)} />
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-border border-t pt-3 font-mono text-xs text-muted-foreground">
              <span>
                Block {formatBlock(transfer.blockNumber)} · {formatUtcTime(transfer.blockTimestamp)}
              </span>
              <ExternalHashLink hash={transfer.transactionHash} />
            </div>
          </div>
        ))}
        {transfers.length === 0 && <EmptyPanelRow>No recent boundary transfers.</EmptyPanelRow>}
      </div>

      <div className="hidden overflow-x-auto lg:block">
        <Table className="min-w-[760px] table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[27%]" scope="col">
                From
              </TableHead>
              <TableHead className="w-[27%]" scope="col">
                To
              </TableHead>
              <TableHead className="w-[18%] text-right" scope="col">
                Amount
              </TableHead>
              <TableHead className="w-[14%] text-right" scope="col">
                Block
              </TableHead>
              <TableHead className="w-[14%] text-right" scope="col">
                Tx
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transfers.map((transfer) => (
              <TableRow
                data-fresh={freshTransferIds.has(transfer.id) ? "true" : undefined}
                key={transfer.id}
              >
                <TableCell className="min-w-0">
                  <TransferPartyCell party={transfer.from} />
                </TableCell>
                <TableCell className="min-w-0">
                  <TransferPartyCell party={transfer.to} />
                </TableCell>
                <TableCell className="text-right">
                  <Amount value={amountToNumber(transfer.amount)} />
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {formatBlock(transfer.blockNumber)}
                  <div className="mt-1 font-mono text-2xs text-muted-foreground">
                    {formatUtcTime(transfer.blockTimestamp)}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <ExternalHashLink hash={transfer.transactionHash} />
                </TableCell>
              </TableRow>
            ))}
            {transfers.length === 0 && (
              <TableRow>
                <TableCell className="h-32 text-center text-muted-foreground" colSpan={5}>
                  No recent boundary transfers.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </Panel>
  );
}

function TransferPartyLine({ label, party }: { label: "From" | "To"; party: LiveTransferParty }) {
  return (
    <div className="grid min-w-0 grid-cols-[2.75rem_minmax(0,1fr)] items-center gap-2">
      <span className="font-mono text-2xs text-muted-foreground uppercase tracking-[0.06em]">
        {label}
      </span>
      <TransferPartyCell party={party} />
    </div>
  );
}

function TransferPartyCell({ party }: { party: LiveTransferParty }) {
  const category = getKnownCategory(party.category);
  const entity = (
    <Entity
      className="min-w-0 max-w-full [&>span:last-child]:min-w-0 [&>span:last-child]:truncate"
      category={category}
      entityId={party.entityId}
      glyph={party.isIdentified ? getEntityGlyph(party.displayName) : "0x"}
      isWallet={!party.isIdentified}
      name={party.displayName}
    />
  );

  if (party.entityId === null) {
    return entity;
  }

  return (
    <Link
      className="block min-w-0 max-w-full text-foreground no-underline hover:text-accent"
      to={`/entities/${party.entityId}`}
    >
      {entity}
    </Link>
  );
}

function EvidencePanel({
  className,
  labels,
  entity,
}: {
  className?: string;
  labels: EntityAddressLabel[];
  entity: EntityDetailSummary;
}) {
  const confidence = countBy(labels, (label) => label.confidence);
  const sourceTypes = countBy(labels, (label) => label.sourceType);
  const policies = countBy(labels, (label) => label.countingPolicy);

  return (
    <Panel className={cn("flex flex-col", className)}>
      <PanelHead>
        <PanelTitle>
          <ShieldCheck size={14} />
          Label Evidence
        </PanelTitle>
      </PanelHead>
      <PanelBody className="flex-1 space-y-4">
        <EvidenceStack
          label="Confidence"
          segments={[
            { color: "var(--inflow)", label: "High", value: confidence.high ?? 0 },
            { color: "var(--accent)", label: "Medium", value: confidence.medium ?? 0 },
            { color: "var(--outflow)", label: "Candidate", value: confidence.candidate ?? 0 },
          ]}
        />
        <EvidenceStack
          label="Source type"
          segments={[
            {
              color: "var(--muted-foreground)",
              label: "Static config",
              value: sourceTypes.static_config ?? 0,
            },
            {
              color: "var(--inflow)",
              label: "Factory event",
              value: sourceTypes.factory_event ?? 0,
            },
            {
              color: "var(--accent)",
              label: "On-chain state",
              value: sourceTypes.onchain_state ?? 0,
            },
          ]}
        />
        <EvidenceStack
          label="Counting policy"
          segments={[
            { color: "var(--accent)", label: "Boundary", value: policies.boundary ?? 0 },
            {
              color: "var(--inflow)",
              label: "Discovery source",
              value: policies.discovery_source ?? 0,
            },
            { color: "var(--muted-foreground)", label: "Internal", value: policies.internal ?? 0 },
            { color: "var(--outflow)", label: "Ignore", value: policies.ignore ?? 0 },
          ]}
        />
        <div className="grid grid-cols-2 gap-3 border-border border-t pt-4 font-mono text-2xs">
          <EvidenceMetric
            label="Attribution groups"
            value={formatInteger(entity.attributionGroups.length)}
          />
          <EvidenceMetric
            label="Source events"
            value={formatInteger(new Set(labels.map((label) => label.sourceEvent)).size)}
          />
        </div>
      </PanelBody>
    </Panel>
  );
}

function EvidenceStack({
  label,
  segments,
}: {
  label: string;
  segments: { color: string; label: string; value: number }[];
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between font-mono text-[9px] text-muted-foreground uppercase tracking-[0.08em]">
        <span>{label}</span>
        <span>{formatInteger(total)} labels</span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-surface-2">
        {segments.map((segment) => (
          <div
            key={segment.label}
            className={segment.value === 0 ? "hidden" : undefined}
            style={{
              background: segment.color,
              width: `${(segment.value / Math.max(total, 1)) * 100}%`,
            }}
          />
        ))}
      </div>
      <div className="mt-2 grid gap-1 font-mono text-2xs text-muted-foreground">
        {segments
          .filter((segment) => segment.value > 0)
          .map((segment) => (
            <div className="flex items-center gap-2" key={segment.label}>
              <span className="size-2 rounded-sm" style={{ background: segment.color }} />
              <span className="flex-1 text-foreground">{segment.label}</span>
              <span>{formatInteger(segment.value)}</span>
            </div>
          ))}
      </div>
    </div>
  );
}

function EvidenceMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted-foreground uppercase tracking-[0.08em]">{label}</div>
      <div className="mt-1 text-sm text-foreground">{value}</div>
    </div>
  );
}

function AddressLabelsPanel({ labels }: { labels: EntityAddressLabel[] }) {
  return (
    <Panel id="addresses">
      <PanelHead>
        <PanelTitle>
          <Database size={14} />
          Addresses And Labels
        </PanelTitle>
        <PanelActions>
          <span className="rounded-full border border-border bg-surface-2 px-2.5 py-1 font-mono text-2xs text-muted-foreground uppercase tracking-[0.04em]">
            {formatInteger(labels.length)} labels
          </span>
        </PanelActions>
      </PanelHead>
      <div className="overflow-x-auto">
        <Table className="min-w-[1080px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[23%]" scope="col">
                <DefinitionHeader
                  description="The Base address that has been attributed to this entity."
                  label="Address"
                />
              </TableHead>
              <TableHead className="w-[11%]" scope="col">
                <DefinitionHeader
                  description="What this address does inside the entity, such as a pool, vault, factory, or token contract."
                  label="Role"
                />
              </TableHead>
              <TableHead className="w-[10%]" scope="col">
                <DefinitionHeader
                  description="How strong the attribution evidence is for this address label."
                  label="Confidence"
                />
              </TableHead>
              <TableHead className="w-[13%]" scope="col">
                <DefinitionHeader
                  description="The type of evidence used to discover or verify the label."
                  label="Source"
                />
              </TableHead>
              <TableHead className="w-[15%]" scope="col">
                <DefinitionHeader
                  description="The specific contract event, call, or indexed signal that produced the label."
                  label="Event"
                />
              </TableHead>
              <TableHead className="w-[13%]" scope="col">
                <DefinitionHeader
                  description="How Stableflow should treat this address when computing entity-level flow."
                  label="Policy"
                />
              </TableHead>
              <TableHead className="w-[8%] text-right" scope="col">
                <DefinitionHeader
                  align="right"
                  description="The first Base block where this label evidence was observed."
                  label="First block"
                />
              </TableHead>
              <TableHead className="w-[7%] text-right" scope="col">
                <DefinitionHeader
                  align="right"
                  description="The transaction hash for the evidence row when the label came from a transaction log."
                  label="Tx"
                />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {labels.map((label) => (
              <TableRow key={label.address}>
                <TableCell>
                  <ExternalAddressLink address={label.address} />
                  <div className="mt-1 font-mono text-xs text-muted-foreground">
                    group:{" "}
                    <DefinitionValue
                      className="text-xs text-muted-foreground"
                      description={getAttributionGroupDescription(label.attributionGroup)}
                      value={label.attributionGroup}
                    />
                  </div>
                </TableCell>
                <TableCell>
                  <DefinitionValue
                    description={getRoleDescription(label.role)}
                    value={formatToken(label.role)}
                  />
                </TableCell>
                <TableCell>
                  <ConfidencePill confidence={label.confidence} />
                </TableCell>
                <TableCell>
                  <DefinitionValue
                    description={getSourceTypeDescription(label.sourceType)}
                    value={formatToken(label.sourceType)}
                  />
                </TableCell>
                <TableCell>
                  <DefinitionValue
                    description={getSourceEventDescription(label.sourceEvent)}
                    value={label.sourceEvent}
                  />
                </TableCell>
                <TableCell>
                  <DefinitionValue
                    description={getCountingPolicyDescription(label.countingPolicy)}
                    value={formatToken(label.countingPolicy)}
                  />
                </TableCell>
                <TableCell className="text-right font-mono text-sm text-muted-foreground">
                  {formatBlock(label.firstSeenBlock)}
                </TableCell>
                <TableCell className="text-right">
                  {label.transactionHash === null ? (
                    <span className="font-mono text-sm text-muted-foreground">Static</span>
                  ) : (
                    <ExternalHashLink hash={label.transactionHash} />
                  )}
                </TableCell>
              </TableRow>
            ))}
            {labels.length === 0 && (
              <TableRow>
                <TableCell className="h-32 text-center text-muted-foreground" colSpan={8}>
                  No address labels for this entity.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </Panel>
  );
}

function WindowToggle({
  ariaLabel,
  onWindowChange,
  windowMinutes,
}: {
  ariaLabel: string;
  onWindowChange: (windowMinutes: EntityDetailWindow) => void;
  windowMinutes: EntityDetailWindow;
}) {
  return (
    <ToggleGroup
      aria-label={ariaLabel}
      type="single"
      value={windowMinutes}
      onValueChange={(nextWindow) => {
        if (isEntityDetailWindow(nextWindow) && nextWindow !== windowMinutes) {
          onWindowChange(nextWindow);
        }
      }}
    >
      {entityDetailWindowOptions.map((option) => (
        <ToggleGroupItem key={option.value} value={option.value}>
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

function EmptyPanelRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-32 items-center justify-center gap-2 font-mono text-muted-foreground text-xs">
      <CircleDotDashed size={14} />
      {children}
    </div>
  );
}

function DefinitionHeader({
  align = "left",
  description,
  label,
}: {
  align?: "left" | "right";
  description: string;
  label: string;
}) {
  return (
    <span
      className={cn("inline-flex w-full items-center gap-1.5", align === "right" && "justify-end")}
    >
      <span>{label}</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            aria-label={`${label} definition`}
            className="inline-flex size-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            type="button"
          >
            <CircleHelp size={12} />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-72 text-left font-sans text-xs normal-case leading-relaxed tracking-normal">
          {description}
        </TooltipContent>
      </Tooltip>
    </span>
  );
}

function DefinitionValue({
  className,
  description,
  value,
}: {
  className?: string;
  description: string;
  value: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          className={cn(
            "inline-flex max-w-full cursor-help items-center rounded-sm text-left font-mono text-sm text-foreground underline decoration-border decoration-dotted underline-offset-4 transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className,
          )}
          type="button"
        >
          <span className="truncate">{value}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-80 text-left font-sans text-xs normal-case leading-relaxed tracking-normal">
        {description}
      </TooltipContent>
    </Tooltip>
  );
}

function ConfidencePill({ confidence }: { confidence: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          className={cn(
            "rounded-full border px-2 py-1 font-mono text-2xs uppercase tracking-[0.04em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            confidence === "high" && "border-inflow/35 bg-inflow-soft text-inflow",
            confidence === "medium" && "border-accent/35 bg-accent-soft text-accent",
            confidence === "candidate" && "border-outflow/35 bg-outflow-soft text-outflow",
            !["candidate", "high", "medium"].includes(confidence) &&
              "border-border bg-surface-2 text-muted-foreground",
          )}
          type="button"
        >
          {formatToken(confidence)}
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-72 text-left font-sans text-xs normal-case leading-relaxed tracking-normal">
        {getConfidenceDescription(confidence)}
      </TooltipContent>
    </Tooltip>
  );
}

function ExternalAddressLink({ address }: { address: string }) {
  return (
    <a
      className="inline-flex items-center gap-1.5 font-mono text-sm text-foreground no-underline hover:text-accent"
      href={`https://basescan.org/address/${address}`}
      rel="noreferrer"
      target="_blank"
    >
      {shortAddr(address)}
      <ExternalLink size={11} />
    </a>
  );
}

function ExternalHashLink({ hash }: { hash: string }) {
  return (
    <a
      className="inline-flex items-center justify-end gap-1 font-mono text-sm text-muted-foreground no-underline hover:text-accent"
      href={`https://basescan.org/tx/${hash}`}
      rel="noreferrer"
      target="_blank"
    >
      {shortHash(hash)}
      <ExternalLink size={11} />
    </a>
  );
}

const centerPoint = { x: 410, y: 220 };

const graphPoints = [
  { x: 150, y: 95 },
  { x: 650, y: 90 },
  { x: 135, y: 325 },
  { x: 665, y: 320 },
  { x: 410, y: 58 },
  { x: 410, y: 382 },
];
const fallbackGraphPoint = { x: 150, y: 95 };

function buildGraphEdges(counterparties: EntityCounterpartyFlow[], _mode: FlowMode) {
  return counterparties.slice(0, 6).flatMap((counterparty, index) => {
    const value = amountToNumber(counterparty.net);

    if (value === 0) {
      return [];
    }

    return [
      {
        ...counterparty,
        direction: value >= 0 ? ("in" as const) : ("out" as const),
        point: graphPoints[index] ?? fallbackGraphPoint,
        value,
      },
    ];
  });
}

function amountToNumber(amount: Pick<EntityDetailAmount, "formatted">) {
  const value = Number(amount.formatted);

  return Number.isFinite(value) ? value : 0;
}

const getTransferIds = (transfers: LiveTransferRow[]) =>
  new Set(transfers.map((transfer) => transfer.id));

function getAttributionGroupDescription(group: string) {
  return `${formatToken(group)} is the attribution namespace that tied this address to the selected entity.`;
}

function getConfidenceDescription(confidence: string) {
  if (confidence === "high") {
    return "High confidence means the label came from strong deterministic evidence, such as an emitted factory event, static protocol config, or verified protocol state.";
  }

  if (confidence === "medium") {
    return "Medium confidence means the label is supported by useful evidence but may need additional corroboration before it is treated as fully deterministic.";
  }

  if (confidence === "candidate") {
    return "Candidate means the address is useful to review, but the attribution should not be treated as final without more evidence.";
  }

  return `${formatToken(confidence)} is the confidence value attached to this label.`;
}

function getCountingPolicyDescription(policy: string) {
  if (policy === "boundary") {
    return "Boundary addresses are counted as entity edges where USDC enters or exits the entity.";
  }

  if (policy === "discovery_source") {
    return "Discovery source addresses help find or verify other labels, but are not normally counted as entity flow boundaries.";
  }

  if (policy === "internal") {
    return "Internal addresses belong to the entity but are usually excluded from external flow boundaries.";
  }

  if (policy === "ignore") {
    return "Ignored addresses are known but intentionally excluded from flow accounting because they are noisy, helper-like, or not useful as entity boundaries.";
  }

  return `${formatToken(policy)} is the flow accounting policy attached to this label.`;
}

function getRoleDescription(role: string) {
  const descriptions: Record<string, string> = {
    a_token: "Aave interest-bearing token contract representing supplied USDC.",
    bridge: "Bridge contract where USDC enters or leaves Base.",
    core: "Core protocol contract for the entity.",
    counterparty:
      "An address represented as a counterparty label rather than a protocol-specific role.",
    factory: "Contract that creates or registers protocol instances.",
    factory_registry: "Registry contract used to discover factories or related protocol addresses.",
    message_passer: "System contract that records messages leaving Base.",
    message_transmitter: "Circle CCTP contract that receives or verifies cross-chain messages.",
    messenger: "Bridge messaging contract used to relay cross-chain instructions.",
    permit: "Approval helper contract used by routers or protocol flows.",
    pool: "Protocol pool contract where USDC activity is observed.",
    pool_instance: "Liquidity pool contract created by a protocol factory.",
    position_manager: "Contract used to manage concentrated liquidity positions.",
    predeploy: "Base system predeploy contract.",
    quoter: "Read-only quote helper, usually excluded from flow accounting.",
    router:
      "Protocol router contract that users or contracts call to move USDC through the protocol.",
    stable_debt_token: "Aave debt token contract representing stable-rate borrowed USDC.",
    token: "Token contract for the asset itself.",
    token_messenger: "Circle CCTP contract that initiates bridge burns and messages.",
    variable_debt_token: "Aave debt token contract representing variable-rate borrowed USDC.",
    vault: "Protocol vault contract where users deposit, withdraw, or route USDC.",
    voter:
      "Governance or routing contract used by the protocol, normally treated as internal evidence.",
  };

  return (
    descriptions[role] ??
    `${formatToken(role)} is the role assigned to this address inside the entity.`
  );
}

function getSourceEventDescription(sourceEvent: string) {
  const descriptions: Record<string, string> = {
    CreateMetaMorpho: "A Morpho factory event indicating a vault was created.",
    DepositForBurn: "A Circle CCTP event indicating USDC was burned to bridge value across chains.",
    MessageReceived: "A Circle CCTP event indicating a cross-chain message was received.",
    PoolCreated: "A DEX factory event indicating a new liquidity pool was created.",
    "USDC Transfer counterparty pattern":
      "A derived signal from repeated USDC transfer activity involving this address.",
    "base-address-labels": "A static protocol label bundled with Stableflow's indexer.",
    factory: "A protocol state call used to identify a factory contract.",
    "factory()": "A protocol state call used to identify a factory contract.",
    "factoryRegistry()": "A protocol state call used to identify the factory registry contract.",
    "getReserveData(USDC)": "An Aave protocol state call used to identify USDC reserve contracts.",
    "marketParams()": "A Morpho protocol state call used to identify market configuration.",
    top_unidentified_usdc_counterparty:
      "A derived candidate signal from high-volume USDC counterparty activity.",
    "voter()": "A protocol state call used to identify the voter contract.",
  };

  return (
    descriptions[sourceEvent] ??
    `${sourceEvent} is the specific event, call, or signal that produced this label.`
  );
}

function getSourceTypeDescription(sourceType: string) {
  if (sourceType === "static_config") {
    return "Static config means the label is a maintained protocol address included with Stableflow's indexer.";
  }

  if (sourceType === "factory_event") {
    return "Factory event means the label came from an indexed contract event emitted by a protocol factory.";
  }

  if (sourceType === "onchain_state") {
    return "On-chain state means the label came from reading protocol contract state or a deterministic protocol method.";
  }

  return `${formatToken(sourceType)} is the evidence source type attached to this label.`;
}

function getKnownCategory(category: string): Category | undefined {
  if (category === "stablecoin_issuer") {
    return "mint";
  }

  return category in CATEGORY ? (category as Category) : undefined;
}

function getEntityGlyph(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  const first = parts.at(0)?.at(0) ?? "?";
  const second = parts.length > 1 ? parts.at(1)?.at(0) : undefined;

  return `${first}${second ?? ""}`.toUpperCase();
}

function formatCategory(category: string) {
  if (category === "cex") {
    return "CEX";
  }

  if (category === "dex") {
    return "DEX";
  }

  if (category === "stablecoin_issuer") {
    return "Stablecoin issuer";
  }

  return formatToken(category);
}

function formatToken(value: string) {
  return value
    .split(/[_-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatWindowLabel(windowMinutes: number | string) {
  if (windowMinutes.toString() === "1440") {
    return "24h";
  }

  if (windowMinutes.toString() === "60") {
    return "1h";
  }

  return `${windowMinutes}m`;
}

function isEntityDetailWindow(value: string): value is EntityDetailWindow {
  return value === "5" || value === "60" || value === "1440";
}

function countBy<T extends string>(
  items: EntityAddressLabel[],
  getKey: (item: EntityAddressLabel) => T,
) {
  return items.reduce<Record<T, number>>(
    (counts, item) => {
      const key = getKey(item);
      counts[key] = (counts[key] ?? 0) + 1;

      return counts;
    },
    {} as Record<T, number>,
  );
}

function formatCompact(value: number) {
  const sign = value < 0 ? "-" : "";
  const absolute = Math.abs(value);

  if (absolute >= 1_000_000_000) {
    return `${sign}${(absolute / 1_000_000_000).toFixed(1)}B`;
  }

  if (absolute >= 1_000_000) {
    return `${sign}${(absolute / 1_000_000).toFixed(1)}M`;
  }

  if (absolute >= 1_000) {
    return `${sign}${(absolute / 1_000).toFixed(0)}K`;
  }

  return `${sign}${absolute.toFixed(0)}`;
}

function formatInteger(value: number) {
  return Math.trunc(value).toLocaleString("en-US");
}

function formatBlock(value: string | null) {
  if (value === null) {
    return "-";
  }

  const numeric = Number(value);

  return Number.isFinite(numeric) ? numeric.toLocaleString("en-US") : value;
}

function shortHash(hash: string) {
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

function formatUtcTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.valueOf())) {
    return value;
  }

  return `${date.getUTCHours().toString().padStart(2, "0")}:${date
    .getUTCMinutes()
    .toString()
    .padStart(2, "0")} UTC`;
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}

const getSearchWithoutEntityDetailParams = (url: URL) => {
  const params = new URLSearchParams(url.search);

  for (const name of entityDetailSearchParamNames) {
    params.delete(name);
  }

  params.sort();

  return params.toString();
};
