import assert from "node:assert/strict";
import { createServer } from "node:http";
import { afterEach, test } from "node:test";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { createApp } from "../dist/server.js";

const running = [];

afterEach(async () => {
  for (const { close, server } of running.splice(0)) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    if (close) await close();
  }
});

async function listen(server) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return `http://127.0.0.1:${address.port}`;
}

async function fixture({ apiResponse, rateLimitPerMinute = 60 } = {}) {
  const paths = [];
  const apiServer = createServer((request, response) => {
    paths.push(request.url);
    response.setHeader("Content-Type", "application/json");
    response.end(
      JSON.stringify(
        (typeof apiResponse === "function" ? apiResponse(request) : apiResponse) ?? {
          data: [{ id: "transfer-1" }],
          meta: { limit: 5 },
        },
      ),
    );
  });
  const apiOrigin = await listen(apiServer);
  running.push({ server: apiServer });

  const { app, close } = createApp({
    apiUrl: new URL(`${apiOrigin}/v1`),
    host: "127.0.0.1",
    maxConcurrentRequests: 12,
    port: 0,
    rateLimitPerMinute,
    trustProxyHops: 0,
  });
  const mcpServer = createServer(app);
  const origin = await listen(mcpServer);
  running.unshift({ close, server: mcpServer });
  return { origin, paths };
}

