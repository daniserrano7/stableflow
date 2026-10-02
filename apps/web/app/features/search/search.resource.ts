import type { SearchResponse } from "@stableflow/shared";
import { getApiUrl } from "~/config/api.server";

const emptySearchResponse = (query: string): SearchResponse => ({
  data: [],
  meta: {
    generatedAt: new Date().toISOString(),
    query,
    total: 0,
  },
});

export async function loader({ request }: { request: Request }) {
  const requestUrl = new URL(request.url);
  const query = requestUrl.searchParams.get("q")?.trim() ?? "";

  if (query.length === 0) {
    return Response.json(emptySearchResponse(query), {
      headers: { "Cache-Control": "no-store" },
    });
  }

  if (query.length > 128) {
    return Response.json({ message: "Search query is too long" }, { status: 400 });
  }

  const apiUrl = new URL(getApiUrl("/search"));
  apiUrl.searchParams.set("q", query);
  apiUrl.searchParams.set("limit", "6");
  const response = await fetch(apiUrl, {
    headers: { accept: "application/json" },
    signal: request.signal,
  });

  if (!response.ok) {
    return Response.json(
      { message: "Search is temporarily unavailable" },
      { status: response.status },
    );
  }

  return Response.json((await response.json()) as SearchResponse, {
    headers: { "Cache-Control": "private, max-age=15" },
  });
}
