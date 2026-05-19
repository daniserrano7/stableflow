import type { EntityCategory } from "@stableflow/shared";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Blocks,
  CircleHelp,
  Copy,
  Database,
  ExternalLink,
  Hash,
  Network,
  ShieldCheck,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router";
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
import { CATEGORY, type Category } from "~/styles/tokens";
import { cn } from "~/utils/cn";
import { shortAddr } from "~/utils/format";

type FlowMode = "net" | "inflow" | "outflow";
type WindowMinutes = "5" | "60" | "1440";
type Confidence = "candidate" | "high" | "medium";
type CountingPolicy = "boundary" | "discovery_source" | "ignore" | "internal";
type SourceType = "factory_event" | "onchain_state";

interface EntityProfile {
  addressLabels: AddressLabelRow[];
  attributionGroups: string[];
  category: EntityCategory;
  counterparties: CounterpartyRow[];
  entityId: string;
  entityName: string;
  firstSeenBlock: string;
  flowWindows: Record<WindowMinutes, FlowWindow>;
  labelCount: number;
  latestLabelBlock: string;
  recentTransfers: RecentEntityTransfer[];
  roles: string[];
  sourceTypes: SourceType[];
}

interface FlowWindow {
  bucketEnd: string;
  bucketStart: string;
  inflow: number;
  inflowTransferCount: number;
  outflow: number;
  outflowTransferCount: number;
}

interface CounterpartyRow {
  category: EntityCategory;
  entityId: string;
  entityName: string;
  inflow: number;
  outflow: number;
  transferCount: number;
}

interface AddressLabelRow {
  address: string;
  attributionGroup: string;
  confidence: Confidence;
  countingPolicy: CountingPolicy;
  firstSeenBlock: string;
  logIndex: number;
  role: string;
  sourceAddress: string;
  sourceEvent: string;
  sourceType: SourceType;
  transactionHash: string;
}

interface RecentEntityTransfer {
  amount: number;
  blockNumber: string;
  blockTimestamp: string;
  from: TransferParty;
  logIndex: number;
  to: TransferParty;
  transactionHash: string;
}

interface TransferParty {
  address: string;
  category: EntityCategory;
  displayName: string;
  entityId: string | null;
  isIdentified: boolean;
}

const windowOptions: { label: string; value: WindowMinutes }[] = [
  { label: "5m", value: "5" },
  { label: "1h", value: "60" },
  { label: "24h", value: "1440" },
];

const knownEntities = {
  "aave-v3": { category: "lending", entityName: "Aave V3" },
  across: { category: "bridge", entityName: "Across" },
  aerodrome: { category: "dex", entityName: "Aerodrome" },
  "base-native-bridge": {
    category: "bridge",
    entityName: "Base Native Bridge",
  },
  circle: { category: "stablecoin_issuer", entityName: "Circle" },
  "circle-cctp": { category: "bridge", entityName: "Circle CCTP" },
  "compound-v3": { category: "lending", entityName: "Compound V3" },
  "morpho-blue": { category: "lending", entityName: "Morpho Blue" },
  "pancakeswap-v3": { category: "dex", entityName: "PancakeSwap V3" },
  "uniswap-v3": { category: "dex", entityName: "Uniswap V3" },
} satisfies Record<string, { category: EntityCategory; entityName: string }>;

export function meta() {
  return [
    { title: "Entity Detail | Stableflow" },
    {
      content: "Entity-level USDC flow intelligence on Base.",
      name: "description",
    },
  ];
}

