import { type Context, ponder } from "ponder:registry";
import {
  discoveredAddressLabels,
  usdcBridgeFlowBuckets,
  usdcEntityFlowBuckets,
  usdcEntityPairFlowBuckets,
  usdcTransfers,
  usdcTransferVolumeBuckets,
} from "ponder:schema";
import { formatUnits, parseAbi } from "viem";
import { base } from "viem/chains";
import { baseProtocolContracts, baseUsdc } from "../chains/base.chain.js";
import {
  type AddressLabel,
  type DiscoveredAddressLabelInput,
  getBaseAddressLabel,
  isFlowBoundaryLabel,
} from "../labels/base-address-labels.js";

const bucketSize = "1m";
const bucketSizeSeconds = 60n;

const aaveV3PoolAbi = parseAbi([
  "function getReserveData(address asset) view returns ((uint256 configuration, uint128 liquidityIndex, uint128 currentLiquidityRate, uint128 variableBorrowIndex, uint128 currentVariableBorrowRate, uint128 currentStableBorrowRate, uint40 lastUpdateTimestamp, uint16 id, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint128 accruedToTreasury, uint128 unbacked, uint128 isolationModeTotalDebt))",
]);

type BlockStats = {
  bucketStart: bigint;
  insertedCount: number;
  processedCount: number;
  totalValue: bigint;
};

const blockStats = new Map<bigint, BlockStats>();
const discoveredFlowLabelsByAddress = new Map<string, FlowLabel>();

type FlowDirection = "in" | "out";
type BridgeDirection = "inbound" | "outbound";

type FlowLabel = Pick<
  AddressLabel,
  "attributionGroup" | "category" | "countingPolicy" | "entityId" | "entityName"
>;

type EntityFlowUpdate = {
  direction: FlowDirection;
  label: FlowLabel;
};

type EntityPairFlowUpdate = {
  fromLabel: FlowLabel;
  toLabel: FlowLabel;
};

type IndexerContext = Context;

const unidentifiedLabel = {
  attributionGroup: "unidentified",
  category: "unidentified",
  countingPolicy: "boundary",
  entityId: "unidentified",
  entityName: "Unidentified",
} as const;

const getAddressLabelId = (address: `0x${string}`) => `${base.id}:${address.toLowerCase()}`;

const zeroAddress = "0x0000000000000000000000000000000000000000";
const zeroHash = "0x0000000000000000000000000000000000000000000000000000000000000000";

const getBucketStart = (timestamp: bigint) => timestamp - (timestamp % bucketSizeSeconds);

const getPaddedAddress = (address: `0x${string}`) =>
  `0x000000000000000000000000${address.slice(2)}`;

const isBaseUsdcToken = (token: `0x${string}`) => {
  const normalizedToken = token.toLowerCase();
  const normalizedBaseUsdc = baseUsdc.address.toLowerCase();

  return (
    normalizedToken === normalizedBaseUsdc ||
    normalizedToken === getPaddedAddress(baseUsdc.address).toLowerCase()
  );
};

const logDiscoveredLabel = ({
  address,
  entityName,
  role,
  sourceType,
}: {
  address: `0x${string}`;
  entityName: string;
  role: string;
  sourceType: string;
}) => {
  console.log(`[discovery] ${entityName} ${role} | ${address} | source=${sourceType}`);
};

const logCompletedBlocks = (currentBlockNumber: bigint) => {
  for (const [blockNumber, stats] of blockStats) {
    if (blockNumber >= currentBlockNumber) {
      continue;
    }

    const volume = formatUnits(stats.totalValue, baseUsdc.decimals);

    console.log(
      `[indexer] Base USDC block ${blockNumber.toString()} | events=${stats.processedCount} | indexed=${stats.insertedCount} | volume=${volume} ${baseUsdc.symbol} | bucket=${new Date(
        Number(stats.bucketStart) * 1000,
      ).toISOString()}`,
    );

    blockStats.delete(blockNumber);
  }
};

