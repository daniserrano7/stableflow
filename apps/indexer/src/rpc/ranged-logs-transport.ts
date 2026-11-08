import {
  type Address,
  custom,
  type Hash,
  type Hex,
  HttpRequestError,
  hexToBytes,
  hexToNumber,
  keccak256,
  numberToHex,
  RpcRequestError,
  TimeoutError,
  type Transport,
  zeroAddress,
  zeroHash,
} from "viem";
import { baseBlocksIn } from "../chains/base-block-time.js";

/**
 * Since Denim, Base makes 5 blocks a second, and Ponder fetches each block on its own
 * (the full block, then its logs): about 10 requests a second in realtime, and as many
 * blocks as a deployment backfills. This transport answers those per-block requests from
 * ranged eth_getLogs instead: each realtime poll costs the head's header, one eth_getLogs
 * and one header per block without logs, and a recent block that isn't covered yet is
 * fetched with up to `maxRangeBlocks` of its successors.
 *
 * Covered blocks are rebuilt from their logs. Hash, number, parent hash and timestamp are
 * real, and so are transaction hashes and indexes; every other field is zero (`from` is
 * the zero address). The handlers read nothing else. Everything else goes upstream.
 *
 * Only plain contract addresses are fetched: a source using Ponder's factory pattern
 * would need its child addresses here too (ponder.config.ts rejects those).
 */

type RpcLog = {
  address: Address;
  blockHash: Hash;
  blockNumber: Hex;
  blockTimestamp?: Hex;
  logIndex: Hex;
  removed?: boolean;
  transactionHash: Hash;
  transactionIndex: Hex;
};

type RpcHeader = {
  hash: Hash;
  logsBloom: Hex;
  number: Hex;
  parentHash: Hash;
  timestamp: Hex;
};

type CoveredBlock = {
  hash: Hash;
  logs: RpcLog[];
  number: number;
  /** Null for the lowest block of a range whose parent wasn't fetched: not served. */
  parentHash: Hash | null;
  timestamp: Hex;
};

export type Upstream = (method: string, params: unknown[]) => Promise<unknown>;

/** One eth_getLogs at most; also the jump after which coverage restarts at the head. */
export const maxRangeBlocks = 500;
/** A fresh range starts this far behind the head, so realtime's first blocks are covered. */
export const initialRangeBlocks = baseBlocksIn(60);
/** Covered blocks are kept this long: past a deployment's backfill (scripts/start-block.ts). */
export const retainedBlocks = baseBlocksIn(15 * 60);

const zeroLogsBloom: Hex = `0x${"0".repeat(512)}`;
// Covered blocks with logs claim every bloom bit, so Ponder always asks for their logs.
const fullLogsBloom: Hex = `0x${"f".repeat(512)}`;

const isInBloom = (bloom: Hex, input: Hex) => {
  const bloomBytes = hexToBytes(bloom);
  const hash = hexToBytes(keccak256(input));

  return [0, 2, 4].every((i) => {
    const bit = (((hash[i] ?? 0) << 8) + (hash[i + 1] ?? 0)) & 0x7ff;
    return ((bloomBytes[255 - Math.floor(bit / 8)] ?? 0) & (1 << (bit % 8))) !== 0;
  });
};

const isBlockNumber = (tag: unknown): tag is Hex =>
  typeof tag === "string" && /^0x[0-9a-f]+$/i.test(tag);

class InconsistentRangeError extends Error {}

