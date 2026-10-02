// table.jsx — Live transfers table + Anomaly feed + KPI strip

const { useEffect, useRef, useState } = React;

// ── KPI strip ────────────────────────────────────────

function Sparkline({ data, color = "var(--accent)", w = 84, h = 36 }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const step = w / (data.length - 1);
  const pts = data.map((v, i) => [i * step, h - ((v - min) / range) * h]);
  const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const dArea = d + ` L ${w} ${h} L 0 ${h} Z`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <defs>
        <linearGradient id="spark-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={dArea} fill="url(#spark-grad)" />
      <path d={d} stroke={color} strokeWidth="1.4" fill="none" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2" fill={color} />
    </svg>
  );
}

function useDriftingSeries(start, vol = 0.02, len = 24) {
  const [series, setSeries] = useState(() => {
    const arr = [start];
    for (let i = 1; i < len; i++) {
      arr.push(arr[i - 1] * (1 + (Math.random() - 0.5) * vol));
    }
    return arr;
  });
  useEffect(() => {
    const t = setInterval(() => {
      setSeries(prev => {
        const next = prev[prev.length - 1] * (1 + (Math.random() - 0.48) * vol);
        return [...prev.slice(1), next];
      });
    }, 2500);
    return () => clearInterval(t);
  }, [vol]);
  return series;
}

function KPIStrip() {
  const volSeries = useDriftingSeries(4.82, 0.04);
  const txnSeries = useDriftingSeries(82400, 0.03);
  const addrSeries = useDriftingSeries(11.2, 0.02);
  const netSeries = useDriftingSeries(38, 0.08);

  const fmt = (n, d = 2) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

  return (
    <div className="kpis">
      <div className="kpi">
        <div className="kpi-label">24h USDC Volume <span style={{color: "var(--text-dim)"}}>· Base</span></div>
        <div className="kpi-value">${fmt(volSeries[volSeries.length - 1], 2)}<span className="unit">B</span></div>
        <div className="kpi-delta up">▲ +4.8% vs 24h</div>
        <div className="kpi-spark"><Sparkline data={volSeries} color="var(--accent)" /></div>
      </div>
      <div className="kpi">
        <div className="kpi-label">Transfers · 1h</div>
        <div className="kpi-value">{Math.round(txnSeries[txnSeries.length - 1]).toLocaleString("en-US")}</div>
        <div className="kpi-delta up">▲ +2.1% vs 1h</div>
        <div className="kpi-spark"><Sparkline data={txnSeries} color="var(--inflow)" /></div>
      </div>
      <div className="kpi">
        <div className="kpi-label">Active Addresses · 24h</div>
        <div className="kpi-value">{fmt(addrSeries[addrSeries.length - 1], 1)}<span className="unit">K</span></div>
        <div className="kpi-delta down">▼ −0.6% vs 24h</div>
        <div className="kpi-spark"><Sparkline data={addrSeries} color="var(--outflow)" /></div>
      </div>
      <div className="kpi">
        <div className="kpi-label">Net Flow → Base · 24h</div>
        <div className="kpi-value">+${fmt(netSeries[netSeries.length - 1], 1)}<span className="unit">M</span></div>
        <div className="kpi-delta up">▲ net inflow</div>
        <div className="kpi-spark"><Sparkline data={netSeries} color="var(--accent)" /></div>
      </div>
    </div>
  );
}

// ── Anomaly feed ─────────────────────────────────────

