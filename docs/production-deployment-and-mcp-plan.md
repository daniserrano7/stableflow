# Stableflow production deployment and public MCP plan

Status: planning only. This file is the implementation checklist and handoff for future work. **Do not deploy anything until the application and MCP server are implemented and tested locally and the owner explicitly starts the production-launch phase.** No code or infrastructure change is authorized by the request that created this document.

## Decisions and non-negotiable constraints

- One hosted environment: **production only**. Local development and disposable local test databases are fine; do not create a hosted staging, preview, or development environment.
- **Never backfill pre-launch chain history.** At first production launch, record the then-current Base block as an immutable production start block. Configure the indexer to start at that block, not block `0`, contract creation, or an earlier date. Persist that exact number in Railway; do not recompute `latest` on later releases or reset it during incidents. Normal checkpoint resume and catching up blocks missed during downtime are necessary to avoid gaps; they must never move the lower boundary before the recorded launch block.
- Use a single Railway project/environment with six services: PostgreSQL, indexer, private label-discovery worker, private API, public web, and public MCP. The indexer, discovery worker, and API have no public Railway domain. Web and MCP have separate HTTPS domains (or subdomains). No Cloudflare Tunnel, Cloudflare Worker, VPS, or custom AI/LLM service is required for the first version.
- Changes go through PRs targeting `master`; merge to `master` triggers GitHub CI and, only after CI passes, Railway production autodeploys for the affected services. No deployment on PR open/update. Do not enable Railway PR environments.
- Expose **read-only, bounded** MCP tools without user login initially. Publish the HTTPS `/mcp` URL and setup instructions on the website. A public URL does not guarantee that every ChatGPT or Claude account can add a custom MCP connection; client features and workspace policy vary. We do not pay for users' model tokens, but we do pay for hosting, RPC, and database work caused by tool calls.

## Repo facts to preserve

- pnpm 10 / Node >=22.14 monorepo: `apps/web` (React Router SSR), `apps/api` (NestJS), `apps/indexer` (Ponder 0.16), `apps/shared`. Add `apps/mcp` as its own package when implementing.
- The web currently calls the API through server-side loaders/resource routes using `STABLEFLOW_API_URL`; keep this server-to-server path so the API can stay private. Verify that no browser path needs a direct API origin before launch, including the live-transfer SSE proxy.
- The API imports Ponder schema and address labels from `@stableflow/indexer`, and reads PostgreSQL. The indexer writes Ponder-managed tables. Avoid making the MCP package depend directly on the indexer or database; it should use a small, explicit private API query contract.
- `apps/indexer/src/chains/base.chain.ts` currently falls back to `"latest"` for `PONDER_DISCOVERY_START_BLOCK_8453`; `.env.example` says fresh schemas start at latest and existing schemas resume from checkpoints. For production, make the numeric pinned start block required/validated before first launch.
- `.github/workflows/ci.yml` currently runs on PRs and pushes to **`main`**, while the requested production branch is **`master`**. Change this during implementation. Check whether `master` and the current default `develop` branch need a one-time reconciliation before connecting Railway; do not silently deploy the wrong branch.

## Target topology

```text
Browser -> public web (React Router SSR) -> private API -> private PostgreSQL
ChatGPT / Claude / other MCP client -> public MCP (/mcp) -> private API -> private PostgreSQL
Base RPC -> private indexer (Ponder) -> private PostgreSQL
Base RPC -> private label-discovery worker -> private PostgreSQL
```

Run one replica of each application service to start. Keep PostgreSQL on a persistent volume with backups. Use Railway private networking for web/MCP-to-API and API/indexer/discovery-worker-to-Postgres. Give the API a read-only database role if practical; the indexer and discovery worker need write privileges. MCP must not receive `DATABASE_URL` or a privileged internal API operation. Neither API, indexer, nor discovery worker gets a public domain. Health endpoints must be cheap and not issue chain queries.