export default function EntityDetail() {
  const params = useParams();
  const entityId = params.entityId ?? "aerodrome";
  const profile = useMemo(() => buildEntityProfile(entityId), [entityId]);
  const [windowMinutes, setWindowMinutes] = useState<WindowMinutes>("60");
  const mode: FlowMode = "net";
  const flow = profile.flowWindows[windowMinutes];
  const net = flow.inflow - flow.outflow;
  const transferCount = flow.inflowTransferCount + flow.outflowTransferCount;

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
          eyebrow="Entities / Base · USDC"
          headingId="entity-app-title"
          searchPlaceholder="Search entity, address, tx hash..."
          title="Stableflow"
        />

        <EntityHero profile={profile} />

        <EntityKpiBand
          flow={flow}
          net={net}
          onWindowChange={setWindowMinutes}
          transferCount={transferCount}
          windowMinutes={windowMinutes}
        />

        <div className="grid gap-3.5 xl:grid-cols-[minmax(0,1.35fr)_minmax(24rem,0.65fr)]">
          <EntityFlowGraph
            mode={mode}
            onWindowChange={setWindowMinutes}
            profile={profile}
            windowFlow={flow}
            windowMinutes={windowMinutes}
          />

          <div className="flex min-w-0 flex-col gap-3.5 xl:h-full">
            <CounterpartiesPanel counterparties={profile.counterparties} mode={mode} />
            <EvidencePanel className="xl:flex-1" labels={profile.addressLabels} profile={profile} />
          </div>
        </div>

        <RecentTransfersPanel transfers={profile.recentTransfers} />
        <AddressLabelsPanel labels={profile.addressLabels} />

        <footer className="flex flex-col items-start justify-between gap-3 p-1 font-mono text-2xs text-muted-foreground md:flex-row md:items-center">
          <span>Stableflow · v0.1.0</span>
          <span>Scope: Base + USDC</span>
          <span>
            {profile.labelCount} labels · {profile.counterparties.length} counterparties
          </span>
        </footer>
      </section>
    </main>
  );
}