function AnomalyFeed() {
  const [items, setItems] = useState(() => {
    const arr = [];
    for (let i = 0; i < 5; i++) {
      const a = randomAnomaly();
      a.ts = Date.now() - (i + 1) * (30_000 + Math.random() * 90_000);
      arr.push(a);
    }
    return arr;
  });
  const [, force] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setItems(prev => [randomAnomaly(), ...prev].slice(0, 14));
    }, 5500);
    const tick = setInterval(() => force(x => x + 1), 5000);
    return () => { clearInterval(t); clearInterval(tick); };
  }, []);

  return (
    <div className="panel" style={{ display: "flex", flexDirection: "column" }}>
      <div className="panel-head">
        <div className="panel-title">
          <span className="live-dot"></span>Anomalies & Whale Alerts
        </div>
        <div className="seg">
          <button className="active">All</button>
          <button>Whales</button>
          <button>Spikes</button>
        </div>
      </div>
      <div className="anomaly-list">
        {items.map(it => (
          <div key={it.id} className="anomaly-item">
            <div className="anomaly-head">
              <span className={"anomaly-tag " + it.tag}>{it.verb}</span>
              <span className="anomaly-time">{timeAgo(it.ts)}</span>
            </div>
            <div className="anomaly-body">{it.body}</div>
            <div className="anomaly-meta">
              <span>{it.target.cat}</span>
              <span>·</span>
              <span>Base · USDC</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Live transfers table ─────────────────────────────

function EntityCell({ entity }) {
  return (
    <span className="entity">
      <span className="entity-glyph" style={{ background: entity.color }}>{entity.glyph}</span>
      <span className={entity.cat === "wallet" ? "entity-addr" : "entity-name"}>{entity.name}</span>
    </span>
  );
}

function DirectionArrow() {
  return (
    <span className="direction-arrow">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M2 7 H 11 M 8 4 L 11 7 L 8 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function TagPill({ cat }) {
  const label = { dex: "DEX", lending: "Lending", bridge: "Bridge", cex: "CEX", mint: "Mint", wallet: "Wallet" }[cat] || cat;
  return <span className={"tag " + cat}>{label}</span>;
}

function TransfersTable({ transfers }) {
  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-title">
          <span className="live-dot"></span>Live Transfers
        </div>
        <div className="seg">
          <button className="active">All</button>
          <button>≥ $10K</button>
          <button>Whales</button>
        </div>
      </div>
      <div className="table-wrap">
        <table className="transfers">
          <thead>
            <tr>
              <th style={{width: "32%"}}>From</th>
              <th style={{width: 32}}></th>
              <th style={{width: "32%"}}>To</th>
              <th style={{width: "20%", textAlign: "right"}}>Amount</th>
              <th style={{width: "16%", textAlign: "right"}}>Protocol</th>
            </tr>
          </thead>
          <tbody>
            {transfers.slice(0, 14).map((t, i) => (
              <tr key={t.id} className={i === 0 ? "fresh" : ""}>
                <td><EntityCell entity={t.from} /></td>
                <td><DirectionArrow /></td>
                <td><EntityCell entity={t.to} /></td>
                <td style={{textAlign: "right"}}>
                  <span className={"amount " + (t.isWhale ? "whale" : t.isLarge ? "large" : "")}>
                    {fmtUSDC(t.amount)}<span className="usd"> USDC</span>
                  </span>
                </td>
                <td style={{textAlign: "right"}}>
                  <TagPill cat={t.to.cat !== "wallet" ? t.to.cat : t.from.cat} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

Object.assign(window, { KPIStrip, AnomalyFeed, TransfersTable, TopMovers });

// ── Top Movers panel ────────────────────────────────

function useDriftingMovers() {
  const protocols = PROTOCOLS.filter(p => p.cat !== "wallet");
  const [data, setData] = useState(() => {
    return protocols.map(p => ({
      proto: p,
      inflow:  (50_000 + Math.random() * 4_000_000) * (p.weight || 0.4),
      outflow: (50_000 + Math.random() * 4_000_000) * (p.weight || 0.4),
      prev: 0,
    }));
  });
  useEffect(() => {
    const t = setInterval(() => {
      setData(prev => prev.map(d => {
        const drift = 0.85 + Math.random() * 0.3;
        return {
          ...d,
          prev: d.inflow - d.outflow,
          inflow: Math.max(20_000, d.inflow * drift + (Math.random() - 0.5) * 200_000),
          outflow: Math.max(20_000, d.outflow * (0.9 + Math.random() * 0.25) + (Math.random() - 0.5) * 200_000),
        };
      }));
    }, 2200);
    return () => clearInterval(t);
  }, []);
  return data;
}

function TopMovers() {
  const data = useDriftingMovers();
  const [tab, setTab] = useState("net");

  let sorted, maxV;
  if (tab === "inflow") {
    sorted = [...data].sort((a, b) => b.inflow - a.inflow).slice(0, 8);
    maxV = sorted[0]?.inflow || 1;
  } else if (tab === "outflow") {
    sorted = [...data].sort((a, b) => b.outflow - a.outflow).slice(0, 8);
    maxV = sorted[0]?.outflow || 1;
  } else {
    sorted = [...data].map(d => ({ ...d, net: d.inflow - d.outflow }))
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net)).slice(0, 8);
    maxV = Math.max(...sorted.map(s => Math.abs(s.net)), 1);
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-title">
          <span className="live-dot"></span>Top Movers · 1h
        </div>
        <div className="seg">
          <button className={tab === "net" ? "active" : ""} onClick={() => setTab("net")}>Net</button>
          <button className={tab === "inflow" ? "active" : ""} onClick={() => setTab("inflow")}>Inflow</button>
          <button className={tab === "outflow" ? "active" : ""} onClick={() => setTab("outflow")}>Outflow</button>
        </div>
      </div>
      <div className="movers-list">
        {sorted.map((d, i) => {
          const v = tab === "inflow" ? d.inflow : tab === "outflow" ? d.outflow : d.net;
          const pct = Math.min(100, (Math.abs(v) / maxV) * 100);
          const cls = tab === "inflow" ? "inflow"
                    : tab === "outflow" ? "outflow"
                    : (v >= 0 ? "net-pos" : "net-neg");
          const sign = tab === "net" ? (v >= 0 ? "+" : "−") : "";
          const valCls = tab === "inflow" ? "inflow"
                       : tab === "outflow" ? "outflow"
                       : (v >= 0 ? "inflow" : "outflow");
          const deltaPct = d.prev ? ((v - d.prev) / Math.abs(d.prev) * 100) : 0;
          return (
            <div className="mover-row" key={d.proto.id}>
              <span className="mover-rank">{String(i + 1).padStart(2, "0")}</span>
              <EntityCell entity={d.proto} />
              <div className="mover-bar-wrap">
                <div className={"mover-bar " + cls} style={{ width: pct + "%" }}></div>
              </div>
              <div className={"mover-value " + valCls}>
                {sign}${fmtUSDC(Math.abs(v))}
                {tab === "net" && d.prev !== 0 && (
                  <span className="delta">{deltaPct >= 0 ? "▲" : "▼"} {Math.abs(deltaPct).toFixed(1)}%</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
