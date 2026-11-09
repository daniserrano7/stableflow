// USDC pools and vaults the factories created in a block range, from raw logs.
//   node scripts/expected-labels-from-rpc.mjs <from> <to>   (prints one lowercase address per line)
import { decodeEventLog, parseAbi } from "viem";
const [from, to] = [Number(process.argv[2]), Number(process.argv[3])];
const rpc = process.env.RPC_URL ?? "https://base-rpc.publicnode.com";
const USDC = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
const factories = {
  "0x420dd381b31aef6683db6b902084cb0ffece40da": "event PoolCreated(address indexed token0, address indexed token1, bool indexed stable, address pool, uint256 poolIndex)",
  "0x5e7bb104d84c7cb9b682aac2f3d509f5f406809a": "event PoolCreated(address indexed token0, address indexed token1, int24 indexed tickSpacing, address pool)",
  "0xf8f2eb4940cfe7d13603dddd87f123820fc061ef": "event PoolCreated(address indexed token0, address indexed token1, int24 indexed tickSpacing, address pool)",
  "0xec8e5342b19977b4ef8892e02d8daecfa1315831": "event PoolCreated(address indexed token0, address indexed token1, int24 indexed tickSpacing, address pool)",
  "0x33128a8fc17869897dce68ed026d694621f6fdfd": "event PoolCreated(address indexed token0, address indexed token1, uint24 indexed fee, int24 tickSpacing, address pool)",
  "0x0bfbcf9fa4f9c56b0f40a671ad40e0805a091865": "event PoolCreated(address indexed token0, address indexed token1, uint24 indexed fee, int24 tickSpacing, address pool)",
  "0xa9c3d3a366466fa809d1ae982fb2c46e5fc41101": "event CreateMetaMorpho(address indexed metaMorpho, address indexed caller, address initialOwner, uint256 initialTimelock, address indexed asset, string name, string symbol, bytes32 salt)",
};
for (const [factory, sig] of Object.entries(factories)) {
  const res = await fetch(rpc, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getLogs", params: [{ address: factory, fromBlock: "0x" + from.toString(16), toBlock: "0x" + to.toString(16) }] }) });
  const j = await res.json();
  if (!j.result) throw new Error(`${factory}: ${JSON.stringify(j.error)}`);
  for (const l of j.result) {
    const { args } = decodeEventLog({ abi: parseAbi([sig]), data: l.data, topics: l.topics });
    if (args.metaMorpho) { if (args.asset.toLowerCase() === USDC) console.log(args.metaMorpho.toLowerCase()); }
    else if ([args.token0, args.token1].some((t) => t.toLowerCase() === USDC)) console.log(args.pool.toLowerCase());
  }
}
