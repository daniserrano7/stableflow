import assert from "node:assert/strict";
import { createServer } from "node:http";
import test, { type TestContext } from "node:test";
import {
  type Hex,
  HttpRequestError,
  hexToNumber,
  keccak256,
  numberToHex,
  RpcRequestError,
  TimeoutError,
  toHex,
} from "viem";
import {
  createHttpUpstream,
  createRangedLogsRpc,
  initialRangeBlocks,
  retainedBlocks,
  type Upstream,
} from "../src/rpc/ranged-logs-transport.js";

const usdc = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const zeroBloom: Hex = `0x${"0".repeat(512)}`;
const fullBloom: Hex = `0x${"f".repeat(512)}`;

type Log = {
  address: Hex;
  blockHash: Hex;
  blockNumber: Hex;
  blockTimestamp?: Hex;
  logIndex: Hex;
  transactionHash: Hex;
  transactionIndex: Hex;
};

/**
 * A fake Base node. Every block has two USDC logs except `withoutLogs`. Blocks from
 * `forkFrom` on belong to fork "b". `omittedFromRanges` blocks are missing from ranged
 * eth_getLogs answers, like a lagging node behind a load balancer.
 */
const createChain = () => {
  const chain = {
    calls: [] as { method: string; params: unknown[] }[],
    forkFrom: Number.POSITIVE_INFINITY,
    head: 1000,
    omittedFromRanges: new Set<number>(),
    timestamps: true,
    withoutLogs: new Set<number>(),
  };

  const hashOf = (number: number) =>
    keccak256(toHex(`${number >= chain.forkFrom ? "b" : "a"}:${number}`));

  const logsOf = (number: number): Log[] =>
    chain.withoutLogs.has(number)
      ? []
      : [0, 1].map((index) => ({
          address: usdc,
          blockHash: hashOf(number),
          blockNumber: numberToHex(number),
          ...(chain.timestamps
            ? { blockTimestamp: numberToHex(1_000_000 + Math.floor(number / 5)) }
            : {}),
          logIndex: numberToHex(index),
          transactionHash: keccak256(toHex(`tx:${hashOf(number)}:${index}`)),
          transactionIndex: numberToHex(index),
        }));

  const headerOf = (number: number) => ({
    hash: hashOf(number),
    logsBloom: chain.withoutLogs.has(number) ? zeroBloom : fullBloom,
    number: numberToHex(number),
    parentHash: hashOf(number - 1),
    source: "upstream",
    timestamp: numberToHex(1_000_000 + Math.floor(number / 5)),
  });

  const upstream: Upstream = async (method, params) => {
    chain.calls.push({ method, params });

    if (method === "eth_getBlockByNumber") {
      const [tag] = params as [string];
      if (tag === "latest") return headerOf(chain.head);
      if (tag === "finalized") return headerOf(chain.head - 30);
      return headerOf(hexToNumber(tag as Hex));
    }
    if (method === "eth_getLogs") {
      const [filter] = params as [{ blockHash?: Hex; fromBlock?: Hex; toBlock?: Hex }];
      if (filter.blockHash !== undefined) {
        const number = Array.from({ length: chain.head + 1 }, (_, i) => i).find(
          (candidate) => hashOf(candidate) === filter.blockHash,
        );
        return number === undefined ? [] : logsOf(number);
      }

      const logs: Log[] = [];
      for (
        let number = hexToNumber(filter.fromBlock ?? "0x0");
        number <= hexToNumber(filter.toBlock ?? "0x0");
        number++
      ) {
        if (!chain.omittedFromRanges.has(number)) logs.push(...logsOf(number));
      }
      return logs;
    }
    return { method, source: "upstream" };
  };

  return { chain, hashOf, logsOf, upstream };
};

const silenceWarnings = (t: TestContext) => t.mock.method(console, "warn", () => {});