const getEntityFlowUpdates = ({
  fromLabel,
  toLabel,
}: {
  fromLabel: FlowLabel | undefined;
  toLabel: FlowLabel | undefined;
}) => {
  if (
    fromLabel !== undefined &&
    toLabel !== undefined &&
    fromLabel.attributionGroup === toLabel.attributionGroup
  ) {
    return [];
  }

  const updates: EntityFlowUpdate[] = [];
  const fromFlowLabel = isFlowBoundaryLabel(fromLabel) ? fromLabel : undefined;
  const toFlowLabel = isFlowBoundaryLabel(toLabel) ? toLabel : undefined;

  if (fromFlowLabel === undefined && toFlowLabel === undefined) {
    updates.push({
      direction: "out",
      label: unidentifiedLabel,
    });
    updates.push({
      direction: "in",
      label: unidentifiedLabel,
    });

    return updates;
  }

  if (fromFlowLabel !== undefined) {
    updates.push({
      direction: "out",
      label: fromFlowLabel,
    });
  } else if (toFlowLabel !== undefined) {
    updates.push({
      direction: "out",
      label: unidentifiedLabel,
    });
  }

  if (toFlowLabel !== undefined) {
    updates.push({
      direction: "in",
      label: toFlowLabel,
    });
  } else if (fromFlowLabel !== undefined) {
    updates.push({
      direction: "in",
      label: unidentifiedLabel,
    });
  }

  return updates;
};

const getEntityPairFlowUpdate = ({
  fromLabel,
  toLabel,
}: {
  fromLabel: FlowLabel | undefined;
  toLabel: FlowLabel | undefined;
}): EntityPairFlowUpdate | undefined => {
  if (
    fromLabel !== undefined &&
    toLabel !== undefined &&
    fromLabel.attributionGroup === toLabel.attributionGroup
  ) {
    return undefined;
  }

  let fromFlowLabel: FlowLabel = unidentifiedLabel;
  let toFlowLabel: FlowLabel = unidentifiedLabel;

  if (fromLabel !== undefined && isFlowBoundaryLabel(fromLabel)) {
    fromFlowLabel = fromLabel;
  }

  if (toLabel !== undefined && isFlowBoundaryLabel(toLabel)) {
    toFlowLabel = toLabel;
  }

  return {
    fromLabel: fromFlowLabel,
    toLabel: toFlowLabel,
  };
};

const upsertBridgeFlowBucket = async ({
  bridgeId,
  bridgeName,
  context,
  direction,
  eventCount = 1n,
  remoteChainId = null,
  remoteDomain = null,
  timestamp,
  totalValue,
}: {
  bridgeId: string;
  bridgeName: string;
  context: IndexerContext;
  direction: BridgeDirection;
  eventCount?: bigint;
  remoteChainId?: bigint | null;
  remoteDomain?: number | null;
  timestamp: bigint;
  totalValue: bigint;
}) => {
  const bucketStart = getBucketStart(timestamp);
  const bridgeBucketId = [
    base.id,
    baseUsdc.address,
    bucketSize,
    bucketStart.toString(),
    bridgeId,
    direction,
    remoteChainId?.toString() ?? "no-chain",
    remoteDomain?.toString() ?? "no-domain",
  ].join(":");

  await context.db
    .insert(usdcBridgeFlowBuckets)
    .values({
      id: bridgeBucketId,
      chainId: base.id,
      tokenAddress: baseUsdc.address,
      bucketSize,
      bucketStart,
      bridgeId,
      bridgeName,
      direction,
      remoteChainId,
      remoteDomain,
      eventCount,
      totalValue,
    })
    .onConflictDoUpdate((row) => ({
      eventCount: row.eventCount + eventCount,
      totalValue: row.totalValue + totalValue,
    }));
};

const getFlowLabel = async ({
  address,
  context,
}: {
  address: `0x${string}`;
  context: IndexerContext;
}): Promise<FlowLabel | undefined> => {
  const staticLabel = getBaseAddressLabel(address);

  if (staticLabel !== undefined) {
    return staticLabel;
  }

  const normalizedAddress = address.toLowerCase();
  const cachedDiscoveredLabel = discoveredFlowLabelsByAddress.get(normalizedAddress);

  if (cachedDiscoveredLabel !== undefined) {
    return cachedDiscoveredLabel;
  }

  const discoveredLabel = await context.db.find(discoveredAddressLabels, {
    id: getAddressLabelId(address),
  });

  if (discoveredLabel === null) {
    return undefined;
  }

  const flowLabel = {
    attributionGroup: discoveredLabel.attributionGroup,
    category: discoveredLabel.category as AddressLabel["category"],
    countingPolicy: discoveredLabel.countingPolicy as AddressLabel["countingPolicy"],
    entityId: discoveredLabel.entityId,
    entityName: discoveredLabel.entityName,
  };

  discoveredFlowLabelsByAddress.set(normalizedAddress, flowLabel);

  return flowLabel;
};

