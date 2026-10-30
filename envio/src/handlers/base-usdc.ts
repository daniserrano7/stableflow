import { type EvmOnBlockContext, type EvmOnEventContext, indexer } from "envio";
import { type ResolvedBridgeRemoteNetwork, resolveAcrossRemoteNetwork, resolveCctpRemoteNetwork } from "../chains/external-networks";
import { TransactionNetValueTracker } from "../flows/transaction-net-value";
import { BASE_CHAIN_ID, baseUsdc, bucketSize, getBucketStart, isBaseUsdcToken } from "../lib/constants";
import { recordBlockTimestamp } from "../lib/clock";
import { getEntityFlowUpdates, getEntityPairFlowUpdate } from "../lib/flows";
import { discoverAaveReserveLabels, getFlowLabel } from "../lib/labels";

const AAVE_DISCOVERY_INTERVAL_BLOCKS = 1800;

type Context = EvmOnEventContext | EvmOnBlockContext;
type BridgeDirection = "inbound" | "outbound";

// Only touched in the sequential pass: a preload pass must not advance it.
const transactionNetValue = new TransactionNetValueTracker();
let aaveInitialized = false;

const readUint256FromHex = (value: string, byteOffset: number) => {
  const start = 2 + byteOffset * 2;
  const hexValue = value.slice(start, start + 64);
  return hexValue.length !== 64 ? null : BigInt(`0x${hexValue}`);
};

const readUint32FromHex = (value: string, byteOffset: number) => {
  const start = 2 + byteOffset * 2;
  const hexValue = value.slice(start, start + 8);
  return hexValue.length !== 8 ? null : Number(BigInt(`0x${hexValue}`));
};

export const parseCctpBurnMessageBody = (messageBody: string) => {
  const byteLength = (messageBody.length - 2) / 2;
  if (byteLength < 196) return null;

  const version = readUint32FromHex(messageBody, 0);
  const amount = readUint256FromHex(messageBody, 68);
  const feeExecuted = readUint256FromHex(messageBody, 164);

  if (version !== 1 || amount === null || feeExecuted === null || feeExecuted > amount) return null;

  return { netAmount: amount - feeExecuted };
};

type BridgeEvent = {
  block: { number: number; timestamp: number };
  logIndex: number;
  transaction: { hash: string };
};

const upsertBridgeFlowBucket = async ({
  bridgeId,
  bridgeName,
  context,
  direction,
  event,
  remoteNetwork,
  remoteChainId,
  remoteDomain,
  sourceEvent,
  totalValue,
}: {
  bridgeId: string;
  bridgeName: string;
  context: Context;
  direction: BridgeDirection;
  event: BridgeEvent;
  remoteNetwork: ResolvedBridgeRemoteNetwork;
  remoteChainId?: bigint;
  remoteDomain?: number;
  sourceEvent: string;
  totalValue: bigint;
}) => {
  const blockTimestamp = BigInt(event.block.timestamp);
  const bridgeEventId = `${event.transaction.hash}-${event.logIndex}`;

  context.Usdc_bridge_events.set({
    id: bridgeEventId,
    chain_id: BASE_CHAIN_ID,
    block_number: BigInt(event.block.number),
    block_timestamp: blockTimestamp,
    transaction_hash: event.transaction.hash,
    log_index: event.logIndex,
    token_address: baseUsdc.address,
    bridge_id: bridgeId,
    bridge_name: bridgeName,
    direction,
    source_event: sourceEvent,
    remote_network_id: remoteNetwork.remoteNetworkId,
    remote_network_name: remoteNetwork.remoteNetworkName,
    remote_network_ecosystem: remoteNetwork.remoteNetworkEcosystem,
    bridge_remote_namespace: remoteNetwork.bridgeRemoteNamespace,
    bridge_remote_id: remoteNetwork.bridgeRemoteId,
    remote_chain_id: remoteChainId,
    remote_domain: remoteDomain,
    value: totalValue,
  });

  const bucketStart = getBucketStart(blockTimestamp);
  const id = [
    BASE_CHAIN_ID,
    baseUsdc.address,
    bucketSize,
    bucketStart.toString(),
    bridgeId,
    direction,
    remoteNetwork.remoteNetworkId,
    remoteChainId?.toString() ?? "no-chain",
    remoteDomain?.toString() ?? "no-domain",
  ].join(":");

  const bucket = await context.Usdc_bridge_flow_buckets.get(id);
  context.Usdc_bridge_flow_buckets.set({
    id,
    chain_id: BASE_CHAIN_ID,
    token_address: baseUsdc.address,
    bucket_size: bucketSize,
    bucket_start: bucketStart,
    bridge_id: bridgeId,
    bridge_name: bridgeName,
    direction,
    remote_network_id: remoteNetwork.remoteNetworkId,
    remote_network_name: remoteNetwork.remoteNetworkName,
    remote_network_ecosystem: remoteNetwork.remoteNetworkEcosystem,
    bridge_remote_namespace: remoteNetwork.bridgeRemoteNamespace,
    bridge_remote_id: remoteNetwork.bridgeRemoteId,
    remote_chain_id: remoteChainId,
    remote_domain: remoteDomain,
    event_count: (bucket?.event_count ?? 0n) + 1n,
    total_value: (bucket?.total_value ?? 0n) + totalValue,
  });
};

