import { type Address, createPublicClient, http, parseAbi } from "viem";
import { base } from "viem/chains";
import { baseProtocolFactories, baseRpcUrl, baseUsdc } from "../src/chains/base.chain.js";
import type { CandidateVerification, UnidentifiedAddressCandidate } from "./candidates.js";

const poolIdentityAbi = parseAbi([
  "function factory() view returns (address)",
  "function token0() view returns (address)",
  "function token1() view returns (address)",
]);

const v3PoolAbi = parseAbi(["function fee() view returns (uint24)"]);
const v3FactoryAbi = parseAbi([
  "function getPool(address tokenA, address tokenB, uint24 fee) view returns (address)",
]);

const aerodromeFactoryAbi = parseAbi(["function isPool(address pool) view returns (bool)"]);

const aerodromePoolAbi = parseAbi(["function stable() view returns (bool)"]);

const aerodromeSlipstreamPoolAbi = parseAbi(["function tickSpacing() view returns (int24)"]);

type FactoryMetadata = {
  attributionGroup: string;
  entityId: string;
  entityName: string;
  factoryAddress: Address;
  isFactoryPool: (poolAddress: Address, token0: Address, token1: Address) => Promise<boolean>;
  poolKind: (poolAddress: Address) => Promise<string>;
  sourceEvent: string;
  verifier: string;
};

const publicClient = createPublicClient({
  chain: base,
  transport: http(baseRpcUrl),
});

const isBaseUsdcPair = (token0: Address, token1: Address) =>
  token0.toLowerCase() === baseUsdc.address.toLowerCase() ||
  token1.toLowerCase() === baseUsdc.address.toLowerCase();

const safeReadPoolKind = async (fallback: string, read: () => Promise<string>) => {
  try {
    return await read();
  } catch {
    return fallback;
  }
};

const factoryMetadataByAddress = new Map<string, FactoryMetadata>(
  (
    [
      {
        attributionGroup: "uniswap-v3",
        entityId: "uniswap-v3",
        entityName: "Uniswap V3",
        factoryAddress: baseProtocolFactories.uniswapV3Factory,
        isFactoryPool: async (poolAddress, token0, token1) => {
          const fee = await publicClient.readContract({
            abi: v3PoolAbi,
            address: poolAddress,
            functionName: "fee",
          });
          const registeredPool = await publicClient.readContract({
            abi: v3FactoryAbi,
            address: baseProtocolFactories.uniswapV3Factory,
            functionName: "getPool",
            args: [token0, token1, fee],
          });
          return registeredPool.toLowerCase() === poolAddress.toLowerCase();
        },
        poolKind: (poolAddress) =>
          safeReadPoolKind("v3_pool", async () => {
            const fee = await publicClient.readContract({
              abi: v3PoolAbi,
              address: poolAddress,
              functionName: "fee",
            });

            return `fee:${fee.toString()}`;
          }),
        sourceEvent: "factory.getPool(token0, token1, fee)",
        verifier: "uniswap_v3_pool_identity",
      },
      {
        attributionGroup: "pancakeswap-v3",
        entityId: "pancakeswap-v3",
        entityName: "PancakeSwap V3",
        factoryAddress: baseProtocolFactories.pancakeSwapV3Factory,
        isFactoryPool: async (poolAddress, token0, token1) => {
          const fee = await publicClient.readContract({
            abi: v3PoolAbi,
            address: poolAddress,
            functionName: "fee",
          });
          const registeredPool = await publicClient.readContract({
            abi: v3FactoryAbi,
            address: baseProtocolFactories.pancakeSwapV3Factory,
            functionName: "getPool",
            args: [token0, token1, fee],
          });
          return registeredPool.toLowerCase() === poolAddress.toLowerCase();
        },
        poolKind: (poolAddress) =>
          safeReadPoolKind("v3_pool", async () => {
            const fee = await publicClient.readContract({
              abi: v3PoolAbi,
              address: poolAddress,
              functionName: "fee",
            });

            return `fee:${fee.toString()}`;
          }),
        sourceEvent: "factory.getPool(token0, token1, fee)",
        verifier: "pancakeswap_v3_pool_identity",
      },
      {
        attributionGroup: "aerodrome",
        entityId: "aerodrome",
        entityName: "Aerodrome",
        factoryAddress: baseProtocolFactories.aerodromePoolFactory,
        isFactoryPool: (poolAddress) =>
          publicClient.readContract({
            abi: aerodromeFactoryAbi,
            address: baseProtocolFactories.aerodromePoolFactory,
            functionName: "isPool",
            args: [poolAddress],
          }),
        poolKind: (poolAddress) =>
          safeReadPoolKind("aerodrome_pool", async () => {
            const stable = await publicClient.readContract({
              abi: aerodromePoolAbi,
              address: poolAddress,
              functionName: "stable",
            });

            return stable ? "stable" : "volatile";
          }),
        sourceEvent: "factory.isPool(pool)",
        verifier: "aerodrome_pool_identity",
      },
      {
        attributionGroup: "aerodrome",
        entityId: "aerodrome",
        entityName: "Aerodrome",
        factoryAddress: baseProtocolFactories.aerodromeSlipstreamFactory,
        isFactoryPool: (poolAddress) =>
          publicClient.readContract({
            abi: aerodromeFactoryAbi,
            address: baseProtocolFactories.aerodromeSlipstreamFactory,
            functionName: "isPool",
            args: [poolAddress],
          }),
        poolKind: (poolAddress) =>
          safeReadPoolKind("slipstream_pool", async () => {
            const tickSpacing = await publicClient.readContract({
              abi: aerodromeSlipstreamPoolAbi,
              address: poolAddress,
              functionName: "tickSpacing",
            });

            return `tickSpacing:${tickSpacing.toString()}`;
          }),
        sourceEvent: "factory.isPool(pool)",
        verifier: "aerodrome_slipstream_pool_identity",
      },
      {
        attributionGroup: "aerodrome",
        entityId: "aerodrome",
        entityName: "Aerodrome",
        factoryAddress: baseProtocolFactories.aerodromeSlipstream3Factory,
        isFactoryPool: (poolAddress) =>
          publicClient.readContract({
            abi: aerodromeFactoryAbi,
            address: baseProtocolFactories.aerodromeSlipstream3Factory,
            functionName: "isPool",
            args: [poolAddress],
          }),
        poolKind: (poolAddress) =>
          safeReadPoolKind("slipstream_pool", async () => {
            const tickSpacing = await publicClient.readContract({
              abi: aerodromeSlipstreamPoolAbi,
              address: poolAddress,
              functionName: "tickSpacing",
            });

            return `tickSpacing:${tickSpacing.toString()}`;
          }),
        sourceEvent: "factory.isPool(pool)",
        verifier: "aerodrome_slipstream_pool_identity",
      },
      {
        attributionGroup: "aerodrome",
        entityId: "aerodrome",
        entityName: "Aerodrome",
        factoryAddress: baseProtocolFactories.aerodromeSlipstreamPoolFactory,
        isFactoryPool: (poolAddress) =>
          publicClient.readContract({
            abi: aerodromeFactoryAbi,
            address: baseProtocolFactories.aerodromeSlipstreamPoolFactory,
            functionName: "isPool",
            args: [poolAddress],
          }),
        poolKind: (poolAddress) =>
          safeReadPoolKind("slipstream_pool", async () => {
            const tickSpacing = await publicClient.readContract({
              abi: aerodromeSlipstreamPoolAbi,
              address: poolAddress,
              functionName: "tickSpacing",
            });

            return `tickSpacing:${tickSpacing.toString()}`;
          }),
        sourceEvent: "factory.isPool(pool)",
        verifier: "aerodrome_slipstream_pool_identity",
      },
    ] satisfies FactoryMetadata[]
  ).map((metadata) => [metadata.factoryAddress.toLowerCase(), metadata]),
);

