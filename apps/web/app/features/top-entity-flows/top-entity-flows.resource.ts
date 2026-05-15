import { getApiUrl } from "../../config/api.server";
import {
  appendTopEntityFlowSearchParams,
  normalizeTopEntityFlowMode,
  normalizeTopEntityFlowWindow,
} from "./top-entity-flows.params";

export async function loader({ request }: { request: Request }) {
  const requestUrl = new URL(request.url);
  const apiUrl = new URL(getApiUrl("/flows/top-entities"));

  appendTopEntityFlowSearchParams(apiUrl, {
    mode: normalizeTopEntityFlowMode(requestUrl.searchParams.get("mode")),
    windowMinutes: normalizeTopEntityFlowWindow(requestUrl.searchParams.get("windowMinutes")),
  });

  const response = await fetch(apiUrl, {
    headers: {
      accept: "application/json",
    },
    signal: request.signal,
  });

  if (!response.ok) {
    throw new Response("Unable to load top entity flows", {
      status: response.status,
      statusText: response.statusText,
    });
  }

  return response.json();
}