const bridgeFields = { block: ["timestamp"], transaction: ["hash"] } as const;

indexer.onEvent(
  { contract: "BaseUsdc", event: "Transfer", fields: bridgeFields },
  async ({ event, context }) => {
    const { from, to, value } = event.params;
    const fromLabel = await getFlowLabel(from, context);
    const toLabel = await getFlowLabel(to, context);

    // The preload pass only warms the label reads above.
    if (context.isPreload) return;

    // Aave's reserve tokens are labelled before the first transfer, like Ponder's setup event.
    if (!aaveInitialized) {
      aaveInitialized = true;
      await discoverAaveReserveLabels(
        context,
        BigInt(indexer.chains[BASE_CHAIN_ID].startBlock),
        0n,
      );
    }

    const blockTimestamp = BigInt(event.block.timestamp);
    recordBlockTimestamp(blockTimestamp);
    const transactionHash = event.transaction.hash;
    const bucketStart = getBucketStart(blockTimestamp);
    const bucketId = `${BASE_CHAIN_ID}:${baseUsdc.address}:${bucketSize}:${bucketStart.toString()}`;

    context.Usdc_transfers.set({
      id: `${transactionHash}-${event.logIndex}`,
      chain_id: BASE_CHAIN_ID,
      block_number: BigInt(event.block.number),
      block_timestamp: blockTimestamp,
      transaction_hash: transactionHash,
      log_index: event.logIndex,
      from_address: from,
      to_address: to,
      value,
    });

    // A transaction lives in one block, so its adjusted deltas always land in the same bucket.
    const adjustedValue = transactionNetValue.add({ from, to, transactionHash, value });

    const volumeBucket = await context.Usdc_transfer_volume_buckets.get(bucketId);
    context.Usdc_transfer_volume_buckets.set({
      id: bucketId,
      chain_id: BASE_CHAIN_ID,
      token_address: baseUsdc.address,
      bucket_size: bucketSize,
      bucket_start: bucketStart,
      transfer_count: (volumeBucket?.transfer_count ?? 0n) + 1n,
      total_value: (volumeBucket?.total_value ?? 0n) + value,
      adjusted_value: (volumeBucket?.adjusted_value ?? 0n) + adjustedValue,
    });

    for (const { direction, label } of getEntityFlowUpdates({ fromLabel, toLabel })) {
      const id = [
        BASE_CHAIN_ID,
        baseUsdc.address,
        bucketSize,
        bucketStart.toString(),
        label.entityId,
        direction,
      ].join(":");
      const bucket = await context.Usdc_entity_flow_buckets.get(id);
      context.Usdc_entity_flow_buckets.set({
        id,
        chain_id: BASE_CHAIN_ID,
        token_address: baseUsdc.address,
        bucket_size: bucketSize,
        bucket_start: bucketStart,
        entity_id: label.entityId,
        entity_name: label.entityName,
        category: label.category,
        direction,
        transfer_count: (bucket?.transfer_count ?? 0n) + 1n,
        total_value: (bucket?.total_value ?? 0n) + value,
      });
    }

    const pair = getEntityPairFlowUpdate({ fromLabel, toLabel });
    if (pair !== undefined) {
      const id = [
        BASE_CHAIN_ID,
        baseUsdc.address,
        bucketSize,
        bucketStart.toString(),
        pair.fromLabel.entityId,
        pair.toLabel.entityId,
      ].join(":");
      const bucket = await context.Usdc_entity_pair_flow_buckets.get(id);
      context.Usdc_entity_pair_flow_buckets.set({
        id,
        chain_id: BASE_CHAIN_ID,
        token_address: baseUsdc.address,
        bucket_size: bucketSize,
        bucket_start: bucketStart,
        from_entity_id: pair.fromLabel.entityId,
        from_entity_name: pair.fromLabel.entityName,
        from_category: pair.fromLabel.category,
        to_entity_id: pair.toLabel.entityId,
        to_entity_name: pair.toLabel.entityName,
        to_category: pair.toLabel.category,
        transfer_count: (bucket?.transfer_count ?? 0n) + 1n,
        total_value: (bucket?.total_value ?? 0n) + value,
      });
    }
  },
);

