import type { SearchResponse } from "@stableflow/shared";

export const searchQueryKey = (query: string) => ["global-search", query] as const;

export async function fetchSearchResults({
  query,
  signal,
}: {
  query: string;
  signal: AbortSignal;
}) {
  const searchParams = new URLSearchParams({ q: query });
  const response = await fetch(`/api/search?${searchParams.toString()}`, {
    headers: { accept: "application/json" },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Search request failed with status ${response.status.toString()}`);
  }

  return response.json() as Promise<SearchResponse>;
}