export const createRangedLogsRpc = ({
  addresses,
  upstream,
}: {
  addresses: readonly Address[];
  upstream: Upstream;
}) => {
  const blocks = new Map<number, CoveredBlock>();
  const blocksByHash = new Map<Hash, CoveredBlock>();
  const filling: { from: number; promise: Promise<void>; to: number }[] = [];
  let coveredTo: number | undefined;
  let enabled = true;
  let extending: Promise<void> | undefined;
  // Bumped by every reset, so a range fetched before one isn't stored after it.
  let generation = 0;
  let stats = { servedBlocks: 0, upstream: {} as Record<string, number> };

  const send = (method: string, params: unknown[]) => {
    stats.upstream[method] = (stats.upstream[method] ?? 0) + 1;
    return upstream(method, params);
  };

  const reset = () => {
    blocks.clear();
    blocksByHash.clear();
    coveredTo = undefined;
    generation++;
  };

  const mayHaveIndexedLogs = (bloom: Hex) => addresses.some((address) => isInBloom(bloom, address));

  /** Blocks `fromBlock`..`toBlock` from one ranged eth_getLogs, checked against real headers. */
  const fetchRange = async (fromBlock: number, toBlock: number, head?: RpcHeader) => {
    const logs = (await send("eth_getLogs", [
      { address: addresses, fromBlock: numberToHex(fromBlock), toBlock: numberToHex(toBlock) },
    ])) as RpcLog[];

    const logsByBlock = new Map<number, RpcLog[]>();
    for (const log of logs) {
      if (log.removed) continue;
      if (log.blockTimestamp === undefined) return undefined;

      const blockNumber = hexToNumber(log.blockNumber);
      logsByBlock.set(blockNumber, [...(logsByBlock.get(blockNumber) ?? []), log]);
    }

    // Blocks without indexed logs need their real header. When its bloom says they may
    // have some after all (a lagging node answered the range), their logs are refetched.
    const headers = new Map<number, RpcHeader>(head === undefined ? [] : [[toBlock, head]]);
    await Promise.all(
      Array.from({ length: toBlock - fromBlock + 1 }, (_, i) => fromBlock + i)
        .filter((blockNumber) => !logsByBlock.has(blockNumber) && !headers.has(blockNumber))
        .map(async (blockNumber) => {
          const header = (await send("eth_getBlockByNumber", [
            numberToHex(blockNumber),
            false,
          ])) as RpcHeader | null;
          if (header === null) throw new InconsistentRangeError(`Block ${blockNumber} is missing`);
          headers.set(blockNumber, header);
        }),
    );
    await Promise.all(
      [...headers.values()]
        .filter((header) => !logsByBlock.has(hexToNumber(header.number)))
        .filter((header) => mayHaveIndexedLogs(header.logsBloom))
        .map(async (header) => {
          const blockLogs = (await send("eth_getLogs", [
            { address: addresses, blockHash: header.hash },
          ])) as RpcLog[];
          const kept = blockLogs.filter((log) => !log.removed);
          if (kept.length > 0) logsByBlock.set(hexToNumber(header.number), kept);
        }),
    );

    const range: CoveredBlock[] = [];
    for (let blockNumber = fromBlock; blockNumber <= toBlock; blockNumber++) {
      const header = headers.get(blockNumber);
      const blockLogs = logsByBlock.get(blockNumber) ?? [];
      const hash = header?.hash ?? blockLogs[0]?.blockHash;
      const timestamp = header?.timestamp ?? blockLogs[0]?.blockTimestamp;
      const previous = range.at(-1);
      const parentHash = header?.parentHash ?? previous?.hash ?? null;

      if (hash === undefined || timestamp === undefined) {
        throw new InconsistentRangeError(`Block ${blockNumber} is missing`);
      }
      if (blockLogs.some((log) => log.blockHash !== hash)) {
        throw new InconsistentRangeError(`Logs of block ${blockNumber} disagree on its hash`);
      }
      if (previous !== undefined && parentHash !== previous.hash) {
        throw new InconsistentRangeError(`Block ${blockNumber} doesn't follow its parent`);
      }

      range.push({ hash, logs: blockLogs, number: blockNumber, parentHash, timestamp });
    }

    return range;
  };

  /**
   * Stores a fetched range. A different hash at a covered height means a reorg, and a
   * covered child that doesn't follow the range means another fork answered: either way
   * only the newest range is kept.
   */
  const store = (range: CoveredBlock[]) => {
    const highest = range.at(-1);
    if (highest === undefined) return;

    const child = blocks.get(highest.number + 1);
    if (
      range.some((block) => {
        const covered = blocks.get(block.number);
        return covered !== undefined && covered.hash !== block.hash;
      }) ||
      (child?.parentHash != null && child.parentHash !== highest.hash)
    ) {
      reset();
    }

    for (const block of range) {
      const covered = blocks.get(block.number);
      if (covered !== undefined && (covered.parentHash !== null || block.parentHash === null)) {
        continue;
      }
      blocks.set(block.number, block);
      blocksByHash.set(block.hash, block);
    }

    const coveredChild = blocks.get(highest.number + 1);
    if (coveredChild !== undefined && coveredChild.parentHash === null) {
      coveredChild.parentHash = highest.hash;
    }

    coveredTo = Math.max(coveredTo ?? highest.number, highest.number);
    for (const [blockNumber, block] of blocks) {
      if (blockNumber >= coveredTo - retainedBlocks) continue;
      blocks.delete(blockNumber);
      blocksByHash.delete(block.hash);
    }
  };

  const fetchAndStore = async (fromBlock: number, toBlock: number, head?: RpcHeader) => {
    const fetchedGeneration = generation;
    let range: CoveredBlock[] | undefined;
    try {
      range = await fetchRange(fromBlock, toBlock, head);
    } catch (error) {
      if (!(error instanceof InconsistentRangeError)) throw error;

      console.warn(`[rpc] ${error.message}; refetching from the head on the next poll`);
      reset();
      return;
    }

    if (range === undefined) {
      if (enabled) console.warn("[rpc] eth_getLogs has no blockTimestamp; fetching every block");
      enabled = false;
      reset();
    } else if (generation === fetchedGeneration) {
      store(range);
    }
  };

  const extend = async () => {
    const head = (await send("eth_getBlockByNumber", ["latest", false])) as RpcHeader;
    const headNumber = hexToNumber(head.number);

    // A lagging node can report an older head: keep serving the newest covered block.
    if (coveredTo !== undefined && headNumber <= coveredTo) return;

    // Ranges overlap by one block, so a reorg there is noticed.
    const fromBlock =
      coveredTo === undefined || headNumber - coveredTo > maxRangeBlocks
        ? headNumber - initialRangeBlocks
        : coveredTo;
    await fetchAndStore(fromBlock, headNumber, head);
  };

  /** Covers a recent block that isn't servable yet, with the blocks after it. */
  const fill = (blockNumber: number) => {
    const pending = filling.find(({ from, to }) => from <= blockNumber && blockNumber <= to);
    if (pending !== undefined) return pending.promise;
    if (
      coveredTo === undefined ||
      blockNumber > coveredTo ||
      blockNumber < coveredTo - retainedBlocks
    ) {
      return undefined;
    }

    // Start at the parent: it gives the block its parent hash, and when the parent is
    // already covered, comparing it checks the range against the covered chain.
    const from = blockNumber - 1;
    let to = Math.min(from + maxRangeBlocks - 1, coveredTo);
    for (let next = blockNumber; next <= to; next++) {
      if (blocks.has(next) || filling.some((entry) => entry.from <= next && next <= entry.to)) {
        to = Math.max(next - 1, from);
        break;
      }
    }

    const entry = { from, promise: Promise.resolve(), to };
    entry.promise = fetchAndStore(from, to).finally(() => {
      filling.splice(filling.indexOf(entry), 1);
    });
    filling.push(entry);
    return entry.promise;
  };

  const servable = (block: CoveredBlock | undefined) =>
    block !== undefined && block.parentHash !== null ? block : undefined;

  const toRpcBlock = (block: CoveredBlock, includeTransactions: boolean) => {
    stats.servedBlocks++;

    const transactions = new Map<Hex, RpcLog>();
    for (const log of block.logs) {
      if (log.transactionHash !== zeroHash) transactions.set(log.transactionIndex, log);
    }

    // Fields logs don't carry are zero but always present: Ponder reads some of them
    // without defaulting them first (receiptsRoot when storing, gasPrice for events).
    return {
      baseFeePerGas: "0x0",
      difficulty: "0x0",
      extraData: "0x",
      gasLimit: "0x0",
      gasUsed: "0x0",
      hash: block.hash,
      logsBloom: block.logs.length > 0 ? fullLogsBloom : zeroLogsBloom,
      miner: zeroAddress,
      mixHash: zeroHash,
      nonce: "0x0000000000000000",
      number: numberToHex(block.number),
      parentHash: block.parentHash,
      receiptsRoot: zeroHash,
      sha3Uncles: zeroHash,
      size: "0x0",
      stateRoot: zeroHash,
      timestamp: block.timestamp,
      totalDifficulty: "0x0",
      transactions: [...transactions.values()].map((log) =>
        includeTransactions
          ? {
              blockHash: block.hash,
              blockNumber: numberToHex(block.number),
              from: zeroAddress,
              gas: "0x0",
              gasPrice: "0x0",
              hash: log.transactionHash,
              input: "0x",
              nonce: "0x0",
              r: "0x0",
              s: "0x0",
              to: null,
              transactionIndex: log.transactionIndex,
              type: "0x0",
              v: "0x0",
              value: "0x0",
            }
          : log.transactionHash,
      ),
      transactionsRoot: zeroHash,
    };
  };

  const request = async (method: string, params: unknown[] = []) => {
    if (enabled && method === "eth_getBlockByNumber") {
      const [tag, includeTransactions] = params;

      if (tag === "latest") {
        extending ??= extend().finally(() => {
          extending = undefined;
        });
        await extending;
        const head = servable(coveredTo === undefined ? undefined : blocks.get(coveredTo));
        if (head !== undefined) return toRpcBlock(head, includeTransactions === true);
      } else if (isBlockNumber(tag)) {
        const blockNumber = hexToNumber(tag);
        if (servable(blocks.get(blockNumber)) === undefined) await fill(blockNumber);
        const block = servable(blocks.get(blockNumber));
        if (block !== undefined) return toRpcBlock(block, includeTransactions === true);
      }
    }

    if (enabled && method === "eth_getBlockByHash") {
      const [hash, includeTransactions] = params as [Hash, boolean | undefined];
      const block = servable(blocksByHash.get(hash));
      if (block !== undefined) return toRpcBlock(block, includeTransactions === true);
    }

    if (enabled && method === "eth_getLogs") {
      const [filter] = params as [Record<string, unknown> | undefined];
      // Ponder asks for all of a block's logs and filters them itself.
      if (filter !== undefined && Object.keys(filter).join() === "blockHash") {
        const block = servable(blocksByHash.get(filter.blockHash as Hash));
        if (block !== undefined) return block.logs.map((log) => ({ ...log }));
      }
    }

    return send(method, params);
  };

  /** Upstream requests and served blocks since the previous call. */
  const takeStats = () => {
    const taken = stats;
    stats = { servedBlocks: 0, upstream: {} };
    return taken;
  };

  return { request, takeStats };
};