## Implementation order (do all development and tests before deployment)

1. **Lock the contracts and branch workflow.** Inventory current API queries and web server proxies; define a narrow versioned/read-only API contract for MCP instead of arbitrary SQL or arbitrary URL fetch. Decide the initial tool set (for example: recent transfers, entity details, flow summaries, token/network metadata), with explicit filters, pagination limits, date/block ranges, stable result shapes, and sensible empty/error responses. Align the code/CI target branch to `master` without deploying.
2. **Build `apps/mcp`.** Use the official MCP TypeScript SDK and Streamable HTTP at `/mcp`. Implement only allowlisted read tools; mark them read-only in metadata. Prefer stateless request handling if compatible with chosen clients/protocol version. Call the private API with short timeouts; never expose API internals, DB credentials, SQL, or unrestricted queries. Add `/health` separately. Treat chain labels and other data as untrusted content in tool results, not instructions. Add precise input validation, per-tool maximum limits, output truncation/size caps, and bounded concurrency.
3. **Add public abuse controls.** Start with one MCP replica and an in-process per-client-IP token bucket/window, with correct Railway proxy-IP handling verified in deployment; document that this is best-effort and resets on restart. Apply a global concurrency cap, request/body size limit, query timeout, per-tool result caps, 429 + `Retry-After`, and useful logs without raw sensitive payloads. Do not assume Railway's own API rate limits protect this service. If abuse or multiple replicas become real, move the limiter to a shared store or edge service; this is not needed for the hobby launch. Set Railway spend alerts and monitor RPC usage.
4. **Prepare all packages for Railway.** Add deterministic build/start commands and health checks for web, API, indexer, discovery worker, and MCP; bind to Railway's `PORT` and `0.0.0.0` where required. Keep the build context at repository root so pnpm workspace dependencies resolve. Add per-service config-as-code where useful, but do not put secrets in git. Verify the web's private API URL and SSE streaming on a production-like local setup. Add an indexer production guard that refuses to start without a numeric, non-negative, explicitly set production start block (and never defaults production to `latest`). Preserve Ponder state/checkpoints across restarts. Start the discovery worker with `labels:worker`; it runs discovery at startup and on its schedule. A one-shot `labels:discover` invocation does not start it.
5. **Tests before any deployment.** Run lint/typecheck/build/unit tests for all packages. Add MCP protocol/Inspector tests for initialization, tools/list, tool calls, malformed/oversized inputs, 429, timeout, empty data, and tool result size. Add API↔MCP contract tests and web proxy/SSE tests. Use disposable local PostgreSQL and fixtures; CI must not read or mutate the production database or run a historical Base sync. Optionally do a local short live test starting at current head, not pre-launch history. Verify a fresh empty DB and a restart against a populated local DB.
6. **Prepare CI/CD in code.** Change CI push branch from `main` to `master`; run on PRs targeting `master` and pushes to `master`, with frozen pnpm install and relevant tests/checks/builds. Keep a required aggregate CI check on PRs. No GitHub Action should run indexer production start, migrations, or Railway deployment before the launch phase. Prefer Railway's GitHub autodeploy + **Wait for CI** over a second GitHub Actions deployment script; this avoids duplicate deploy triggers and Railway tokens in GitHub. Add a small path-matrix test or documented change-classification check for selective deployment behavior.
7. **Create local runbook and website copy.** Document the public MCP URL and client-specific connection steps, examples, limitations, and a note that the user supplies their own ChatGPT/Claude account/model usage. Do not claim universal client support or need an OpenAI/Anthropic API key in our service. Test supported ChatGPT and Claude flows when accounts/features are available, plus a vendor-neutral MCP Inspector check.
8. **Production launch only after all above is green and owner approves.** Follow the account/setup and launch checklists below. After launch, verify end-to-end and update this checklist with actual production URLs, launch block, and decisions (do not commit secrets).

