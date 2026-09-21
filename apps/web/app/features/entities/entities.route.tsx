import type { EntityListResponse, EntitySummary, TopEntityFlowsResponse } from "@stableflow/shared";
import { Blocks, ChevronRight, LayoutGrid, Search, Table2 } from "lucide-react";
import { useMemo } from "react";
import { Link, useLoaderData, useSearchParams } from "react-router";
import {
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
import { getApiUrl } from "~/config/api.server";
import { CATEGORY, type Category } from "~/styles/tokens";
import { cn } from "~/utils/cn";

type ViewMode = "cards" | "table";

interface EntitiesLoaderData {
  entities: EntityListResponse;
  topFlows: TopEntityFlowsResponse;
}

interface EnrichedEntity extends EntitySummary {
  flow: TopEntityFlowsResponse["data"][number] | null;
}

interface SourceSummary {
  entityCount: number;
  sourceType: string;
}

export function meta() {
  return [
    { title: "Entities | Stableflow" },
    {
      content: "Known and discovered entities tracked by Stableflow.",
      name: "description",
    },
  ];
}

export async function loader(): Promise<EntitiesLoaderData> {
  const topFlowsUrl = new URL(getApiUrl("/flows/top-entities"));
  topFlowsUrl.searchParams.set("limit", "20");
  topFlowsUrl.searchParams.set("mode", "net");
  topFlowsUrl.searchParams.set("windowMinutes", "1440");

  const [entitiesResponse, topFlowsResponse] = await Promise.all([
    fetch(getApiUrl("/entities"), {
      headers: {
        accept: "application/json",
      },
    }),
    fetch(topFlowsUrl, {
      headers: {
        accept: "application/json",
      },
    }),
  ]);

  if (!entitiesResponse.ok) {
    throw new Response("Unable to load entities", {
      status: entitiesResponse.status,
      statusText: entitiesResponse.statusText,
    });
  }

  if (!topFlowsResponse.ok) {
    throw new Response("Unable to load entity flow context", {
      status: topFlowsResponse.status,
      statusText: topFlowsResponse.statusText,
    });
  }

  return {
    entities: (await entitiesResponse.json()) as EntityListResponse,
    topFlows: (await topFlowsResponse.json()) as TopEntityFlowsResponse,
  };
}

export default function Entities() {
  const { entities, topFlows } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const category = searchParams.get("category") ?? "all";
  const view = normalizeViewMode(searchParams.get("view"));
  const enrichedEntities = useMemo(
    () => enrichEntities(entities.data, topFlows),
    [entities.data, topFlows],
  );
  const categoryOptions = useMemo(() => getCategoryOptions(entities), [entities]);
  const visibleEntities = useMemo(
    () =>
      enrichedEntities.filter((entity) => {
        if (category !== "all" && entity.category !== category) {
          return false;
        }

        if (query.trim().length === 0) {
          return true;
        }

        const normalizedQuery = query.trim().toLowerCase();
        const haystack = [
          entity.entityName,
          entity.entityId,
          entity.category,
          entity.roles.join(" "),
          entity.sourceTypes.join(" "),
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(normalizedQuery);
      }),
    [category, enrichedEntities, query],
  );
  const totalAddresses = entities.data.reduce((total, entity) => total + entity.addressCount, 0);
  const sourceSummaries = useMemo(() => getSourceSummaries(entities.data), [entities.data]);

  const updateSearchParam = (name: string, value: string, defaultValue?: string) => {
    setSearchParams(
      (currentSearchParams) => {
        const nextSearchParams = new URLSearchParams(currentSearchParams);

        if (value === defaultValue || value.length === 0) {
          nextSearchParams.delete(name);
        } else {
          nextSearchParams.set(name, value);
        }

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
        aria-labelledby="entities-title"
      >
        <AppHeader
          eyebrow="Flow / Entities / Registry"
          headingId="entities-app-title"
          searchPlaceholder="Search entity, address, tx hash..."
          title="Stableflow"
        />

        <Panel>
          <PanelBody className="flex flex-col items-start gap-5 p-5 sm:flex-row">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-accent text-background shadow-[var(--shadow-glow-accent)]">
              <Blocks size={25} strokeWidth={1.8} />
            </div>

            <div className="min-w-0 flex-1">
              <p className="mb-2 font-mono text-2xs text-muted-foreground uppercase tracking-[0.08em]">
                Labeled entity registry · Base · USDC
              </p>
              <h1 id="entities-title" className="m-0 text-2xl font-medium leading-tight">
                Entity Registry
              </h1>

              <dl className="mt-5 grid max-w-3xl grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4">
                <SummaryStat label="Entities" value={entities.meta.totalEntities.toString()} />
                <SummaryStat label="Addresses" value={formatInteger(totalAddresses)} />
                <SummaryStat label="Labels" value={formatInteger(entities.meta.totalLabels)} />
                <SummaryStat
                  label="Categories"
                  value={entities.meta.categories.length.toString()}
                />
              </dl>
            </div>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelBody className="flex flex-col gap-3 p-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
              <ToggleGroup
                aria-label="Entity category"
                type="single"
                value={category}
                onValueChange={(nextCategory) => {
                  if (nextCategory.length > 0) {
                    updateSearchParam("category", nextCategory, "all");
                  }
                }}
              >
                {categoryOptions.map((option) => (
                  <ToggleGroupItem key={option.value} value={option.value}>
                    {option.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>

              <label className="flex h-9 min-w-0 items-center gap-2 rounded-md border border-border bg-surface-2 px-3 font-mono text-sm text-muted-foreground sm:w-72">
                <Search size={14} className="shrink-0" />
                <input
                  aria-label="Filter entities"
                  className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
                  onChange={(event) => updateSearchParam("q", event.target.value)}
                  placeholder="Filter entities..."
                  type="search"
                  value={query}
                />
              </label>
            </div>

            <div className="flex items-center justify-between gap-3 lg:justify-end">
              <span className="font-mono text-2xs text-muted-foreground">
                {visibleEntities.length} entities
              </span>
              <ToggleGroup
                aria-label="Entity view"
                type="single"
                value={view}
                onValueChange={(nextView) => {
                  if (isViewMode(nextView)) {
                    updateSearchParam("view", nextView, "table");
                  }
                }}
              >
                <ToggleGroupItem value="table">
                  <Table2 size={13} />
                  Table
                </ToggleGroupItem>
                <ToggleGroupItem value="cards">
                  <LayoutGrid size={13} />
                  Cards
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </PanelBody>
        </Panel>

        <div className="grid min-w-0 gap-3.5 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0">
            {view === "cards" ? (
              <EntityCards entities={visibleEntities} />
            ) : (
              <EntityTable entities={visibleEntities} />
            )}
          </div>

          <RegistryRail
            entities={entities}
            sourceSummaries={sourceSummaries}
            totalAddresses={totalAddresses}
          />
        </div>

        <footer className="flex flex-col items-start justify-between gap-3 p-1 font-mono text-2xs text-muted-foreground md:flex-row md:items-center">
          <span>Stableflow · v0.1.0</span>
          <span>Scope: Base + USDC</span>
          <span>{entities.meta.totalLabels} labels · 24h flow context</span>
        </footer>
      </section>
    </main>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-2xs text-muted-foreground uppercase tracking-[0.08em]">
        {label}
      </dt>
      <dd className="mt-1 font-mono text-lg text-foreground">{value}</dd>
    </div>
  );
}

function EntityTable({ entities }: { entities: EnrichedEntity[] }) {
  return (
    <Panel>
      <PanelHead>
        <PanelTitle>Entities</PanelTitle>
        <PanelActions>
          <span className="font-mono text-2xs text-muted-foreground">24h net</span>
        </PanelActions>
      </PanelHead>
      <div className="overflow-x-auto">
        <Table className="min-w-[880px]">
          <TableHeader>
            <TableRow>
              <TableHead>Entity</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead className="text-right">Addresses</TableHead>
              <TableHead className="text-right">Labels</TableHead>
              <TableHead className="text-right">24h Volume</TableHead>
              <TableHead className="text-right">24h Net</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {entities.map((entity) => (
              <TableRow key={entity.entityId}>
                <TableCell>
                  <Link
                    className="inline-flex min-w-0 text-foreground no-underline hover:text-accent"
                    to={`/entities/${entity.entityId}`}
                  >
                    <Entity
                      category={getKnownCategory(entity.category)}
                      glyph={getEntityGlyph(entity.entityName)}
                      name={entity.entityName}
                    />
                  </Link>
                  <span className="mt-1 block font-mono text-2xs text-muted-foreground">
                    {entity.entityId}
                  </span>
                </TableCell>
                <TableCell>
                  <Tag category={getKnownCategory(entity.category)}>
                    {formatCategory(entity.category)}
                  </Tag>
                </TableCell>
                <TableCell>
                  <RoleList roles={entity.roles} />
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatInteger(entity.addressCount)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatInteger(entity.labelCount)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {entity.flow ? formatUsdNumber(getFlowVolume(entity.flow)) : "-"}
                </TableCell>
                <TableCell className="min-w-36 text-right">
                  {entity.flow ? <FlowNet flow={entity.flow} align="end" /> : <EmptyMetric />}
                </TableCell>
                <TableCell>
                  <Button
                    asChild
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Open ${entity.entityName}`}
                  >
                    <Link to={`/entities/${entity.entityId}`}>
                      <ChevronRight />
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {entities.length === 0 && <EmptyEntities />}
      </div>
    </Panel>
  );
}

function EntityCards({ entities }: { entities: EnrichedEntity[] }) {
  if (entities.length === 0) {
    return (
      <Panel>
        <EmptyEntities />
      </Panel>
    );
  }

  return (
    <div className="grid gap-3.5 md:grid-cols-2 2xl:grid-cols-3">
      {entities.map((entity) => (
        <Link
          className="group min-w-0 rounded-lg border border-border bg-glass p-3.5 text-foreground no-underline shadow-sm backdrop-blur-xl backdrop-saturate-150 transition-colors duration-fast hover:border-accent/60 hover:bg-surface-1"
          key={entity.entityId}
          to={`/entities/${entity.entityId}`}
        >
          <article className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <Entity
                category={getKnownCategory(entity.category)}
                glyph={getEntityGlyph(entity.entityName)}
                name={entity.entityName}
              />
              <Tag category={getKnownCategory(entity.category)}>
                {formatCategory(entity.category)}
              </Tag>
            </div>

            <RoleList roles={entity.roles} />

            <div className="border-border border-t pt-3">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <CardMetric
                  label="24h Volume"
                  value={entity.flow ? formatUsdNumber(getFlowVolume(entity.flow)) : "-"}
                />
                <div>
                  <span className="font-mono text-2xs text-muted-foreground uppercase tracking-[0.08em]">
                    24h Net
                  </span>
                  {entity.flow ? <FlowNet className="mt-1" flow={entity.flow} /> : <EmptyMetric />}
                </div>
                <CardMetric label="Addresses" value={formatInteger(entity.addressCount)} />
                <CardMetric label="Labels" value={formatInteger(entity.labelCount)} />
              </div>
            </div>
          </article>
        </Link>
      ))}
    </div>
  );
}

function RegistryRail({
  entities,
  sourceSummaries,
  totalAddresses,
}: {
  entities: EntityListResponse;
  sourceSummaries: SourceSummary[];
  totalAddresses: number;
}) {
  const maxCategoryLabels = Math.max(
    1,
    ...entities.meta.categories.map((category) => category.labelCount),
  );
  const avgLabelsPerEntity =
    entities.meta.totalEntities === 0 ? 0 : entities.meta.totalLabels / entities.meta.totalEntities;
  const avgAddressesPerEntity =
    entities.meta.totalEntities === 0 ? 0 : totalAddresses / entities.meta.totalEntities;

  return (
    <aside className="flex min-w-0 flex-col gap-3.5" aria-label="Registry context">
      <Panel>
        <PanelHead>
          <PanelTitle>Coverage</PanelTitle>
        </PanelHead>
        <PanelBody className="space-y-3">
          {entities.meta.categories.map((category) => (
            <CategoryCoverageRow
              category={category.category}
              entityCount={category.entityCount}
              key={category.category}
              labelCount={category.labelCount}
              maxLabels={maxCategoryLabels}
            />
          ))}
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHead>
          <PanelTitle>Registry Health</PanelTitle>
        </PanelHead>
        <PanelBody className="grid grid-cols-2 gap-3">
          <RailMetric label="Labels / entity" value={formatRatio(avgLabelsPerEntity)} />
          <RailMetric label="Addr / entity" value={formatRatio(avgAddressesPerEntity)} />
          <RailMetric label="Sources" value={sourceSummaries.length.toString()} />
          <RailMetric label="Generated" value={formatGeneratedAt(entities.meta.generatedAt)} />
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHead>
          <PanelTitle>Sources</PanelTitle>
        </PanelHead>
        <PanelBody className="space-y-2.5">
          {sourceSummaries.map((source) => (
            <div className="flex items-center justify-between gap-3" key={source.sourceType}>
              <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">
                {formatSourceType(source.sourceType)}
              </span>
              <span className="shrink-0 font-mono text-xs text-foreground">
                {formatInteger(source.entityCount)}
              </span>
            </div>
          ))}
        </PanelBody>
      </Panel>
    </aside>
  );
}

function CategoryCoverageRow({
  category,
  entityCount,
  labelCount,
  maxLabels,
}: {
  category: string;
  entityCount: number;
  labelCount: number;
  maxLabels: number;
}) {
  const knownCategory = getKnownCategory(category);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Tag category={knownCategory}>{formatCategory(category)}</Tag>
        <span className="font-mono text-2xs text-muted-foreground">
          {formatInteger(entityCount)} entities
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full"
            style={{
              background: knownCategory ? `var(--cat-${knownCategory})` : "var(--accent)",
              width: `${Math.max(4, (labelCount / maxLabels) * 100)}%`,
            }}
          />
        </div>
        <span className="w-16 text-right font-mono text-2xs text-muted-foreground">
          {formatInteger(labelCount)} labels
        </span>
      </div>
    </div>
  );
}

function RailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface-1 p-3">
      <span className="block font-mono text-2xs text-muted-foreground uppercase tracking-[0.08em]">
        {label}
      </span>
      <span className="mt-1 block font-mono text-sm text-foreground">{value}</span>
    </div>
  );
}

function RoleList({ roles }: { roles: string[] }) {
  const visibleRoles = roles.slice(0, 3);
  const hiddenCount = roles.length - visibleRoles.length;

  return (
    <div className="flex min-w-0 flex-wrap gap-1.5">
      {visibleRoles.map((role) => (
        <span
          className="rounded-sm bg-surface-2 px-2 py-1 font-mono text-[10px] text-muted-foreground uppercase tracking-[0.04em]"
          key={role}
        >
          {formatRole(role)}
        </span>
      ))}
      {hiddenCount > 0 && (
        <span className="rounded-sm bg-surface-2 px-2 py-1 font-mono text-[10px] text-muted-foreground">
          +{hiddenCount}
        </span>
      )}
    </div>
  );
}

function FlowNet({
  align,
  className,
  flow,
}: {
  align?: "end" | "start";
  className?: string;
  flow: TopEntityFlowsResponse["data"][number];
}) {
  const net = Number(flow.net.formatted);
  const trend = net < 0 ? "net-neg" : "net-pos";

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", align === "end" && "items-end", className)}>
      <span className={cn("font-mono", net < 0 ? "text-outflow" : "text-inflow")}>
        {formatUsdNumber(net)}
      </span>
      <FlowBar className="w-24" trend={trend} value={flow.relativeShare} />
    </div>
  );
}

function CardMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="font-mono text-2xs text-muted-foreground uppercase tracking-[0.08em]">
        {label}
      </span>
      <span className="mt-1 block font-mono text-sm text-foreground">{value}</span>
    </div>
  );
}

function EmptyMetric() {
  return <span className="font-mono text-sm text-muted-foreground">-</span>;
}

function EmptyEntities() {
  return (
    <div className="flex h-44 items-center justify-center px-4 text-center font-mono text-sm text-muted-foreground">
      No entities match the current filters.
    </div>
  );
}

const enrichEntities = (
  entities: EntitySummary[],
  topFlows: TopEntityFlowsResponse,
): EnrichedEntity[] => {
  const flowsByEntityId = new Map(topFlows.data.map((flow) => [flow.entityId, flow]));

  return entities
    .map((entity) => ({
      ...entity,
      flow: flowsByEntityId.get(entity.entityId) ?? null,
    }))
    .sort(compareEntities);
};

const compareEntities = (left: EnrichedEntity, right: EnrichedEntity) => {
  const leftVolume = left.flow ? getFlowVolume(left.flow) : 0;
  const rightVolume = right.flow ? getFlowVolume(right.flow) : 0;

  if (leftVolume !== rightVolume) {
    return rightVolume - leftVolume;
  }

  if (left.labelCount !== right.labelCount) {
    return right.labelCount - left.labelCount;
  }

  return left.entityName.localeCompare(right.entityName);
};

const getFlowVolume = (flow: TopEntityFlowsResponse["data"][number]) =>
  Number(flow.inflow.formatted) + Number(flow.outflow.formatted);

const getCategoryOptions = (entities: EntityListResponse) => [
  { label: "All", value: "all" },
  ...entities.meta.categories.map((category) => ({
    label: formatCategory(category.category),
    value: category.category,
  })),
];

const normalizeViewMode = (view: string | null): ViewMode => (view === "cards" ? "cards" : "table");

const isViewMode = (value: string): value is ViewMode => value === "cards" || value === "table";

const getKnownCategory = (category: string): Category | undefined => {
  if (category in CATEGORY) {
    return category as Category;
  }

  if (category === "stablecoin_issuer") {
    return "mint";
  }

  return undefined;
};

const getEntityGlyph = (entityName: string) => {
  const words = entityName.split(/\s+/).filter(Boolean);
  const first = words.at(0)?.at(0) ?? entityName.at(0) ?? "?";
  const second = words.length > 1 ? words.at(1)?.at(0) : undefined;

  return `${first}${second ?? ""}`.toUpperCase();
};

const formatCategory = (category: string) => {
  if (category === "dex") {
    return "DEX";
  }

  if (category === "cex") {
    return "CEX";
  }

  if (category === "stablecoin_issuer") {
    return "Issuer";
  }

  return category
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const formatRole = (role: string) =>
  role
    .replace(/_/g, " ")
    .replace(/\b(v)(\d)\b/gi, "$1$2")
    .toUpperCase();

const formatInteger = (value: number) => new Intl.NumberFormat("en-US").format(value);

const formatRatio = (value: number) =>
  new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value >= 10 ? 0 : 1,
    minimumFractionDigits: value > 0 && value < 10 ? 1 : 0,
  }).format(value);

const formatGeneratedAt = (value: string) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const formatSourceType = (sourceType: string) =>
  sourceType
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const getSourceSummaries = (entities: EntitySummary[]): SourceSummary[] => {
  const countsBySourceType = new Map<string, number>();

  for (const entity of entities) {
    for (const sourceType of entity.sourceTypes) {
      countsBySourceType.set(sourceType, (countsBySourceType.get(sourceType) ?? 0) + 1);
    }
  }

  return [...countsBySourceType.entries()]
    .map(([sourceType, entityCount]) => ({
      entityCount,
      sourceType,
    }))
    .sort((left, right) => {
      if (left.entityCount !== right.entityCount) {
        return right.entityCount - left.entityCount;
      }

      return left.sourceType.localeCompare(right.sourceType);
    });
};

const formatUsdNumber = (value: number) => {
  const sign = value < 0 ? "-" : "";
  const absValue = Math.abs(value);

  if (absValue >= 1_000_000_000) {
    return `${sign}$${(absValue / 1_000_000_000).toFixed(2)}B`;
  }

  if (absValue >= 1_000_000) {
    return `${sign}$${(absValue / 1_000_000).toFixed(2)}M`;
  }

  if (absValue >= 1_000) {
    return `${sign}$${(absValue / 1_000).toFixed(1)}K`;
  }

  return `${sign}$${absValue.toFixed(0)}`;
};
