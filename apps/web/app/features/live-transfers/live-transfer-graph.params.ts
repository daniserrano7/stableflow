export type LiveTransferGraphWindow = "5" | "60" | "1440";

export const defaultLiveTransferGraphWindow = "5" satisfies LiveTransferGraphWindow;

export const liveTransferGraphWindowOptions: {
  label: string;
  value: LiveTransferGraphWindow;
}[] = [
  { label: "5m", value: "5" },
  { label: "1h", value: "60" },
  { label: "24h", value: "1440" },
];

export const normalizeLiveTransferGraphWindow = (
  windowMinutes: string | null | undefined,
): LiveTransferGraphWindow => {
  if (windowMinutes === "5" || windowMinutes === "60" || windowMinutes === "1440") {
    return windowMinutes;
  }

  return defaultLiveTransferGraphWindow;
};

export const isLiveTransferGraphWindow = (value: string): value is LiveTransferGraphWindow => {
  return value === "5" || value === "60" || value === "1440";
};

export const appendLiveTransferGraphSearchParams = (
  url: URL,
  { windowMinutes }: { windowMinutes: LiveTransferGraphWindow },
) => {
  url.searchParams.set("windowMinutes", windowMinutes);
};
