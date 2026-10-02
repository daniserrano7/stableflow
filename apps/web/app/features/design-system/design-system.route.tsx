import { Activity, ArrowLeftRight, BookOpen, Palette, RotateCcw, Search } from "lucide-react";
import { useState } from "react";
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
  Sparkline,
  Tag,
} from "~/components";
import { AppPage } from "~/components/app-page";
import { PageHeader } from "~/components/page-header";
import { SidebarItem } from "~/components/sidebar";
import { Button } from "~/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { ASSET, CATEGORY, type Category, CHAIN } from "~/styles/tokens";

const semanticTokens = [
  "background",
  "foreground",
  "muted-foreground",
  "card",
  "primary",
  "secondary",
  "muted",
  "accent",
  "accent-soft",
  "destructive",
  "border",
  "border-strong",
  "input",
  "ring",
] as const;

const flowTokens = [
  "inflow",
  "outflow",
  "anomaly",
  "magnitude-large",
  "whale",
  "neutral-flow",
] as const;

// Lightest to most emphasised in light, the reverse in dark; each layer nests inside the previous.
const surfaceTokens = [
  { role: "Page canvas", token: "surface-0" },
  { role: "Panels, header, sidebar", token: "glass" },
  { role: "Cards, popovers, dialogs", token: "surface-1" },
  { role: "Wells, inputs, hover", token: "surface-2" },
  { role: "Selected and active items", token: "surface-3" },
] as const;

const elevations = [
  { className: "shadow-xs", name: "xs" },
  { className: "shadow-sm", name: "sm" },
  { className: "shadow-md", name: "md" },
  { className: "shadow-lg", name: "lg" },
] as const;

const layers = [
  { name: "z-raised", value: 10 },
  { name: "z-overlay", value: 50 },
  { name: "z-modal", value: 100 },
  { name: "z-popover", value: 200 },
  { name: "z-tooltip", value: 300 },
  { name: "z-toast", value: 400 },
] as const;

