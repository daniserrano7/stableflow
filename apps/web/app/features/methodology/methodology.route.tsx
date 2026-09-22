import { Link } from "react-router";
import { Panel, PanelBody, PanelHead, PanelTitle } from "~/components";
import { PublicPage } from "~/components/public-page";

export function meta() {
  return [
    { title: "Methodology | Stableflow" },
    {
      name: "description",
      content:
        "How Stableflow measures native USDC movements on Base, attributes entity flows, and handles coverage limitations.",
    },
  ];
}

const sectionLinks = [
  ["scope", "Scope"],
  ["counting", "Counting flows"],
  ["labels", "Labels"],
  ["bridges", "Bridges & supply"],
  ["limits", "Limits"],
] as const;

const scopeFacts = [
  ["Network", "Base mainnet", "Chain ID 8453"],
  ["Asset", "Native USDC", "USDbC is excluded"],
  ["Precision", "6 decimals", "Amounts stay USDC-denominated"],
  ["Time", "UTC", "Used throughout Movements"],
] as const;

const limits = [
  [
    "Indexed history",
    "Coverage starts at the indexer’s configured blocks, not necessarily Base genesis.",
  ],
  [
    "Recent data",
    "Indexing delays and chain reorganizations can briefly change the latest results.",
  ],
  ["Unidentified", "Means no applicable label was found—not that the address is one person."],
  [
    "Transfer meaning",
    "A USDC transfer alone cannot prove a deposit, repayment, withdrawal, or swap.",
  ],
] as const;