const insertDiscoveredAddressLabel = async ({
  context,
  event,
  firstSeenBlock,
  label,
  poolKind,
  sourceAddress,
  sourceEvent,
  sourceType = "factory_event",
  token0,
  token1 = null,
}: {
  context: IndexerContext;
  event: {
    block?: { number: bigint };
    log?: { logIndex: number };
    transaction: { hash: `0x${string}` };
  };
  firstSeenBlock?: bigint;
  label: DiscoveredAddressLabelInput;
  poolKind: string;
  sourceAddress: `0x${string}`;
  sourceEvent: string;
  sourceType?: "factory_event" | "onchain_state";
  token0: `0x${string}`;
  token1?: `0x${string}` | null;
}) => {
  if (
    token0.toLowerCase() !== baseUsdc.address.toLowerCase() &&
    token1?.toLowerCase() !== baseUsdc.address.toLowerCase()
  ) {
    return;
  }

  const insertedLabel = await context.db
    .insert(discoveredAddressLabels)
    .values({
      id: getAddressLabelId(label.address),
      chainId: base.id,
      address: label.address,
      entityId: label.entityId,
      entityName: label.entityName,
      category: label.category,
      role: label.role,
      attributionGroup: label.attributionGroup,
      countingPolicy: label.countingPolicy,
      confidence: label.confidence,
      sourceType,
      sourceAddress,
      sourceEvent,
      token0,
      token1,
      poolKind,
      firstSeenBlock: firstSeenBlock ?? event.block?.number ?? 0n,
      transactionHash: event.transaction.hash,
      logIndex: event.log?.logIndex ?? 0,
    })
    .onConflictDoNothing();

  discoveredFlowLabelsByAddress.set(label.address.toLowerCase(), label);

  if (insertedLabel !== null) {
    logDiscoveredLabel({
      address: label.address,
      entityName: label.entityName,
      role: label.role,
      sourceType,
    });
  }
};

const insertDiscoveredProtocolLabel = async ({
  context,
  firstSeenBlock,
  label,
  sourceAddress,
  sourceEvent,
}: {
  context: IndexerContext;
  firstSeenBlock?: bigint;
  label: DiscoveredAddressLabelInput;
  sourceAddress: `0x${string}`;
  sourceEvent: string;
}) => {
  if (label.address.toLowerCase() === zeroAddress) {
    return;
  }

  const insertedLabel = await context.db
    .insert(discoveredAddressLabels)
    .values({
      id: getAddressLabelId(label.address),
      chainId: base.id,
      address: label.address,
      entityId: label.entityId,
      entityName: label.entityName,
      category: label.category,
      role: label.role,
      attributionGroup: label.attributionGroup,
      countingPolicy: label.countingPolicy,
      confidence: label.confidence,
      sourceType: "onchain_state",
      sourceAddress,
      sourceEvent,
      token0: baseUsdc.address,
      token1: null,
      poolKind: null,
      firstSeenBlock: firstSeenBlock ?? 0n,
      transactionHash: zeroHash,
      logIndex: 0,
    })
    .onConflictDoNothing();

  discoveredFlowLabelsByAddress.set(label.address.toLowerCase(), label);

  if (insertedLabel !== null) {
    logDiscoveredLabel({
      address: label.address,
      entityName: label.entityName,
      role: label.role,
      sourceType: "onchain_state",
    });
  }
};

