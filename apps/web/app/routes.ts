import { index, type RouteConfig, route } from "@react-router/dev/routes";

export default [
  index("features/home/home.route.tsx"),
  route("design-system", "features/design-system/design-system.route.tsx"),
  route("transfers", "features/transfers/transfers.route.tsx"),
  route("transfers/:transferId", "features/transfers/transfer-detail.route.tsx"),
  // Pre-rename URLs; transfers were briefly called movements.
  route("movements", "features/transfers/movements-redirect.ts", { id: "movements-redirect" }),
  route("movements/:transferId", "features/transfers/movements-redirect.ts", {
    id: "movement-redirect",
  }),
  route("methodology/attribution", "features/methodology/attribution.resource.ts"),
  route("methodology", "features/methodology/methodology.route.tsx"),
  route("entities", "features/entities/entities.route.tsx"),
  route("assets", "features/assets/assets.route.tsx"),
  route("entities/:entityId", "features/entities/entity-detail.route.tsx"),
  route("api/entities/:entityId", "features/entities/entity-detail.resource.ts"),
  route("api/search", "features/search/search.resource.ts"),
  route("api/flows/kpis", "features/flow-kpis/flow-kpis.resource.ts"),
  route("api/flows/live-graph", "features/live-transfers/live-transfer-graph.resource.ts"),
  route("events/transfers", "features/live-transfers/transfers.stream.ts"),
  route("api/flows/top-entities", "features/top-entity-flows/top-entity-flows.resource.ts"),
  route("health", "features/health/health.resource.ts"),
] satisfies RouteConfig;
