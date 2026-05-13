// data.jsx — mock protocols, transfer events, anomalies
// Exposes: PROTOCOLS, randomTransfer(), randomAnomaly(), shortAddr()

const PROTOCOLS = [
  // DEXs
  { id: "uniswap",    name: "Uniswap V3",   cat: "dex",     glyph: "U", color: "#ff6ec7", weight: 1.0 },
  { id: "aerodrome",  name: "Aerodrome",    cat: "dex",     glyph: "A", color: "#5ce1ff", weight: 0.95 },
  { id: "curve",      name: "Curve",        cat: "dex",     glyph: "C", color: "#ffd86b", weight: 0.55 },
  { id: "balancer",   name: "Balancer",     cat: "dex",     glyph: "B", color: "#a78bfa", weight: 0.4 },
  // Lending
  { id: "aave",       name: "Aave V3",      cat: "lending", glyph: "Av", color: "#7c5cff", weight: 0.9 },
  { id: "morpho",     name: "Morpho",       cat: "lending", glyph: "M", color: "#52d8a3", weight: 0.5 },
  { id: "moonwell",   name: "Moonwell",     cat: "lending", glyph: "Mw", color: "#ffaf66", weight: 0.4 },
  { id: "compound",   name: "Compound",     cat: "lending", glyph: "Co", color: "#7be8c0", weight: 0.45 },
  // Bridges
  { id: "stargate",   name: "Stargate",     cat: "bridge",  glyph: "St", color: "#ffb86b", weight: 0.45 },
  { id: "across",     name: "Across",       cat: "bridge",  glyph: "Ac", color: "#ff8a6b", weight: 0.4 },
  { id: "cctp",       name: "CCTP",         cat: "bridge",  glyph: "Cc", color: "#6ec1ff", weight: 0.7 },
  // CEX
  { id: "coinbase",   name: "Coinbase",     cat: "cex",     glyph: "Cb", color: "#3b82f6", weight: 0.8 },
  { id: "binance",    name: "Binance",      cat: "cex",     glyph: "Bn", color: "#f0b90b", weight: 0.5 },
  // Mint/Treasury
  { id: "circle",     name: "Circle Mint",  cat: "mint",    glyph: "◎", color: "#2775ca", weight: 0.6 },
  // Generic users (smaller, weaker)
  { id: "user-1",     name: "0x4a…f29c",    cat: "wallet",  glyph: "•", color: "#9aa7be", weight: 0.25 },
  { id: "user-2",     name: "0xb1…02de",    cat: "wallet",  glyph: "•", color: "#9aa7be", weight: 0.25 },
  { id: "user-3",     name: "0x7c…aa11",    cat: "wallet",  glyph: "•", color: "#9aa7be", weight: 0.25 },
];

const PROTO_BY_ID = Object.fromEntries(PROTOCOLS.map(p => [p.id, p]));

const CAT_COLOR = {
  dex: "var(--accent)",
  lending: "var(--inflow)",
  bridge: "var(--outflow)",
  cex: "oklch(0.72 0.18 320)",
  mint: "var(--accent)",
  wallet: "var(--text-dim)",
};

// Edge connections (which protocols are likely to transfer between each other)
const EDGES = [
  ["uniswap", "aave"], ["uniswap", "aerodrome"], ["uniswap", "morpho"], ["uniswap", "coinbase"],
  ["uniswap", "user-1"], ["uniswap", "curve"], ["uniswap", "cctp"],
  ["aerodrome", "morpho"], ["aerodrome", "aave"], ["aerodrome", "user-2"], ["aerodrome", "moonwell"],
  ["aave", "morpho"], ["aave", "coinbase"], ["aave", "compound"],
  ["morpho", "user-3"], ["morpho", "moonwell"],
  ["curve", "balancer"], ["curve", "stargate"],
  ["stargate", "cctp"], ["stargate", "user-1"],
  ["across", "cctp"], ["across", "coinbase"],
  ["cctp", "circle"], ["circle", "coinbase"], ["coinbase", "binance"],
  ["binance", "user-2"], ["compound", "user-3"], ["moonwell", "user-1"],
  ["balancer", "aerodrome"], ["aerodrome", "across"],
];