test("a poll covers new blocks with one ranged eth_getLogs and serves them", async () => {
  const { chain, hashOf, logsOf, upstream } = createChain();
  const rpc = createRangedLogsRpc({ addresses: [usdc], upstream });

  const first = (await rpc.request("eth_getBlockByNumber", ["latest", true])) as { number: Hex };
  assert.equal(first.number, numberToHex(1000));
  assert.deepEqual(chain.calls[1]?.params[0], {
    address: [usdc],
    fromBlock: numberToHex(1000 - initialRangeBlocks),
    toBlock: numberToHex(1000),
  });

  chain.calls.length = 0;
  chain.head = 1010;
  await rpc.request("eth_getBlockByNumber", ["latest", true]);
  // The head's header and one eth_getLogs, overlapping the last covered block.
  assert.deepEqual(
    chain.calls.map(({ method }) => method),
    ["eth_getBlockByNumber", "eth_getLogs"],
  );
  assert.equal((chain.calls[1]?.params[0] as { fromBlock: Hex }).fromBlock, numberToHex(1000));

  chain.calls.length = 0;
  const block = (await rpc.request("eth_getBlockByNumber", [numberToHex(1005), true])) as {
    hash: Hex;
    logsBloom: Hex;
    parentHash: Hex;
    timestamp: Hex;
    transactions: { from: Hex; hash: Hex; transactionIndex: Hex }[];
  };
  const logs = await rpc.request("eth_getLogs", [{ blockHash: hashOf(1005) }]);
  const byHash = await rpc.request("eth_getBlockByHash", [hashOf(1005), false]);

  assert.equal(chain.calls.length, 0);
  assert.equal(block.hash, hashOf(1005));
  assert.equal(block.parentHash, hashOf(1004));
  assert.equal(block.timestamp, numberToHex(1_000_000 + 201));
  assert.equal(block.logsBloom, fullBloom);
  // Fields Ponder reads when storing blocks and building events, some without defaults
  // (a missing receiptsRoot crashed the backfill, a missing gasPrice realtime events).
  for (const field of [
    "difficulty",
    "extraData",
    "gasLimit",
    "gasUsed",
    "miner",
    "mixHash",
    "nonce",
    "receiptsRoot",
    "sha3Uncles",
    "size",
    "stateRoot",
    "transactionsRoot",
  ]) {
    assert.equal(typeof (block as Record<string, unknown>)[field], "string", field);
  }
  for (const field of [
    "blockHash",
    "blockNumber",
    "from",
    "gas",
    "gasPrice",
    "input",
    "nonce",
    "r",
    "s",
    "type",
    "v",
    "value",
  ]) {
    assert.equal(
      typeof (block.transactions[0] as Record<string, unknown> | undefined)?.[field],
      "string",
      field,
    );
  }
  assert.deepEqual(
    block.transactions.map(({ hash, transactionIndex }) => [hash, transactionIndex]),
    logsOf(1005).map(({ transactionHash, transactionIndex }) => [
      transactionHash,
      transactionIndex,
    ]),
  );
  assert.deepEqual(logs, logsOf(1005));
  assert.deepEqual(
    (byHash as { transactions: Hex[] }).transactions,
    logsOf(1005).map(({ transactionHash }) => transactionHash),
  );
});

test("blocks without indexed logs come from their real header", async () => {
  const { chain, hashOf, upstream } = createChain();
  const rpc = createRangedLogsRpc({ addresses: [usdc], upstream });
  await rpc.request("eth_getBlockByNumber", ["latest", true]);

  chain.withoutLogs.add(1003);
  chain.head = 1006;
  chain.calls.length = 0;
  await rpc.request("eth_getBlockByNumber", ["latest", true]);
  assert.deepEqual(
    chain.calls.map(({ method }) => method),
    ["eth_getBlockByNumber", "eth_getLogs", "eth_getBlockByNumber"],
  );
  assert.deepEqual(chain.calls[2]?.params, [numberToHex(1003), false]);

  chain.calls.length = 0;
  const block = (await rpc.request("eth_getBlockByNumber", [numberToHex(1003), true])) as {
    logsBloom: Hex;
    parentHash: Hex;
    transactions: unknown[];
  };
  const logs = await rpc.request("eth_getLogs", [{ blockHash: hashOf(1003) }]);
  const next = (await rpc.request("eth_getBlockByNumber", [numberToHex(1004), true])) as {
    parentHash: Hex;
  };

  assert.equal(chain.calls.length, 0);
  // Ponder only accepts an empty logs array next to an empty bloom.
  assert.equal(block.logsBloom, zeroBloom);
  assert.equal(block.parentHash, hashOf(1002));
  assert.deepEqual(block.transactions, []);
  assert.deepEqual(logs, []);
  assert.equal(next.parentHash, hashOf(1003));
});

