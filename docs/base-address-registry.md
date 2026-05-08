# Base Address Registry

Research date: 2026-05-08

Purpose: seed labels for USDC flow classification on Base mainnet (`chain_id = 8453`).

This file is intentionally conservative. It favors official protocol docs, official repositories, and protocol governance posts. CEX wallet labels are not included yet because they are operational wallets, frequently rotate, and are rarely published as stable official contract addresses.

## Confidence Levels

- `high`: official protocol docs, official repository, or protocol governance/source-of-truth.
- `medium`: protocol forum, official explorer label, or reputable secondary source when no better source is available.
- `candidate`: useful for investigation, but should not be used for production classification without another verification step.

## Static Seed Addresses

| Entity | Category | Label | Address | Confidence | Source |
| --- | --- | --- | --- | --- | --- |
| Circle | stablecoin_issuer | USDC token | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | high | Circle USDC contract addresses |
| Base | system | WETH9 predeploy | `0x4200000000000000000000000000000000000006` | high | Base contract addresses |
| Base | bridge | L2CrossDomainMessenger | `0x4200000000000000000000000000000000000007` | high | Base contract addresses |
| Base | bridge | L2StandardBridge | `0x4200000000000000000000000000000000000010` | high | Base contract addresses |
| Base | bridge | L2ToL1MessagePasser | `0x4200000000000000000000000000000000000016` | high | Base contract addresses |
| Circle CCTP | bridge | TokenMessengerV2 | `0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d` | high | Circle CCTP contract addresses |
| Circle CCTP | bridge | MessageTransmitterV2 | `0x81D40F21F12A8F0E3252Bccb954D722d4c464B64` | high | Circle CCTP contract addresses |
| Uniswap V3 | dex | Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` | high | Base/Uniswap deployment docs |
| Uniswap V3 | dex | UniversalRouter | `0x198EF79F1F515F02dFE9e3115eD9fC07183f02fC` | high | Base/Uniswap deployment docs |
| Uniswap V3 | dex | Factory | `0x33128a8fC17869897dcE68Ed026d694621f6FDfD` | high | Base/Uniswap deployment docs |
| Uniswap V3 | dex | NonfungiblePositionManager | `0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1` | high | Uniswap deployment docs |
| Uniswap V3 | dex | SwapRouter02 | `0x2626664c2603336E57B271c5C0b26F421741e481` | high | Uniswap deployment docs |
| Uniswap V3 | dex | QuoterV2 | `0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a` | high | Uniswap deployment docs |
| Aerodrome | dex | Router | `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43` | high | Aerodrome contracts repo |
| Aerodrome | dex | PoolFactory | `0x420DD381b31aEf6683db6B902084cB0FFECe40Da` | high | Aerodrome contracts repo |
| Aerodrome | dex | FactoryRegistry | `0x5C3F18F06CC09CA1910767A34a20F771039E37C0` | high | Aerodrome contracts repo |
| Aerodrome | dex | Voter | `0x16613524e02ad97eDfeF371bC883F2F5d6C480A5` | high | Aerodrome contracts repo |
| Aerodrome | dex | AERO token | `0x940181a94A35A4569E4529A3CDfB74e38FD98631` | high | Aerodrome contracts repo |
| Aave V3 | lending | Pool | `0xA238Dd80C259a72e81d7e4664a9801593F98d1c5` | high | Aave address book / Aave Base docs |
| Aave V3 | lending | PoolAddressesProvider | `0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D` | high | Aave address book |
| Aave V3 | lending | WrappedTokenGatewayV3 | `0xa0d9C1E9E48Ca30c8d8C3B5D69FF5dc1f6DFfC24` | medium | Aave Base integration docs |
| Compound V3 | lending | cUSDCv3 / Comet proxy | `0xb125E6687d4313864e53df431d5425969c15Eb2F` | high | Compound Comet deployments |
| Compound V3 | lending | Configurator | `0x45939657d1CA34A8FA39A924B71D28Fe8431e581` | high | Compound Comet deployments |
| Compound V3 | lending | Rewards | `0x123964802e6ABabBE1Bc9547D72Ef1B69B00A6b1` | high | Compound Comet deployments |
| Compound V3 | lending | Bulker | `0x78D0677032A35c63D142a48A2037048871212a8C` | high | Compound Comet deployments |
| Morpho Blue | lending | Morpho Blue | `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb` | medium | Morpho governance forum |
| Morpho Blue | lending | AdaptiveCurveIRM | `0x46415998764C29aB2a25CbeA6254146D50D22687` | medium | Morpho governance forum |
| Morpho Blue | lending | Oracle Factory | `0x2DC205F24BCb6B311E5cdf0745B0741648Aebd3d` | medium | Morpho governance forum |
| Morpho Blue | lending | MetaMorpho Vault Factory | `0xA9c3D3a366466Fa809d1Ae982Fb2c46E5fC41101` | medium | Morpho governance forum |
| Morpho Blue | lending | PublicAllocator | `0xA090dD1a701408Df1d4d0B85b716c87565f90467` | medium | Morpho governance forum |
| PancakeSwap V3 | dex | PancakeV3Factory | `0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865` | high | PancakeSwap v3 docs |
| PancakeSwap V3 | dex | PancakeV3PoolDeployer | `0x41ff9AA7e16B8B1a8a8dc4f0eFacd93D02d071c9` | high | PancakeSwap v3 docs |
| PancakeSwap V3 | dex | SwapRouter | `0x1b81D678ffb9C0263b24A97847620C99d213eB14` | high | PancakeSwap v3 docs |
| PancakeSwap V3 | dex | NonfungiblePositionManager | `0x46A15B0b27311cedF172AB29E4f4766fbE7F4364` | high | PancakeSwap v3 docs |
| PancakeSwap V3 | dex | QuoterV2 | `0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997` | high | PancakeSwap v3 docs |
| Across | bridge | SpokePool | `0x09aea4b2242abC8bb4BB78D537A67a245A7bEC64` | high | Across docs / BaseScan |
| Across | bridge | SpokePoolPeriphery | `0x10D8b8DaA26d307489803e10477De69C0492B610` | high | Across docs / BaseScan |

## Dynamic Discovery Needed

The static addresses above are not enough for good flow analytics.

For DEXs, user USDC usually moves through pool contracts, not just routers or factories. Pool addresses are dynamic and should be discovered from factory events:

- Uniswap V3: listen to `PoolCreated` on `UniswapV3Factory`.
- Aerodrome: listen to pool creation events on `PoolFactory`.
- PancakeSwap V3: listen to pool creation events on `PancakeV3Factory`.

For lending protocols, the most useful addresses may be asset-specific token/vault contracts:

- Aave: use the Aave address book or `Pool.getReserveData(USDC)` to identify the current aToken/debt token addresses.
- Morpho: markets/vaults are created dynamically; factory events and curated vault lists matter more than only the core Morpho address.
- Compound V3: the Comet proxy is the primary USDC market address for supply/withdraw/borrow flows.

For CEXs, do not treat static labels as permanent. Deposit addresses and hot wallets rotate. Use an external labels provider, explorer labels, or a manual review queue.

## Sources

- Base contract addresses: https://docs.base.org/base-chain/network-information/base-contracts
- Circle USDC contract addresses: https://developers.circle.com/stablecoins/usdc-contract-addresses
- Circle CCTP contract addresses: https://developers.circle.com/cctp/references/contract-addresses
- Uniswap Base deployments: https://developers.uniswap.org/docs/protocols/v3/deployments/v3-base-deployments
- Base ecosystem contracts: https://docs.base.org/chain/contracts
- Aerodrome contracts repository: https://github.com/aerodrome-finance/contracts
- Aave address book: https://github.com/bgd-labs/aave-address-book
- Aave V3 Base integration docs: https://kit.kpk.io/learn/protocols/aave_v3/base
- Compound docs: https://docs.compound.finance/
- Compound Comet Base USDC deployment: https://raw.githubusercontent.com/compound-finance/comet/main/deployments/base/usdc/roots.json
- Compound Comet Base USDC configuration: https://raw.githubusercontent.com/compound-finance/comet/main/deployments/base/usdc/configuration.json
- Morpho Blue on Base governance post: https://forum.morpho.org/t/mip59-morpho-dao-as-owner-of-morpho-blue-on-base/599
- PancakeSwap v3 contracts: https://docs.pancakeswap.finance/to-delete/smart-contracts/pancakeswap-exchange/v3-contracts
- Across chain contracts: https://docs.across.to/chains-and-contracts

## Keeping This Fresh

Addresses do change, but not all address types change equally.

- Token contracts and core immutable deployments are usually stable.
- Proxy contracts are stable, but implementations can change.
- Factories are stable, but child pools/vaults are constantly created.
- CEX addresses are operational and can change frequently.

Recommended maintenance strategy:

1. Keep this file as the human-reviewed seed list.
2. Add a machine-readable version later, probably `apps/indexer/src/labels/base-address-labels.ts` or `apps/indexer/src/labels/base-address-labels.json`.
3. Build dynamic discovery for pools/vaults from onchain factory events instead of hand-maintaining every pool.
4. Add `source`, `confidence`, `first_seen_block`, `last_verified_at`, and `verified_by` fields to any DB label table.
5. Run a scheduled validation job that checks official source files/docs where possible and flags diffs for review.
6. Use explorer/CEX labels only as `medium` or `candidate` unless confirmed by official documentation.
