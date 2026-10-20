// Deploy healthcheck. It deliberately skips the API so an API outage can't block web deploys.
export function loader() {
  return Response.json(
    { service: "stableflow-web", status: "ok" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