function EntityHero({ profile }: { profile: EntityProfile }) {
  const [copied, setCopied] = useState(false);
  const category = getKnownCategory(profile.category);
  const glyph = getEntityGlyph(profile.entityName);

  const copyEntityId = async () => {
    await navigator.clipboard?.writeText(profile.entityId);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <header className="grid gap-4 overflow-hidden rounded-lg border border-border bg-glass p-4 backdrop-blur-xl backdrop-saturate-150 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-start lg:p-5">
      <div
        className="flex size-14 items-center justify-center rounded-lg font-mono text-xl font-semibold text-background shadow-sm"
        style={{ background: `var(--cat-${category ?? "wallet"})` }}
        aria-hidden
      >
        {glyph}
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 font-mono text-2xs text-muted-foreground uppercase tracking-[0.08em]">
          <span>Entity registry</span>
          <span className="text-muted-foreground/50">/</span>
          <Tag category={category}>{formatCategory(profile.category)}</Tag>
        </div>

        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
          <h1 id="entity-title" className="m-0 text-2xl font-medium leading-tight tracking-normal">
            {profile.entityName}
          </h1>
          <span className="inline-flex min-w-0 items-center gap-2 rounded-md border border-border bg-surface-2 px-2.5 py-1 font-mono text-xs text-muted-foreground">
            <Hash size={12} />
            <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
              {profile.entityId}
            </span>
          </span>
        </div>

        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <HeroMetric label="Labels" value={formatInteger(profile.labelCount)} />
          <HeroMetric label="Addresses" value={formatInteger(profile.addressLabels.length)} />
          <HeroMetric
            label="First label block"
            value={formatIntegerString(profile.firstSeenBlock)}
          />
          <HeroMetric
            label="Latest label block"
            value={formatIntegerString(profile.latestLabelBlock)}
          />
          <HeroMetric
            label="Attribution groups"
            value={formatInteger(profile.attributionGroups.length)}
          />
        </dl>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {profile.roles.slice(0, 6).map((role) => (
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
  net,
  onWindowChange,
  transferCount,
  windowMinutes,
}: {
  flow: FlowWindow;
  net: number;
  onWindowChange: (windowMinutes: WindowMinutes) => void;
  transferCount: number;
  windowMinutes: WindowMinutes;
}) {
  return (
    <section
      className="overflow-hidden rounded-lg border border-border bg-glass backdrop-blur-xl backdrop-saturate-150"
      aria-label="Entity flow summary"
    >
      <div className="flex items-center justify-end border-border border-b bg-card px-3.5 py-2.5">
        <ToggleGroup
          aria-label="Flow summary window"
          type="single"
          value={windowMinutes}
          onValueChange={(nextWindow) => {
            if (isWindowMinutes(nextWindow)) {
              onWindowChange(nextWindow);
            }
          }}
        >
          {windowOptions.map((option) => (
            <ToggleGroupItem key={option.value} value={option.value}>
              {option.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="grid md:grid-cols-4">
        <KpiCell
          label="Inflow"
          sub={`${formatInteger(flow.inflowTransferCount)} transfers`}
          tone="inflow"
          value={flow.inflow}
        />
        <KpiCell
          label="Outflow"
          sub={`${formatInteger(flow.outflowTransferCount)} transfers`}
          tone="outflow"
          value={flow.outflow}
        />
        <KpiCell
          label="Net"
          sub="Inflow minus outflow"
          tone={net >= 0 ? "inflow" : "outflow"}
          value={net}
        />
        <div className="border-border border-t p-4 md:border-t-0 md:border-l">
          <p className="m-0 font-mono text-2xs text-muted-foreground uppercase tracking-[0.08em]">
            Transfer count
          </p>
          <p className="m-0 mt-1 font-mono text-2xl font-medium tabular-nums">
            {formatInteger(transferCount)}
          </p>
          <p className="m-0 mt-1 font-mono text-2xs text-muted-foreground">
            {formatWindowLabel(windowMinutes)} bucket window
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
  mode,
  onWindowChange,
  profile,
  windowFlow,
  windowMinutes,
}: {
  mode: FlowMode;
  onWindowChange: (windowMinutes: WindowMinutes) => void;
  profile: EntityProfile;
  windowFlow: FlowWindow;
  windowMinutes: WindowMinutes;
}) {
  const graphEdges = buildGraphEdges(profile.counterparties, mode);
  const maxEdge = Math.max(...graphEdges.map((edge) => Math.abs(edge.value)), 1);
  const category = getKnownCategory(profile.category);

  return (
    <Panel className="flex min-h-[34rem] flex-col">
      <PanelHead className="flex-wrap gap-3">
        <PanelTitle>
          <Network size={14} />
          Entity Flow Graph
        </PanelTitle>
        <PanelActions className="flex-wrap">
          <ToggleGroup
            aria-label="Entity graph window"
            type="single"
            value={windowMinutes}
            onValueChange={(nextWindow) => {
              if (isWindowMinutes(nextWindow)) {
                onWindowChange(nextWindow);
              }
            }}
          >
            {windowOptions.map((option) => (
              <ToggleGroupItem key={option.value} value={option.value}>
                {option.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </PanelActions>
      </PanelHead>

      <div className="relative min-h-[28rem] flex-1 overflow-hidden">
        <svg
          className="absolute inset-0 size-full"
          role="img"
          viewBox="0 0 820 440"
          aria-label={`${profile.entityName} counterparty flow graph`}
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
              edge.direction === "in" ? "url(#entity-arrow-inflow)" : "url(#entity-arrow-outflow)";
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
              {getEntityGlyph(profile.entityName)}
            </text>
            <text
              className="fill-foreground font-mono text-[13px] font-medium"
              textAnchor="middle"
              x={centerPoint.x}
              y={centerPoint.y + 58}
            >
              {truncate(profile.entityName, 18)}
            </text>
            <text
              className="fill-muted-foreground font-mono text-[9px] uppercase tracking-[0.1em]"
              textAnchor="middle"
              x={centerPoint.x}
              y={centerPoint.y + 74}
            >
              {formatCategory(profile.category)}
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

        <div className="absolute left-3.5 bottom-3.5 flex gap-3 rounded-md border border-border bg-card px-3 py-2 font-mono text-2xs text-muted-foreground">
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
            <span className="text-foreground">{graphEdges.length}</span> counterparties
          </div>
          <div>
            <span className="text-foreground">
              {formatCompact(windowFlow.inflow + windowFlow.outflow)}
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
  counterparties: CounterpartyRow[];
  mode: FlowMode;
}) {
  const ranked = [...counterparties]
    .sort(
      (a, b) => Math.abs(getCounterpartyValue(b, mode)) - Math.abs(getCounterpartyValue(a, mode)),
    )
    .slice(0, 6);
  const maxValue = Math.max(
    ...ranked.map((counterparty) => Math.abs(getCounterpartyValue(counterparty, mode))),
    1,
  );

  return (
    <Panel>
      <PanelHead>
        <PanelTitle>
          <Blocks size={14} />
          Top Counterparties
        </PanelTitle>
      </PanelHead>

      <div className="divide-y divide-border">
        {ranked.map((counterparty, index) => {
          const category = getKnownCategory(counterparty.category);
          const value = getCounterpartyValue(counterparty, mode);
          const trend = getCounterpartyTrend(counterparty, mode);
          const share = (Math.abs(value) / maxValue) * 100;

          return (
            <Link
              className="grid min-h-20 grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-foreground no-underline transition-colors hover:bg-surface-2"
              key={counterparty.entityId}
              to={`/entities/${counterparty.entityId}`}
            >
              <span className="font-mono text-sm text-muted-foreground">
                {(index + 1).toString().padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <Entity
                  category={category}
                  glyph={getEntityGlyph(counterparty.entityName)}
                  name={counterparty.entityName}
                />
                <div className="mt-2 flex items-center gap-2 font-mono text-2xs text-muted-foreground">
                  <span>{formatInteger(counterparty.transferCount)} transfers</span>
                  <span className="size-1 rounded-full bg-muted-foreground/50" />
                  <span>{formatCategory(counterparty.category)}</span>
                </div>
                <FlowBar className="mt-2" trend={trend} value={share} />
              </div>
              <div className="text-right">
                <Amount
                  className={
                    trend === "inflow" || trend === "net-pos" ? "text-inflow" : "text-outflow"
                  }
                  magnitude="small"
                  value={value}
                />
                <div className="mt-1 flex items-center justify-end gap-1 font-mono text-2xs text-muted-foreground">
                  {trend === "inflow" || trend === "net-pos" ? (
                    <ArrowDownLeft size={12} />
                  ) : (
                    <ArrowUpRight size={12} />
                  )}
                  {mode}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </Panel>
  );
}

function RecentTransfersPanel({ transfers }: { transfers: RecentEntityTransfer[] }) {
  return (
    <Panel>
      <PanelHead>
        <PanelTitle live>Recent Entity Transfers</PanelTitle>
      </PanelHead>

      <div className="divide-y divide-border lg:hidden">
        {transfers.map((transfer) => (
          <div className="px-4 py-3" key={`${transfer.transactionHash}-${transfer.logIndex}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="grid min-w-0 flex-1 gap-2">
                <TransferPartyLine label="From" party={transfer.from} />
                <TransferPartyLine label="To" party={transfer.to} />
              </div>
              <Amount className="shrink-0 text-right" value={transfer.amount} />
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-border border-t pt-3 font-mono text-xs text-muted-foreground">
              <span>
                Block {formatIntegerString(transfer.blockNumber)} ·{" "}
                {formatUtcTime(transfer.blockTimestamp)}
              </span>
              <ExternalHashLink hash={transfer.transactionHash} />
            </div>
          </div>
        ))}
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
              <TableRow key={`${transfer.transactionHash}-${transfer.logIndex}`}>
                <TableCell className="min-w-0">
                  <TransferPartyCell party={transfer.from} />
                </TableCell>
                <TableCell className="min-w-0">
                  <TransferPartyCell party={transfer.to} />
                </TableCell>
                <TableCell className="text-right">
                  <Amount value={transfer.amount} />
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {formatIntegerString(transfer.blockNumber)}
                  <div className="mt-1 font-mono text-2xs text-muted-foreground">
                    {formatUtcTime(transfer.blockTimestamp)}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <ExternalHashLink hash={transfer.transactionHash} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Panel>
  );
}

function TransferPartyLine({ label, party }: { label: "From" | "To"; party: TransferParty }) {
  return (
    <div className="grid min-w-0 grid-cols-[2.75rem_minmax(0,1fr)] items-center gap-2">
      <span className="font-mono text-2xs text-muted-foreground uppercase tracking-[0.06em]">
        {label}
      </span>
      <TransferPartyCell party={party} />
    </div>
  );
}

function TransferPartyCell({ party }: { party: TransferParty }) {
  const category = getKnownCategory(party.category);
  const entity = (
    <Entity
      className="min-w-0 max-w-full [&>span:last-child]:min-w-0 [&>span:last-child]:truncate"
      category={category}
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
  profile,
}: {
  className?: string;
  labels: AddressLabelRow[];
  profile: EntityProfile;
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
            {
              color: "var(--inflow)",
              label: "High",
              value: confidence.high ?? 0,
            },
            {
              color: "var(--accent)",
              label: "Medium",
              value: confidence.medium ?? 0,
            },
            {
              color: "var(--outflow)",
              label: "Candidate",
              value: confidence.candidate ?? 0,
            },
          ]}
        />
        <EvidenceStack
          label="Source type"
          segments={[
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
            {
              color: "var(--accent)",
              label: "Boundary",
              value: policies.boundary ?? 0,
            },
            {
              color: "var(--inflow)",
              label: "Discovery source",
              value: policies.discovery_source ?? 0,
            },
            {
              color: "var(--muted-foreground)",
              label: "Internal",
              value: policies.internal ?? 0,
            },
            {
              color: "var(--outflow)",
              label: "Ignore",
              value: policies.ignore ?? 0,
            },
          ]}
        />
        <div className="grid grid-cols-2 gap-3 border-border border-t pt-4 font-mono text-2xs">
          <EvidenceMetric
            label="Attribution groups"
            value={formatInteger(profile.attributionGroups.length)}
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

function AddressLabelsPanel({ labels }: { labels: AddressLabelRow[] }) {
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
                  {formatIntegerString(label.firstSeenBlock)}
                </TableCell>
                <TableCell className="text-right">
                  <ExternalHashLink hash={label.transactionHash} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Panel>
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

function ConfidencePill({ confidence }: { confidence: Confidence }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          className={cn(
            "rounded-full border px-2 py-1 font-mono text-2xs uppercase tracking-[0.04em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            confidence === "high" && "border-inflow/35 bg-inflow-soft text-inflow",
            confidence === "medium" && "border-accent/35 bg-accent-soft text-accent",
            confidence === "candidate" && "border-outflow/35 bg-outflow-soft text-outflow",
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

function buildGraphEdges(counterparties: CounterpartyRow[], mode: FlowMode) {
  return counterparties.slice(0, 6).flatMap((counterparty, index) => {
    const net = counterparty.inflow - counterparty.outflow;
    const value = getCounterpartyValue(counterparty, mode);

    if (value === 0) {
      return [];
    }

    return [
      {
        ...counterparty,
        direction:
          mode === "inflow" || (mode === "net" && net >= 0) ? ("in" as const) : ("out" as const),
        point: graphPoints[index] ?? fallbackGraphPoint,
        value,
      },
    ];
  });
}

function buildEntityProfile(entityId: string): EntityProfile {
  const catalogEntry = knownEntities[entityId as keyof typeof knownEntities] ?? {
    category: "wallet",
    entityName: formatEntityId(entityId),
  };
  const selected = {
    category: catalogEntry.category,
    entityId,
    entityName: catalogEntry.entityName,
  };
  const counterparties = buildCounterparties(selected.entityId);
  const addressLabels = buildAddressLabels(selected.entityId);
  const sourceTypes = [...new Set(addressLabels.map((label) => label.sourceType))];
  const roles = [...new Set(addressLabels.map((label) => label.role))];
  const attributionGroups = [...new Set(addressLabels.map((label) => label.attributionGroup))];

  return {
    addressLabels,
    attributionGroups,
    category: selected.category,
    counterparties,
    entityId: selected.entityId,
    entityName: selected.entityName,
    firstSeenBlock: minBlock(addressLabels.map((label) => label.firstSeenBlock)),
    flowWindows: buildFlowWindows(seedFromText(entityId)),
    labelCount: addressLabels.length,
    latestLabelBlock: maxBlock(addressLabels.map((label) => label.firstSeenBlock)),
    recentTransfers: buildRecentTransfers(selected, counterparties),
    roles,
    sourceTypes,
  };
}

function buildFlowWindows(seed: number): Record<WindowMinutes, FlowWindow> {
  const hourInflow = 12_400_000 + seed * 310_000;
  const hourOutflow = 9_850_000 + seed * 190_000;

  return {
    "5": {
      bucketEnd: "2026-05-20T15:00:00.000Z",
      bucketStart: "2026-05-20T14:55:00.000Z",
      inflow: hourInflow * 0.12,
      inflowTransferCount: 42 + seed,
      outflow: hourOutflow * 0.1,
      outflowTransferCount: 36 + seed,
    },
    "60": {
      bucketEnd: "2026-05-20T15:00:00.000Z",
      bucketStart: "2026-05-20T14:00:00.000Z",
      inflow: hourInflow,
      inflowTransferCount: 438 + seed * 5,
      outflow: hourOutflow,
      outflowTransferCount: 389 + seed * 4,
    },
    "1440": {
      bucketEnd: "2026-05-20T15:00:00.000Z",
      bucketStart: "2026-05-19T15:00:00.000Z",
      inflow: hourInflow * 18.5,
      inflowTransferCount: 7_920 + seed * 31,
      outflow: hourOutflow * 17.2,
      outflowTransferCount: 7_104 + seed * 28,
    },
  };
}

function buildCounterparties(entityId: string): CounterpartyRow[] {
  const baseCounterparties = [
    {
      category: "cex",
      entityId: "coinbase",
      entityName: "Coinbase",
      inflow: 4_860_000,
      outflow: 3_210_000,
      transferCount: 186,
    },
    {
      category: "lending",
      entityId: "aave-v3",
      entityName: "Aave V3",
      inflow: 2_440_000,
      outflow: 3_760_000,
      transferCount: 143,
    },
    {
      category: "bridge",
      entityId: "circle-cctp",
      entityName: "Circle CCTP",
      inflow: 1_980_000,
      outflow: 1_120_000,
      transferCount: 94,
    },
    {
      category: "dex",
      entityId: "uniswap-v3",
      entityName: "Uniswap V3",
      inflow: 1_540_000,
      outflow: 1_310_000,
      transferCount: 118,
    },
    {
      category: "lending",
      entityId: "morpho-blue",
      entityName: "Morpho Blue",
      inflow: 890_000,
      outflow: 1_620_000,
      transferCount: 74,
    },
    {
      category: "wallet",
      entityId: "wallet-cluster-0x7c",
      entityName: "0x7c...aa11",
      inflow: 620_000,
      outflow: 420_000,
      transferCount: 49,
    },
  ] satisfies CounterpartyRow[];

  if (entityId !== "aerodrome") {
    return [
      {
        category: "dex",
        entityId: "aerodrome",
        entityName: "Aerodrome",
        inflow: 3_180_000,
        outflow: 2_260_000,
        transferCount: 151,
      },
      ...baseCounterparties
        .filter((counterparty) => counterparty.entityId !== entityId)
        .slice(0, 5),
    ];
  }

  return baseCounterparties;
}

function buildAddressLabels(entityId: string): AddressLabelRow[] {
  const labelSets: Record<string, AddressLabelRow[]> = {
    "aave-v3": [
      buildLabel(
        "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
        "pool",
        "high",
        "boundary",
        "onchain_state",
        "getReserveData(USDC)",
        "aave-v3",
        "26851402",
      ),
      buildLabel(
        "0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB",
        "a_token",
        "high",
        "boundary",
        "onchain_state",
        "getReserveData(USDC)",
        "aave-v3",
        "26851402",
      ),
      buildLabel(
        "0x59dca05b6c26dbd64b5381374aAaC5CD05644C28",
        "variable_debt_token",
        "high",
        "internal",
        "onchain_state",
        "getReserveData(USDC)",
        "aave-v3",
        "26851402",
      ),
    ],
    aerodrome: [
      buildLabel(
        "0x4e962BB3889Bf030368F56810A9c96B83CB3E778",
        "pool_instance",
        "high",
        "boundary",
        "factory_event",
        "PoolCreated",
        "aerodrome",
        "26684712",
      ),
      buildLabel(
        "0xb2cc224c1c9feE385f8ad6a55b4d94E92359DC59",
        "pool_instance",
        "high",
        "boundary",
        "factory_event",
        "PoolCreated",
        "aerodrome",
        "26685893",
      ),
      buildLabel(
        "0x3FE04a59eBd38cF06080a6f60A98D124eB59392A",
        "pool_instance",
        "medium",
        "boundary",
        "factory_event",
        "PoolCreated",
        "aerodrome",
        "26687420",
      ),
      buildLabel(
        "0x67c0d1F2a5B2B8d70b4aC0f746c10Ea765F7b2d4",
        "pool_instance",
        "high",
        "boundary",
        "factory_event",
        "PoolCreated",
        "aerodrome",
        "26710284",
      ),
      buildLabel(
        "0x90f3D1c7d52c80c8B6086a9BAf079B6c9D3412dA",
        "pool_instance",
        "high",
        "boundary",
        "factory_event",
        "PoolCreated",
        "aerodrome",
        "26738841",
      ),
      buildLabel(
        "0x5C3F18F06CC09CA1910767A34a20F771039E37C0",
        "factory_registry",
        "high",
        "discovery_source",
        "onchain_state",
        "factoryRegistry()",
        "aerodrome",
        "26598011",
      ),
      buildLabel(
        "0x16613524e02ad97eDfeF371bC883F2F5d6C480A5",
        "voter",
        "high",
        "internal",
        "onchain_state",
        "voter()",
        "aerodrome",
        "26598011",
      ),
    ],
    "circle-cctp": [
      buildLabel(
        "0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d",
        "token_messenger",
        "high",
        "boundary",
        "onchain_state",
        "DepositForBurn",
        "circle-cctp",
        "26290410",
      ),
      buildLabel(
        "0x81D40F21F12A8F0E3252Bccb954D722d4c464B64",
        "message_transmitter",
        "high",
        "internal",
        "onchain_state",
        "MessageReceived",
        "circle-cctp",
        "26290410",
      ),
    ],
    "morpho-blue": [
      buildLabel(
        "0xBAa5cc21fd487B8Fcc2F632f3F4E8D3726C3c43a",
        "core",
        "medium",
        "boundary",
        "onchain_state",
        "marketParams()",
        "morpho-blue",
        "26611290",
      ),
      buildLabel(
        "0x2d012EdbAdc37eDc2BC62791B666f919E95E3F5f",
        "vault",
        "high",
        "boundary",
        "factory_event",
        "CreateMetaMorpho",
        "morpho-blue",
        "26700471",
      ),
      buildLabel(
        "0x8462f82a72001988702eB3B39C922dEcA4C8d9CE",
        "vault",
        "high",
        "boundary",
        "factory_event",
        "CreateMetaMorpho",
        "morpho-blue",
        "26760429",
      ),
    ],
    "uniswap-v3": [
      buildLabel(
        "0xd0b53D9277642d899DF5C87A3966A349A798F224",
        "pool_instance",
        "high",
        "boundary",
        "factory_event",
        "PoolCreated",
        "uniswap-v3",
        "26591015",
      ),
      buildLabel(
        "0x88A43bbDF9D098eEC7bCE2D6D2BfF2B1aF52aD10",
        "pool_instance",
        "high",
        "boundary",
        "factory_event",
        "PoolCreated",
        "uniswap-v3",
        "26644218",
      ),
      buildLabel(
        "0x33128a8fC17869897dcE68Ed026d694621f6FDfD",
        "factory",
        "high",
        "discovery_source",
        "onchain_state",
        "factory()",
        "uniswap-v3",
        "26590000",
      ),
    ],
  };

  return (
    labelSets[entityId] ?? [
      buildLabel(
        "0x61040e143a77f165ba44543af4a079f2c809d14b",
        "counterparty",
        "medium",
        "boundary",
        "factory_event",
        "USDC Transfer counterparty pattern",
        entityId,
        "26790114",
      ),
      buildLabel(
        "0xcf7603eb05d36b54935fecb6c5f79e6d1198f1c3",
        "counterparty",
        "candidate",
        "boundary",
        "factory_event",
        "top_unidentified_usdc_counterparty",
        entityId,
        "26798220",
      ),
    ]
  );
}

function buildLabel(
  address: string,
  role: string,
  confidence: Confidence,
  countingPolicy: CountingPolicy,
  sourceType: SourceType,
  sourceEvent: string,
  attributionGroup: string,
  firstSeenBlock: string,
): AddressLabelRow {
  return {
    address,
    attributionGroup,
    confidence,
    countingPolicy,
    firstSeenBlock,
    logIndex: Number(firstSeenBlock.slice(-2)),
    role,
    sourceAddress: "0x420DD381b31aEf6683db6B902084cB0FFECe40Da",
    sourceEvent,
    sourceType,
    transactionHash: `0x${firstSeenBlock.padEnd(64, "0")}`,
  };
}

function buildRecentTransfers(
  selected: { category: EntityCategory; entityId: string; entityName: string },
  counterparties: CounterpartyRow[],
): RecentEntityTransfer[] {
  const selectedParty = toTransferParty(selected);

  return counterparties.slice(0, 6).map((counterparty, index) => {
    const counterpartyParty = toTransferParty(counterparty);
    const isInflow = index % 2 === 0;

    return {
      amount: isInflow ? counterparty.inflow * 0.12 : counterparty.outflow * 0.1,
      blockNumber: (28_894_200 - index * 42).toString(),
      blockTimestamp: new Date(Date.UTC(2026, 4, 20, 14, 58 - index * 4)).toISOString(),
      from: isInflow ? counterpartyParty : selectedParty,
      logIndex: index + 8,
      to: isInflow ? selectedParty : counterpartyParty,
      transactionHash: `0x${(counterparty.entityId + selected.entityId).replaceAll("-", "").padEnd(64, "a").slice(0, 64)}`,
    };
  });
}

function toTransferParty(entity: {
  category: EntityCategory;
  entityId: string;
  entityName: string;
}): TransferParty {
  const isWallet = entity.category === "wallet";

  return {
    address: isWallet
      ? "0x7c62b91f8446fd38a78ee186b7d01fe38fb4aa11"
      : "0x0000000000000000000000000000000000000000",
    category: entity.category,
    displayName: entity.entityName,
    entityId: isWallet ? null : entity.entityId,
    isIdentified: !isWallet,
  };
}

function getCounterpartyValue(counterparty: CounterpartyRow, mode: FlowMode) {
  if (mode === "inflow") {
    return counterparty.inflow;
  }

  if (mode === "outflow") {
    return counterparty.outflow;
  }

  return counterparty.inflow - counterparty.outflow;
}

function getCounterpartyTrend(counterparty: CounterpartyRow, mode: FlowMode) {
  if (mode === "inflow") {
    return "inflow";
  }

  if (mode === "outflow") {
    return "outflow";
  }

  return getCounterpartyValue(counterparty, mode) >= 0 ? "net-pos" : "net-neg";
}

function getAttributionGroupDescription(group: string) {
  return `${formatToken(group)} is the attribution namespace that tied this address to the selected entity.`;
}

function getConfidenceDescription(confidence: Confidence) {
  if (confidence === "high") {
    return "High confidence means the label came from strong deterministic evidence, such as an emitted factory event or verified protocol state.";
  }

  if (confidence === "medium") {
    return "Medium confidence means the label is supported by useful evidence but may need additional corroboration before it is treated as fully deterministic.";
  }

  return "Candidate means the address is useful to review, but the attribution should not be treated as final without more evidence.";
}

function getCountingPolicyDescription(policy: CountingPolicy) {
  if (policy === "boundary") {
    return "Boundary addresses are counted as entity edges where USDC enters or exits the entity.";
  }

  if (policy === "discovery_source") {
    return "Discovery source addresses help find or verify other labels, but are not normally counted as entity flow boundaries.";
  }

  if (policy === "internal") {
    return "Internal addresses belong to the entity but are usually excluded from external flow boundaries.";
  }

  return "Ignored addresses are known but intentionally excluded from flow accounting because they are noisy, helper-like, or not useful as entity boundaries.";
}

function getRoleDescription(role: string) {
  const descriptions: Record<string, string> = {
    a_token: "Aave interest-bearing token contract representing supplied USDC.",
    core: "Core protocol contract for the entity.",
    counterparty:
      "An address currently represented as a counterparty label rather than a protocol-specific role.",
    factory: "Contract that creates or registers protocol instances.",
    factory_registry: "Registry contract used to discover factories or related protocol addresses.",
    message_transmitter: "Circle CCTP contract that receives or verifies cross-chain messages.",
    pool: "Protocol pool contract where USDC activity is observed.",
    pool_instance: "Liquidity pool contract created by a protocol factory.",
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

function getSourceTypeDescription(sourceType: SourceType) {
  if (sourceType === "factory_event") {
    return "Factory event means the label came from an indexed contract event emitted by a protocol factory.";
  }

  return "On-chain state means the label came from reading protocol contract state or a deterministic protocol method.";
}

function getKnownCategory(category: EntityCategory): Category | undefined {
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

function formatEntityId(entityId: string) {
  return entityId
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatCategory(category: EntityCategory) {
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

function formatWindowLabel(windowMinutes: WindowMinutes) {
  if (windowMinutes === "1440") {
    return "24h";
  }

  if (windowMinutes === "60") {
    return "1h";
  }

  return `${windowMinutes}m`;
}

function isWindowMinutes(value: string): value is WindowMinutes {
  return value === "5" || value === "60" || value === "1440";
}

function countBy<T extends string>(items: AddressLabelRow[], getKey: (item: AddressLabelRow) => T) {
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

function formatIntegerString(value: string) {
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

function minBlock(blocks: string[]) {
  return blocks.reduce(
    (min, block) => (BigInt(block) < BigInt(min) ? block : min),
    blocks[0] ?? "0",
  );
}

function maxBlock(blocks: string[]) {
  return blocks.reduce(
    (max, block) => (BigInt(block) > BigInt(max) ? block : max),
    blocks[0] ?? "0",
  );
}

function seedFromText(value: string) {
  return Array.from(value).reduce((total, char) => total + char.charCodeAt(0), 0) % 9;
}