const discoverAaveReserveLabels = async ({
  context,
  firstSeenBlock,
}: {
  context: IndexerContext;
  firstSeenBlock?: bigint;
}) => {
  const reserveData = await context.client.readContract({
    abi: aaveV3PoolAbi,
    address: baseProtocolContracts.aaveV3Pool,
    functionName: "getReserveData",
    args: [baseUsdc.address],
  });

  const aTokenAddress = reserveData.aTokenAddress;
  const stableDebtTokenAddress = reserveData.stableDebtTokenAddress;
  const variableDebtTokenAddress = reserveData.variableDebtTokenAddress;

  await insertDiscoveredProtocolLabel({
    context,
    firstSeenBlock,
    label: {
      address: aTokenAddress,
      attributionGroup: "aave-v3",
      category: "lending",
      confidence: "high",
      countingPolicy: "boundary",
      entityId: "aave-v3",
      entityName: "Aave V3",
      label: "USDC aToken",
      role: "a_token",
    },
    sourceAddress: baseProtocolContracts.aaveV3Pool,
    sourceEvent: "getReserveData(USDC)",
  });

  await insertDiscoveredProtocolLabel({
    context,
    firstSeenBlock,
    label: {
      address: stableDebtTokenAddress,
      attributionGroup: "aave-v3",
      category: "lending",
      confidence: "high",
      countingPolicy: "internal",
      entityId: "aave-v3",
      entityName: "Aave V3",
      label: "USDC stable debt token",
      role: "stable_debt_token",
    },
    sourceAddress: baseProtocolContracts.aaveV3Pool,
    sourceEvent: "getReserveData(USDC)",
  });

  await insertDiscoveredProtocolLabel({
    context,
    firstSeenBlock,
    label: {
      address: variableDebtTokenAddress,
      attributionGroup: "aave-v3",
      category: "lending",
      confidence: "high",
      countingPolicy: "internal",
      entityId: "aave-v3",
      entityName: "Aave V3",
      label: "USDC variable debt token",
      role: "variable_debt_token",
    },
    sourceAddress: baseProtocolContracts.aaveV3Pool,
    sourceEvent: "getReserveData(USDC)",
  });
};

ponder.on("BaseUsdc:setup", async ({ context }) => {
  await discoverAaveReserveLabels({ context });
});

ponder.on("AaveReserveDiscovery:block", async ({ event, context }) => {
  await discoverAaveReserveLabels({
    context,
    firstSeenBlock: event.block.number,
  });
});

ponder.on("BaseUsdc:Transfer", async ({ event, context }) => {
  logCompletedBlocks(event.block.number);

  const transferId = `${event.transaction.hash}-${event.log.logIndex}`;
  const bucketStart = getBucketStart(event.block.timestamp);
  const bucketId = `${base.id}:${baseUsdc.address}:${bucketSize}:${bucketStart.toString()}`;

  const insertedTransfer = await context.db
    .insert(usdcTransfers)
    .values({
      id: transferId,
      chainId: base.id,
      blockNumber: event.block.number,
      blockTimestamp: event.block.timestamp,
      transactionHash: event.transaction.hash,
      logIndex: event.log.logIndex,
      fromAddress: event.args.from,
      toAddress: event.args.to,
      value: event.args.value,
    })
    .onConflictDoNothing();

  if (insertedTransfer !== null) {
    await context.db
      .insert(usdcTransferVolumeBuckets)
      .values({
        id: bucketId,
        chainId: base.id,
        tokenAddress: baseUsdc.address,
        bucketSize,
        bucketStart,
        transferCount: 1n,
        totalValue: event.args.value,
      })
      .onConflictDoUpdate((row) => ({
        transferCount: row.transferCount + 1n,
        totalValue: row.totalValue + event.args.value,
      }));

    const fromLabel = await getFlowLabel({ address: event.args.from, context });
    const toLabel = await getFlowLabel({ address: event.args.to, context });
    const entityFlowUpdates = getEntityFlowUpdates({ fromLabel, toLabel });

    for (const { direction, label } of entityFlowUpdates) {
      const entityFlowBucketId = [
        base.id,
        baseUsdc.address,
        bucketSize,
        bucketStart.toString(),
        label.entityId,
        direction,
      ].join(":");

      await context.db
        .insert(usdcEntityFlowBuckets)
        .values({
          id: entityFlowBucketId,
          chainId: base.id,
          tokenAddress: baseUsdc.address,
          bucketSize,
          bucketStart,
          entityId: label.entityId,
          entityName: label.entityName,
          category: label.category,
          direction,
          transferCount: 1n,
          totalValue: event.args.value,
        })
        .onConflictDoUpdate((row) => ({
          transferCount: row.transferCount + 1n,
          totalValue: row.totalValue + event.args.value,
        }));
    }

    const entityPairFlowUpdate = getEntityPairFlowUpdate({ fromLabel, toLabel });

    if (entityPairFlowUpdate !== undefined) {
      const { fromLabel: pairFromLabel, toLabel: pairToLabel } = entityPairFlowUpdate;
      const entityPairFlowBucketId = [
        base.id,
        baseUsdc.address,
        bucketSize,
        bucketStart.toString(),
        pairFromLabel.entityId,
        pairToLabel.entityId,
      ].join(":");

      await context.db
        .insert(usdcEntityPairFlowBuckets)
        .values({
          id: entityPairFlowBucketId,
          chainId: base.id,
          tokenAddress: baseUsdc.address,
          bucketSize,
          bucketStart,
          fromEntityId: pairFromLabel.entityId,
          fromEntityName: pairFromLabel.entityName,
          fromCategory: pairFromLabel.category,
          toEntityId: pairToLabel.entityId,
          toEntityName: pairToLabel.entityName,
          toCategory: pairToLabel.category,
          transferCount: 1n,
          totalValue: event.args.value,
        })
        .onConflictDoUpdate((row) => ({
          transferCount: row.transferCount + 1n,
          totalValue: row.totalValue + event.args.value,
        }));
    }
  }

  const stats = blockStats.get(event.block.number) ?? {
    bucketStart,
    insertedCount: 0,
    processedCount: 0,
    totalValue: 0n,
  };

  stats.processedCount += 1;

  if (insertedTransfer !== null) {
    stats.insertedCount += 1;
    stats.totalValue += event.args.value;
  }

  blockStats.set(event.block.number, stats);
});

