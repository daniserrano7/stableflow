import strategy from "../../../../../docs/usdc-flow-attribution-strategy.md?raw";

export function loader() {
  return new Response(strategy, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