const motions = [
  { className: "animate-fade-in", name: "fade-in", use: "Dialog overlays · 200ms" },
  { className: "animate-slide-in", name: "slide-in", use: "Dialog content · 400ms" },
  { className: "animate-row-in", name: "row-in", use: "Fresh live rows · 500ms" },
] as const;

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
  const [motionRun, setMotionRun] = useState(0);

  return (
    <AppPage breadcrumbs={[{ label: "Design System" }]} headingId="design-system-title">
      <PageHeader
        description="Tokens and primitives for dense USDC flow intelligence. Every token switches with the theme, so flip it from the sidebar to compare light and dark."
        id="design-system-title"
        title="Design System"
      />

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

      <section aria-labelledby="surface-title">
        <Panel>
          <PanelHead>
            <PanelTitle id="surface-title">Surfaces and elevation</PanelTitle>
          </PanelHead>
          <PanelBody className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="grid gap-4">
              {/* The real nesting order: panels sit on the page, wells sit in panels. */}
              <div className="rounded-lg border border-border bg-background p-3">
                <LayerLabel label="Page" token="surface-0" />
                <div className="mt-3 rounded-lg border border-border bg-glass p-3 shadow-sm">
                  <LayerLabel label="Panel" token="glass" />
                  <div className="mt-3 rounded-md border border-border bg-surface-2 p-3">
                    <LayerLabel label="Well" token="surface-2" />
                    <span className="mt-3 inline-flex rounded-full bg-surface-3 px-2.5 py-1 font-mono text-2xs text-foreground uppercase tracking-[0.04em] ring-1 ring-border">
                      surface-3 · selected
                    </span>
                  </div>
                </div>
              </div>
              <ul className="m-0 grid list-none gap-2 p-0">
                {surfaceTokens.map((surface) => (
                  <li className="flex items-center gap-3" key={surface.token}>
                    <span
                      className="size-5 shrink-0 rounded-sm border border-border"
                      style={{ background: `var(--${surface.token})` }}
                    />
                    <span className="w-20 font-mono text-xs">--{surface.token}</span>
                    <span className="text-muted-foreground text-sm">{surface.role}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid content-start gap-3">
              <p className="eyebrow">Elevation</p>
              <div className="grid grid-cols-2 gap-3 rounded-lg bg-background p-4">
                {elevations.map((elevation) => (
                  <div
                    className={`grid h-20 place-items-center rounded-md border border-border bg-surface-1 font-mono text-muted-foreground text-xs ${elevation.className}`}
                    key={elevation.name}
                  >
                    shadow-{elevation.name}
                  </div>
                ))}
              </div>
              <p className="text-muted-foreground text-sm">
                Each theme defines its own --elevation-* values: dark needs deep shadows to
                register, light keeps them faint so surfaces separate by lightness instead.
              </p>
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
          <nav aria-label="Sidebar preview" className="flex flex-col items-center gap-1">
            <SidebarItem
              icon={<Palette size={16} strokeWidth={1.6} />}
              isActive
              label="Design System"
              to="/design-system"
            />
            <SidebarItem
              icon={<ArrowLeftRight size={16} strokeWidth={1.6} />}
              label="Transfers"
              to="/transfers"
            />
            <SidebarItem
              icon={<BookOpen size={16} strokeWidth={1.6} />}
              label="Methodology"
              to="/methodology"
            />
          </nav>
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
              <div className="grid gap-3 rounded-md border border-border bg-surface-2 p-4">
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
                <div className="flex flex-wrap items-center gap-2">
                  <Chip>Live</Chip>
                  <Chip dotColor="var(--chain-base)" pulse={false}>
                    Base
                  </Chip>
                  <Chip dotColor="var(--anomaly)" pulse={false}>
                    Anomaly
                  </Chip>
                </div>
                <div className="grid gap-3">
                  <Entity category="dex" glyph="AE" name="Aerodrome" />
                  <Entity category="lending" glyph="MO" name="Morpho Blue" />
                  <Entity isWallet glyph="0x" name="0x4e96...e778" />
                </div>
              </div>

              <div className="grid gap-3 rounded-md border border-border bg-surface-2 p-4">
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

      <section className="grid gap-4 lg:grid-cols-2" aria-labelledby="layers-title">
        <Panel>
          <PanelHead>
            <PanelTitle id="layers-title">Layers</PanelTitle>
          </PanelHead>
          <PanelBody className="grid gap-3">
            <ul className="m-0 grid list-none gap-0 p-0">
              {layers.map((layer) => (
                <li
                  className="flex items-center justify-between gap-4 border-border border-b py-2 last:border-b-0"
                  key={layer.name}
                >
                  <span className="font-mono text-sm">{layer.name}</span>
                  <span className="font-mono text-muted-foreground text-sm tabular-nums">
                    {layer.value}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground text-sm">
              Stack with these utilities instead of raw numbers. Dialogs use z-modal for both
              overlay and content, so the overlay always covers the sticky sidebar.
            </p>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHead>
            <PanelTitle>Motion</PanelTitle>
            <PanelActions>
              <Button onClick={() => setMotionRun((run) => run + 1)} size="sm" variant="secondary">
                <RotateCcw />
                Replay
              </Button>
            </PanelActions>
          </PanelHead>
          <PanelBody className="grid gap-3">
            {/* Remounting on replay restarts each entrance animation. */}
            <div className="grid gap-3 sm:grid-cols-3" key={motionRun}>
              {motions.map((motion) => (
                <div className="grid gap-2" key={motion.name}>
                  <div
                    className={`h-14 rounded-md border border-border bg-surface-2 ${motion.className}`}
                  />
                  <span className="font-mono text-xs">animate-{motion.name}</span>
                  <span className="text-muted-foreground text-xs">{motion.use}</span>
                </div>
              ))}
            </div>
            <p className="text-muted-foreground text-sm">
              Entrances only; everything is disabled under prefers-reduced-motion.
            </p>
          </PanelBody>
        </Panel>
      </section>

      <Panel>
        <PanelHead>
          <PanelTitle>Usage rules</PanelTitle>
        </PanelHead>
        <PanelBody className="grid gap-3 text-muted-foreground text-sm md:grid-cols-2">
          <p>Use semantic tokens like bg-card, text-foreground, border-border, and ring-ring.</p>
          <p>
            Nest surfaces in order: panels on the page, surface-2 wells inside panels, surface-3 for
            the selected item.
          </p>
          <p>Route new colors through tokens.css before using them in components or charts.</p>
          <p>Use component primitives for panels, KPIs, live rows, tags, entities, and amounts.</p>
        </PanelBody>
      </Panel>
    </AppPage>
  );
}

function LayerLabel({ label, token }: { label: string; token: string }) {
  return (
    <p className="eyebrow m-0">
      {label} · {token}
    </p>
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
