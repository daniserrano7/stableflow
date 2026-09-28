# USDC address discovery

Ponder's factory-event and protocol-state handlers run as new blocks arrive. Their configured start block does not include pools created before that block. The candidate pipeline inspects indexed USDC transfers to find those gaps without changing the indexer's start block.

## Commands

| Command | Use |
| --- | --- |
| `labels:discover` | One-shot scan, verification, and promotion; run ad hoc locally or on the server. |
| `labels:worker` | Production-only scheduler that invokes the same operation. |
| `labels:report` | Read past discovery results. |
| `labels:reject` | Manually reject a questionable, unpromoted review candidate. |
| `inspect:unidentified` | Read-only list of the largest unknown addresses. |
| Other `inspect:*` commands | Read-only flow and accounting diagnostics; they do not discover or promote labels. |

## One-shot discovery

Run `pnpm --filter @stableflow/indexer labels:discover` to scan the 50 highest-volume eligible addresses in the latest 24-hour indexed window, verify them, and promote only addresses with on-chain pool identity evidence. `--minutes` and `--limit` override those defaults. This command is ad hoc and is safe to use against a disposable local database.

Auto-promotion requires all of: high confidence, factory-confirmed pool membership, a boundary counting policy, and a specific entity ID. The verifier checks the pool's `factory()`, `token0()`, and `token1()` against supported factories and Base USDC, then asks the factory for `getPool(...)` or `isPool(...)`. Counterparty patterns and transfer volume remain review candidates. The command also restores verified labels missing after a local Ponder index reset, even if the review table marks them as previously promoted. Older pool reviews are checked against the factory before restoration. Discovery and promotion are one operation; there are no separate routine stage commands.

Keep the indexer running while invoking this command in another terminal. The API reads promoted labels from the database on its next request. The indexer refreshes operator-promoted labels during transfer processing at most every 30 seconds, so subsequent transfers receive the new classification without a restart. Existing flow buckets are not recalculated.

## Server worker

Run `pnpm --filter @stableflow/indexer labels:worker` as a **separate production process** with `NODE_ENV=production` and `LABEL_DISCOVERY_SCHEDULE_ENABLED=true`. The worker runs once at startup, then every six hours by default. Empty or failed runs retry after five minutes. It scans a 24-hour window, checks at most 50 addresses, and skips candidates checked within the prior 24 hours so later runs can inspect deeper addresses. Configuration is listed in `apps/indexer/.env.example`. The worker refuses to start in a local environment, and the normal `ponder start` process does not launch it. Running `labels:discover` once does not start the scheduler. A PostgreSQL advisory lock prevents overlapping runs across worker replicas and ad-hoc invocations.

The worker needs the indexer's database credentials and Base RPC URL. Keep it with the indexer-side services, not the read-only API. Deploying this worker is a separate server configuration step; merely starting the indexer locally never schedules it.

## Measuring results

Each completed run records its observed block range, scan count, on-chain verified count, promoted count, restored-after-reset count, promoted candidate address-side volume, duration, and Unidentified directional share in `address_label_discovery_runs`. Inspect recent runs with `pnpm --filter @stableflow/indexer labels:report --limit 20` or `--json`. Check the observed block range before drawing conclusions from a nominal 24-hour window; a newly rebuilt local index may contain only a few blocks. The promoted touch share divides the newly promoted addresses' observed USDC volume by both sides of raw transfer volume; it is a reach indicator, not a retroactive change in flow totals.

Previously indexed flow buckets retain their original classification. Assess whether the Unidentified share falls only after a fresh window has elapsed since promotion. A high remaining share can be real wallet-to-wallet traffic. Repeated runs with no promotions and a high share are a signal to investigate the top unclassified **contracts**, rather than auto-label their counterparties.

## Improving deterministic coverage

The current verifier recognizes supported DEX pools that expose pool identity calls. Next, inspect high-volume contracts that remain candidates for verifiable factory membership, vault asset/registry membership, and known implementation fingerprints. Add a verifier only when the relationship proves attribution to a specific entity and the address is an appropriate flow boundary. Avoid inferring ownership from a dominant counterparty.

[Jev](https://docs.typesafe.ai/api) can rank uncertain candidates or assess evidence completeness with typed decisions. Keep its outputs in the candidate review data until a labelled evaluation set establishes useful thresholds. A model score alone must not pass the automatic promotion gate.
