# Stableflow Design System

A Tailwind v4 + shadcn/ui compatible design system extracted from the Stableflow
flow explorer prototype. Built to scale from the current Base/USDC scope to
multi-chain, multi-asset analytics surfaces (entities, stats, assets, chains…).

## Files

| File | Purpose |
|------|---------|
| `tokens.css`         | Tailwind v4 `@theme` + light/dark CSS variables (the heart of the system) |
| `globals.css`        | App reset, ambient backdrop, base typography, scrollbar styling |
| `tailwind.config.ts` | Optional v4 config for content paths & plugins (Tailwind v4 is mostly CSS-first) |
| `components.css`     | Recipe-style classes for primitives that don't ship in shadcn (panel, kpi, chip, segmented control, etc.) |
| `components/`        | TSX components wired in shadcn style (cva variants, `cn()` helper) |
| `lib/utils.ts`       | The standard shadcn `cn()` helper |
| `tokens.ts`          | Typed JS export of the same tokens for charts / d3 / SVG code |
| `usage.md`           | Quickstart, migration notes, naming conventions, do/don't |

## Quickstart

```bash
# Tailwind v4 (no PostCSS config needed)
npm install tailwindcss@^4 @tailwindcss/vite
npm install class-variance-authority clsx tailwind-merge lucide-react
npm install @radix-ui/react-slot @radix-ui/react-tabs @radix-ui/react-tooltip @radix-ui/react-dialog
```

In the web app stylesheet:

```css
@import "./design-system/tokens.css";
@import "./design-system/globals.css";
@import "./design-system/components.css";
```

In your top-level HTML element:

```html
<html data-theme="dark" class="dark">…</html>
```

## Naming conventions

This system follows shadcn semantic naming so any shadcn component drops in:
`background / foreground / card / popover / primary / secondary / muted /
accent / destructive / border / input / ring`.

We add Stableflow-specific semantic tokens on top:
`surface-{0..3}`, `inflow`, `outflow`, `anomaly`, `whale`, `glass`,
`grid-line`, plus per-category protocol tokens (`dex / lending / bridge /
cex / mint / wallet`).

Read `usage.md` for full details.
