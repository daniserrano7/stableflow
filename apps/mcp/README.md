# Stableflow MCP (local development)

This is a public, read-only Streamable HTTP MCP server. It calls the existing private Stableflow API; it does not connect to PostgreSQL, call an LLM, or require an OpenAI/Anthropic API key. Its five tools expose recent USDC transfers, flow KPIs, top entity flows, index search, and entity details.

Run the API on port 3001, then run `pnpm --filter @stableflow/mcp dev` from the repo root. The local endpoint is `http://localhost:3002/mcp` and its health check is `/health`. Running `pnpm dev` starts web, API, shared, and MCP together, but the API still needs its local database. The indexer remains a separate process and must **not** be backfilled for this feature.

Set variables in `apps/mcp/.env.local` if needed; see `.env.example`. `STABLEFLOW_API_URL` is the private API base ending in `/v1`. For a public bind, set `HOST=0.0.0.0` and `MCP_ALLOWED_HOST` to the actual public hostname. Set `TRUST_PROXY_HOPS=1` only after confirming a trusted single proxy appends the client IP; otherwise leave it at `0`. The web app exposes the configured `STABLEFLOW_MCP_PUBLIC_URL` from `apps/web/.env.local` in its floating Connect AI dialog. The local development default is `http://localhost:3002/mcp`; a production URL must be explicitly configured later.

Run `pnpm --filter @stableflow/mcp test` for the local protocol and security tests. To inspect interactively, run `npx @modelcontextprotocol/inspector` and connect to the local endpoint using Streamable HTTP. ChatGPT and Claude cloud connectors require a reachable public HTTPS endpoint, which will be configured during deployment—not in this phase.

The server allows anonymous access by design. Input schemas, a 16 KiB request limit, an 8-second upstream timeout, a 64 KiB API-response limit, per-IP rate limiting (60 requests/minute by default), and a global concurrency cap reduce accidental or abusive load. The in-memory limiter assumes one replica and resets on restart. It is not a substitute for network-level protection if the endpoint attracts sustained abuse.
