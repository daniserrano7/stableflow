export type ExternalNetworkEcosystem = "evm" | "svm" | "unknown";

export type ExternalNetwork = {
  acrossChainId?: bigint;
  caip2: string;
  cctpDomain?: number;
  ecosystem: ExternalNetworkEcosystem;
  id: string;
  name: string;
};

export type BridgeRemoteNamespace = "across-chain-id" | "cctp-domain";

export type ResolvedBridgeRemoteNetwork = {
  bridgeRemoteId: string;
  bridgeRemoteNamespace: BridgeRemoteNamespace;
  remoteNetworkEcosystem: ExternalNetworkEcosystem;
  remoteNetworkId: string;
  remoteNetworkName: string;
};

const externalNetworks: readonly ExternalNetwork[] = [
  {
    acrossChainId: 1n,
    caip2: "eip155:1",
    cctpDomain: 0,
    ecosystem: "evm",
    id: "ethereum",
    name: "Ethereum",
  },
  {
    caip2: "eip155:43114",
    cctpDomain: 1,
    ecosystem: "evm",
    id: "avalanche",
    name: "Avalanche",
  },
  {
    acrossChainId: 10n,
    caip2: "eip155:10",
    cctpDomain: 2,
    ecosystem: "evm",
    id: "optimism",
    name: "OP Mainnet",
  },
  {
    acrossChainId: 42161n,
    caip2: "eip155:42161",
    cctpDomain: 3,
    ecosystem: "evm",
    id: "arbitrum",
    name: "Arbitrum",
  },
  {
    acrossChainId: 34268394551451n,
    caip2: "solana:mainnet",
    cctpDomain: 5,
    ecosystem: "svm",
    id: "solana",
    name: "Solana",
  },
  {
    acrossChainId: 8453n,
    caip2: "eip155:8453",
    cctpDomain: 6,
    ecosystem: "evm",
    id: "base",
    name: "Base",
  },
  {
    acrossChainId: 137n,
    caip2: "eip155:137",
    cctpDomain: 7,
    ecosystem: "evm",
    id: "polygon",
    name: "Polygon PoS",
  },
  {
    acrossChainId: 130n,
    caip2: "eip155:130",
    cctpDomain: 10,
    ecosystem: "evm",
    id: "unichain",
    name: "Unichain",
  },
  {
    acrossChainId: 59144n,
    caip2: "eip155:59144",
    cctpDomain: 11,
    ecosystem: "evm",
    id: "linea",
    name: "Linea",
  },
  {
    cctpDomain: 12,
    caip2: "eip155:81224",
    ecosystem: "evm",
    id: "codex",
    name: "Codex",
  },
  {
    cctpDomain: 13,
    caip2: "eip155:146",
    ecosystem: "evm",
    id: "sonic",
    name: "Sonic",
  },
  {
    acrossChainId: 480n,
    caip2: "eip155:480",
    cctpDomain: 14,
    ecosystem: "evm",
    id: "world-chain",
    name: "World Chain",
  },
  {
    acrossChainId: 143n,
    caip2: "eip155:143",
    cctpDomain: 15,
    ecosystem: "evm",
    id: "monad",
    name: "Monad",
  },
  {
    cctpDomain: 16,
    caip2: "eip155:1329",
    ecosystem: "evm",
    id: "sei",
    name: "Sei",
  },
  {
    acrossChainId: 56n,
    caip2: "eip155:56",
    cctpDomain: 17,
    ecosystem: "evm",
    id: "bnb-smart-chain",
    name: "BNB Smart Chain",
  },
  {
    cctpDomain: 18,
    caip2: "eip155:50",
    ecosystem: "evm",
    id: "xdc",
    name: "XDC",
  },
  {
    acrossChainId: 999n,
    caip2: "eip155:999",
    cctpDomain: 19,
    ecosystem: "evm",
    id: "hyperevm",
    name: "HyperEVM",
  },
  {
    acrossChainId: 57073n,
    caip2: "eip155:57073",
    cctpDomain: 21,
    ecosystem: "evm",
    id: "ink",
    name: "Ink",
  },
  {
    cctpDomain: 22,
    caip2: "eip155:98866",
    ecosystem: "evm",
    id: "plume",
    name: "Plume",
  },
  {
    cctpDomain: 25,
    caip2: "starknet:mainnet",
    ecosystem: "unknown",
    id: "starknet",
    name: "Starknet",
  },
  {
    cctpDomain: 26,
    caip2: "arc:testnet",
    ecosystem: "unknown",
    id: "arc-testnet",
    name: "Arc Testnet",
  },
  {
    cctpDomain: 27,
    caip2: "stellar:mainnet",
    ecosystem: "unknown",
    id: "stellar",
    name: "Stellar",
  },
  {
    cctpDomain: 28,
    caip2: "eip155:5751",
    ecosystem: "evm",
    id: "edge",
    name: "EDGE",
  },
  {
    cctpDomain: 29,
    caip2: "injective:testnet",
    ecosystem: "unknown",
    id: "injective-testnet",
    name: "Injective Testnet",
  },
  {
    cctpDomain: 30,
    caip2: "eip155:2818",
    ecosystem: "evm",
    id: "morph",
    name: "Morph",
  },
  {
    cctpDomain: 31,
    caip2: "eip155:688688",
    ecosystem: "evm",
    id: "pharos-testnet",
    name: "Pharos Testnet",
  },
  {
    acrossChainId: 81457n,
    caip2: "eip155:81457",
    ecosystem: "evm",
    id: "blast",
    name: "Blast",
  },
  {
    acrossChainId: 232n,
    caip2: "eip155:232",
    ecosystem: "evm",
    id: "lens",
    name: "Lens",
  },
  {
    acrossChainId: 1135n,
    caip2: "eip155:1135",
    ecosystem: "evm",
    id: "lisk",
    name: "Lisk",
  },
  {
    acrossChainId: 4326n,
    caip2: "eip155:4326",
    ecosystem: "evm",
    id: "megaeth",
    name: "MegaETH",
  },
  {
    acrossChainId: 34443n,
    caip2: "eip155:34443",
    ecosystem: "evm",
    id: "mode",
    name: "Mode",
  },
  {
    acrossChainId: 9745n,
    caip2: "eip155:9745",
    ecosystem: "evm",
    id: "plasma",
    name: "Plasma",
  },
  {
    acrossChainId: 1868n,
    caip2: "eip155:1868",
    ecosystem: "evm",
    id: "soneium",
    name: "Soneium",
  },
  {
    acrossChainId: 4217n,
    caip2: "eip155:4217",
    ecosystem: "evm",
    id: "tempo",
    name: "Tempo",
  },
  {
    acrossChainId: 324n,
    caip2: "eip155:324",
    ecosystem: "evm",
    id: "zksync",
    name: "zkSync",
  },
  {
    acrossChainId: 7777777n,
    caip2: "eip155:7777777",
    ecosystem: "evm",
    id: "zora",
    name: "Zora",
  },
];

