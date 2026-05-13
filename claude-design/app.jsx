// app.jsx — main composition

const { useEffect, useState, useRef } = React;

function Sidebar() {
  const [active, setActive] = useState("flow");
  const items = [
    { id: "flow", label: "Flow", icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="3.5" cy="3.5" r="1.6" stroke="currentColor" strokeWidth="1.3" />
        <circle cx="12.5" cy="3.5" r="1.6" stroke="currentColor" strokeWidth="1.3" />
        <circle cx="8" cy="12" r="1.6" stroke="currentColor" strokeWidth="1.3" />
        <path d="M5 4 H 11 M 4.2 5 L 7.3 11 M 11.8 5 L 8.7 11" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      </svg>) },
    { id: "entities", label: "Entities", icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
        <rect x="9" y="2.5" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
        <rect x="2.5" y="9" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
        <rect x="9" y="9" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
      </svg>) },
    { id: "assets", label: "Assets", icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.2" />
        <path d="M8 4.5 V 11.5 M 5.5 6.5 H 9.5 A 1.5 1.5 0 1 1 9.5 9.5 H 5.5 H 10 A 1.5 1.5 0 1 1 10 12.5 H 6" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      </svg>) },
    { id: "chains", label: "Chains", icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="6" width="5.5" height="4" rx="1.2" stroke="currentColor" strokeWidth="1.2" transform="rotate(-20 4.75 8)" />
        <rect x="8.5" y="6" width="5.5" height="4" rx="1.2" stroke="currentColor" strokeWidth="1.2" transform="rotate(-20 11.25 8)" />
      </svg>) },
    { id: "stats", label: "Stats", icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2.5 13 V 7 M 6.5 13 V 4 M 10.5 13 V 9 M 14 13 V 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>) },
  ];
  return (
    <aside className="sidebar">
      <div className="sb-brand">
        <svg viewBox="0 0 32 32">
          <path d="M6 21 C 12 21, 12 11, 19 11 S 27 17, 27 17" stroke="white" strokeOpacity="0.75" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          <path d="M5 26 C 11 26, 14 16, 20 16 S 27 22, 27 22" stroke="white" strokeOpacity="0.4" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </svg>
      </div>
      <nav className="sb-nav">
        {items.map(it => (
          <button key={it.id} className={"sb-item " + (active === it.id ? "active" : "")}
                  onClick={() => setActive(it.id)} aria-label={it.label}>
            {it.icon}
            {it.id === "stats" && <span className="sb-badge" />}
            <span className="sb-tooltip">{it.label}</span>
          </button>
        ))}
      </nav>
      <div className="sb-spacer" />
      <div className="sb-divider" />
      <button className="sb-item" aria-label="Settings">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.2" />
          <path d="M8 1.5 V 3 M 8 13 V 14.5 M 1.5 8 H 3 M 13 8 H 14.5 M 3.3 3.3 L 4.4 4.4 M 11.6 11.6 L 12.7 12.7 M 3.3 12.7 L 4.4 11.6 M 11.6 4.4 L 12.7 3.3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
        </svg>
        <span className="sb-tooltip">Settings</span>
      </button>
    </aside>
  );
}

function TopBar({ theme, setTheme }) {
  return (
    <header className="topbar">
      <div className="topbar-title">
        <span>Flow</span>
        <span className="sep">/</span>
        <span className="crumb">Base · USDC · Live</span>
      </div>

      <div className="search">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="6" cy="6" r="4.2" stroke="currentColor" strokeWidth="1.2" />
          <path d="M9.4 9.4 L 12 12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        <input placeholder="Search protocol, address, tx hash…" />
        <span className="kbd">⌘K</span>
      </div>

      <div className="spacer"></div>

      <div className="chip-row">
        <span className="chip"><span className="dot"></span>BASE · MAINNET</span>
        <span className="chip chip-asset"><span className="dot"></span>USDC</span>
      </div>

      <button className="icon-btn" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title="Toggle theme">
        {theme === "dark" ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M12 9 A 5 5 0 1 1 5 2 A 4 4 0 0 0 12 9 Z" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.2" />
            <g stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
              <path d="M7 1.2 V 2.8" /><path d="M7 11.2 V 12.8" />
              <path d="M1.2 7 H 2.8" /><path d="M11.2 7 H 12.8" />
              <path d="M2.8 2.8 L 3.9 3.9" /><path d="M10.1 10.1 L 11.2 11.2" />
              <path d="M2.8 11.2 L 3.9 10.1" /><path d="M10.1 3.9 L 11.2 2.8" />
            </g>
          </svg>
        )}
      </button>
    </header>
  );
}