test("logs a lagging node left out of the range are refetched by block hash", async () => {
  const { chain, hashOf, logsOf, upstream } = createChain();
  const rpc = createRangedLogsRpc({ addresses: [usdc], upstream });
  await rpc.request("eth_getBlockByNumber", ["latest", true]);

  chain.omittedFromRanges.add(1004);
  chain.head = 1005;
  await rpc.request("eth_getBlockByNumber", ["latest", true]);

  assert.deepEqual(await rpc.request("eth_getLogs", [{ blockHash: hashOf(1004) }]), logsOf(1004));
});

test("a reorg at the overlap block restarts coverage on the new fork", async () => {
  const { chain, hashOf, upstream } = createChain();
  const rpc = createRangedLogsRpc({ addresses: [usdc], upstream });
  await rpc.request("eth_getBlockByNumber", ["latest", true]);
  chain.head = 1010;
  await rpc.request("eth_getBlockByNumber", ["latest", true]);
  const orphanHash = hashOf(1009);

  chain.forkFrom = 1009;
  chain.head = 1012;
  chain.calls.length = 0;
  const head = (await rpc.request("eth_getBlockByNumber", ["latest", true])) as { hash: Hex };
  assert.equal(head.hash, hashOf(1012));
  // The overlap moved to the new fork: one range from the old head, nothing else.
  assert.deepEqual(
    chain.calls.map(({ method }) => method),
    ["eth_getBlockByNumber", "eth_getLogs"],
  );

  chain.calls.length = 0;
  const child = (await rpc.request("eth_getBlockByNumber", [numberToHex(1011), true])) as {
    parentHash: Hex;
  };
  assert.equal(child.parentHash, hashOf(1010));
  assert.equal(chain.calls.length, 0);

  // The new range's first block needs its parent fetched; the orphan goes upstream.
  const first = (await rpc.request("eth_getBlockByNumber", [numberToHex(1010), true])) as {
    parentHash: Hex;
  };
  assert.equal(first.parentHash, hashOf(1009));
  await rpc.request("eth_getBlockByHash", [orphanHash, true]);
  assert.deepEqual(
    chain.calls.map(({ method }) => method),
    ["eth_getLogs", "eth_getBlockByHash"],
  );
});

test("a range that disagrees with the head's header is not served", async (t) => {
  silenceWarnings(t);
  const { chain, upstream } = createChain();
  const rpc = createRangedLogsRpc({
    addresses: [usdc],
    upstream: async (method, params) => {
      const result = await upstream(method, params);
      // The node answering eth_getLogs is on another fork for the head block.
      if (method === "eth_getLogs") {
        return (result as Log[]).map((log) =>
          hexToNumber(log.blockNumber) === chain.head
            ? { ...log, blockHash: keccak256("0x01") }
            : log,
        );
      }
      return result;
    },
  });

  const head = (await rpc.request("eth_getBlockByNumber", ["latest", true])) as { source?: string };
  assert.equal(head.source, "upstream");
  assert.deepEqual(chain.calls.at(-1)?.params, ["latest", true]);
});

test("without blockTimestamp in logs every request goes upstream", async (t) => {
  silenceWarnings(t);
  const { chain, upstream } = createChain();
  chain.timestamps = false;
  const rpc = createRangedLogsRpc({ addresses: [usdc], upstream });

  const head = (await rpc.request("eth_getBlockByNumber", ["latest", true])) as { source?: string };
  assert.equal(head.source, "upstream");

  chain.timestamps = true;
  chain.head = 1010;
  chain.calls.length = 0;
  await rpc.request("eth_getBlockByNumber", ["latest", true]);
  assert.deepEqual(chain.calls, [{ method: "eth_getBlockByNumber", params: ["latest", true] }]);
});

test("other requests and uncovered blocks go upstream unchanged", async () => {
  const { chain, hashOf, upstream } = createChain();
  const rpc = createRangedLogsRpc({ addresses: [usdc], upstream });
  await rpc.request("eth_getBlockByNumber", ["latest", true]);
  chain.calls.length = 0;

  const call = await rpc.request("eth_call", [{ data: "0x" }, numberToHex(1000)]);
  await rpc.request("eth_getBlockByNumber", [numberToHex(1001), true]);
  await rpc.request("eth_getBlockByNumber", ["finalized", false]);
  await rpc.request("eth_getLogs", [{ address: usdc, blockHash: hashOf(999) }]);

  assert.deepEqual(call, { method: "eth_call", source: "upstream" });
  assert.deepEqual(
    chain.calls.map(({ method }) => method),
    ["eth_call", "eth_getBlockByNumber", "eth_getBlockByNumber", "eth_getLogs"],
  );
});

