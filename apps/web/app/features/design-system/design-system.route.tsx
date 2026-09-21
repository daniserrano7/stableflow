import { Activity, ArrowLeft, BarChart3, Network, Radio, Search } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import {
  Amount,
  AnomalyItem,
  Chip,
  Entity,
  FlowBar,
  KPI,
  Panel,
  PanelActions,
  PanelBody,
  PanelHead,
  PanelTitle,
  Rail,
  RailItem,
  Sparkline,
  Tag,
} from "~/components";
import { Button } from "~/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { ASSET, CATEGORY, type Category, CHAIN } from "~/styles/tokens";

const semanticTokens = [
  "background",
  "foreground",
  "card",
  "primary",
  "secondary",
  "muted",
  "accent",
  "destructive",
  "border",
  "input",
  "ring",
] as const;

const flowTokens = ["inflow", "outflow", "anomaly", "whale", "neutral-flow"] as const;
const typeScale = [
  { className: "text-2xs", name: "2xs" },
  { className: "text-xs", name: "xs" },
  { className: "text-sm", name: "sm" },
  { className: "text-base", name: "base" },
  { className: "text-md", name: "md" },
  { className: "text-lg", name: "lg" },
  { className: "text-xl", name: "xl" },
  { className: "text-2xl", name: "2xl" },
  { className: "text-3xl", name: "3xl" },
  { className: "text-4xl", name: "4xl" },
] as const;
const categories = Object.keys(CATEGORY) as Category[];

export function meta() {
  return [
    { title: "Stableflow Design System" },
    {
      content: "Stableflow design tokens, component primitives, and usage guidelines.",
      name: "description",
    },
  ];
}

