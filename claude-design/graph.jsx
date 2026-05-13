// graph.jsx — Live flow graph: force-directed, with animated transfer particles
// Exposes: FlowGraph

const { useEffect, useRef, useState, useMemo, useCallback } = React;

// ── Layout helpers ────────────────────────────────────

function layoutForce(nodes, edges, w, h, iterations = 240) {
  // Simple force-directed layout (Fruchterman–Reingold-ish)
  const k = Math.sqrt((w * h) / nodes.length) * 0.85;
  const t0 = w / 8;
  const positions = {};
  nodes.forEach((n, i) => {
    const a = (i / nodes.length) * Math.PI * 2;
    positions[n.id] = {
      x: w / 2 + Math.cos(a) * (w / 4) + (Math.random() - 0.5) * 30,
      y: h / 2 + Math.sin(a) * (h / 4) + (Math.random() - 0.5) * 30,
      vx: 0, vy: 0,
    };
  });
  const adj = new Set(edges.map(e => e[0] + "|" + e[1]).concat(edges.map(e => e[1] + "|" + e[0])));

  for (let it = 0; it < iterations; it++) {
    const t = t0 * (1 - it / iterations);
    // repulsion
    for (let i = 0; i < nodes.length; i++) {
      const a = positions[nodes[i].id];
      a.vx = 0; a.vy = 0;
      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;
        const b = positions[nodes[j].id];
        const dx = a.x - b.x, dy = a.y - b.y;
        let d = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const f = (k * k) / d;
        a.vx += (dx / d) * f;
        a.vy += (dy / d) * f;
      }
    }
    // attraction along edges
    for (const [u, v] of edges) {
      const a = positions[u], b = positions[v];
      if (!a || !b) continue;
      const dx = a.x - b.x, dy = a.y - b.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const f = (d * d) / k;
      a.vx -= (dx / d) * f;
      a.vy -= (dy / d) * f;
      b.vx += (dx / d) * f;
      b.vy += (dy / d) * f;
    }
    // centering pull
    for (const n of nodes) {
      const p = positions[n.id];
      p.vx -= (p.x - w / 2) * 0.012;
      p.vy -= (p.y - h / 2) * 0.012;
    }
    // apply with cooling
    for (const n of nodes) {
      const p = positions[n.id];
      const disp = Math.sqrt(p.vx * p.vx + p.vy * p.vy) || 0.01;
      p.x += (p.vx / disp) * Math.min(disp, t);
      p.y += (p.vy / disp) * Math.min(disp, t);
      p.x = Math.max(36, Math.min(w - 36, p.x));
      p.y = Math.max(36, Math.min(h - 36, p.y));
    }
  }
  return positions;
}

function layoutRadial(nodes, w, h) {
  const positions = {};
  // group by category, place each category at its angle
  const cats = ["dex", "lending", "bridge", "cex", "mint", "wallet"];
  const byCat = {};
  nodes.forEach(n => { (byCat[n.cat] = byCat[n.cat] || []).push(n); });
  const cx = w / 2, cy = h / 2;
  const rOuter = Math.min(w, h) / 2 - 60;

  cats.forEach((cat, ci) => {
    const list = byCat[cat] || [];
    list.forEach((n, i) => {
      // wallets in center
      if (cat === "wallet") {
        const a = (i / list.length) * Math.PI * 2;
        positions[n.id] = { x: cx + Math.cos(a) * 60, y: cy + Math.sin(a) * 60 };
        return;
      }
      const baseA = (ci / (cats.length - 1)) * Math.PI * 2;
      const spread = 0.35;
      const a = baseA + (i - (list.length - 1) / 2) * spread / Math.max(list.length, 1);
      const r = rOuter * (0.65 + 0.25 * Math.random() * 0 + (i % 2 ? 0.18 : 0));
      positions[n.id] = { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
    });
  });
  return positions;
}

function layoutSankey(nodes, w, h) {
  // Three columns: source (cex/mint) → middle (dex/lending) → sinks (bridge/wallet)
  const cols = [
    { ids: nodes.filter(n => n.cat === "cex" || n.cat === "mint").map(n => n.id), x: w * 0.12 },
    { ids: nodes.filter(n => n.cat === "dex" || n.cat === "lending").map(n => n.id), x: w * 0.50 },
    { ids: nodes.filter(n => n.cat === "bridge" || n.cat === "wallet").map(n => n.id), x: w * 0.88 },
  ];
  const positions = {};
  cols.forEach(col => {
    const pad = 50;
    const usable = h - pad * 2;
    col.ids.forEach((id, i) => {
      const y = pad + (usable * (i + 0.5)) / col.ids.length;
      positions[id] = { x: col.x, y };
    });
  });
  return positions;
}

// node radius from weight
function nodeRadius(n) {
  return 8 + (n.weight || 0.4) * 14;
}

// path between two points (curved)
function edgePath(a, b, curvature = 0.18) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  // perpendicular offset
  const nx = -dy, ny = dx;
  const len = Math.sqrt(nx * nx + ny * ny) || 1;
  const cx = mx + (nx / len) * Math.sqrt(dx*dx+dy*dy) * curvature;
  const cy = my + (ny / len) * Math.sqrt(dx*dx+dy*dy) * curvature;
  return { d: `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`, cx, cy };
}

