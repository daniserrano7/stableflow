# Stableflow Design System — Usage

## Imports

```css
/* app/styles.css */
@import "./design-system/tokens.css";       /* tokens + Tailwind v4 @theme */
@import "./design-system/globals.css";      /* reset, base, scrollbars, motion utilities */
@import "./design-system/components.css";   /* recipe classes (.sf-panel, .sf-kpi, …) */
```

```html
<!-- root html element -->
<html lang="en" data-theme="dark" class="dark">…</html>
```

To switch themes:

```ts
import { setTheme } from "~/design-system/tokens";
setTheme("light"); // or "dark"
```

## Token system

### Semantic (shadcn-compatible)
Use these for anything that should automatically adapt across light/dark and across new sub-themes (e.g. a "neutral chain" theme later).

`background, foreground, card, popover, primary, secondary, muted, accent, destructive, border, input, ring`

```tsx
<div className="bg-card border border-border text-foreground rounded-lg">…</div>
<Button variant="default">Track address</Button>
```

### Stableflow surfaces
The 4-stop surface ramp (`surface-0` … `surface-3`) handles elevation. Use:

- `surface-0` = page background (= `background`)
- `surface-1` = card / panel base (= `card`)
- `surface-2` = inset (search field, segmented control track, table hover)
- `surface-3` = active / pressed state, popover background

### Flow semantics
The whole product is about money moving — these tokens are first-class:

- `inflow` (green) — money entering an entity, positive deltas, "live" dots
- `outflow` (amber) — money leaving, negative deltas
- `anomaly` / `whale` (red-pink) — flagged events, ≥ $1M transfers
- `neutral-flow` — undirected / unknown trend

### Protocol categories
Color-coded across tags, graph nodes, legends:

`cat-dex, cat-lending, cat-bridge, cat-cex, cat-mint, cat-wallet` (each with `-soft` variant for fills).

### Chains & assets
Forward-looking. Today only `chain-base` and `asset-usdc` are used, but the others are pre-defined so adding Ethereum/Arbitrum/etc. or USDT/DAI/etc. is a config change.

## Typography

| Token | Use |
|-------|-----|
| `font-sans` (Geist) | Default UI |
| `font-mono` (Geist Mono) | Data — addresses, amounts, hashes, eyebrows, table cells |
| `font-display` | Marketing / hero (currently = sans) |

Type scale runs `2xs (10px) → 4xl (48px)`. Dense by default — body is **13px**, not 16. Numbers should always carry `font-variant-numeric: tabular-nums` (apply `.tabular` or `font-mono`).

## Component primitives

| Component | Class recipe | Notes |
|-----------|--------------|-------|
| `<Button>` | — | shadcn-style cva variants: `default / secondary / ghost / outline / destructive / glow / link` × `sm / md / lg / icon` |
| `<Panel> / <PanelHead> / <PanelTitle> / <PanelActions>` | `.sf-panel` | The glassy card. Use `<PanelTitle live>` for the green pulse |
| `<Segmented>` | `.sf-seg` | Pill tab group used in panel heads |
| `<Chip>` | `.sf-chip` | Network / asset / status pills |
| `<Tag category>` | `.sf-tag` | Protocol category pill |
| `<KPI>` + `<Sparkline>` | `.sf-kpi` | Stat card with optional sparkline & delta |
| `<Entity>` | `.sf-entity` | Glyph + name (or short addr) |
| `<Amount>` | `.sf-amount` | Auto-colored by magnitude or trend |
| `<Rail> / <RailItem>` | `.sf-rail` | Left icon nav, Linear-style |
| `<FlowBar>` | `.sf-flowbar` | Horizontal magnitude bar with gradient fill |
| `<AnomalyItem>` | `.sf-anomaly-item` | Row in the anomaly feed |

Every recipe class also works without the React component (so you can use it in plain HTML, web components, SVG <foreignObject>, etc.).

## Motion

Custom keyframes live in `globals.css` and are exposed as utilities:

- `animate-pulse-soft` — for live dots
- `animate-slide-in` — for new anomaly rows
- `animate-row-in` — for newly-appended table rows
- `animate-shimmer` — for skeletons

Easings: `var(--ease-out-quart)` (default), `var(--ease-in-out-quart)`. Durations: `--duration-{instant|fast|base|slow|slower}`.

All motion is wrapped in a `prefers-reduced-motion` reset.

## Layout primitives

- `.bg-ambient` + `.bg-grid` — fixed full-bleed background layers, drop them once at the app root.
- `.glass` / `.glass-strong` — reusable blur surfaces.
- `--size-rail` (56px) — width of the left nav. `--size-topbar` (48px) for the top bar height.

## Do / Don't

✅ **Do** use semantic tokens (`bg-card`, `text-muted-foreground`) so theme switches work without rewriting components.

✅ **Do** route any new color through `tokens.css`. Adding a new chain? Add `--chain-foo` + `--color-chain-foo` and you instantly have `bg-chain-foo` etc.

✅ **Do** prefer the recipe classes for stable composite primitives. They are versionable in a single CSS file and survive React refactors.

❌ **Don't** hard-code hex/oklch values in components. If you need it twice, it belongs in `tokens.css`.

❌ **Don't** invent new amount colors — use `<Amount magnitude="…" trend="…">` which already maps to the right token.

❌ **Don't** mix `data-theme` with manual `dark:` overrides. Tokens already swap; only use `dark:` for truly mode-specific tweaks (rarely needed).

## Extending

### Adding a new chain
1. In `tokens.css` add `--chain-newchain: oklch(...)` in both `:root` and `[data-theme="light"]`.
2. Add `--color-chain-newchain: var(--chain-newchain)` inside `@theme inline`.
3. Add an entry to `CHAIN` in `tokens.ts`.

### Adding a new protocol category
Same as chains, but also add a `data-cat` selector in `components.css` under `.sf-tag` so the existing Tag component picks it up.

### Adding a new component primitive
1. Create `components/Foo.tsx` (forwarded ref, `cn()`-merged className).
2. If it needs a CSS recipe, add `.sf-foo` under `@layer components` in `components.css`.
3. Re-export from `components/index.ts`.
4. Document in this file's table.

## Compatibility with the prototype

The prototype (`index.html` at project root) ships its own inline `style.css` so it can run as a single static page. The mapping is 1:1:

| Prototype class | Design system equivalent |
|-----------------|--------------------------|
| `.panel`        | `.sf-panel` / `<Panel>` |
| `.kpi`          | `.sf-kpi` / `<KPI>` |
| `.seg`          | `.sf-seg` / `<Segmented>` |
| `.chip`         | `.sf-chip` / `<Chip>` |
| `.tag.*`        | `.sf-tag[data-cat=*]` / `<Tag>` |
| `.entity*`      | `.sf-entity*` / `<Entity>` |
| `.amount.*`     | `.sf-amount[data-magnitude=*]` / `<Amount>` |
| `.sidebar` + `.sb-item` | `.sf-rail` / `<Rail>` |
| `.mover-bar`    | `.sf-flowbar` / `<FlowBar>` |
| `.anomaly-item` | `.sf-anomaly-item` / `<AnomalyItem>` |
| `.bg-ambient` / `.bg-grid` | same |

CSS variables are identical so existing inline styles keep working as you migrate piece by piece.