async function mcp(origin, method, params = undefined) {
  const response = await fetch(`${origin}/mcp`, {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const text = await response.text();
  const eventData = text
    .split("\n")
    .find((line) => line.startsWith("data: "))
    ?.slice("data: ".length);
  return { response, body: JSON.parse(eventData ?? text) };
}

test("lists nine public read-only tools without authentication", async () => {
  const { origin } = await fixture();
  const { response, body } = await mcp(origin, "tools/list");

  assert.equal(response.status, 200);
  assert.deepEqual(
    body.result.tools.map((tool) => tool.name).sort(),
    [
      "compare_entity_flows",
      "entity_catalog",
      "entity_detail",
      "flow_graph",
      "flow_kpis",
      "recent_transfers",
      "search_index",
      "top_entity_flows",
      "transfer_history",
    ].sort(),
  );
  for (const tool of body.result.tools) {
    assert.equal(tool.annotations.readOnlyHint, true);
    assert.equal(tool.annotations.destructiveHint, false);
  }
});

test("an SDK client can initialize, discover tools, and call one over Streamable HTTP", async () => {
  const { origin, paths } = await fixture();
  const client = new Client({ name: "stableflow-test", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(`${origin}/mcp`));

  try {
    await client.connect(transport);
    assert.equal(client.getServerVersion()?.name, "stableflow");
    assert.ok((await client.listTools()).tools.some((tool) => tool.name === "flow_kpis"));
    const called = await client.callTool({ name: "flow_kpis", arguments: {} });
    assert.deepEqual(JSON.parse(called.content[0].text).data, [{ id: "transfer-1" }]);
    assert.deepEqual(paths, ["/v1/flows/kpis"]);
  } finally {
    await client.close();
  }
});

test("forwards a bounded tool call to the private API", async () => {
  const { origin, paths } = await fixture();
  const { response, body } = await mcp(origin, "tools/call", {
    name: "recent_transfers",
    arguments: { limit: 5 },
  });

  assert.equal(response.status, 200);
  assert.equal(body.result.isError, undefined);
  assert.deepEqual(JSON.parse(body.result.content[0].text).data, [{ id: "transfer-1" }]);
  assert.deepEqual(paths, ["/v1/transfers/recent?limit=5"]);
});

test("gross ranking excludes the pooled unidentified group by default", async () => {
  const { origin, paths } = await fixture();
  const { body } = await mcp(origin, "tools/call", {
    name: "top_entity_flows",
    arguments: { mode: "gross", windowMinutes: 1440 },
  });

  assert.equal(body.result.isError, undefined);
  assert.deepEqual(paths, [
    "/v1/flows/top-entities?limit=8&mode=gross&includeUnidentified=false&windowMinutes=1440",
  ]);
});

test("pages transfer history with a threshold and an opaque cursor", async () => {
  const { origin, paths } = await fixture();
  const { body } = await mcp(origin, "tools/call", {
    name: "transfer_history",
    arguments: { filter: "whale", cursor: "100:2", limit: 5 },
  });

  assert.equal(body.result.isError, undefined);
  assert.deepEqual(paths, ["/v1/transfers?filter=whale&cursor=100%3A2&direction=older&limit=5"]);
});

test("exposes graph and entity catalog through bounded read-only calls", async () => {
  const { origin, paths } = await fixture();
  await mcp(origin, "tools/call", { name: "flow_graph", arguments: { windowMinutes: 60 } });
  await mcp(origin, "tools/call", { name: "entity_catalog", arguments: {} });
  assert.deepEqual(paths, [
    "/v1/flows/live-graph?windowMinutes=60",
    "/v1/entities?limit=20&offset=0",
  ]);
});

test("entity comparison returns only summaries and flows", async () => {
  const { origin, paths } = await fixture({
    apiResponse: (request) => {
      const entityId = request.url.split("/").at(-1).split("?")[0];
      return {
        data: {
          addressLabels: [{ address: "0xprivate" }],
          entity: { entityId },
          flow: { net: { raw: "100" }, window: { minutes: 60 } },
          recentTransfers: [{ id: "omitted" }],
        },
      };
    },
  });
  const { body } = await mcp(origin, "tools/call", {
    name: "compare_entity_flows",
    arguments: { firstEntityId: "entity-a", secondEntityId: "entity-b" },
  });

  assert.equal(body.result.isError, undefined);
  assert.deepEqual(JSON.parse(body.result.content[0].text), {
    data: [
      { entity: { entityId: "entity-a" }, flow: { net: { raw: "100" }, window: { minutes: 60 } } },
      { entity: { entityId: "entity-b" }, flow: { net: { raw: "100" }, window: { minutes: 60 } } },
    ],
  });
  assert.deepEqual(paths.sort(), [
    "/v1/entities/entity-a?windowMinutes=60",
    "/v1/entities/entity-b?windowMinutes=60",
  ]);
});

test("rejects out-of-range tool inputs before touching the API", async () => {
  const { origin, paths } = await fixture();
  const { body } = await mcp(origin, "tools/call", {
    name: "recent_transfers",
    arguments: { limit: 100_000 },
  });

  assert.equal(body.result.isError, true);
  assert.deepEqual(paths, []);
});

test("rejects malformed transfer cursors and duplicate comparison IDs locally", async () => {
  const { origin, paths } = await fixture();
  const cursorCall = await mcp(origin, "tools/call", {
    name: "transfer_history",
    arguments: { cursor: "not-a-cursor" },
  });
  const comparisonCall = await mcp(origin, "tools/call", {
    name: "compare_entity_flows",
    arguments: { firstEntityId: "circle", secondEntityId: "circle" },
  });

  assert.equal(cursorCall.body.result.isError, true);
  assert.equal(comparisonCall.body.result.isError, true);
  assert.deepEqual(paths, []);
});

test("rate limits anonymous clients with Retry-After", async () => {
  const { origin } = await fixture({ rateLimitPerMinute: 2 });
  await mcp(origin, "tools/list");
  await mcp(origin, "tools/list");

  const response = await fetch(`${origin}/mcp`, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 3, method: "tools/list" }),
  });
  assert.equal(response.status, 429);
  assert.ok(response.headers.get("retry-after"));
});

test("rejects oversized API results rather than returning an unbounded tool result", async () => {
  const { origin } = await fixture({ apiResponse: { data: "x".repeat(70_000) } });
  const { body } = await mcp(origin, "tools/call", {
    name: "flow_kpis",
    arguments: {},
  });

  assert.equal(body.result.isError, true);
  assert.match(body.result.content[0].text, /too large/i);
});

test("health endpoint stays available without touching the private API", async () => {
  const { origin, paths } = await fixture();
  const response = await fetch(`${origin}/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok" });
  assert.deepEqual(paths, []);
});
