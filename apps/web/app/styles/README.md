# Stableflow Styles

Tailwind v4 tokens, CSS recipes, and docs for the Stableflow web app. React
components live in `app/components`, with ShadCN/Radix primitives in
`app/components/ui`.

## Files

| File | Purpose |
|------|---------|
| `tokens.css`         | Tailwind v4 `@theme` + light/dark CSS variables (the heart of the system) |
| `globals.css`        | App reset, ambient backdrop, base typography, scrollbar styling |
| `tailwind.config.ts` | Optional v4 config for content paths & plugins (Tailwind v4 is mostly CSS-first) |
| `components.css`     | Recipe-style classes for Stableflow composites (panel, kpi, chip, tag, etc.) |
| `tokens.ts`          | Typed JS export of the same tokens for charts / d3 / SVG code |
| `usage.md`           | Quickstart, migration notes, naming conventions, do/don't |

## Quickstart

```bash
# Tailwind v4 (no PostCSS config needed)
npm install tailwindcss@^4 @tailwindcss/vite
npm install class-variance-authority clsx tailwind-merge lucide-react
npm install radix-ui
```

In the web app stylesheet:

```css
@import "./styles/tokens.css";
@import "./styles/globals.css";
@import "./styles/components.css";
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
