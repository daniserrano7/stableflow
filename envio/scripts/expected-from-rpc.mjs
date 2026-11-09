// Independent check of the indexed rows: fetch raw logs with eth_getLogs from a public Base
// RPC and write the rows the Ponder handlers would produce for USDC transfers and bridge
// events, as TSV files. Compare them with the database using scripts/compare.sql.
//
//   node scripts/expected-from-rpc.mjs <fromBlock> <toBlock> <outDir>
//
// RPC_URL defaults to https://base-rpc.publicnode.com.
import fs from "node:fs";
import { decodeEventLog, parseAbi } from "viem";

const [from, to, outDir] = [Number(process.argv[2]), Number(process.argv[3]), process.argv[4]];
const rpc = process.env.RPC_URL ?? "https://base-rpc.publicnode.com";
const USDC = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
const addr = {
  across: "0x09aea4b2242abc8bb4bb78d537a67a245a7bec64",
  cctpMessenger: "0x28b5a0e9c621a5badaa536219b3a228c8168cf5d",
  cctpTransmitter: "0x81d40f21f12a8f0e3252bccb954d722d4c464b64",
};
const transferTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

const bridgeAbi = parseAbi([
  "event DepositForBurn(uint64 indexed nonce, address indexed burnToken, uint256 amount, address indexed depositor, bytes32 mintRecipient, uint32 destinationDomain, bytes32 destinationTokenMessenger, bytes32 destinationCaller, uint256 maxFee, uint32 minFinalityThreshold)",
  "event MessageReceived(address indexed caller, uint32 sourceDomain, bytes32 indexed nonce, bytes32 sender, uint32 indexed finalityThresholdExecuted, bytes messageBody)",
  "event V3FundsDeposited(address inputToken, address outputToken, uint256 inputAmount, uint256 outputAmount, uint256 indexed destinationChainId, uint32 indexed depositId, uint32 quoteTimestamp, uint32 fillDeadline, uint32 exclusivityDeadline, address indexed depositor, address recipient, address exclusiveRelayer, bytes message)",
  "event FilledV3Relay(address inputToken, address outputToken, uint256 inputAmount, uint256 outputAmount, uint256 repaymentChainId, uint256 indexed originChainId, uint32 indexed depositId, uint32 fillDeadline, uint32 exclusivityDeadline, address exclusiveRelayer, address indexed relayer, address depositor, address recipient, bytes message, (address updatedRecipient, bytes updatedMessage, uint256 updatedOutputAmount, uint8 fillType) relayExecutionInfo)",
  "event FundsDeposited(bytes32 inputToken, bytes32 outputToken, uint256 inputAmount, uint256 outputAmount, uint256 indexed destinationChainId, uint256 indexed depositId, uint32 quoteTimestamp, uint32 fillDeadline, uint32 exclusivityDeadline, bytes32 indexed depositor, bytes32 recipient, bytes32 exclusiveRelayer, bytes message)",
  "event FilledRelay(bytes32 inputToken, bytes32 outputToken, uint256 inputAmount, uint256 outputAmount, uint256 repaymentChainId, uint256 indexed originChainId, uint256 indexed depositId, uint32 fillDeadline, uint32 exclusivityDeadline, bytes32 exclusiveRelayer, bytes32 indexed relayer, bytes32 depositor, bytes32 recipient, bytes32 messageHash, (bytes32 updatedRecipient, bytes updatedMessage, uint256 updatedOutputAmount, uint8 fillType) relayExecutionInfo)",
]);

async function call(method, params) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(rpc, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
    const j = await res.json().catch(() => ({}));
    if (j.result) return j.result;
    if (attempt > 6) throw new Error(`${method}: ${JSON.stringify(j.error ?? j)}`);
    await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
  }
}

// Split a range until the node accepts it (log-count limits differ by endpoint).
async function getLogs(filter, a, b) {
  try {
    return await call("eth_getLogs", [{ ...filter, fromBlock: "0x" + a.toString(16), toBlock: "0x" + b.toString(16) }]);
  } catch (e) {
    if (a === b) throw e;
    const m = Math.floor((a + b) / 2);
    return [...(await getLogs(filter, a, m)), ...(await getLogs(filter, m + 1, b))];
  }
}

async function fetchAll(filter, step) {
  const ranges = [];
  for (let a = from; a <= to; a += step) ranges.push([a, Math.min(a + step - 1, to)]);
  const out = [];
  let i = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (i < ranges.length) { const r = ranges[i++]; out.push(...(await getLogs(filter, r[0], r[1]))); }
  }));
  return out;
}

const isUsdc = (t) => t.toLowerCase() === USDC || t.toLowerCase() === "0x000000000000000000000000" + USDC.slice(2);
const word = (hex, byte) => hex.slice(2 + byte * 2, 2 + byte * 2 + 64);

const transfers = await fetchAll({ address: USDC, topics: [transferTopic] }, 100);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(`${outDir}/expected_transfers.tsv`, transfers.map((l) =>
  [`${l.transactionHash}-${parseInt(l.logIndex, 16)}`, parseInt(l.blockNumber, 16), l.transactionHash, parseInt(l.logIndex, 16),
   "0x" + l.topics[1].slice(26), "0x" + l.topics[2].slice(26), BigInt(l.data).toString()].join("\t")).join("\n") + "\n");

const logs = [
  ...(await fetchAll({ address: [addr.across, addr.cctpMessenger, addr.cctpTransmitter] }, 500)),
];
const rows = [];
for (const l of logs) {
  let ev;
  try { ev = decodeEventLog({ abi: bridgeAbi, data: l.data, topics: l.topics }); } catch { continue; }
  const p = ev.args;
  let r = null;
  if (ev.eventName === "DepositForBurn" && isUsdc(p.burnToken)) r = ["circle-cctp", "outbound", ev.eventName, p.amount, "", String(p.destinationDomain)];
  if (ev.eventName === "MessageReceived") {
    const body = p.messageBody; const len = (body.length - 2) / 2;
    if (len >= 196 && parseInt(body.slice(2, 10), 16) === 1) {
      const amount = BigInt("0x" + word(body, 68)), fee = BigInt("0x" + word(body, 164));
      if (fee <= amount) r = ["circle-cctp", "inbound", ev.eventName, amount - fee, "", String(p.sourceDomain)];
    }
  }
  if ((ev.eventName === "V3FundsDeposited" || ev.eventName === "FundsDeposited") && isUsdc(p.inputToken)) r = ["across", "outbound", ev.eventName, p.inputAmount, String(p.destinationChainId), ""];
  if ((ev.eventName === "FilledV3Relay" || ev.eventName === "FilledRelay") && isUsdc(p.outputToken)) r = ["across", "inbound", ev.eventName, p.relayExecutionInfo.updatedOutputAmount, String(p.originChainId), ""];
  if (r) rows.push([`${l.transactionHash}-${parseInt(l.logIndex, 16)}`, parseInt(l.blockNumber, 16), ...r.map(String)].join("\t"));
}
fs.writeFileSync(`${outDir}/expected_bridge.tsv`, rows.join("\n") + "\n");
console.log(JSON.stringify({ transfers: transfers.length, bridgeEvents: rows.length, bridgeContractLogs: logs.length }));
