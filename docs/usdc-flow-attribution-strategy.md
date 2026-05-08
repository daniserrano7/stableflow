# USDC Flow Attribution Strategy

Research date: 2026-05-08

Scope: Base mainnet USDC flows indexed from the USDC ERC-20 `Transfer` event.

This document defines how to turn raw USDC transfers into useful protocol/entity flow analytics without double-counting internal protocol movement.

## Core Problem

The raw event stream only says:

```txt
from_address -> to_address, value, block, tx_hash, log_index
```

It does not say:

```txt
user deposited into Aave
user swapped through Uniswap
protocol rebalanced liquidity internally
bridge minted USDC after CCTP attestation
```

That semantic layer must be inferred from address labels, transaction context, contract topology, and sometimes protocol-specific events.

The immediate risk is double-counting. A single user intent can produce multiple USDC transfers:

```txt
user -> router
router -> pool
pool -> another contract
contract -> user
```

If every labeled address is counted independently as protocol inflow/outflow, the same user action can be counted multiple times.

## Important Distinction: Identity vs Accounting Surface

For product analytics, we care about protocol/entity identity more than exact implementation details.

Example:

```txt
Compound V3 cUSDCv3 proxy = stable identity
implementation contract = technical detail
```

For most product views, the proxy address is enough. The implementation may change, but the proxy remains the stable user-facing accounting surface.

However, identity alone is not always enough. Some protocols route funds through routers, pools, vaults, reward contracts, adapters, or bridges. If those operational contracts are not linked to the same entity, we can misclassify internal movement as external flow.

So each label should capture:

```txt
entity: Aave V3
category: lending
role: pool | router | factory | vault | aToken | bridge | rewards | treasury | pool_instance
attribution_group: aave-v3
counting_policy: terminal | internal | discovery_source | ignore
```

The `attribution_group` is what lets us avoid counting Aave-to-Aave or Uniswap-to-Uniswap transfers as external flow.

## Counting Rules

### Rule 1: Raw Volume Is Separate From Entity Flow

Raw token volume answers:

```txt
How much USDC moved on Base?
```

Entity flow answers:

```txt
How much USDC flowed into/out of a protocol or category?
```

These are different metrics and must not be mixed.

Raw volume can count every transfer once.

Entity flow should usually collapse intra-entity movement.

### Rule 2: Classify Both Sides Before Aggregating

Every transfer should be classified into sides:

```txt
from_entity
from_category
from_role
to_entity
to_category
to_role
```

Then decide whether it contributes to a flow metric.

Basic decision matrix:

| From | To | Product Interpretation | Count? |
| --- | --- | --- | --- |
| unknown/user | Aave V3 | protocol inflow | yes |
| Aave V3 | unknown/user | protocol outflow | yes |
| Aave V3 | Aave V3 | internal movement | no for external flow |
| Uniswap V3 | Uniswap V3 | internal/pool movement | no for external flow |
| Uniswap V3 | Aave V3 | protocol-to-protocol flow | yes, but separate metric |
| unknown/user | unknown/user | peer/user flow | category metric only |
| CEX | unknown/user | CEX outflow | yes if label confidence is acceptable |
| unknown/user | CEX | CEX inflow | yes if label confidence is acceptable |

### Rule 3: Count At The Boundary, Not Every Hop

For protocol-level net flow, count transitions across the entity boundary:

```txt
outside -> entity = inflow
entity -> outside = outflow
entity -> entity = internal, ignored
```

This is the safest default.

### Rule 4: Keep Transaction-Level Context Available

Some useful semantics cannot be inferred from one transfer in isolation.

For a swap:

```txt
user USDC -> pool
pool tokenOut -> user
```

The USDC transfer alone can tell us "USDC entered a DEX pool", but not necessarily which token was bought unless we inspect the transaction logs.

For now, the flow system can work from USDC transfer boundaries. Later, add transaction classifiers that look at all logs in a transaction.

## Flow Tables

### Raw Transfers

Already implemented:

```txt
usdc_transfers
```

Purpose:

- auditability
- reprocessing
- classifier upgrades
- raw event feed

Do not use raw transfers directly for most product charts.

### Global Volume Buckets

Already implemented:

```txt
usdc_transfer_volume_buckets
```

Purpose:

- total USDC movement per minute
- chain activity pulse
- top-level volume charts

### Entity Boundary Flow Buckets

Recommended next aggregate:

```txt
usdc_entity_flow_buckets
```

Shape:

```txt
id
bucket_start
bucket_size
chain_id
token_address
entity_id
category
direction: in | out
transfer_count
total_value
```

This table only counts boundary crossings:

```txt
outside -> entity
entity -> outside
```

It does not count:

```txt
entity -> same entity
```

Purpose:

- Aave inflow/outflow
- Uniswap pool inflow/outflow
- bridge inflow/outflow
- CEX inflow/outflow when labels exist
- protocol net flow

### Entity-To-Entity Flow Buckets

Recommended after boundary flow:

```txt
usdc_entity_pair_flow_buckets
```

Shape:

```txt
id
bucket_start
bucket_size
chain_id
token_address
from_entity_id
to_entity_id
from_category
to_category
transfer_count
total_value
```

Only create rows where both sides are known and entities differ.

Purpose:

- protocol-to-protocol flow
- CEX-to-DeFi flow
- bridge-to-DEX flow
- DeFi-to-CEX flow

Avoid raw `from_address + to_address` pair buckets for now. That cardinality is too high and duplicates raw transfer storage.

### Category Flow Buckets

Useful low-cardinality table:

```txt
usdc_category_flow_buckets
```

Shape:

```txt
bucket_start
bucket_size
from_category
to_category
transfer_count
total_value
```

Purpose:

- unknown/user -> dex
- dex -> unknown/user
- bridge -> lending
- lending -> cex
- unknown_contract -> unknown_wallet

This gives a macro view even when exact entity labels are incomplete.

## Protocol-Specific Edge Cases

### DEXs: Uniswap V3, Aerodrome, PancakeSwap V3

Static labels:

- router
- factory
- position manager
- quoter

Dynamic labels:

- pool contracts
- gauges/reward contracts for Aerodrome
- concentrated liquidity pools

Main edge case:

```txt
user -> router -> pool
```

For ERC-20 transfers, the router may or may not temporarily hold USDC. Often the final meaningful holder is the pool.

Counting strategy:

- Label routers and factories as `internal`.
- Label pools as `pool_instance`.
- Count boundary flow when USDC crosses between outside and a pool.
- Ignore router-to-pool movement if both are in the same DEX attribution group.
- For user swap volume, pool inflow/outflow is usually the useful metric.

Discovery strategy:

- Listen to factory pool creation events.
- Store discovered pools with `parent_factory`, token0, token1, fee/stable flag, first_seen_block.
- Only mark a pool as USDC-relevant if token0 or token1 is Base USDC.
- For existing historical pools, run a backfill discovery job from factory deployment block.

Notes:

- Factory/router addresses are stable identity anchors.
- Pool contracts are the actual accounting surface for most USDC DEX movement.
- For deep semantic swaps, later correlate USDC transfer logs with pool `Swap` events in the same transaction.

### Lending: Aave V3

Static labels:

- Pool
- PoolAddressesProvider
- WrappedTokenGateway

Dynamic/derived labels:

- aBasUSDC
- variable debt token
- stable debt token if applicable
- collector/treasury

Main edge case:

```txt
user -> Aave Pool
Aave Pool -> aToken/debt/treasury related contracts
```

Counting strategy:

- Treat the Pool and reserve token contracts as the same `aave-v3` attribution group.
- Count outside -> Aave as inflow.
- Count Aave -> outside as outflow.
- Ignore Aave -> Aave internal transfers.
- For "deposits/withdrawals" specifically, prefer Aave protocol events later (`Supply`, `Withdraw`, `Borrow`, `Repay`) over ERC-20 transfer inference.

Discovery strategy:

- Query `Pool.getReserveData(USDC)` to fetch current aToken/debt token addresses.
- Re-run this periodically because assets can be upgraded.
- Also consume the Aave address book as a source of truth.

### Lending: Compound V3

Stable identity:

- cUSDCv3 / Comet proxy

Main edge case:

Compound V3 uses a stable proxy as the user-facing market. Implementations can change, but the proxy remains the contract to classify.

Counting strategy:

- Treat cUSDCv3 proxy as the accounting surface.
- Count outside -> cUSDCv3 as inflow.
- Count cUSDCv3 -> outside as outflow.
- Treat Configurator, Rewards, Bulker as the same attribution group where relevant.
- Do not count implementation addresses unless USDC actually moves through them.

Discovery strategy:

- Track Compound deployment roots from the Comet repository.
- Periodically compare official `roots.json` files.
- For new Comet markets on Base, add the Comet proxy as a new accounting surface.

### Lending: Morpho Blue

Stable identity:

- Morpho Blue core contract

Dynamic labels:

- MetaMorpho vaults
- market-related adapters
- allocator contracts

Main edge case:

Morpho can involve vaults and markets where the core contract is not the only meaningful address. Vaults can be the product-facing entity for users.

Counting strategy:

- Treat Morpho core and known Morpho vaults as one `morpho` attribution group for high-level flow.
- Also preserve vault-level labels for detailed views.
- Count outside -> Morpho vault/core as inflow.
- Count Morpho vault/core -> outside as outflow.
- Ignore Morpho -> Morpho internal movement for high-level entity flow.

Discovery strategy:

- Listen to MetaMorpho factory events.
- Keep curated vault lists where available.
- Mark USDC-relevant vaults by asset/underlying token.

### Bridges: Base Native Bridge

Static labels:

- L2StandardBridge
- L2CrossDomainMessenger
- L2ToL1MessagePasser

Main edge case:

Native bridge transfers can have cross-domain semantics. A USDC transfer on Base may correspond to an L1 operation or system message.

Counting strategy:

- Label bridge contracts as `bridge`.
- Count user -> bridge as bridge outflow from Base if the semantic is withdrawal.
- Count bridge -> user as bridge inflow to Base if the semantic is deposit.
- For exact deposit/withdraw classification, later inspect bridge-specific events, not only ERC-20 transfers.

Discovery strategy:

- Base system contracts are stable predeploys.
- Check Base docs periodically for changes or new bridge contracts.

### Bridges: Circle CCTP

Static labels:

- TokenMessengerV2
- MessageTransmitterV2

Main edge case:

CCTP burns USDC on source chain and mints on destination chain. On Base, a `Transfer` involving zero address or CCTP contracts may represent cross-chain mint/burn, not normal user transfer.

Counting strategy:

- Treat CCTP contracts as `bridge`.
- For exact bridge inflow/outflow, inspect CCTP events:
  - `DepositForBurn`
  - `MintAndWithdraw`
  - `MessageSent`
  - `MessageReceived`
- Use ERC-20 transfer boundaries as a first approximation only.

Discovery strategy:

- Circle publishes contract addresses by domain.
- Periodically fetch/compare Circle CCTP docs or a machine-readable source if available.

### Bridges: Across

Stable identity:

- SpokePool proxy
- SpokePoolPeriphery

Main edge case:

Across involves relayers and liquidity fulfillment. User deposits and relay fills may generate transfers involving relayers, SpokePool, and users. A simple entity boundary can show bridge usage, but not full cross-chain intent.

Counting strategy:

- Count user -> SpokePool as bridge inflow/outflow depending on transfer direction and event semantics.
- Count SpokePool -> user as bridge completion/fill direction.
- Avoid counting relayer operational movement as user flow unless correlated with Across events.
- Later parse Across events for accurate bridge direction.

Discovery strategy:

- Track official Across chain contracts.
- SpokePool is a proxy; implementation upgrades should not require relabeling.

### Stablecoin Issuer: Circle / USDC

Static label:

- USDC token contract

Main edge case:

ERC-20 mints and burns appear as:

```txt
0x000...000 -> recipient
holder -> 0x000...000
```

Counting strategy:

- Keep mint/burn as separate supply movement metrics.
- Do not mix mint/burn with normal entity inflow/outflow.
- For "USDC supply on Base", mints/burns matter.
- For "USDC flow between users/protocols", exclude zero-address transfers.

### CEXs

Static labels are not reliable enough initially.

Main edge case:

CEX deposit addresses can be unique per user, rotated, reused, swept to hot wallets, or controlled by third-party custody providers.

Counting strategy:

- Do not add CEX labels unless source/confidence is clear.
- Use confidence levels.
- Separate `cex_candidate` from confirmed `cex`.
- Never backfill a candidate label into historical analytics without preserving label versioning.

Discovery strategy:

- Explorer labels.
- Publicly known exchange wallets.
- Deposit sweep pattern detection.
- Manual review queue.
- Optional paid label providers later.

## Contract Discovery Strategy

We need three complementary mechanisms.

### 1. Event-Based Discovery

Best for dynamic protocol-created contracts.

Use Ponder to index factory events:

```txt
UniswapV3Factory: PoolCreated
Aerodrome PoolFactory: PoolCreated
PancakeV3Factory: PoolCreated
MetaMorphoFactory: vault creation events
```

When a child contract is discovered:

```txt
insert address_label {
  address,
  chain_id,
  entity_id,
  category,
  role,
  attribution_group,
  confidence: high,
  source: factory_event,
  parent_address,
  tx_hash,
  log_index,
  first_seen_block
}
```

This is the preferred approach because it is deterministic and complete from a start block.

### 2. Periodic Source Sync

Best for official registries and deployment files.

Examples:

- Aave address book
- Compound Comet deployment files
- Circle CCTP docs/source
- Base contract address docs
- Across deployments

Job behavior:

```txt
fetch source
parse addresses
compare with local registry
insert new labels as pending or active
flag removed/changed addresses for review
record last_verified_at
```