export default function DesignSystemRoute() {
  const [activeRange, setActiveRange] = useState("live");

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="bg-ambient" />
      <div className="bg-grid" />

      <div className="mx-auto grid w-full max-w-[1180px] gap-8 px-4 py-10">
        <header className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button asChild size="sm" variant="ghost">
              <Link to="/">
                <ArrowLeft />
                Back to overview
              </Link>
            </Button>
            <div className="flex flex-wrap items-center gap-2">
              <Chip>Base</Chip>
              <Chip dotColor="var(--asset-usdc)">USDC</Chip>
              <Chip pulse={false}>Tailwind v4</Chip>
            </div>
          </div>
          <div>
            <p className="eyebrow">Design System · USDC</p>
            <h1 className="mt-3 max-w-4xl text-4xl font-medium leading-none">
              Tokens and primitives for dense USDC flow intelligence.
            </h1>
            <p className="mt-4 max-w-2xl text-md text-muted-foreground">
              This page previews the local Tailwind v4 theme, shadcn-compatible component setup, and
              Stableflow-specific primitives used for live tables, flow maps, protocol surfaces, and
              inspection views.
            </p>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]" aria-labelledby="token-title">
          <Panel>
            <PanelHead>
              <PanelTitle id="token-title">Semantic tokens</PanelTitle>
              <PanelActions>
                <Button size="sm" variant="secondary">
                  <Search />
                  Inspect
                </Button>
              </PanelActions>
            </PanelHead>
            <PanelBody className="grid gap-5">
              <TokenGrid tokens={semanticTokens} />
              <div className="grid gap-3">
                <p className="eyebrow">Flow semantics</p>
                <TokenGrid tokens={flowTokens} />
              </div>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHead>
              <PanelTitle>Typography</PanelTitle>
            </PanelHead>
            <PanelBody className="grid gap-3">
              {typeScale.map((size) => (
                <div
                  className="flex items-baseline justify-between gap-4 border-border border-b pb-2"
                  key={size.name}
                >
                  <span className="font-mono text-muted-foreground text-xs">text-{size.name}</span>
                  <span className={`${size.className} leading-none`}>Flow volume 24h</span>
                </div>
              ))}
              <div className="mt-2 rounded-md border border-border bg-surface-2 p-3 font-mono tabular-nums">
                240,562,520.929336 USDC
              </div>
            </PanelBody>
          </Panel>
        </section>

        <section className="grid gap-4 lg:grid-cols-3" aria-labelledby="category-title">
          <Panel className="lg:col-span-2">
            <PanelHead>
              <PanelTitle id="category-title">Protocol categories</PanelTitle>
            </PanelHead>
            <PanelBody className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((category) => (
                <div className="rounded-md border border-border bg-surface-2 p-4" key={category}>
                  <div
                    className="mb-3 h-8 rounded-md"
                    style={{ background: CATEGORY[category].soft }}
                  />
                  <div className="flex items-center justify-between gap-3">
                    <Tag category={category} />
                    <span className="font-mono text-muted-foreground text-xs">
                      {CATEGORY[category].color}
                    </span>
                  </div>
                </div>
              ))}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHead>
              <PanelTitle>Chains and assets</PanelTitle>
            </PanelHead>
            <PanelBody className="grid gap-4">
              <SwatchList items={CHAIN} />
              <SwatchList items={ASSET} />
            </PanelBody>
          </Panel>
        </section>

        <section className="grid gap-4 lg:grid-cols-[72px_1fr]" aria-labelledby="component-title">
          <Panel className="flex justify-center py-3">
            <Rail className="relative inset-auto h-auto">
              <RailItem active label="Flow map">
                <Network />
              </RailItem>
              <RailItem label="Live">
                <Radio />
              </RailItem>
              <RailItem badge label="Metrics">
                <BarChart3 />
              </RailItem>
            </Rail>
          </Panel>

          <Panel>
            <PanelHead>
              <PanelTitle live id="component-title">
                Component primitives
              </PanelTitle>
              <PanelActions>
                <ToggleGroup
                  aria-label="Preview range"
                  type="single"
                  value={activeRange}
                  onValueChange={(nextRange) => {
                    if (nextRange) {
                      setActiveRange(nextRange);
                    }
                  }}
                >
                  <ToggleGroupItem value="live">Live</ToggleGroupItem>
                  <ToggleGroupItem value="1h">1H</ToggleGroupItem>
                  <ToggleGroupItem value="24h">24H</ToggleGroupItem>
                </ToggleGroup>
              </PanelActions>
            </PanelHead>
            <PanelBody className="grid gap-5">
              <div className="grid gap-3 md:grid-cols-3">
                <KPI
                  delta={{ trend: "up", value: "+12.4%" }}
                  label="Transfer volume"
                  spark={<Sparkline data={[12, 16, 14, 22, 31, 28, 36]} />}
                  unit="USDC"
                  value="531.8M"
                />
                <KPI
                  delta={{ trend: "down", value: "-4.1%" }}
                  label="Unidentified share"
                  spark={<Sparkline color="var(--outflow)" data={[64, 61, 59, 57, 54, 55, 52]} />}
                  value="52.1%"
                />
                <KPI
                  label="Known entities"
                  spark={<Sparkline color="var(--inflow)" data={[8, 9, 10, 13, 13, 15, 17]} />}
                  value="17"
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="grid gap-3 rounded-md border border-border bg-surface-1 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button>
                      <Activity />
                      Primary
                    </Button>
                    <Button variant="secondary">Secondary</Button>
                    <Button variant="outline">Outline</Button>
                    <Button size="icon" variant="ghost" aria-label="Search">
                      <Search />
                    </Button>
                  </div>
                  <div className="grid gap-3">
                    <Entity category="dex" glyph="AE" name="Aerodrome" />
                    <Entity category="lending" glyph="MO" name="Morpho Blue" />
                    <Entity isWallet glyph="0x" name="0x4e96...e778" />
                  </div>
                </div>

                <div className="grid gap-3 rounded-md border border-border bg-surface-1 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Protocol inflow</span>
                    <Amount trend="up" value={2_901_908} />
                  </div>
                  <FlowBar trend="inflow" value={72} />
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Protocol outflow</span>
                    <Amount trend="down" value={2_586_169} />
                  </div>
                  <FlowBar trend="outflow" value={58} />
                  <AnomalyItem
                    kind="whale"
                    meta={
                      <>
                        <span>Base</span>
                        <span>USDC</span>
                      </>
                    }
                    time="just now"
                    verb="Whale"
                  >
                    8.4M USDC moved from Unidentified to Aerodrome.
                  </AnomalyItem>
                </div>
              </div>
            </PanelBody>
          </Panel>
        </section>

        <Panel>
          <PanelHead>
            <PanelTitle>Usage rules</PanelTitle>
          </PanelHead>
          <PanelBody className="grid gap-3 text-muted-foreground text-sm md:grid-cols-3">
            <p>Use semantic tokens like bg-card, text-foreground, border-border, and ring-ring.</p>
            <p>Route new colors through tokens.css before using them in components or charts.</p>
            <p>
              Use component primitives for panels, KPIs, live rows, tags, entities, and amounts.
            </p>
          </PanelBody>
        </Panel>
      </div>
    </main>
  );
}

function TokenGrid({ tokens }: { tokens: readonly string[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {tokens.map((token) => (
        <div className="rounded-md border border-border bg-surface-2 p-3" key={token}>
          <div
            className="mb-3 h-10 rounded-md border border-border"
            style={{ background: `var(--${token})` }}
          />
          <div className="font-mono text-muted-foreground text-xs">--{token}</div>
        </div>
      ))}
    </div>
  );
}

function SwatchList({ items }: { items: Record<string, { color: string; label: string }> }) {
  return (
    <div className="grid gap-2">
      {Object.entries(items).map(([id, item]) => (
        <div className="flex items-center justify-between gap-3" key={id}>
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ background: item.color }} />
            <span>{item.label}</span>
          </span>
          <span className="font-mono text-muted-foreground text-2xs">{id}</span>
        </div>
      ))}
    </div>
  );
}
