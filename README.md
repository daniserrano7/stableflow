# StableFlow

StableFlow is a public stablecoin flow explorer focused on making on-chain stablecoin activity easier to understand.

The project tracks how stablecoins move across chains, protocols, and assets, starting with a deliberately small scope and evolving into a richer analytics product.

StableFlow is not a wallet, portfolio tracker, trading tool, or yield optimizer. It does not manage user funds or provide investment recommendations. Its goal is to turn raw on-chain data into clear visual insights.

Possible future name: **StablePulse**.

---

## Product Goal

StableFlow helps users answer questions like:

- Where is stablecoin liquidity moving?
- Which protocols are receiving or losing stablecoin flows?
- Which stablecoins are most active?
- Which chains are gaining activity?
- What large or unusual movements happened recently?
- Are there spikes, drops, or anomalies in protocol-level activity?

The project is also intended as a technical portfolio project demonstrating:

- EVM data indexing
- Backend architecture
- PostgreSQL data modeling
- Aggregation pipelines
- GraphQL/REST APIs
- Analytics dashboards
- SSR frontend development
- Deployment and DevOps discipline

---

## Initial Product Scope

The project should start small and avoid trying to become a full DefiLlama replacement.

The initial scope should be:

- Chain: Base
- Asset: USDC
- Protocols: Aave and Morpho
- Core data:
  - ERC-20 transfers
  - protocol inflows
  - protocol outflows
  - net flow
  - daily volume
  - active addresses
  - large movements
  - simple anomalies

The architecture should be designed to support multiple chains, stablecoins, and protocols later, but the first implementation should focus on finishing a clean, working MVP.

---

## Core Concepts

### State vs Flow

StableFlow distinguishes between two different types of data:

#### State

State answers:

> How much exists or is currently held somewhere?

Examples:

- total USDC supply on Base
- USDC balance held by a protocol contract
- current liquidity in a protocol market
- stablecoin supply distribution by chain

State can come from:

- direct contract reads
- periodic snapshots
- external APIs such as DefiLlama

#### Flow

Flow answers:

> What moved?

Examples:

- 2.4M USDC moved into Aave on Base
- 800k USDC flowed out of Morpho
- USDC protocol inflows increased 220% over the 30-day average

Flow comes mainly from indexed blockchain events.

---

## Architecture Overview

```txt
                ┌────────────────────┐
                │    Frontend SSR     │
                │ React Router + UI   │
                └─────────┬──────────┘
                          │
                          ▼
                ┌────────────────────┐
                │     API Server      │
                │ Nest.js GraphQL/API │
                └─────────┬──────────┘
                          │
                          ▼
                ┌────────────────────┐
                │     PostgreSQL      │
                │ normalized data     │
                └─────────▲──────────┘
                          │
          ┌───────────────┴────────────────┐
          │                                │
          ▼                                ▼
┌────────────────────┐          ┌────────────────────┐
│   EVM Indexer       │          │ Background Jobs     │
│ transfers/events    │          │ aggregates/anomalies │
└────────────────────┘          └────────────────────┘
          │
          ▼
┌────────────────────┐
│   RPC Provider      │
│ Base / Ethereum     │
└────────────────────┘
```

---

## Recommended Tech Stack

### Monorepo

- pnpm workspaces
- Turborepo or Nx
- TypeScript
- Biome for linting/formatting

Suggested structure:

```txt
stableflow/
  apps/
    web/
    api/
    indexer/
    jobs/
  packages/
    db/
    domain/
    config/
    ui/
  infra/
    docker/
    nginx/
  docs/
```

### Frontend

Recommended stack:

- React
- React Router with SSR
- TypeScript
- Tailwind CSS
- shadcn/ui
- TanStack Query
- Recharts or Visx
- Zod
- Playwright
- Vitest

Main pages:

| Route | Purpose |
| --- | --- |
| `/` | Market overview |
| `/stablecoins/usdc` | USDC analytics |
| `/protocols/aave` | Aave stablecoin flows |
| `/protocols/morpho` | Morpho stablecoin flows |
| `/chains/base` | Base stablecoin activity |
| `/movements` | Relevant movement feed |
| `/methodology` | Data methodology and limitations |

### Backend

Recommended stack:

- Nest.js
- TypeScript
- GraphQL
- PostgreSQL
- Drizzle ORM or Prisma
- Pino for logging
- Zod or class-validator
- Docker

The API should expose data for:

- overview metrics
- stablecoin pages
- protocol pages
- chain pages
- relevant movements
- rankings
- anomalies

### Indexer

The indexer is responsible for reading blockchain data and storing it in a queryable format.

Initial indexing scope:

- Base chain
- USDC ERC-20 Transfer events
- known Aave and Morpho contract addresses
- protocol inflow/outflow classification

Possible options:

#### Option A: Ponder

Best initial option for speed and TypeScript integration.

Use Ponder to index EVM events and write structured data into PostgreSQL.

#### Option B: Custom Viem Indexer

Better for learning and demonstrating low-level backend/indexing skills.

Responsibilities would include:

- block range processing
- log fetching
- ABI decoding
- checkpointing
- retries
- deduplication
- reorg protection
- database writes

### Recommended Approach

Start with Ponder unless the goal is specifically to build the indexer from scratch.

Keep classification logic independent from the framework so it can be tested and migrated later.

---

## Data Model

Initial tables may include:

- `chains`
- `stablecoins`
- `stablecoin_contracts`
- `protocols`
- `protocol_contracts`
- `token_transfers`
- `movements`
- `daily_asset_metrics`
- `daily_protocol_metrics`
- `daily_chain_metrics`
- `anomalies`
- `indexer_checkpoints`
- `external_market_snapshots`
- `protocol_state_snapshots`

