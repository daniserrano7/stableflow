import type { EntityListResponse, EntitySummary } from "@stableflow/shared";
import { getApiUrl } from "~/config/api.server";

const pageSize = 100;
const maxPages = 50;
const timeoutMs = 5_000;

/**
 * Every entity in the registry, for crawler files. Returns null when the API is unavailable so
 * callers can still serve their static part.
 */
export async function fetchEntityCatalog(signal: AbortSignal): Promise<EntitySummary[] | null> {
  const entities: EntitySummary[] = [];
  const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]);

  try {
    for (let page = 0; page < maxPages; page += 1) {
      const url = new URL(getApiUrl("/entities"));
      url.searchParams.set("limit", String(pageSize));
      url.searchParams.set("offset", String(page * pageSize));

      const response = await fetch(url, {
        headers: { accept: "application/json" },
        signal: requestSignal,
      });
      if (!response.ok) return null;

      const body = (await response.json()) as EntityListResponse;
      entities.push(...body.data);
      if (!body.meta.hasMore || body.data.length === 0) return entities;
    }
    return entities;
  } catch (error) {
    if (signal.aborted) throw error;
    return null;
  }
}
