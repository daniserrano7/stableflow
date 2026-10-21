<div align="center">

<img src="apps/web/public/brand-icon.svg" width="56" alt="" />

# Stableflow

**Live USDC flows on Base.** See which protocols, exchanges and bridges stablecoins are moving into and out of, as it happens.

[**stableflow.dev**](https://stableflow.dev) · [Methodology](https://stableflow.dev/methodology) · [Connect your AI chat](#ask-it-from-your-ai-chat)

</div>

<picture>
  <source media="(prefers-color-scheme: light)" srcset="repo-images/overview-light.png" />
  <img src="repo-images/overview-dark.png" alt="Stableflow overview: KPIs, a live flow graph from wallets through DEXs, lending markets and bridges to other chains, a ranking of entity net flows and the live transfer feed" />
</picture>

## The problem

Over 150,000 USDC transfers happen on Base every hour. All of them are public, and almost none of them are readable. An ERC-20 `Transfer` event only says:

```
0x787f…35e4 → 0xb2cc…dc59   268,700 USDC
```

It doesn't say *"someone sold into Aerodrome"* or *"USDC left Base for Solana through CCTP"*. Worse, one swap emits several transfers (user → router → pool → user), so adding them up counts the same dollars more than once. Block explorers show raw rows. Analytics dashboards show daily snapshots. Neither answers the simple question: **where is the money going right now?**

Stableflow indexes every native USDC transfer on Base, works out which entity is on each side, and turns the stream into live inflow, outflow and net flow per protocol, without double counting.

## What you can do

- **Watch the flow graph** as USDC moves from wallets through DEXs and lending markets, and across bridges to other chains. Columns follow the money, link width scales with volume, and live transfers run along the links as particles.
- **Rank entities** by inflow, outflow or net flow over windows from 5 minutes to 24 hours.
- **Follow bridges.** See USDC entering and leaving Base through Circle CCTP and Across, by remote chain.
- **Inspect any entity** down to the addresses behind it, with each label's role, source and confidence.
- **Browse every transfer**, filter large (≥10k) and whale (≥1M) moves, and open a transaction to see all its hops.
- **Search** entities, addresses and transactions with ⌘K.
- **Ask your AI chat** through a public MCP server.

## Architecture

```mermaid
flowchart LR
  rpc{{"Base RPC"}}

  subgraph private [Private]
    indexer["Indexer<br/>Ponder"]
    worker["Label worker"]
    subgraph pg [PostgreSQL]
      live[("Live index<br/>recent hours")]
      archive[("Archive<br/>raw 3 days · per-minute flows forever")]
    end
    archiver["Archiver"]
    api["API<br/>NestJS"]
  end

  subgraph public [Public]
    web["Web<br/>React Router SSR"]
    mcp["MCP server"]
  end

  rpc --> indexer --> live
  live --> archiver --> archive
  rpc --> worker -- "promoted labels" --> archive
  archive -- "labels" --> indexer
  archive --> api
  live -- "live stream" --> api
  api --> web --> browser([Browser])
  api --> mcp --> ai([Claude · ChatGPT])
```

| Service | Role |
| --- | --- |
| **Indexer** | Reads USDC transfers plus factory, CCTP and Across events. Labels both sides of each transfer and writes per-minute flow aggregates. |
| **Archiver** | Copies settled rows into the archive every two seconds and expires old raw events. |
| **Label worker** | Every six hours, finds the busiest unknown addresses and labels the ones it can prove on-chain. |
| **API** | Read-only REST plus one server-sent event (SSE) stream for live transfers. |
| **Web** | Server-rendered app. Proxies the API and the live stream, so the API never needs a public domain. |
| **MCP** | Nine read-only tools for AI clients, backed by the same API. |

Key decisions:

- **Hot and cold storage.** The indexer keeps only recent hours. The archive holds raw transfers for 3 days and per-minute aggregates forever, so queries stay fast and storage stays flat.
- **Reindex in minutes, not days.** Each indexer start writes to a fresh schema that begins five minutes before the archive's newest block, and never more than ten minutes behind the chain head. Once it catches up, Ponder points the public views at it and old schemas are pruned. Changing the schema or the classification logic causes no downtime and needs no full resync; if the indexer was down for longer, the gap is skipped rather than backfilled for hours.
- **Least privilege.** Every service has its own Postgres role. The API's role is read-only, with a 30-second statement timeout.
- **One poll, many viewers.** The live stream polls the database once per API instance and fans out to every connected browser with RxJS.

## Counting flows without double counting

Every known address carries a label that says who owns it and how to count it:

```ts
{ entity: "Aerodrome", category: "dex", role: "pool_instance",
  attributionGroup: "aerodrome", countingPolicy: "boundary", confidence: "high" }
```

Flows are counted **where USDC crosses an entity's boundary**, not at every hop:

```mermaid
flowchart LR
  u1([User]) -- "inflow ✓" --> router["Aerodrome router"]
  router -- "internal, ignored" --> pool["Aerodrome pool"]
  pool -- "outflow ✓" --> u2([User])
```

On top of that:

- **Volume counts each dollar once.** A transaction's value is the sum of every address's positive net change, so the router hop adds nothing. On early data, raw transfer sums ran about 18% higher.
- **Bridge direction comes from bridge events.** CCTP `DepositForBurn` / `MessageReceived` and Across deposits and fills give the true direction and remote chain, which an ERC-20 transfer alone can't.
- **Unknown stays unknown.** Wallets with no label are grouped as *Unidentified* rather than guessed.

## Entity discovery and promotion

Labels come from three sources, from most to least trusted:

1. **Curated registry.** Core contracts (routers, factories, lending markets, bridges) taken from official docs and repositories, each with its source and confidence.
2. **Event discovery.** The indexer listens for new Uniswap, PancakeSwap and Aerodrome pools and new MetaMorpho vaults, and re-reads Aave's reserve tokens every hour. New pools get labeled in the block they're created.
3. **Activity discovery.** A worker ranks the highest-volume *unidentified* addresses and tries to prove who they belong to.

```mermaid
flowchart LR
  t[("Indexed transfers")] --> c["Top unidentified<br/>addresses, 24 h"]
  c --> v{"On-chain proof?<br/>pool.factory() · token0/1<br/>factory.getPool() / isPool()"}
  v -- "proven" --> p["Promote label"]
  v -- "not proven" --> q["Review queue"]
  p --> l[("Archive labels")]
  l -- "within 30 s" --> i["Indexer classifies<br/>new transfers"]
```

The promotion gate is strict on purpose: **only on-chain evidence promotes a label.** The address must provably belong to a supported factory, sit on a flow boundary and map to a specific entity. Patterns like "mostly trades with Aerodrome" stay in review, because a wrong label is worse than an unknown one. Each run records how much unidentified volume it resolved, so coverage is measurable. A Postgres advisory lock keeps runs from overlapping.

<img src="repo-images/entity-detail.png" alt="Aerodrome entity page over 24 hours: label count and roles, inflow, outflow and net flow, a counterparty flow graph, top counterparties and label evidence" />

## Ask it from your AI chat

```
https://mcp.stableflow.dev/mcp
```

Add it as a custom connector in Claude, or in ChatGPT's developer mode. No Stableflow account or API key needed. Then ask things like *"Which protocols had the largest net USDC outflow in the last hour?"* or *"Compare Aave V3 and Morpho Blue today."*

The server exposes nine read-only tools: transfers, transfer history, flow KPIs, top entity flows, the flow graph, the entity catalog, search, entity detail and entity comparison. It calls the private API, never the database, and every call is bounded by input schemas, request and response size caps, an upstream timeout, per-IP rate limits and a global concurrency cap. Results include the indexed time window, so answers can say when coverage is partial.

## Design system

<img src="repo-images/design-system.png" alt="Design system page showing semantic color tokens and the type scale" />

Built for dense, real-time financial data:

- **Tokens first.** OKLCH color tokens in Tailwind 4's `@theme`, with shadcn-compatible names and a typed TypeScript copy for SVG drawing. Light and dark themes share the same tokens.
- **Color carries meaning.** Green is inflow, amber is outflow, pink flags whales. DEX, lending, bridge and CEX each keep one hue across tags, graph nodes and legends.
- **Type for numbers.** Geist for UI. Geist Mono with tabular numerals for amounts, addresses and hashes. A 13 px body, because this is a dashboard.
- **Hand-built visuals.** The flow graph, sparklines and bars are custom SVG in React, with no chart library.

Every token is on show at [/design-system](https://stableflow.dev/design-system).

## Deployment

Stableflow ran first on **Railway** and now runs on a **single VPS** with Docker Compose. Both setups deploy automatically on every push to `master`.

### Railway (first production setup)

The first release ran as seven Railway services in one project: managed PostgreSQL plus the indexer, archiver, label worker, API, web app and MCP server, each built from its own Dockerfile.

- **Private networking.** Only the web app and the MCP server had public domains; the API and the database were reachable only on Railway's internal network.
- **Zero-downtime rollouts.** Health checks gated each deployment (the indexer only counted as ready once it reached the chain head), with draining time so Ponder could release its schema lock before the replacement took over.
- **Per-service configuration** through Railway variables, with references to the shared Postgres credentials.

The indexer's start script still reads `RAILWAY_DEPLOYMENT_ID`, so the same images run on either platform.

### Why it moved to a VPS

Railway bills memory per GB. PostgreSQL uses spare RAM as page cache, which is what keeps queries fast, so the database alone was about 90% of the bill. Capping its memory starved it of I/O and took the indexer down. A flat-price VPS (4 vCores, 8 GB RAM, NVMe, on OVHcloud) gives Postgres the whole machine for about a quarter of the cost.

### VPS (current)

The production stack is defined in [`compose.prod.yaml`](compose.prod.yaml): PostgreSQL 18, the application containers and [Caddy](infra/caddy/Caddyfile) for HTTPS, with Cloudflare for DNS.

- **Continuous deployment.** [`deploy.yml`](.github/workflows/deploy.yml) builds one image per app into GitHub Container Registry, then copies the stack definition to the server over SSH and runs `docker compose pull && up -d`. Builds are reproducible, so an app whose code didn't change keeps its image digest and its containers keep running.
- **Small attack surface.** Only Caddy publishes ports; the database and the API stay on the internal Docker network. SSH is key-only and the firewall allows only SSH, HTTP and HTTPS. Deployments run as a dedicated `deploy` user.
- **Sized for the box.** Postgres is tuned for 8 GB of RAM (the apps use about 1.3 GB, the page cache gets the rest) and every app container has a memory limit.
- **Health checks.** The indexer is ready once it has caught up to the chain head. The API, web app and MCP server expose their own health endpoints.
- **Database roles.** Applied idempotently on every deploy from [`roles.sql`](infra/postgres/roles.sql). The indexer, background workers and API use separate roles; the API is read-only.

To run your own, use [`infra/vps/env.example`](infra/vps/env.example) as the server's `.env` and set the repository variables `VPS_HOST` and `VPS_KNOWN_HOSTS` and the secret `VPS_SSH_KEY`. Without `VPS_HOST`, the deploy workflow is skipped.

GitHub Actions also runs Biome, type checks and builds on pushes to `master` and `develop`, and on pull requests.

## Tech stack

| Layer | Tools |
| --- | --- |
| Indexing | Ponder, viem |
| Data | PostgreSQL 18 in production, 17 locally; Drizzle ORM |
| API | NestJS 11, RxJS, Zod |
| Web | React 19, React Router 7 (SSR), TanStack Query, Tailwind CSS 4, shadcn/ui, Radix |
| AI | Model Context Protocol TypeScript SDK |
| Tooling | TypeScript, pnpm workspaces, Biome, `node:test`, GitHub Actions |
| Infra | Docker, Docker Compose, Caddy, GitHub Container Registry, OVHcloud VPS, Cloudflare DNS; previously Railway |

## Run it locally

```bash
cp .env.example .env   # a Base RPC URL and a recent start block
docker compose up --build
```

Web runs on `localhost:4000`, the API on `:4001/v1` and MCP on `:4002/mcp`.

```
apps/
  indexer/   Ponder indexer, archiver and label worker
  api/       NestJS API and live stream
  web/       React Router app and design system
  mcp/       MCP server
  shared/    Types shared by the API and web
infra/postgres/roles.sql   Database roles and grants
```

---

<div align="center">

Built by [@daniserrano7](https://github.com/daniserrano7)

</div>
