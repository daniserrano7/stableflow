import { getApiUrl } from "../../config/api.server";
import {
  appendEntityDetailSearchParams,
  normalizeEntityDetailWindow,
} from "./entity-detail.params";

export async function loader({
  params,
  request,
}: {
  params: { entityId?: string };
  request: Request;
}) {
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
    throw new Response("Unable to load entity detail", {
      status: response.status,
      statusText: response.statusText,
    });
  }

  return response.json();
}