test("a recent uncovered block is fetched with its successors in one range", async () => {
  const { chain, hashOf, logsOf, upstream } = createChain();
  const rpc = createRangedLogsRpc({ addresses: [usdc], upstream });
  await rpc.request("eth_getBlockByNumber", ["latest", true]);
  chain.calls.length = 0;

  // Like Ponder's backfill: many blocks below the covered range at once.
  const requested = await Promise.all(
    [500, 501, 650, 699].map(
      (number) =>
        rpc.request("eth_getBlockByNumber", [numberToHex(number), true]) as Promise<{
          hash: Hex;
          parentHash: Hex;
        }>,
    ),
  );

  // One range, from the first block's parent up to the covered blocks.
  assert.deepEqual(chain.calls, [
    {
      method: "eth_getLogs",
      params: [{ address: [usdc], fromBlock: numberToHex(499), toBlock: numberToHex(699) }],
    },
  ]);
  assert.deepEqual(
    requested.map(({ hash, parentHash }) => [hash, parentHash]),
    [500, 501, 650, 699].map((number) => [hashOf(number), hashOf(number - 1)]),
  );
  assert.deepEqual(await rpc.request("eth_getLogs", [{ blockHash: hashOf(600) }]), logsOf(600));
  // The previously lowest covered block now has a known parent too.
  const joined = (await rpc.request("eth_getBlockByNumber", [
    numberToHex(1000 - initialRangeBlocks),
    true,
  ])) as { parentHash: Hex };
  assert.equal(joined.parentHash, hashOf(1000 - initialRangeBlocks - 1));
  assert.equal(chain.calls.length, 1);
});

test("blocks older than the retained window go upstream", async () => {
  const { chain, upstream } = createChain();
  chain.head = 6000;
  const rpc = createRangedLogsRpc({ addresses: [usdc], upstream });
  await rpc.request("eth_getBlockByNumber", ["latest", true]);
  chain.calls.length = 0;

  const block = (await rpc.request("eth_getBlockByNumber", [
    numberToHex(6000 - retainedBlocks - 1),
    true,
  ])) as {
    source?: string;
  };
  assert.equal(block.source, "upstream");
  assert.deepEqual(
    chain.calls.map(({ method }) => method),
    ["eth_getBlockByNumber"],
  );
});

test("stats count upstream requests and served blocks", async () => {
  const { chain, upstream } = createChain();
  const rpc = createRangedLogsRpc({ addresses: [usdc], upstream });
  await rpc.request("eth_getBlockByNumber", ["latest", true]);
  chain.head = 1002;
  await rpc.request("eth_getBlockByNumber", ["latest", true]);
  await rpc.request("eth_getBlockByNumber", [numberToHex(1001), true]);

  assert.deepEqual(rpc.takeStats(), {
    servedBlocks: 3,
    upstream: { eth_getBlockByNumber: 2, eth_getLogs: 2 },
  });
  assert.deepEqual(rpc.takeStats(), { servedBlocks: 0, upstream: {} });
});

test("upstream errors look like Ponder's own HTTP client, so rate limits back off", async (t) => {
  const responses: { body: string; delayMs?: number; status: number }[] = [
    { body: '{"jsonrpc":"2.0","id":1,"result":"0x10"}', status: 200 },
    {
      body: '{"jsonrpc":"2.0","id":2,"error":{"message":"You reached rate limit for your plan","code":15}}',
      status: 429,
    },
    {
      body: '{"jsonrpc":"2.0","id":3,"error":{"message":"execution reverted","code":3}}',
      status: 200,
    },
    { body: "{}", delayMs: 200, status: 200 },
  ];
  const server = createServer((_request, response) => {
    const next = responses.shift();
    setTimeout(() => response.writeHead(next?.status ?? 500).end(next?.body), next?.delayMs ?? 0);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());

  const { port } = server.address() as { port: number };
  const upstream = createHttpUpstream({ timeout: 100, url: `http://127.0.0.1:${port}` });

  assert.equal(await upstream("eth_blockNumber", []), "0x10");
  await assert.rejects(upstream("eth_blockNumber", []), (error) => {
    assert.ok(error instanceof HttpRequestError);
    assert.equal(error.status, 429);
    return true;
  });
  await assert.rejects(upstream("eth_call", []), RpcRequestError);
  await assert.rejects(upstream("eth_blockNumber", []), TimeoutError);
});