export default function Methodology() {
  return (
    <PublicPage title="Methodology">
      <Panel>
        <PanelBody className="space-y-4 p-5">
          <div className="max-w-3xl space-y-2">
            <p className="font-mono text-2xs uppercase tracking-[0.08em] text-accent">
              The short version
            </p>
            <p className="text-lg leading-relaxed text-foreground">
              Stableflow counts USDC transfer events, groups known addresses into entities, and
              measures value crossing each entity’s boundary.
            </p>
            <p className="text-md text-muted-foreground">
              Use this page to understand what the numbers mean. The full attribution strategy is
              available at the end for edge cases and implementation detail.
            </p>
          </div>
          <nav aria-label="Methodology sections" className="flex flex-wrap gap-2">
            {sectionLinks.map(([id, title]) => (
              <a
                className="rounded-md border border-border bg-surface-2 px-3 py-2 text-md text-muted-foreground transition-colors hover:border-[var(--border-strong)] hover:text-foreground"
                href={`#${id}`}
                key={id}
              >
                {title}
              </a>
            ))}
          </nav>
        </PanelBody>
      </Panel>

      <Panel id="scope" className="scroll-mt-4">
        <PanelHead>
          <PanelTitle>What Stableflow covers</PanelTitle>
        </PanelHead>
        <PanelBody className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {scopeFacts.map(([label, value, note]) => (
              <div className="rounded-md border border-border bg-surface-2 p-3.5" key={label}>
                <p className="font-mono text-2xs uppercase tracking-[0.08em] text-muted-foreground">
                  {label}
                </p>
                <p className="mt-2 text-lg font-medium">{value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{note}</p>
              </div>
            ))}
          </div>
          <a
            className="block break-all font-mono text-sm text-accent"
            href="https://basescan.org/token/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
            target="_blank"
            rel="noreferrer"
          >
            USDC contract · 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 ↗
          </a>
        </PanelBody>
      </Panel>

      <Panel id="counting" className="scroll-mt-4">
        <PanelHead>
          <PanelTitle>How flows are counted</PanelTitle>
        </PanelHead>
        <PanelBody className="space-y-4">
          <div className="flex flex-col gap-2 rounded-md border border-accent/30 bg-surface-2 p-4 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-md text-muted-foreground">The number used in rankings</span>
            <span className="font-mono text-lg">
              Net flow = <span className="text-inflow">inflow</span> −{" "}
              <span className="text-outflow">outflow</span>
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <FlowCard
              route="Outside → Entity"
              title="Inflow"
              tone="text-inflow"
              detail="Counts value entering the entity boundary."
            />
            <FlowCard
              route="Entity → Outside"
              title="Outflow"
              tone="text-outflow"
              detail="Counts value leaving the entity boundary."
            />
            <FlowCard
              route="Entity → Same group"
              title="Internal"
              tone="text-muted-foreground"
              detail="Excluded from external entity flow."
            />
            <FlowCard
              route="Entity A → Entity B"
              title="External"
              tone="text-accent"
              detail="A’s outflow and B’s inflow both increase."
            />
          </div>
          <p className="max-w-4xl text-md leading-relaxed text-muted-foreground">
            One movement is one on-chain USDC Transfer event. A transaction can contain several
            movements, so raw volume is not a count of users, swaps, or deposits. Entity totals are
            boundary-based and should not be added together to recreate raw chain volume.
          </p>
        </PanelBody>
      </Panel>

      <Panel id="labels" className="scroll-mt-4">
        <PanelHead>
          <PanelTitle>How labels become entity flows</PanelTitle>
        </PanelHead>
        <PanelBody className="space-y-4">
          <ol className="grid gap-3 md:grid-cols-3">
            <MethodStep
              number="01"
              title="Label addresses"
              detail="Attach an entity, role, confidence, and source to known addresses."
            />
            <MethodStep
              number="02"
              title="Group one entity"
              detail="Related operational addresses share one accounting boundary."
            />
            <MethodStep
              number="03"
              title="Count crossings"
              detail="Only movements that cross the boundary affect external flow."
            />
          </ol>
          <div className="grid gap-3 sm:grid-cols-2">
            <Callout
              title="Boundary labels count"
              detail="An identity label alone does not automatically contribute to inflow or outflow."
            />
            <Callout
              title="Unknown is not a wallet type"
              detail="Unidentified only means no applicable attribution is currently known."
            />
          </div>
          <Link className="inline-block text-md text-accent" to="/entities">
            Explore entity labels and sources →
          </Link>
        </PanelBody>
      </Panel>

      <Panel id="bridges" className="scroll-mt-4">
        <PanelHead>
          <PanelTitle>Bridges and supply are separate</PanelTitle>
        </PanelHead>
        <PanelBody className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <Callout
              eyebrow="Cross-chain"
              title="Bridge flow"
              detail="Confirmed from protocol events such as CCTP messages or Across deposits and fills—not from a bridge address alone."
            />
            <Callout
              eyebrow="Supply"
              title="Mint"
              detail="Zero address → recipient. Visible in Movements and treated as a supply event."
            />
            <Callout
              eyebrow="Supply"
              title="Burn"
              detail="Sender → zero address. Visible in Movements and treated as a supply event."
            />
          </div>
          <p className="max-w-4xl text-md text-muted-foreground">
            These signals are stored separately from general entity flow. Supported event sources do
            not imply coverage of every bridge or cross-chain route.
          </p>
        </PanelBody>
      </Panel>

      <Panel id="limits" className="scroll-mt-4">
        <PanelHead>
          <PanelTitle>Read the numbers with these limits</PanelTitle>
        </PanelHead>
        <PanelBody className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {limits.map(([title, detail]) => (
              <Callout detail={detail} key={title} title={title} />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-md bg-surface-2 px-4 py-3 font-mono text-sm text-muted-foreground">
            <span>
              Large <strong className="font-medium text-foreground">≥ 10,000 USDC</strong>
            </span>
            <span>
              Whale <strong className="font-medium text-foreground">≥ 1,000,000 USDC</strong>
            </span>
            <span>Large includes whales · thresholds describe transfers, not wallet wealth</span>
          </div>
        </PanelBody>
      </Panel>

      <Panel id="sources" className="scroll-mt-4">
        <PanelBody className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-medium">Need the full methodology?</h2>
            <p className="mt-1 max-w-3xl text-md text-muted-foreground">
              Read the detailed counting rules, edge cases, discovery sources, and implementation
              notes. Planned work in that document is not a promise of current coverage.
            </p>
          </div>
          <a className="shrink-0 text-md text-accent" href="/methodology/attribution">
            Read the full attribution strategy →
          </a>
        </PanelBody>
      </Panel>
    </PublicPage>
  );
}

function FlowCard({
  detail,
  route,
  title,
  tone,
}: {
  detail: string;
  route: string;
  title: string;
  tone: string;
}) {
  return (
    <div className="rounded-md border border-border bg-surface-2 p-3.5">
      <p className="font-mono text-sm text-foreground">{route}</p>
      <p className={`mt-3 text-lg font-medium ${tone}`}>{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}

function MethodStep({ detail, number, title }: { detail: string; number: string; title: string }) {
  return (
    <li className="relative rounded-md border border-border bg-surface-2 p-4">
      <span className="font-mono text-2xs text-accent">{number}</span>
      <h3 className="mt-3 text-lg font-medium">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{detail}</p>
    </li>
  );
}

function Callout({ detail, eyebrow, title }: { detail: string; eyebrow?: string; title: string }) {
  return (
    <div className="rounded-md border border-border bg-surface-2 p-4">
      {eyebrow && (
        <p className="font-mono text-2xs uppercase tracking-[0.08em] text-accent">{eyebrow}</p>
      )}
      <h3 className={eyebrow ? "mt-2 text-lg font-medium" : "text-lg font-medium"}>{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{detail}</p>
    </div>
  );
}
