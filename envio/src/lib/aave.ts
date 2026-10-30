// Ponder reads Aave's USDC reserve through context.client at the event's block. Here the
// read is an effect: batched during preload and cached in the database across restarts.
import { createEffect, S } from "envio";
import { createPublicClient, fallback, http, parseAbi } from "viem";
import { base } from "viem/chains";
import { baseProtocolContracts, baseUsdc } from "./constants";

// Public Base endpoints; set ENVIO_RPC_URL (comma-separated) to use your own.
const DEFAULT_RPC = ["https://mainnet.base.org", "https://base-rpc.publicnode.com"];
const urls = process.env.ENVIO_RPC_URL
  ? process.env.ENVIO_RPC_URL.split(",")
      .map((u) => u.trim())
      .filter(Boolean)
  : DEFAULT_RPC;

const client = createPublicClient({
  chain: base,
  transport: fallback(urls.map((url) => http(url, { batch: true, retryCount: 5, timeout: 30_000 }))),
});

const aaveV3PoolAbi = parseAbi([
  "function getReserveData(address asset) view returns ((uint256 configuration, uint128 liquidityIndex, uint128 currentLiquidityRate, uint128 variableBorrowIndex, uint128 currentVariableBorrowRate, uint128 currentStableBorrowRate, uint40 lastUpdateTimestamp, uint16 id, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint128 accruedToTreasury, uint128 unbacked, uint128 isolationModeTotalDebt))",
]);

export const getAaveUsdcReserveTokens = createEffect(
  {
    name: "getAaveUsdcReserveTokens",
    input: { blockNumber: S.bigint },
    output: {
      aTokenAddress: S.string,
      stableDebtTokenAddress: S.string,
      variableDebtTokenAddress: S.string,
    },
    cache: true,
    rateLimit: false,
  },
  async ({ input }) => {
    const reserveData = await client.readContract({
      abi: aaveV3PoolAbi,
      address: baseProtocolContracts.aaveV3Pool,
      functionName: "getReserveData",
      args: [baseUsdc.address],
      blockNumber: input.blockNumber,
    });

    return {
      aTokenAddress: reserveData.aTokenAddress,
      stableDebtTokenAddress: reserveData.stableDebtTokenAddress,
      variableDebtTokenAddress: reserveData.variableDebtTokenAddress,
    };
  },
);
