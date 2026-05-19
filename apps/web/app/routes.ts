import { index, type RouteConfig, route } from "@react-router/dev/routes";

export default [
  index("features/home/home.route.tsx"),
  route("design-system", "features/design-system/design-system.route.tsx"),
  route("entities", "features/entities/entities.route.tsx"),
  route("api/flows/live-graph", "features/live-transfers/live-transfer-graph.resource.ts"),
  route("events/transfers", "features/live-transfers/transfers.stream.ts"),
  route("api/flows/top-entities", "features/top-entity-flows/top-entity-flows.resource.ts"),
] satisfies RouteConfig;
