# Envio HyperIndex port of the Stableflow indexer

This directory ports [`apps/indexer`](../apps/indexer) (the Ponder indexer) to
[Envio HyperIndex](https://docs.envio.dev). It writes the same seven tables, with
the same names, columns and ids, from the same Base contracts. Event logs come from
HyperSync. The only RPC call is the Aave `getReserveData` read. It targets `envio`
3.15.0.

Nothing in `apps/` is changed. The port has its own pnpm lockfile (the Envio CLI
expects pnpm) and an empty `pnpm-workspace.yaml`, so it is not part of the
workspace in the repo root.

## Run it

You need Node.js 22.15 or later, pnpm 10, Docker (for `pnpm dev`) and an Envio API
token for HyperSync (<https://envio.dev/app/api-tokens>).

```bash
cd envio
pnpm install
cp .env.example .env     # set ENVIO_API_TOKEN and ENVIO_START_BLOCK
pnpm dev                 # starts Postgres in Docker, then indexes
```

HyperIndex has no "latest" start block, so `ENVIO_START_BLOCK` is a number: the
equivalent of `PONDER_DISCOVERY_START_BLOCK_8453`. To use your own Postgres, set
`ENVIO_PG_HOST`, `ENVIO_PG_PORT`, `ENVIO_PG_USER`, `ENVIO_PG_PASSWORD` and
`ENVIO_PG_DATABASE` (plus `ENVIO_HASURA=false` to skip Hasura), then `pnpm start`.
`pnpm start -r` wipes the database and re-indexes.

```bash
pnpm codegen      # after editing config.yaml or schema.graphql
pnpm typecheck    # tsc --noEmit
pnpm test         # vitest: net-value tracker, flow rules, CCTP body, token match
```

### Restarts resume

Restarting `pnpm start` without `-r` continues from the last indexed block. A
redeploy therefore does not skip the time the indexer was down: it catches up from
the gap. See [Benchmark](#benchmark) for how fast.

## What maps to what

| Ponder (`apps/indexer`)                                    | HyperIndex                                                             |
| ---------------------------------------------------------- | ---------------------------------------------------------------------- |
| `ponder.config.ts` contracts, same addresses and ABIs      | `config.yaml` (Across ABI in `abis/AcrossSpokePool.json`)              |
| `ponder.schema.ts`                                         | `schema.graphql`: same tables, columns and indexes                     |
| `handlers/base-usdc.handler.ts`: Transfer, CCTP, Across    | `src/handlers/base-usdc.ts`                                            |
| `handlers/base-usdc.handler.ts`: six `PoolCreated`, MetaMorpho | `src/handlers/factories.ts`                                        |
| `AaveReserveDiscovery` block handler and `BaseUsdc:setup`  | `indexer.onBlock` every 1,800 blocks, plus one read before the first Transfer; the read is the `getAaveUsdcReserveTokens` effect (`src/lib/aave.ts`) |
| `LiveRetention` block handler                              | `src/handlers/live-retention.ts`                                       |
| `labels/base-address-labels.ts`, `chains/external-networks.ts`, `flows/transaction-net-value.ts` | copied unchanged into `src/` |
| `ponder:registry` db API                                   | `context.<Table>.get` / `.set`                                         |

Rules that matter for identical output:

- **Ids.** Transfers and bridge events: `<tx hash>-<log index>`. Buckets keep their
  colon-joined ids (checksummed token address, `1m`, bucket start, ...). Labels:
  `8453:<lowercase address>`.
- **Order.** Base is one chain, so events run in block and log order, as in Ponder.
  The per-transaction net-value tracker only advances in the sequential pass; the
  preload pass skips it.
- **First label wins.** Ponder's `onConflictDoNothing` becomes get-then-set-if-missing.
- **Addresses** are stored lowercase (`address_format: lowercase`), as Ponder's `hex`
  columns do.

## Differences a consumer will notice

Not ported, or different:

- **No GraphQL.** The Ponder app serves nothing (`src/api` is an empty Hono app), so
  there is nothing to replace there. The NestJS API and the archiver read Postgres.
  HyperIndex's own Hasura GraphQL is optional and off in the commands above.
- **Schema layout.** Tables are in `public` (or `ENVIO_PG_SCHEMA`). Ponder's
  per-deployment schemas and the `DATABASE_VIEWS_SCHEMA` swap do not exist here.
  [`sql/stableflow-compat-views.sql`](sql/stableflow-compat-views.sql) creates a
  `stableflow` schema with views of the same names and column types, plus the
  `_ponder_checkpoint` view the archiver reads, so the API and archiver can keep
  their `DATABASE_LIVE_SCHEMA=stableflow` setting. Re-apply it after a reset
  (`start -r` drops it).
- **Extra tables.** `envio_*`, `raw_events` and `envio_history_*` tables sit next to
  yours.
- **Archive label sync is not ported.** `readArchivedAddressLabels` copies labels
  from `stableflow_archive` into the live schema so a fresh deployment knows pools
  created before its start block. With restarts that resume, a deployment keeps its
  own labels. Starting a new database mid-history still misses older pools, as with
  Ponder.
- **Retention.** `ENVIO_LIVE_RETENTION_HOURS` prunes rows older than that many
  hours every 150 blocks. Ponder's version also waits until the archive holds the
  rows; this one does not, so set it only if something else already copies them.
  The cutoff uses the newest Transfer's block time.
- **Not ported:** `scripts/start-production.sh` (fresh schema per start, 300-block
  cap, `ponder db prune`), `resolve-start-block.ts`, the per-block console log line.
  `onConflictDoNothing` on transfers and bridge events is dropped: a log is delivered
  once, and reorgs roll the rows back.
- **`chain_id` column.** Envio refuses a user `chain_id` field on per-chain entities,
  so every entity is `@crossChain`; the column is yours to set, as in Ponder.

## Benchmark

Base blocks 53,260,000 to 53,270,799 (10,800 blocks, about six hours), `envio
start -r` on an empty database, HyperSync as the source, Postgres 17 in Docker on
an Apple Silicon laptop. The machine was shared with other indexers, so the timing
is noisy and comes from one run. Time is "Starting indexing" to "Ready".

| Window              | Blocks | Transfers  | Time   |
| ------------------- | ------ | ---------- | ------ |
| 53,270,000 – 53,271,799 | 1,800  | 170,029    | 5.8 s  |
| 53,260,000 – 53,270,799 | 10,800 | 1,281,622  | 42.3 s |

An interrupted run (stopped at block 53,267,797 of the six-hour window) resumed
with `pnpm start` and finished in 20 s including startup, with the same rows.

RPC requests during the six-hour run, counted by a forwarding proxy: **6
`eth_call`s and nothing else**. They are the Aave reads, one per 1,800 blocks. All
log and block data came from HyperSync.

The Ponder indexer (`ponder start`, cache disabled, `endBlock` added in a scratch
worktree) on the same window, same machine, through base-rpc.publicnode.com and the
same counting proxy: **ready after 5,484 s**, **16,659 RPC requests** (10,877
`eth_getBlockByNumber`, 5,774 `eth_getLogs`, 6 `eth_call`, 1 `eth_chainId`). Public
RPC is what Ponder's own docs advise against, and its log shows the provider
rate-limiting, so this time reflects the endpoint as much as Ponder. A paid RPC
would be faster and was not measured.

## Parity

Independent of Ponder. For blocks 53,260,000 to 53,270,799, `scripts/expected-from-rpc.mjs`
fetches raw logs with `eth_getLogs` from a public Base RPC and writes the rows the
handlers should produce; `scripts/compare.sql` compares them with the database.

| Check                              | Expected  | Indexed   | Missing | Extra | Field differences |
| ---------------------------------- | --------- | --------- | ------- | ----- | ----------------- |
| `usdc_transfers` (id, block, tx hash, log index, from, to, value) | 1,281,622 | 1,281,622 | 0 | 0 | 0 |
| `usdc_bridge_events` (bridge, direction, event, value, remote chain or domain) | 1,520 | 1,520 | 0 | 0 | 0 |
| `discovered_address_labels`, factory pools (`scripts/expected-labels-from-rpc.mjs`) | 5 | 5 | 0 | 0 | not compared |

`scripts/compare-aggregates.sql` re-derives the four bucket tables from the indexed
transfers, the curated labels and the discovered labels, using the rules in the
Ponder handler, and compares row by row (count and value per bucket, plus
`adjusted_value` against per-transaction net changes): 0 differing rows in
`usdc_transfer_volume_buckets` (361), `usdc_entity_flow_buckets` (3,684),
`usdc_entity_pair_flow_buckets` (3,323) and `usdc_bridge_flow_buckets` (1,243).
Both scripts were written by the same author as the port, from the same reading of
the Ponder code, so they catch indexing mistakes but not a shared misreading.

Against Ponder's own output on the same window (`ponder start` on its own Postgres,
every column of both sides cast to text and diffed, ordered by id): **0 differing
lines** in all seven tables: `usdc_transfers` 1,281,622, `usdc_transfer_volume_buckets`
361, `usdc_entity_flow_buckets` 3,684, `usdc_entity_pair_flow_buckets` 3,323,
`usdc_bridge_flow_buckets` 1,243, `usdc_bridge_events` 1,520,
`discovered_address_labels` 8.

## Compatibility with the API and archiver

`sql/stableflow-api-smoke.sql` runs, with psql, the queries the archiver
(`archive/cycle.ts`: checkpoint read, upserts for all seven tables, removal and
expiry) and the API services issue, transcribed by hand from the source. All run
against the compat views without errors.

The NestJS API itself, unmodified, was built and started against the views
(`DATABASE_SCHEMA=stableflow_archive`, `DATABASE_LIVE_SCHEMA=stableflow`) on the port's
six-hour data. All nine routes returned 200 with non-empty bodies: `/v1/health`,
`/v1/health/readiness`, `/v1/transfers/recent`, `/v1/transfers`, `/v1/flows/kpis`,
`/v1/flows/top-entities`, `/v1/entities` and `/v1/search` (by address and by name).
Response contents were not compared with a Ponder-backed API. The archiver process
was not run, only its SQL.