## Selective release rules

Configure one GitHub-linked Railway service per app, all watching `master`, with **Wait for CI** enabled. Set watch paths deliberately rather than accepting the monorepo import defaults (which may omit shared dependencies). A GitHub push can deploy services independently and Railway does **not** order separate GitHub-triggered service deployments; use backward-compatible changes or separate PRs for cross-service/schema changes.

| Changed files | Redeploy after passing CI | Notes |
| --- | --- | --- |
| `apps/web/**` | Web only | UI-only change must not restart API, indexer, MCP, or Postgres. |
| `apps/api/**` | API only | Preserve old private API contract until consumers are updated. |
| `apps/mcp/**` | MCP only | Web page explaining MCP may be a separate web change. |
| `apps/indexer/**` | Indexer and/or discovery worker | Worker-only changes should redeploy the worker without restarting Ponder. Handler/config changes should redeploy the indexer without restarting API. A Ponder schema change requires compatibility review and may make Ponder replay from the **pinned launch block**, never before it. |
| `apps/shared/**` | All consuming app services | Current consumers: web, API, indexer; add MCP only if it imports shared. |
| Root runtime/build config or root dependency changes | All affected app services (conservative all if uncertain) | Do not treat a UI package dependency bump as a root-wide change. |
| Docs and `.github/**` | None | CI still runs where configured. |
| `pnpm-lock.yaml` alone | No automatic app deploy; require an explicit affected-package manifest change or manual targeted redeploy | A web dependency update normally changes `apps/web/package.json` too, so only web deploys. Document lockfile-only security bumps as an exception. |

Configure the Railway watch patterns according to this table, including precise shared-package dependencies. The API's import of indexer schema/labels deserves explicit review: do not add all `apps/indexer/**` to API watch paths just because it is a workspace dependency. CI should build/typecheck API against the latest schema on every PR; deploy API only when its runtime code/consumed labels or a deliberately identified shared contract changes. If Railway watch patterns cannot express the required precision, replace autodeploy with one GitHub Actions change-classifier and targeted Railway CLI deploys; do **not** run both mechanisms.

PostgreSQL is a stateful service, not an app artifact to redeploy for a UI/API change. Ponder owns its schema; do not add a generic `drizzle push` or automatic destructive migration to every release. For a future independent SQL migration, add a versioned, reviewed migration and run it as a deliberate one-time production step with a fresh backup. Additive schema/indexer PR first, wait for healthy indexing and API compatibility, then consumer/API/MCP/web PR; destructive or incompatible schema changes require a separate explicit migration/rollout plan. Do not erase or recreate the production DB/schema to fix a failed deploy.

## Railway and GitHub owner setup (guided, not performed yet)