const networksByAcrossChainId = new Map(
  externalNetworks.flatMap((network) =>
    network.acrossChainId === undefined ? [] : [[network.acrossChainId.toString(), network]],
  ),
);

const networksByCctpDomain = new Map(
  externalNetworks.flatMap((network) =>
    network.cctpDomain === undefined ? [] : [[network.cctpDomain, network]],
  ),
);

const toResolvedRemoteNetwork = (
  network: ExternalNetwork | undefined,
  namespace: BridgeRemoteNamespace,
  bridgeRemoteId: string,
): ResolvedBridgeRemoteNetwork => {
  if (network !== undefined) {
    return {
      bridgeRemoteId,
      bridgeRemoteNamespace: namespace,
      remoteNetworkEcosystem: network.ecosystem,
      remoteNetworkId: network.id,
      remoteNetworkName: network.name,
    };
  }

  return {
    bridgeRemoteId,
    bridgeRemoteNamespace: namespace,
    remoteNetworkEcosystem: "unknown",
    remoteNetworkId: `${namespace}:${bridgeRemoteId}`,
    remoteNetworkName: `Unknown ${namespace} ${bridgeRemoteId}`,
  };
};

export const resolveAcrossRemoteNetwork = (chainId: bigint) =>
  toResolvedRemoteNetwork(
    networksByAcrossChainId.get(chainId.toString()),
    "across-chain-id",
    chainId.toString(),
  );

export const resolveCctpRemoteNetwork = (domain: number) =>
  toResolvedRemoteNetwork(networksByCctpDomain.get(domain), "cctp-domain", domain.toString());

export { externalNetworks };
