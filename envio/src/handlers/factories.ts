import { indexer } from "envio";
import type { DiscoveredAddressLabelInput } from "../labels/base-address-labels";
import { insertDiscoveredAddressLabel } from "../lib/labels";

const dexLabel = (
  address: string,
  entityId: string,
  entityName: string,
  label: string,
): DiscoveredAddressLabelInput => ({
  address: address as `0x${string}`,
  attributionGroup: entityId,
  category: "dex",
  confidence: "high",
  countingPolicy: "boundary",
  entityId,
  entityName,
  label,
  role: "pool_instance",
});

const fee = (p: { fee: bigint }) => `fee:${p.fee.toString()}`;
const tickSpacing = (p: { tickSpacing: bigint }) => `tickSpacing:${p.tickSpacing.toString()}`;

indexer.onEvent(
  { contract: "UniswapV3Factory", event: "PoolCreated", fields: { transaction: ["hash"] } },
  async ({ event, context }) => {
    if (context.isPreload) return;
    await insertDiscoveredAddressLabel({
      context,
      event,
      label: dexLabel(event.params.pool, "uniswap-v3", "Uniswap V3", "USDC pool"),
      poolKind: fee(event.params),
      sourceAddress: event.srcAddress,
      sourceEvent: "PoolCreated",
      token0: event.params.token0,
      token1: event.params.token1,
    });
  },
);

indexer.onEvent(
  { contract: "PancakeSwapV3Factory", event: "PoolCreated", fields: { transaction: ["hash"] } },
  async ({ event, context }) => {
    if (context.isPreload) return;
    await insertDiscoveredAddressLabel({
      context,
      event,
      label: dexLabel(event.params.pool, "pancakeswap-v3", "PancakeSwap V3", "USDC pool"),
      poolKind: fee(event.params),
      sourceAddress: event.srcAddress,
      sourceEvent: "PoolCreated",
      token0: event.params.token0,
      token1: event.params.token1,
    });
  },
);

indexer.onEvent(
  { contract: "AerodromePoolFactory", event: "PoolCreated", fields: { transaction: ["hash"] } },
  async ({ event, context }) => {
    if (context.isPreload) return;
    await insertDiscoveredAddressLabel({
      context,
      event,
      label: dexLabel(event.params.pool, "aerodrome", "Aerodrome", "USDC pool"),
      poolKind: event.params.stable ? "stable" : "volatile",
      sourceAddress: event.srcAddress,
      sourceEvent: "PoolCreated",
      token0: event.params.token0,
      token1: event.params.token1,
    });
  },
);

// Three Slipstream factories emit the same event and get the same label.
for (const contract of [
  "AerodromeSlipstreamFactory",
  "AerodromeSlipstream3Factory",
  "AerodromeSlipstreamPoolFactory",
] as const) {
  indexer.onEvent(
    { contract, event: "PoolCreated", fields: { transaction: ["hash"] } },
    async ({ event, context }) => {
      if (context.isPreload) return;
      await insertDiscoveredAddressLabel({
        context,
        event,
        label: dexLabel(event.params.pool, "aerodrome", "Aerodrome", "USDC SlipStream pool"),
        poolKind: tickSpacing(event.params),
        sourceAddress: event.srcAddress,
        sourceEvent: "PoolCreated",
        token0: event.params.token0,
        token1: event.params.token1,
      });
    },
  );
}

indexer.onEvent(
  { contract: "MetaMorphoVaultFactory", event: "CreateMetaMorpho", fields: { transaction: ["hash"] } },
  async ({ event, context }) => {
    if (context.isPreload) return;
    await insertDiscoveredAddressLabel({
      context,
      event,
      label: {
        address: event.params.metaMorpho as `0x${string}`,
        attributionGroup: "morpho-blue",
        category: "lending",
        confidence: "high",
        countingPolicy: "boundary",
        entityId: "morpho-blue",
        entityName: "Morpho Blue",
        label: event.params.name,
        role: "vault",
      },
      poolKind: "erc4626_vault",
      sourceAddress: event.srcAddress,
      sourceEvent: "CreateMetaMorpho",
      token0: event.params.asset,
    });
  },
);
