import type { FlowKpiCard, FlowKpisResponse, FlowKpiTone } from "@stableflow/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { KPI, Sparkline } from "~/components";
import { fetchFlowKpis, flowKpisQueryKey, flowKpisRefreshIntervalMs } from "./flow-kpis.query";

interface FlowKpisProps {
  initialKpis: FlowKpisResponse;
}

export function FlowKpis({ initialKpis }: FlowKpisProps) {
  const kpisQuery = useQuery({
    initialData: initialKpis,
    initialDataUpdatedAt: Date.parse(initialKpis.meta.generatedAt),
    placeholderData: keepPreviousData,
    queryFn: ({ signal }) => fetchFlowKpis({ signal }),
    queryKey: flowKpisQueryKey,
    refetchInterval: flowKpisRefreshIntervalMs,
    retry: 2,
    staleTime: 10_000,
  });
  const kpis = kpisQuery.data ?? initialKpis;

  return (
    <section aria-label="Flow summary" className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.data.map((card) => (
        <FlowKpiCardView key={card.id} card={card} />
      ))}
    </section>
  );
}

function FlowKpiCardView({ card }: { card: FlowKpiCard }) {
  const value = formatCardValue(card);
  const sparklineData = getSparklineData(card);

  return (
    <KPI
      className="min-h-28"
      delta={card.delta ? { trend: card.delta.trend, value: card.delta.label } : undefined}
      label={card.label}
      spark={
        sparklineData.length >= 2 ? (
          <Sparkline color={getToneColor(card.tone)} data={sparklineData} />
        ) : undefined
      }
      unit={value.unit}
      value={value.value}
    />
  );
}

const getSparklineData = (card: FlowKpiCard) =>
  card.series.map((point) => Number(point.value)).filter((value) => Number.isFinite(value));

const getToneColor = (tone: FlowKpiTone) => {
  if (tone === "inflow") {
    return "var(--inflow)";
  }

  if (tone === "outflow") {
    return "var(--outflow)";
  }

  if (tone === "neutral") {
    return "var(--neutral-flow)";
  }

  return "var(--accent)";
};

const formatCardValue = (card: FlowKpiCard) => {
  if (card.value.kind === "count") {
    return {
      unit: null,
      value: formatIntegerString(card.value.formatted),
    };
  }

  return formatCompactUsdc(card.value.formatted, shouldShowSign(card));
};

const shouldShowSign = (card: FlowKpiCard) =>
  card.id === "top-net-mover-15m" || card.id === "bridge-net-flow-24h";

const formatCompactUsdc = (formattedAmount: string, signed: boolean) => {
  const value = Number(formattedAmount);

  if (!Number.isFinite(value)) {
    return {
      unit: null,
      value: "$0",
    };
  }

  const sign = value < 0 ? "-" : signed && value > 0 ? "+" : "";
  const absoluteValue = Math.abs(value);

  if (absoluteValue >= 1_000_000_000) {
    return {
      unit: "B",
      value: `${sign}$${(absoluteValue / 1_000_000_000).toFixed(2)}`,
    };
  }

  if (absoluteValue >= 1_000_000) {
    return {
      unit: "M",
      value: `${sign}$${(absoluteValue / 1_000_000).toFixed(2)}`,
    };
  }

  if (absoluteValue >= 1_000) {
    return {
      unit: "K",
      value: `${sign}$${(absoluteValue / 1_000).toFixed(1)}`,
    };
  }

  return {
    unit: null,
    value: `${sign}$${absoluteValue.toFixed(0)}`,
  };
};

const formatIntegerString = (value: string) => value.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