---

## Movement Classification

A movement is a semantic interpretation of a raw transfer.

Examples:

```txt
wallet -> protocol contract = protocol_inflow
protocol contract -> wallet = protocol_outflow
wallet -> wallet = token_transfer
```

Suggested movement fields:

```ts
type MovementKind =
  | "token_transfer"
  | "protocol_inflow"
  | "protocol_outflow"
  | "protocol_deposit"
  | "protocol_withdrawal";

type MovementDirection =
  | "inflow"
  | "outflow"
  | "neutral";

type ClassificationConfidence =
  | "low"
  | "medium"
  | "high";
```

Important: do not label a movement as a deposit or withdrawal unless the indexed event proves it. A token transfer into a known protocol contract should initially be called protocol_inflow.

---

## External Data

StableFlow may use external APIs for macro-level context.

For example:

- global stablecoin supply
- stablecoin market share
- supply by chain
- protocol TVL

This data should be stored separately from internally indexed data and marked with a source field.

Example:

```txt
source = "defillama"
source = "contract_read"
source = "stableflow_indexer"
```

The core value of the project should come from StableFlow's own indexed flow data.

---

## Phase 1: Visual MVP

Goal: build the public product shell with mock or seeded data.

Features:

- homepage overview
- USDC page
- Aave page
- Morpho page
- Base page
- movement feed
- basic charts
- responsive layout
- methodology page

No real indexer required yet.

Success criteria:

- the product looks real
- the navigation is clear
- the dashboard communicates the intended value
- mock data can later be replaced with real API data

---

## Phase 2: Real Data MVP

Goal: connect the app to real indexed data.

Scope:

- Base
- USDC
- Aave
- Morpho

Features:

- index USDC transfers on Base
- classify transfers involving known protocol contracts
- store movements in PostgreSQL
- compute daily aggregates
- expose data through Nest.js API
- connect frontend via TanStack Query
- show real protocol inflows/outflows
- show relevant large movements
- add basic anomaly rules

Success criteria:

- StableFlow can show real USDC movement data on Base
- Aave and Morpho have protocol flow pages
- homepage is powered by real indexed metrics
- the system can recover from restarts using checkpoints

---

## Phase 3: Expanded Analytics

Goal: evolve StableFlow into a richer analytics tool.

Possible additions:

- more stablecoins:
  - USDT
  - DAI / USDS
- more chains:
  - Ethereum
  - Arbitrum
  - Optimism
- more protocols:
  - Uniswap
  - Curve
  - Compound
  - Maker/Sky
  - Pendle
- protocol state snapshots
- supply snapshots
- better anomaly detection
- weekly brief
- comparison pages
- known address labeling
- richer methodology documentation

Success criteria:

- users can compare flows across assets, protocols, and chains
- the system supports additional integrations without major rewrites
- StableFlow becomes a credible public Web3 analytics portfolio project

---

## Anomaly Detection

Initial anomaly detection should be simple and explainable.

Examples:

- current daily inflow is more than 2.5x the 30-day average
- movement amount is above the 95th percentile
- protocol net outflow is unusually negative
- daily transfer count drops sharply
- stablecoin activity spikes compared to previous periods

Avoid complex machine learning in the initial version.

---

## Deployment

Recommended deployment model:

- Cloudflare
  - DNS
  - CDN
  - frontend SSR
  - caching

- VPS or AWS EC2
  - Nest.js API
  - indexer
  - background jobs
  - PostgreSQL
  - Docker Compose

Alternative managed setup:

- Frontend: Cloudflare
- Backend: Render, Fly.io, Railway, or EC2
- Database: Neon, Supabase, RDS, or self-hosted PostgreSQL

For a portfolio project, a Docker-based backend deployment is preferred because it demonstrates more infrastructure knowledge.

---

## Testing Strategy

Recommended tests:

- unit tests for classification rules
- unit tests for formatting and amount normalization
- integration tests for database repositories
- API tests for overview/protocol/stablecoin queries
- indexer tests for transfer processing
- frontend tests for main pages and filters
- Playwright tests for critical user flows

---

## Methodology Requirements

StableFlow should include a public methodology page explaining:

- tracked chains
- tracked stablecoins
- tracked protocol contracts
- how inflow/outflow is defined
- what data comes from the indexer
- what data comes from external APIs
- known limitations
- update frequency
- confidence levels

This is important because analytics products can easily become misleading if definitions are unclear.

---

## Non-Goals

StableFlow should not include these in the initial version:

- wallet connection
- trading
- swaps
- investment advice
- yield optimization
- transaction execution
- portfolio tracking
- tax reporting
- personal alerts
- complex AI assistant
- broad multi-chain support from day one

The initial goal is a focused stablecoin flow explorer, not a full DeFi platform.

---

## Portfolio Positioning

Short description:

StableFlow is a visual stablecoin flow explorer that indexes USDC movements on Base, classifies protocol inflows and outflows across Aave and Morpho, computes historical metrics and anomalies, and exposes the data through a public React SSR analytics dashboard.

Technical description:

Built an end-to-end Web3 data product with EVM indexing, protocol-aware movement classification, PostgreSQL aggregation pipelines, GraphQL APIs, anomaly detection rules, and a public SSR dashboard deployed with Cloudflare and Docker-based backend infrastructure.

---

## Development Principles

- Start narrow.
- Finish each phase before expanding.
- Prefer accurate limited data over broad unreliable data.
- Clearly separate indexed data from external data.
- Do not overclaim what a transfer means.
- Keep methodology transparent.
- Optimize for a polished public demo.
- Build the architecture for extension, but keep the initial scope small.