// Ponder's AaveReserveDiscovery block handler: re-read the reserve every 1800 blocks.
indexer.onBlock(
  {
    name: "AaveReserveDiscovery",
    where: () => ({
      block: {
        number: { _gte: indexer.chains[BASE_CHAIN_ID].startBlock, _every: AAVE_DISCOVERY_INTERVAL_BLOCKS },
      },
    }),
  },
  async ({ block, context }) => {
    if (context.isPreload) return;
    aaveInitialized = true;
    await discoverAaveReserveLabels(context, BigInt(block.number), BigInt(block.number));
  },
);

indexer.onEvent(
  { contract: "CircleCctpTokenMessengerV2", event: "DepositForBurn", fields: bridgeFields },
  async ({ event, context }) => {
    if (context.isPreload || !isBaseUsdcToken(event.params.burnToken)) return;

    await upsertBridgeFlowBucket({
      bridgeId: "circle-cctp",
      bridgeName: "Circle CCTP",
      context,
      direction: "outbound",
      event,
      remoteNetwork: resolveCctpRemoteNetwork(Number(event.params.destinationDomain)),
      remoteDomain: Number(event.params.destinationDomain),
      sourceEvent: "DepositForBurn",
      totalValue: event.params.amount,
    });
  },
);

indexer.onEvent(
  { contract: "CircleCctpMessageTransmitterV2", event: "MessageReceived", fields: bridgeFields },
  async ({ event, context }) => {
    if (context.isPreload) return;
    const burnMessageBody = parseCctpBurnMessageBody(event.params.messageBody);
    if (burnMessageBody === null) return;

    await upsertBridgeFlowBucket({
      bridgeId: "circle-cctp",
      bridgeName: "Circle CCTP",
      context,
      direction: "inbound",
      event,
      remoteNetwork: resolveCctpRemoteNetwork(Number(event.params.sourceDomain)),
      remoteDomain: Number(event.params.sourceDomain),
      sourceEvent: "MessageReceived",
      totalValue: burnMessageBody.netAmount,
    });
  },
);

// Across: the v3 events carry addresses, the v4 events bytes32; both are matched on USDC.
const acrossHandlers = [
  { event: "V3FundsDeposited", direction: "outbound", token: "inputToken" },
  { event: "FundsDeposited", direction: "outbound", token: "inputToken" },
  { event: "FilledV3Relay", direction: "inbound", token: "outputToken" },
  { event: "FilledRelay", direction: "inbound", token: "outputToken" },
] as const;

for (const { event: eventName, direction, token } of acrossHandlers) {
  indexer.onEvent(
    { contract: "AcrossSpokePool", event: eventName, fields: bridgeFields },
    async ({ event, context }) => {
      if (context.isPreload) return;
      const params = event.params as {
        inputToken?: string;
        outputToken?: string;
        inputAmount?: bigint;
        destinationChainId?: bigint;
        originChainId?: bigint;
        relayExecutionInfo?: { updatedOutputAmount: bigint };
      };
      if (!isBaseUsdcToken(params[token] as string)) return;

      const remoteChainId = (direction === "outbound" ? params.destinationChainId : params.originChainId) as bigint;
      await upsertBridgeFlowBucket({
        bridgeId: "across",
        bridgeName: "Across",
        context,
        direction,
        event,
        remoteNetwork: resolveAcrossRemoteNetwork(remoteChainId),
        remoteChainId,
        sourceEvent: eventName,
        totalValue:
          direction === "outbound"
            ? (params.inputAmount as bigint)
            : (params.relayExecutionInfo as { updatedOutputAmount: bigint }).updatedOutputAmount,
      });
    },
  );
}
