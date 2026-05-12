import { index, type RouteConfig, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("design-system", "routes/design-system.tsx"),
  route("entities", "routes/entities.tsx"),
  route("events/transfers", "routes/events.transfers.ts"),
] satisfies RouteConfig;
