import { createConfig } from "ponder";
import { erc20Abi, parseAbi } from "viem";
import { base } from "viem/chains";
import {
  baseDiscoveryStartBlock,
  baseProtocolContracts,
  baseProtocolFactories,
  baseRpcUrl,
  baseUsdc,
} from "./src/chains/base.chain.js";

const uniswapV3FactoryAbi = parseAbi([
  "event PoolCreated(address indexed token0, address indexed token1, uint24 indexed fee, int24 tickSpacing, address pool)",
]);

const aerodromePoolFactoryAbi = parseAbi([
  "event PoolCreated(address indexed token0, address indexed token1, bool indexed stable, address pool, uint256 poolIndex)",
]);

const aerodromeSlipstreamFactoryAbi = parseAbi([
  "event PoolCreated(address indexed token0, address indexed token1, int24 indexed tickSpacing, address pool)",
]);

const metaMorphoVaultFactoryAbi = parseAbi([
  "event CreateMetaMorpho(address indexed metaMorpho, address indexed caller, address initialOwner, uint256 initialTimelock, address indexed asset, string name, string symbol, bytes32 salt)",
]);

const circleCctpTokenMessengerV2Abi = parseAbi([
  "event DepositForBurn(uint64 indexed nonce, address indexed burnToken, uint256 amount, address indexed depositor, bytes32 mintRecipient, uint32 destinationDomain, bytes32 destinationTokenMessenger, bytes32 destinationCaller, uint256 maxFee, uint32 minFinalityThreshold)",
]);

const circleCctpMessageTransmitterV2Abi = parseAbi([
  "event MessageReceived(address indexed caller, uint32 sourceDomain, bytes32 indexed nonce, bytes32 sender, uint32 indexed finalityThresholdExecuted, bytes messageBody)",
]);

const acrossSpokePoolAbi = parseAbi([
  "event V3FundsDeposited(address inputToken, address outputToken, uint256 inputAmount, uint256 outputAmount, uint256 indexed destinationChainId, uint32 indexed depositId, uint32 quoteTimestamp, uint32 fillDeadline, uint32 exclusivityDeadline, address indexed depositor, address recipient, address exclusiveRelayer, bytes message)",
  "event FilledV3Relay(address inputToken, address outputToken, uint256 inputAmount, uint256 outputAmount, uint256 repaymentChainId, uint256 indexed originChainId, uint32 indexed depositId, uint32 fillDeadline, uint32 exclusivityDeadline, address exclusiveRelayer, address indexed relayer, address depositor, address recipient, bytes message, (address updatedRecipient, bytes updatedMessage, uint256 updatedOutputAmount, uint8 fillType) relayExecutionInfo)",
  "event FundsDeposited(bytes32 inputToken, bytes32 outputToken, uint256 inputAmount, uint256 outputAmount, uint256 indexed destinationChainId, uint256 indexed depositId, uint32 quoteTimestamp, uint32 fillDeadline, uint32 exclusivityDeadline, bytes32 indexed depositor, bytes32 recipient, bytes32 exclusiveRelayer, bytes message)",
  "event FilledRelay(bytes32 inputToken, bytes32 outputToken, uint256 inputAmount, uint256 outputAmount, uint256 repaymentChainId, uint256 indexed originChainId, uint256 indexed depositId, uint32 fillDeadline, uint32 exclusivityDeadline, bytes32 exclusiveRelayer, bytes32 indexed relayer, bytes32 depositor, bytes32 recipient, bytes32 messageHash, (bytes32 updatedRecipient, bytes updatedMessage, uint256 updatedOutputAmount, uint8 fillType) relayExecutionInfo)",
]);

export default createConfig({
  chains: {
    base: {
      id: base.id,
      rpc: baseRpcUrl,
      pollingInterval: 2000,
      ethGetLogsBlockRange: 500,
    },
  },
  contracts: {
    BaseUsdc: {
      abi: erc20Abi,
      chain: "base",
      address: baseUsdc.address,
      startBlock: baseDiscoveryStartBlock,
    },
    AcrossSpokePool: {
      abi: acrossSpokePoolAbi,
      chain: "base",
      address: baseProtocolContracts.acrossSpokePool,
      startBlock: baseDiscoveryStartBlock,
    },
    AerodromePoolFactory: {
      abi: aerodromePoolFactoryAbi,
      chain: "base",
      address: baseProtocolFactories.aerodromePoolFactory,
      startBlock: baseDiscoveryStartBlock,
    },
    AerodromeSlipstreamFactory: {
      abi: aerodromeSlipstreamFactoryAbi,
      chain: "base",
      address: baseProtocolFactories.aerodromeSlipstreamFactory,
      startBlock: baseDiscoveryStartBlock,
    },
    AerodromeSlipstream3Factory: {
      abi: aerodromeSlipstreamFactoryAbi,
      chain: "base",
      address: baseProtocolFactories.aerodromeSlipstream3Factory,
      startBlock: baseDiscoveryStartBlock,
    },
    AerodromeSlipstreamPoolFactory: {
      abi: aerodromeSlipstreamFactoryAbi,
      chain: "base",
      address: baseProtocolFactories.aerodromeSlipstreamPoolFactory,
      startBlock: baseDiscoveryStartBlock,
    },
    CircleCctpTokenMessengerV2: {
      abi: circleCctpTokenMessengerV2Abi,
      chain: "base",
      address: baseProtocolContracts.circleCctpTokenMessengerV2,
      startBlock: baseDiscoveryStartBlock,
    },
    CircleCctpMessageTransmitterV2: {
      abi: circleCctpMessageTransmitterV2Abi,
      chain: "base",
      address: baseProtocolContracts.circleCctpMessageTransmitterV2,
      startBlock: baseDiscoveryStartBlock,
    },
    MetaMorphoVaultFactory: {
      abi: metaMorphoVaultFactoryAbi,
      chain: "base",
      address: baseProtocolFactories.metaMorphoVaultFactory,
      startBlock: baseDiscoveryStartBlock,
    },
    PancakeSwapV3Factory: {
      abi: uniswapV3FactoryAbi,
      chain: "base",
      address: baseProtocolFactories.pancakeSwapV3Factory,
      startBlock: baseDiscoveryStartBlock,
    },
    UniswapV3Factory: {
      abi: uniswapV3FactoryAbi,
      chain: "base",
      address: baseProtocolFactories.uniswapV3Factory,
      startBlock: baseDiscoveryStartBlock,
    },
  },
  blocks: {
    AaveReserveDiscovery: {
      chain: "base",
      startBlock: baseDiscoveryStartBlock,
      interval: 1800,
    },
  },
});