1. Confirm `master` is the intended production branch and enable GitHub branch protection: PR required, required CI check, no direct pushes (admin bypass policy is owner's choice). Merge current work into `master` only after local tests pass. Keep repo secrets out of git.
2. Create one Railway project and only its `production` environment. Connect the Railway GitHub App to this repo with necessary permission. Do not enable PR/preview environments.
3. Add persistent PostgreSQL and configure automatic backups/retention. Keep it private; verify available storage, restore procedure, and spend alert. Create separate database credentials/roles for indexer write and API read if feasible.
4. Add web, API, indexer, discovery worker, and MCP services from the same repo/`master`. Use repo-root build context with package-specific build/start commands, one replica each, health checks, restart policy, and service-specific watch paths from the table. Disable autodeploy while wiring services; enable it only at launch after CI and environment variables are ready. Enable **Wait for CI** on each application service. Railway Postgres itself is not GitHub-autodeployed.
5. Wire private references: indexer `DATABASE_URL`, `DATABASE_SCHEMA`, paid/reliable Base `PONDER_RPC_URL_8453`; discovery worker write-enabled `DATABASE_URL`, the same Base RPC URL, `NODE_ENV=production`, and `LABEL_DISCOVERY_SCHEDULE_ENABLED=true`; API read-only `DATABASE_URL` and `PORT`; web `STABLEFLOW_API_URL` pointing to private API `/v1`; MCP private API base URL, `PORT`, and rate-limit settings. Keep the public Base endpoint only for local/CI checks, not as an assumed production-capacity RPC. Set service domains only for web and MCP, then optionally custom domains and DNS. The published MCP URL is `https://<mcp-host>/mcp`.
6. First launch block procedure: while indexer is still stopped, query the chosen Base RPC for current finalized/safe head (choose and document which block tag is used); record block number `N`, UTC time, chain ID 8453, and transaction/RPC evidence in the private operations log. Set `PONDER_DISCOVERY_START_BLOCK_8453=N` in Railway and retain it permanently. Verify the effective Ponder config uses `N` for every discovery/source path. Never use `0`, contract deployment block, a pre-launch timestamp, or a fresh `latest` on redeploy. Start the indexer once, then check that first indexed block/event is at or after `N`. If its startup proposes pre-`N` sync, stop it and investigate before continuing.
7. Deploy/verify the private discovery worker, API, MCP, and web against the fresh (possibly empty) DB. Empty-state responses are expected until new on-chain activity arrives. Exercise web, API via private network, MCP Inspector, then available ChatGPT/Claude custom connector paths. Confirm the worker starts once, reports empty windows until transfers arrive, and has no public endpoint. Enable service autodeploys on `master` after the baseline is healthy.
8. Record a restore drill, spend/RPC alert thresholds, and on-call-for-one-person basics: how to see Railway logs, pause MCP if abused, restart a service, redeploy latest healthy commit, and restore Postgres without changing `N`.

## Acceptance criteria before calling this done

- A web-only PR merged to `master` results in exactly one app redeploy: web. DB, API, indexer, discovery worker, and MCP remain untouched.
- An indexer-only handler PR redeploys the indexer only and resumes from its checkpoint without any pre-launch scan. A discovery-worker-only PR redeploys the worker without restarting Ponder. An API-only or MCP-only PR deploys only that service.
- Failed CI prevents Railway application deployment. PRs themselves deploy nothing; production remains a single environment.
- First indexer boot starts at recorded block `N`; no history before `N` is indexed. Restart/catch-up still works. No migration or reset runs on ordinary UI/API/MCP releases.
- Web works with private API, including SSE; MCP works with a public HTTPS `/mcp` endpoint, read-only tools, bounds, rate limiting, and no public DB/API/indexer endpoint.
- DB backups and restore instructions exist; a cost alert is configured; secrets are only in Railway/GitHub secret stores where actually needed.

## Reference docs to re-check when implementing

Product behavior and platform UI can change. Verify the current docs again at implementation/deployment time:

- [Railway monorepo and watch paths](https://docs.railway.com/deployments/monorepo), [GitHub autodeploy and Wait for CI](https://docs.railway.com/deployments/github-autodeploys), [deployment ordering limitations](https://docs.railway.com/deployments/deployment-actions), [Postgres backups/restores](https://docs.railway.com/guides/postgres-backups-restores).
- [OpenAI public MCP connection and testing](https://developers.openai.com/plugins/deploy/connect-chatgpt), [OpenAI MCP server guidance](https://developers.openai.com/plugins/concepts/mcp-server). ChatGPT developer mode/workspace support may vary; public plugin publication is a separate process, not part of this launch.
- [Anthropic MCP documentation](https://docs.anthropic.com/en/docs/mcp) for the current Claude client connection path.
- The repo's own `apps/indexer/src/chains/base.chain.ts`, `apps/indexer/ponder.config.ts`, `.env.example` files, package scripts, and `.github/workflows/ci.yml` are the source of truth for implementation details; verify Ponder's installed-version checkpoint/schema-change behavior with local tests before launch.