This can be a cronjob later. It does not need to be in Ponder initially.

### 3. Activity-Based Candidate Discovery

Best for unknown high-volume contracts.

Run queries over raw transfers:

```txt
top unknown contracts by USDC received
top unknown contracts by USDC sent
top unknown contracts by unique counterparties
top unknown contracts by repeated router-like behavior
```

Then classify candidates manually or with heuristics:

```txt
unknown_contract -> candidate_protocol
candidate_protocol -> confirmed after review
```

This is important because not every important contract will come from a factory we already index.

## Label Model

Eventually, labels should move from markdown to DB/table/JSON.

Recommended fields:

```txt
address
chain_id
entity_id
entity_name
category
role
attribution_group
counting_policy
confidence
source_type
source_url
parent_address
first_seen_block
last_verified_at
valid_from_block
valid_to_block
notes
```

`valid_from_block` and `valid_to_block` matter because labels can change over time.

Example:

```txt
address: 0x...
entity_id: uniswap-v3
role: pool_instance
attribution_group: uniswap-v3
counting_policy: boundary
valid_from_block: pool creation block
valid_to_block: null
```

## Counting Policy Values

Suggested policies:

```txt
boundary
internal
ignore
discovery_source
candidate
```

Meaning:

- `boundary`: count outside/entity crossings.
- `internal`: same entity, used to suppress double-counting.
- `ignore`: infrastructure contract that should not create product flow metrics.
- `discovery_source`: factory/registry, useful for discovery but not volume attribution.
- `candidate`: not trusted for production metrics.

## Implementation Plan

### Phase 1: Manual Seed Labels

Use `docs/base-address-registry.md` as source material.

Create a machine-readable registry:

```txt
apps/indexer/src/labels/base-address-labels.ts
```

Add only high/medium confidence labels.

Normalize addresses to lowercase for lookup.

### Phase 2: Entity Flow Buckets

Add Ponder table:

```txt
usdc_entity_flow_buckets
```

For each raw transfer:

```txt
classify from
classify to
if from_entity !== to_entity:
  if to is known entity: increment entity in
  if from is known entity: increment entity out
if same attribution_group:
  suppress boundary flow
```

Also add category buckets if useful:

```txt
usdc_category_flow_buckets
```

### Phase 3: Dynamic DEX Pool Discovery

Add factory event listeners:

```txt
UniswapV3Factory: PoolCreated
Aerodrome PoolFactory: PoolCreated
PancakeV3Factory: PoolCreated
```

Store discovered USDC pools as labels.

This should dramatically improve DEX flow attribution.

### Phase 4: Lending Reserve/Vault Discovery

Add discovery jobs:

- Aave `getReserveData(USDC)`.
- Compound deployment source sync.
- Morpho vault factory events.

### Phase 5: Bridge Event Semantics

Add bridge-specific classifiers:

- CCTP events for burn/mint direction.
- Base bridge events for L1/L2 direction.
- Across events for origin/destination and relayer behavior.

### Phase 6: Candidate Review Pipeline

Add queries for high-volume unknown contracts.

Review and promote candidates to confirmed labels.

## Answer To The Specific Concern

If a user sends USDC to a protocol front contract and that contract routes USDC to underlying operational contracts, then yes, we can double-count if we label both contracts independently and count every labeled transfer.

Correct handling:

```txt
front contract -> operational contract
same attribution_group
do not count as external inflow/outflow
```

But:

```txt
user -> front contract
outside -> entity
count inflow
```

and:

```txt
operational contract -> user
entity -> outside
count outflow
```

This is why labels need `attribution_group`, not just `entity_name`.

## Sources

- Base contract addresses: https://docs.base.org/base-chain/network-information/base-contracts
- Circle USDC contract addresses: https://developers.circle.com/stablecoins/usdc-contract-addresses
- Circle CCTP contract addresses and events: https://developers.circle.com/cctp/references/contract-addresses and https://developers.circle.com/cctp/references/contract-interfaces
- Uniswap V3 Base deployments: https://developers.uniswap.org/docs/protocols/v3/deployments/v3-base-deployments
- Aerodrome contracts repository: https://github.com/aerodrome-finance/contracts
- Aave address book: https://github.com/bgd-labs/aave-address-book
- Compound III docs and Comet deployments: https://docs.compound.finance/ and https://github.com/compound-finance/comet
- Morpho Blue on Base governance post: https://forum.morpho.org/t/mip59-morpho-dao-as-owner-of-morpho-blue-on-base/599
- PancakeSwap V3 contract docs: https://docs.pancakeswap.finance/to-delete/smart-contracts/pancakeswap-exchange/v3-contracts
- Across contract docs: https://docs.across.to/chains-and-contracts
