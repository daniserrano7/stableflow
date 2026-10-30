import type { EvmOnBlockContext, EvmOnEventContext } from "envio";
import { type AddressLabel, type DiscoveredAddressLabelInput, getBaseAddressLabel } from "../labels/base-address-labels";
import { BASE_CHAIN_ID, baseProtocolContracts, baseUsdc, zeroAddress, zeroHash } from "./constants";
import { getAaveUsdcReserveTokens } from "./aave";

export type FlowLabel = Pick<
  AddressLabel,
  "attributionGroup" | "category" | "countingPolicy" | "entityId" | "entityName"
>;

type Context = EvmOnEventContext | EvmOnBlockContext;

const getAddressLabelId = (address: string) => `${BASE_CHAIN_ID}:${address.toLowerCase()}`;

// Discovered labels never change once written, so a cache is safe. Only filled from
// database reads and from the sequential pass, never from a preload pass.
const discoveredFlowLabelsByAddress = new Map<string, FlowLabel>();

export const getFlowLabel = async (address: string, context: Context): Promise<FlowLabel | undefined> => {
  const staticLabel = getBaseAddressLabel(address as `0x${string}`);
  if (staticLabel !== undefined) return staticLabel;

  const normalizedAddress = address.toLowerCase();
  const cached = discoveredFlowLabelsByAddress.get(normalizedAddress);
  if (cached !== undefined) return cached;

  const discoveredLabel = await context.Discovered_address_labels.get(getAddressLabelId(address));
  if (discoveredLabel === undefined) return undefined;

  const flowLabel = {
    attributionGroup: discoveredLabel.attribution_group,
    category: discoveredLabel.category as AddressLabel["category"],
    countingPolicy: discoveredLabel.counting_policy as AddressLabel["countingPolicy"],
    entityId: discoveredLabel.entity_id,
    entityName: discoveredLabel.entity_name,
  };
  discoveredFlowLabelsByAddress.set(normalizedAddress, flowLabel);
  return flowLabel;
};

/** Like Ponder's onConflictDoNothing: the first label written for an address wins. */
const insertLabelIfMissing = async (
  context: Context,
  label: DiscoveredAddressLabelInput,
  row: {
    sourceType: string;
    sourceAddress: string;
    sourceEvent: string;
    token0: string;
    token1: string | undefined;
    poolKind: string | undefined;
    firstSeenBlock: bigint;
    transactionHash: string;
    logIndex: number;
  },
) => {
  const id = getAddressLabelId(label.address);
  const existing = await context.Discovered_address_labels.get(id);

  if (existing === undefined) {
    context.Discovered_address_labels.set({
      id,
      chain_id: BASE_CHAIN_ID,
      address: label.address.toLowerCase(),
      entity_id: label.entityId,
      entity_name: label.entityName,
      category: label.category,
      role: label.role,
      attribution_group: label.attributionGroup,
      counting_policy: label.countingPolicy,
      confidence: label.confidence,
      source_type: row.sourceType,
      source_address: row.sourceAddress.toLowerCase(),
      source_event: row.sourceEvent,
      token0: row.token0.toLowerCase(),
      token1: row.token1?.toLowerCase(),
      pool_kind: row.poolKind,
      first_seen_block: row.firstSeenBlock,
      transaction_hash: row.transactionHash,
      log_index: row.logIndex,
    });
    context.log.info(`[discovery] ${label.entityName} ${label.role} | ${label.address} | source=${row.sourceType}`);
  }

  // Ponder caches the label it was given even when the insert was a no-op.
  discoveredFlowLabelsByAddress.set(label.address.toLowerCase(), label);
};

/** Pool and vault labels from factory events. Only pools that hold USDC are kept. */
export const insertDiscoveredAddressLabel = async ({
  context,
  event,
  label,
  poolKind,
  sourceAddress,
  sourceEvent,
  token0,
  token1,
}: {
  context: Context;
  event: { block: { number: number }; logIndex: number; transaction: { hash: string } };
  label: DiscoveredAddressLabelInput;
  poolKind: string;
  sourceAddress: string;
  sourceEvent: string;
  token0: string;
  token1?: string;
}) => {
  const usdc = baseUsdc.address.toLowerCase();
  if (token0.toLowerCase() !== usdc && token1?.toLowerCase() !== usdc) return;

  await insertLabelIfMissing(context, label, {
    sourceType: "factory_event",
    sourceAddress,
    sourceEvent,
    token0,
    token1,
    poolKind,
    firstSeenBlock: BigInt(event.block.number),
    transactionHash: event.transaction.hash,
    logIndex: event.logIndex,
  });
};

const insertDiscoveredProtocolLabel = async (
  context: Context,
  label: DiscoveredAddressLabelInput,
  firstSeenBlock: bigint,
) => {
  if (label.address.toLowerCase() === zeroAddress) return;

  await insertLabelIfMissing(context, label, {
    sourceType: "onchain_state",
    sourceAddress: baseProtocolContracts.aaveV3Pool,
    sourceEvent: "getReserveData(USDC)",
    token0: baseUsdc.address,
    token1: undefined,
    poolKind: undefined,
    firstSeenBlock,
    transactionHash: zeroHash,
    logIndex: 0,
  });
};

const aaveLabel = (
  address: string,
  countingPolicy: "boundary" | "internal",
  label: string,
  role: string,
): DiscoveredAddressLabelInput => ({
  address: address as `0x${string}`,
  attributionGroup: "aave-v3",
  category: "lending",
  confidence: "high",
  countingPolicy,
  entityId: "aave-v3",
  entityName: "Aave V3",
  label,
  role,
});

/** Reads Aave's USDC reserve at `blockNumber` and labels its aToken and debt tokens. */
export const discoverAaveReserveLabels = async (
  context: Context,
  blockNumber: bigint,
  firstSeenBlock: bigint,
) => {
  const tokens = await context.effect(getAaveUsdcReserveTokens, { blockNumber });

  await insertDiscoveredProtocolLabel(
    context,
    aaveLabel(tokens.aTokenAddress, "boundary", "USDC aToken", "a_token"),
    firstSeenBlock,
  );
  await insertDiscoveredProtocolLabel(
    context,
    aaveLabel(tokens.stableDebtTokenAddress, "internal", "USDC stable debt token", "stable_debt_token"),
    firstSeenBlock,
  );
  await insertDiscoveredProtocolLabel(
    context,
    aaveLabel(tokens.variableDebtTokenAddress, "internal", "USDC variable debt token", "variable_debt_token"),
    firstSeenBlock,
  );
};