/**
 * JSON-RPC over HTTP that fails like Ponder's own client: a non-2xx response is an
 * HttpRequestError with its status (viem's http transport reports dRPC's 429 as an RPC
 * error instead), so Ponder recognizes rate limits and backs off.
 */
export const createHttpUpstream = ({
  timeout,
  url,
}: {
  timeout: number;
  url: string;
}): Upstream => {
  let id = 0;

  return async (method, params) => {
    const body = { id: ++id, jsonrpc: "2.0", method, params };
    let response: Response;
    let text: string;
    try {
      response = await fetch(url, {
        body: JSON.stringify(body),
        headers: { "content-type": "application/json" },
        method: "POST",
        signal: AbortSignal.timeout(timeout),
      });
      text = await response.text();
    } catch (error) {
      if (error instanceof DOMException && error.name === "TimeoutError") {
        throw new TimeoutError({ body, url });
      }
      throw new HttpRequestError({ body, cause: error as Error, url });
    }

    let data: { error?: { code: number; data?: unknown; message: string }; result?: unknown };
    try {
      data = JSON.parse(text || "{}");
    } catch {
      data = { error: { code: -32700, message: text } };
    }

    if (!response.ok) {
      throw new HttpRequestError({
        body,
        details: JSON.stringify(data.error) || response.statusText,
        headers: response.headers,
        status: response.status,
        url,
      });
    }
    if (data.error !== undefined) throw new RpcRequestError({ body, error: data.error, url });
    return data.result;
  };
};

export const rangedLogsTransport =
  ({ addresses, url }: { addresses: readonly Address[]; url: string }): Transport =>
  (options) => {
    const rpc = createRangedLogsRpc({
      addresses,
      upstream: createHttpUpstream({ timeout: options.timeout ?? 10_000, url }),
    });

    setInterval(() => {
      const { servedBlocks, upstream } = rpc.takeStats();
      const total = Object.values(upstream).reduce((sum, count) => sum + count, 0);
      const methods = Object.entries(upstream)
        .map(([method, count]) => `${method}=${count}`)
        .join(" ");

      console.log(
        `[rpc] last minute | upstream=${total} ${methods} | served_blocks=${servedBlocks}`,
      );
    }, 60_000).unref();

    return custom({
      request: ({ method, params }) => rpc.request(method, (params ?? []) as unknown[]),
    })(options);
  };