ponder.on("CircleCctpTokenMessengerV2:DepositForBurn", async ({ event, context }) => {
  if (!isBaseUsdcToken(event.args.burnToken)) {
    return;
  }

  await upsertBridgeFlowBucket({
    bridgeId: "circle-cctp",
    bridgeName: "Circle CCTP",
    context,
    direction: "outbound",
    remoteDomain: event.args.destinationDomain,
    timestamp: event.block.timestamp,
    totalValue: event.args.amount,
  });
});

ponder.on("CircleCctpTokenMessengerV2:MintAndWithdraw", async ({ event, context }) => {
  if (!isBaseUsdcToken(event.args.mintToken)) {
    return;
  }

  await upsertBridgeFlowBucket({
    bridgeId: "circle-cctp",
    bridgeName: "Circle CCTP",
    context,
    direction: "inbound",
    timestamp: event.block.timestamp,
    totalValue: event.args.amount,
  });
});

ponder.on("AcrossSpokePool:V3FundsDeposited", async ({ event, context }) => {
  if (!isBaseUsdcToken(event.args.inputToken)) {
    return;
  }

  await upsertBridgeFlowBucket({
    bridgeId: "across",
    bridgeName: "Across",
    context,
    direction: "outbound",
    remoteChainId: event.args.destinationChainId,
    timestamp: event.block.timestamp,
    totalValue: event.args.inputAmount,
  });
});

ponder.on("AcrossSpokePool:FilledV3Relay", async ({ event, context }) => {
  if (!isBaseUsdcToken(event.args.outputToken)) {
    return;
  }

  await upsertBridgeFlowBucket({
    bridgeId: "across",
    bridgeName: "Across",
    context,
    direction: "inbound",
    remoteChainId: event.args.originChainId,
    timestamp: event.block.timestamp,
    totalValue: event.args.relayExecutionInfo.updatedOutputAmount,
  });
});

ponder.on("AcrossSpokePool:FundsDeposited", async ({ event, context }) => {
  if (!isBaseUsdcToken(event.args.inputToken)) {
    return;
  }

  await upsertBridgeFlowBucket({
    bridgeId: "across",
    bridgeName: "Across",
    context,
    direction: "outbound",
    remoteChainId: event.args.destinationChainId,
    timestamp: event.block.timestamp,
    totalValue: event.args.inputAmount,
  });
});

ponder.on("AcrossSpokePool:FilledRelay", async ({ event, context }) => {
  if (!isBaseUsdcToken(event.args.outputToken)) {
    return;
  }

  await upsertBridgeFlowBucket({
    bridgeId: "across",
    bridgeName: "Across",
    context,
    direction: "inbound",
    remoteChainId: event.args.originChainId,
    timestamp: event.block.timestamp,
    totalValue: event.args.relayExecutionInfo.updatedOutputAmount,
  });
});