function FooterMeta() {
  const [t, setT] = useState(new Date());
  useEffect(() => { const i = setInterval(() => setT(new Date()), 1000); return () => clearInterval(i); }, []);
  return (
    <div className="footer-meta">
      <div>
        <span>Stableflow · v0.1.0</span>
        <span className="dot-sep">·</span>
        <span>Scope: Base + USDC</span>
        <span className="dot-sep">·</span>
        <span>Indexed up to block 24,891,402</span>
      </div>
      <div>
        <span>Synced</span>
        <span className="dot-sep">·</span>
        <span>{t.toUTCString().slice(17, 25)} UTC</span>
      </div>
    </div>
  );
}

function App() {
  // Tweaks
  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "theme": "dark",
    "layout": "force",
    "density": 1.0
  }/*EDITMODE-END*/;

  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // Apply theme to <html data-theme>
  useEffect(() => {
    document.documentElement.dataset.theme = t.theme;
  }, [t.theme]);

  // Live transfers state — kept in App so graph particles can feed table
  const [transfers, setTransfers] = useState(() => {
    const arr = [];
    let now = Date.now();
    for (let i = 0; i < 20; i++) {
      const tx = randomTransfer();
      tx.ts = now - i * (2000 + Math.random() * 4000);
      arr.push(tx);
    }
    return arr;
  });
  const transfersRef = useRef(transfers);
  transfersRef.current = transfers;

  const handleTransfer = React.useCallback((tx) => {
    transfersRef.current = [tx, ...transfersRef.current].slice(0, 30);
    setTransfers(transfersRef.current);
  }, []);

  // Periodic re-render so timeAgo refreshes
  const [, force] = useState(0);
  useEffect(() => {
    const i = setInterval(() => force(x => x + 1), 4000);
    return () => clearInterval(i);
  }, []);

  return (
    <div className="app">
      <div className="bg-ambient"></div>
      <div className="bg-grid"></div>

      <Sidebar />

      <div className="app-main">
        <TopBar theme={t.theme} setTheme={(v) => setTweak("theme", v)} />

        <KPIStrip />

        <div className="main-grid">
          <div className="panel">
            <div className="panel-head">
              <div className="panel-title">
                <span className="live-dot"></span>Live Flow Graph · Base · USDC
              </div>
              <div className="panel-actions">
                <div className="seg">
                  <button className={t.layout === "force" ? "active" : ""} onClick={() => setTweak("layout", "force")}>Force</button>
                  <button className={t.layout === "radial" ? "active" : ""} onClick={() => setTweak("layout", "radial")}>Radial</button>
                  <button className={t.layout === "sankey" ? "active" : ""} onClick={() => setTweak("layout", "sankey")}>Sankey</button>
                </div>
              </div>
            </div>
            <FlowGraph
              layout={t.layout}
              density={t.density}
              onTransfer={handleTransfer}
              theme={t.theme}
            />
          </div>

          <AnomalyFeed />
        </div>

        <div className="bottom-grid">
          <TransfersTable transfers={transfers} />
          <TopMovers />
        </div>

        <FooterMeta />
      </div>

      {/* Tweaks panel */}
      <TweaksPanel title="Stableflow Tweaks">
        <TweakSection label="Appearance" />
        <TweakRadio
          label="Theme"
          value={t.theme}
          onChange={(v) => setTweak("theme", v)}
          options={[
            { value: "dark", label: "Dark" },
            { value: "light", label: "Light" },
          ]}
        />
        <TweakSection label="Flow Graph" />
        <TweakSelect
          label="Layout"
          value={t.layout}
          onChange={(v) => setTweak("layout", v)}
          options={[
            { value: "force", label: "Force-directed" },
            { value: "radial", label: "Radial (by category)" },
            { value: "sankey", label: "Sankey (3-column flow)" },
          ]}
        />
        <TweakSlider
          label="Flow density"
          value={t.density}
          onChange={(v) => setTweak("density", v)}
          min={0.25} max={3.5} step={0.05}
          unit="×"
        />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
