import { getApiUrl } from "../config/api.server";

export async function loader({ request }: { request: Request }) {
  const requestUrl = new URL(request.url);
  const apiUrl = new URL(getApiUrl("/transfers/live"));

  for (const [key, value] of requestUrl.searchParams) {
    apiUrl.searchParams.set(key, value);
  }

  const response = await fetch(apiUrl, {
    headers: {
      accept: "text/event-stream",
    },
    signal: request.signal,
  });

  if (!response.ok || response.body === null) {
    throw new Response("Unable to connect to transfer stream", {
      status: response.status,
      statusText: response.statusText,
    });
  }

  return new Response(response.body, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream",
    },
  });
}