ponder.on("UniswapV3Factory:PoolCreated", async ({ event, context }) => {
  await insertDiscoveredAddressLabel({
    context,
    event,
    label: {
      address: event.args.pool,
      attributionGroup: "uniswap-v3",
      category: "dex",
      confidence: "high",
      countingPolicy: "boundary",
      entityId: "uniswap-v3",
      entityName: "Uniswap V3",
      label: "USDC pool",
      role: "pool_instance",
    },
    poolKind: `fee:${event.args.fee.toString()}`,
    sourceAddress: event.log.address,
    sourceEvent: "PoolCreated",
    token0: event.args.token0,
    token1: event.args.token1,
  });
});

ponder.on("PancakeSwapV3Factory:PoolCreated", async ({ event, context }) => {
  await insertDiscoveredAddressLabel({
    context,
    event,
    label: {
      address: event.args.pool,
      attributionGroup: "pancakeswap-v3",
      category: "dex",
      confidence: "high",
      countingPolicy: "boundary",
      entityId: "pancakeswap-v3",
      entityName: "PancakeSwap V3",
      label: "USDC pool",
      role: "pool_instance",
    },
    poolKind: `fee:${event.args.fee.toString()}`,
    sourceAddress: event.log.address,
    sourceEvent: "PoolCreated",
    token0: event.args.token0,
    token1: event.args.token1,
  });
});

ponder.on("AerodromePoolFactory:PoolCreated", async ({ event, context }) => {
  await insertDiscoveredAddressLabel({
    context,
    event,
    label: {
      address: event.args.pool,
      attributionGroup: "aerodrome",
      category: "dex",
      confidence: "high",
      countingPolicy: "boundary",
      entityId: "aerodrome",
      entityName: "Aerodrome",
      label: "USDC pool",
      role: "pool_instance",
    },
    poolKind: event.args.stable ? "stable" : "volatile",
    sourceAddress: event.log.address,
    sourceEvent: "PoolCreated",
    token0: event.args.token0,
    token1: event.args.token1,
  });
});

ponder.on("AerodromeSlipstreamFactory:PoolCreated", async ({ event, context }) => {
  await insertDiscoveredAddressLabel({
    context,
    event,
    label: {
      address: event.args.pool,
      attributionGroup: "aerodrome",
      category: "dex",
      confidence: "high",
      countingPolicy: "boundary",
      entityId: "aerodrome",
      entityName: "Aerodrome",
      label: "USDC SlipStream pool",
      role: "pool_instance",
    },
    poolKind: `tickSpacing:${event.args.tickSpacing.toString()}`,
    sourceAddress: event.log.address,
    sourceEvent: "PoolCreated",
    token0: event.args.token0,
    token1: event.args.token1,
  });
});

ponder.on("AerodromeSlipstreamPoolFactory:PoolCreated", async ({ event, context }) => {
  await insertDiscoveredAddressLabel({
    context,
    event,
    label: {
      address: event.args.pool,
      attributionGroup: "aerodrome",
      category: "dex",
      confidence: "high",
      countingPolicy: "boundary",
      entityId: "aerodrome",
      entityName: "Aerodrome",
      label: "USDC SlipStream pool",
      role: "pool_instance",
    },
    poolKind: `tickSpacing:${event.args.tickSpacing.toString()}`,
    sourceAddress: event.log.address,
    sourceEvent: "PoolCreated",
    token0: event.args.token0,
    token1: event.args.token1,
  });
});

ponder.on("MetaMorphoVaultFactory:CreateMetaMorpho", async ({ event, context }) => {
  await insertDiscoveredAddressLabel({
    context,
    event,
    label: {
      address: event.args.metaMorpho,
      attributionGroup: "morpho-blue",
      category: "lending",
      confidence: "high",
      countingPolicy: "boundary",
      entityId: "morpho-blue",
      entityName: "Morpho Blue",
      label: event.args.name,
      role: "vault",
    },
    poolKind: "erc4626_vault",
    sourceAddress: event.log.address,
    sourceEvent: "CreateMetaMorpho",
    token0: event.args.asset,
  });
});