export const verifyDexPoolCandidate = async (
  candidate: UnidentifiedAddressCandidate,
): Promise<CandidateVerification | null> => {
  try {
    const [factory, token0, token1] = await Promise.all([
      publicClient.readContract({
        abi: poolIdentityAbi,
        address: candidate.address,
        functionName: "factory",
      }),
      publicClient.readContract({
        abi: poolIdentityAbi,
        address: candidate.address,
        functionName: "token0",
      }),
      publicClient.readContract({
        abi: poolIdentityAbi,
        address: candidate.address,
        functionName: "token1",
      }),
    ]);

    if (!isBaseUsdcPair(token0, token1)) {
      return null;
    }

    const factoryMetadata = factoryMetadataByAddress.get(factory.toLowerCase());

    if (factoryMetadata === undefined) {
      return null;
    }

    if (!(await factoryMetadata.isFactoryPool(candidate.address, token0, token1))) {
      return null;
    }

    const poolKind = await factoryMetadata.poolKind(candidate.address);

    return {
      attributionGroup: factoryMetadata.attributionGroup,
      confidence: "high",
      countingPolicy: "boundary",
      evidenceDetails: JSON.stringify({
        factory,
        factoryMembership: true,
        token0,
        token1,
      }),
      evidenceSource: "onchain_factory_membership",
      poolKind,
      sourceAddress: factory,
      sourceEvent: factoryMetadata.sourceEvent,
      suggestedCategory: "dex",
      suggestedEntityId: factoryMetadata.entityId,
      suggestedEntityName: factoryMetadata.entityName,
      suggestedRole: "pool_instance",
      token0,
      token1,
      verifier: factoryMetadata.verifier,
    };
  } catch {
    return null;
  }
};

export const verifyCandidate = async (
  candidate: UnidentifiedAddressCandidate,
): Promise<CandidateVerification | null> => verifyDexPoolCandidate(candidate);
