import { getApiUrl } from "../../config/api.server";

export async function loader({ request }: { request: Request }) {
  const response = await fetch(getApiUrl("/flows/kpis"), {
    headers: {
      accept: "application/json",
    },
    signal: request.signal,
  });

  if (!response.ok) {
    throw new Response("Unable to load flow KPI cards", {
      status: response.status,
      statusText: response.statusText,
    });
  }

  return response.json();
}