// Sample transfer (weighted random)
function pickWeighted(items) {
  const total = items.reduce((s, x) => s + (x.weight || 1), 0);
  let r = Math.random() * total;
  for (const x of items) { r -= (x.weight || 1); if (r <= 0) return x; }
  return items[items.length - 1];
}

function randomAmount() {
  // log-normal-ish: lots of small txns, occasional whales
  const r = Math.random();
  if (r < 0.55) return 50 + Math.random() * 4500;            // small
  if (r < 0.85) return 5_000 + Math.random() * 90_000;       // medium
  if (r < 0.97) return 100_000 + Math.random() * 800_000;    // large
  return 1_000_000 + Math.random() * 9_000_000;              // whale
}

function randomTransfer() {
  const edge = EDGES[Math.floor(Math.random() * EDGES.length)];
  const fromFirst = Math.random() < 0.5;
  const from = PROTO_BY_ID[fromFirst ? edge[0] : edge[1]];
  const to   = PROTO_BY_ID[fromFirst ? edge[1] : edge[0]];
  const amount = randomAmount();
  const hash = "0x" + Math.random().toString(16).slice(2, 6) + "…" + Math.random().toString(16).slice(2, 6);
  return {
    id: Math.random().toString(36).slice(2, 10),
    ts: Date.now(),
    from, to, amount,
    hash,
    isLarge: amount >= 100_000,
    isWhale: amount >= 1_000_000,
  };
}

const ANOMALY_KINDS = [
  { tag: "whale", verb: "Whale transfer" },
  { tag: "spike", verb: "Inflow spike" },
  { tag: "drain", verb: "Outflow drain" },
  { tag: "spike", verb: "Volume spike" },
  { tag: "drain", verb: "Liquidity dip" },
];

function randomAnomaly() {
  const kind = ANOMALY_KINDS[Math.floor(Math.random() * ANOMALY_KINDS.length)];
  const target = pickWeighted(PROTOCOLS.filter(p => p.cat !== "wallet"));
  let body, amount = null;
  if (kind.tag === "whale") {
    amount = 1_000_000 + Math.random() * 9_500_000;
    const dest = pickWeighted(PROTOCOLS.filter(p => p.id !== target.id));
    body = <span><strong>{fmtUSDC(amount)} USDC</strong> moved from <strong>{target.name}</strong> → <strong>{dest.name}</strong></span>;
  } else if (kind.tag === "spike") {
    const pct = (15 + Math.random() * 180).toFixed(0);
    body = <span><strong>+{pct}%</strong> inflow on <strong>{target.name}</strong> vs 1h avg</span>;
  } else {
    const pct = (10 + Math.random() * 60).toFixed(0);
    body = <span><strong>−{pct}%</strong> TVL on <strong>{target.name}</strong> in last 30m</span>;
  }
  return {
    id: Math.random().toString(36).slice(2, 10),
    ts: Date.now(),
    tag: kind.tag,
    verb: kind.verb,
    body,
    target,
    amount,
  };
}

function fmtUSDC(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toFixed(0);
}
function fmtUSD(n) {
  return "$" + fmtUSDC(n);
}
function shortAddr(s) { return s; }

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 5) return "just now";
  if (s < 60) return s + "s ago";
  const m = Math.floor(s / 60);
  if (m < 60) return m + "m ago";
  const h = Math.floor(m / 60);
  return h + "h ago";
}

Object.assign(window, { PROTOCOLS, PROTO_BY_ID, EDGES, CAT_COLOR, randomTransfer, randomAnomaly, fmtUSDC, fmtUSD, timeAgo });
