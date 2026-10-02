import { getApiUrl } from "../../config/api.server";
import {
  appendLiveTransferGraphSearchParams,
  normalizeLiveTransferGraphWindow,
} from "./live-transfer-graph.params";

export async function loader({ request }: { request: Request }) {
  const requestUrl = new URL(request.url);
  const apiUrl = new URL(getApiUrl("/flows/live-graph"));

  appendLiveTransferGraphSearchParams(apiUrl, {
    windowMinutes: normalizeLiveTransferGraphWindow(requestUrl.searchParams.get("windowMinutes")),
  });

  const response = await fetch(apiUrl, {
    headers: {
      accept: "application/json",
    },
    signal: request.signal,
  });

  if (!response.ok) {
    throw new Response("Unable to load live transfer graph", {
      status: response.status,
      statusText: response.statusText,
    });
  }

  return response.json();
}
