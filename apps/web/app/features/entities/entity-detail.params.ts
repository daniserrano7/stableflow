export type EntityDetailWindow = "5" | "60" | "1440";

export const defaultEntityDetailWindow = "60" satisfies EntityDetailWindow;

export const entityDetailWindowOptions: { label: string; value: EntityDetailWindow }[] = [
  { label: "5m", value: "5" },
  { label: "1h", value: "60" },
  { label: "24h", value: "1440" },
];

export const entityDetailSearchParamNames = ["windowMinutes"] as const;

export const normalizeEntityDetailWindow = (
  windowMinutes: string | null | undefined,
): EntityDetailWindow => {
  if (windowMinutes === "5" || windowMinutes === "60" || windowMinutes === "1440") {
    return windowMinutes;
  }

  return defaultEntityDetailWindow;
};

export const appendEntityDetailSearchParams = (
  url: URL,
  { windowMinutes }: { windowMinutes: EntityDetailWindow },
) => {
  url.searchParams.set("windowMinutes", windowMinutes);
};