function pointOnPath(a, c, b, t) {
  // Quadratic Bezier point
  const x = (1 - t) ** 2 * a.x + 2 * (1 - t) * t * c.x + t * t * b.x;
  const y = (1 - t) ** 2 * a.y + 2 * (1 - t) * t * c.y + t * t * b.y;
  return { x, y };
}

// ── FlowGraph component ──────────────────────────────

function FlowGraph({ layout = "force", density = 1, onTransfer, theme }) {
  const wrapRef = useRef(null);
  const [size, setSize] = useState({ w: 900, h: 540 });

  // resize observer
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        const { width, height } = e.contentRect;
        setSize({ w: Math.max(600, width), h: Math.max(400, height) });
      }
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  // compute positions
  const positions = useMemo(() => {
    if (layout === "radial") return layoutRadial(PROTOCOLS, size.w, size.h);
    if (layout === "sankey") return layoutSankey(PROTOCOLS, size.w, size.h);
    return layoutForce(PROTOCOLS, EDGES, size.w, size.h);
  }, [layout, size.w, size.h]);

  // build edge paths
  const edgeData = useMemo(() => {
    return EDGES.map(([u, v]) => {
      const a = positions[u], b = positions[v];
      if (!a || !b) return null;
      const p = edgePath(a, b, layout === "sankey" ? 0 : 0.18);
      return { u, v, a, b, c: { x: p.cx, y: p.cy }, d: p.d };
    }).filter(Boolean);
  }, [positions, layout]);

  const edgeByKey = useMemo(() => {
    const m = {};
    edgeData.forEach(e => { m[e.u + "|" + e.v] = e; m[e.v + "|" + e.u] = { ...e, a: e.b, b: e.a }; });
    return m;
  }, [edgeData]);

  // Particles
  const [particles, setParticles] = useState([]);
  const particlesRef = useRef([]);
  particlesRef.current = particles;

  // Node activity scores (decay)
  const [activity, setActivity] = useState({});
  const activityRef = useRef({});
  activityRef.current = activity;

  // Spawn loop
  useEffect(() => {
    let raf;
    let lastSpawn = 0;
    const baseInterval = 380; // ms
    const tick = (now) => {
      const interval = baseInterval / Math.max(0.25, density);
      if (now - lastSpawn > interval) {
        lastSpawn = now;
        const tx = randomTransfer();
        // ensure we have an edge between these
        const k = tx.from.id + "|" + tx.to.id;
        if (edgeByKey[k]) {
          const id = Math.random().toString(36).slice(2, 10);
          const size = tx.isWhale ? 5.5 : tx.isLarge ? 4 : 2.4 + Math.random() * 1.4;
          const duration = 1100 + Math.random() * 700;
          const color = tx.isWhale ? "var(--anomaly)" : tx.isLarge ? "var(--accent)" : "var(--inflow)";
          particlesRef.current = [...particlesRef.current, {
            id, edgeKey: k, start: now, duration, size, color, tx
          }];
          setParticles(particlesRef.current);
          // bump activity on both nodes
          const act = { ...activityRef.current };
          act[tx.from.id] = Math.min(1, (act[tx.from.id] || 0) + 0.25);
          act[tx.to.id] = Math.min(1, (act[tx.to.id] || 0) + 0.25);
          activityRef.current = act;
          setActivity(act);
          if (onTransfer) onTransfer(tx);
        }
      }
      // decay activity
      const decayed = {};
      let changed = false;
      for (const [k, v] of Object.entries(activityRef.current)) {
        const nv = Math.max(0, v - 0.012);
        if (nv > 0) decayed[k] = nv;
        if (nv !== v) changed = true;
      }
      if (changed) { activityRef.current = decayed; setActivity(decayed); }

      // cull old particles
      const live = particlesRef.current.filter(p => now - p.start < p.duration);
      if (live.length !== particlesRef.current.length) {
        particlesRef.current = live;
        setParticles(live);
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [edgeByKey, density, onTransfer]);

  // Particle render: compute position via path point
  const now = useAnimationFrame();
  const renderedParticles = particles.map(p => {
    const edge = edgeByKey[p.edgeKey];
    if (!edge) return null;
    const t = Math.min(1, (now - p.start) / p.duration);
    const pos = pointOnPath(edge.a, edge.c, edge.b, t);
    const opacity = t < 0.1 ? t / 0.1 : t > 0.9 ? (1 - t) / 0.1 : 1;
    return (
      <g key={p.id} style={{ pointerEvents: "none" }}>
        <circle cx={pos.x} cy={pos.y} r={p.size * 2.6} fill={p.color} opacity={opacity * 0.18} />
        <circle cx={pos.x} cy={pos.y} r={p.size} fill={p.color} opacity={opacity} />
        <circle cx={pos.x} cy={pos.y} r={p.size * 0.45} fill="white" opacity={opacity * 0.9} />
      </g>
    );
  });

  // count "active flows"
  const flowCount = particles.length;

  return (
    <div className="graph-wrap" ref={wrapRef}>
      <svg className="graph-svg" width={size.w} height={size.h} viewBox={`0 0 ${size.w} ${size.h}`}>
        <defs>
          <radialGradient id="node-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="white" stopOpacity="0.5" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <filter id="particle-blur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="0.6" />
          </filter>
        </defs>

        {/* edges */}
        <g>
          {edgeData.map(e => (
            <path
              key={e.u + "-" + e.v}
              d={e.d}
              stroke="var(--border-strong)"
              strokeOpacity={0.35}
              strokeWidth={1}
              fill="none"
            />
          ))}
        </g>

        {/* particles */}
        <g>{renderedParticles}</g>

        {/* nodes */}
        <g>
          {PROTOCOLS.map(n => {
            const p = positions[n.id];
            if (!p) return null;
            const r = nodeRadius(n);
            const act = activity[n.id] || 0;
            const isWallet = n.cat === "wallet";
            return (
              <g key={n.id} transform={`translate(${p.x}, ${p.y})`}>
                {/* glow */}
                <circle r={r + 16 + act * 22} fill={n.color} opacity={0.06 + act * 0.18} />
                <circle r={r + 6 + act * 8} fill={n.color} opacity={0.10 + act * 0.20} />
                {/* ring */}
                <circle r={r} fill={isWallet ? "var(--bg-2)" : n.color} fillOpacity={isWallet ? 1 : 0.95}
                        stroke="oklch(1 0 0 / 0.18)" strokeWidth={1} />
                {/* inner highlight */}
                <circle r={r * 0.55} cx={-r * 0.18} cy={-r * 0.18} fill="url(#node-glow)" opacity={isWallet ? 0.2 : 0.9} />
                {/* center glyph */}
                <text textAnchor="middle" dy="3.5"
                      fontFamily="Geist Mono, monospace" fontSize={Math.max(9, r * 0.55)}
                      fontWeight={600}
                      fill={isWallet ? "var(--text-dim)" : "oklch(0.13 0.012 254)"}>
                  {n.glyph}
                </text>
                {/* label */}
                {!isWallet && (
                  <g transform={`translate(0, ${r + 14})`}>
                    <text className="node-label" textAnchor="middle">{n.name}</text>
                    <text className="node-cat" textAnchor="middle" dy="11">{n.cat}</text>
                  </g>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      <div className="graph-stats">
        <div><span className="v">{flowCount}</span> active flows</div>
        <div><span className="v">{PROTOCOLS.filter(p => p.cat !== "wallet").length}</span> protocols tracked</div>
      </div>

      <div className="graph-legend">
        <div><span className="swatch" style={{background: "var(--inflow)"}}></span>transfer &lt; $100K</div>
        <div><span className="swatch" style={{background: "var(--accent)"}}></span>$100K – $1M</div>
        <div><span className="swatch" style={{background: "var(--anomaly)"}}></span>whale ≥ $1M</div>
      </div>
    </div>
  );
}

// requestAnimationFrame hook returning current high-res time
function useAnimationFrame() {
  const [t, setT] = useState(performance.now());
  useEffect(() => {
    let raf;
    const tick = () => { setT(performance.now()); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return t;
}

Object.assign(window, { FlowGraph });
