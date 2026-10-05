import { transferThresholds } from "@stableflow/shared";
import { ArrowUpRight, Check, Scale, SquareDashed, Tag as TagIcon, X } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { Amount, Panel, PanelBody, PanelHead, PanelTitle, Tag } from "~/components";
import { AppPage } from "~/components/app-page";
import { PageHeader } from "~/components/page-header";
import { absoluteUrl, site } from "~/config/site";
import { seo } from "~/utils/seo";
import { FlowExample } from "./flow-example";
import { MethodologyQuestions, methodologyQuestions } from "./methodology-questions";

export function meta() {
  const path = "/methodology";
  const url = absoluteUrl(path);

  return seo({
    breadcrumbs: [{ name: "Methodology", path }],
    description:
      "How Stableflow measures native USDC on Base: address labels, entity boundaries, inflow, outflow and net flow, multi-hop swaps, bridges, and coverage limits.",
    nodes: [
      {
        "@type": "Dataset",
        "@id": `${url}#dataset`,
        name: "Stableflow: native USDC transfers and entity flows on Base",
        description:
          "Live native USDC transfers on Base mainnet, attributed to labelled entities (decentralized exchanges, lending protocols, bridges and issuers) to measure each entity's USDC inflow, outflow and net flow, with large and whale transfer classification.",
        url,
        creator: { "@id": `${site.url}/#organization` },
        publisher: { "@id": `${site.url}/#organization` },
        isAccessibleForFree: true,
        keywords: [
          "USDC",
          "Base",
          "stablecoin flows",
          "on-chain data",
          "token transfers",
          "entity flows",
          "whale transfers",
          "DeFi",
        ],
        measurementTechnique:
          "Indexing ERC-20 Transfer events of the native USDC contract on Base, attributing addresses to entities from a labelled address registry, and detecting bridge flows from bridge protocol events.",
        variableMeasured: ["USDC volume", "Inflow", "Outflow", "Net flow", "Transfer count"],
      },
      {
        "@type": "DefinedTermSet",
        "@id": `${url}#terms`,
        name: "Stableflow key terms",
        hasDefinedTerm: terms.map(({ definition, term }) => ({
          "@type": "DefinedTerm",
          name: term,
          description: definition,
        })),
      },
    ],
    page: {
      about: { "@id": `${url}#dataset` },
      mainEntity: methodologyQuestions.map(({ answer, question }) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: { "@type": "Answer", text: answer },
      })),
    },
    pageType: "FAQPage",
    path,
    title: "Methodology: How USDC Flows Are Measured",
  });
}

const usdcContract = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

const takeaways = [
  {
    detail: "Known addresses are grouped into entities, like an exchange or a lending protocol.",
    icon: TagIcon,
    title: "Label addresses",
  },
  {
    detail: "Only USDC entering or leaving an entity counts. Moves inside it don't.",
    icon: SquareDashed,
    title: "Count what crosses",
  },
  {
    detail: "Net flow is inflow minus outflow. Entity rankings sort by it.",
    icon: Scale,
    title: "Net it out",
  },
] as const;

const included: ReactNode[] = [
  "Native USDC on Base mainnet",
  "Every USDC transfer since indexing began",
  "Mints and burns, as supply changes",
  "Bridge activity from Circle CCTP and Across events",
  <>
    Labelled protocols, bridges and issuers.{" "}
    <Link className="text-accent underline underline-offset-2" to="/entities">
      See entities
    </Link>
  </>,
];

const excluded: ReactNode[] = [
  "USDbC, the older bridged USDC",
  "Other chains and other stablecoins",
  "Blocks before the indexer's start",
  "Why a transfer happened",
  "Who is behind an unidentified address",
];

const formatThreshold = (value: number) => `${value.toLocaleString("en-US")} USDC`;

const terms: { definition: string; sample?: ReactNode; term: string }[] = [
  {
    definition: "USDC moved on Base, counting each transaction once.",
    sample: <Amount magnitude="small" value={4_410_000_000} />,
    term: "Volume",
  },
  {
    definition: "USDC entering an entity from outside it.",
    sample: <Amount trend="up" value={500} />,
    term: "Inflow",
  },
  {
    definition: "USDC leaving an entity for outside it.",
    sample: <Amount trend="down" value={300} />,
    term: "Outflow",
  },
  {
    definition: "Inflow minus outflow. Green when more came in, orange when more left.",
    sample: (
      <span className="inline-flex gap-2.5 font-medium font-mono text-sm tabular-nums">
        <span className="text-inflow">+2.24M</span>
        <span className="text-outflow">−1.93M</span>
      </span>
    ),
    term: "Net flow",
  },
  {
    definition: `One transfer of ${formatThreshold(transferThresholds.large)} or more.`,
    sample: <Amount value={25_000} />,
    term: "Large transfer",
  },
  {
    definition: `One transfer of ${formatThreshold(transferThresholds.whale)} or more. Describes the transfer, not the wallet's wealth.`,
    sample: <Amount value={2_400_000} />,
    term: "Whale",
  },
  {
    definition: "No label is known for the address yet.",
    sample: <Tag>Unidentified</Tag>,
    term: "Unidentified",
  },
  {
    definition: "USDC moving to or from another chain, confirmed from bridge protocol events.",
    sample: <Tag category="bridge" />,
    term: "Bridge flow",
  },
  {
    definition: "USDC created or destroyed via the zero address. Tracked as supply.",
    sample: <span className="font-mono text-muted-foreground text-xs">0x0000...0000</span>,
    term: "Mint and burn",
  },
];

export default function Methodology() {
  return (
    <AppPage breadcrumbs={[{ label: "Methodology" }]} headingId="methodology-title">
      <PageHeader
        description="How Stableflow turns raw USDC transfers into the entity flows you see across the app."
        id="methodology-title"
        stats={[
          { label: "Network", unit: "mainnet", value: "Base" },
          { label: "Asset", unit: "native", value: "USDC" },
          { label: "Timezone", value: "UTC" },
        ]}
        title="Methodology"
      />

      <section aria-labelledby="flow-title">
        <Panel>
          <PanelHead>
            <PanelTitle id="flow-title">How a flow is counted</PanelTitle>
            <span className="font-mono text-2xs text-muted-foreground uppercase tracking-[0.06em]">
              Worked example
            </span>
          </PanelHead>
          <PanelBody className="grid gap-6">
            <FlowExample />
            <ol className="m-0 grid list-none gap-4 border-border border-t p-0 pt-5 md:grid-cols-3">
              {takeaways.map(({ detail, icon: Icon, title }, index) => (
                <li className="flex gap-3" key={title}>
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-surface-2 text-muted-foreground">
                    <Icon aria-hidden size={15} strokeWidth={1.75} />
                  </span>
                  <div>
                    <h3 className="m-0 font-medium text-md">
                      <span className="mr-1.5 font-mono text-muted-foreground text-xs">
                        {index + 1}
                      </span>
                      {title}
                    </h3>
                    <p className="m-0 mt-0.5 text-muted-foreground text-sm">{detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </PanelBody>
        </Panel>
      </section>

      <div className="grid gap-3.5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
        <section aria-labelledby="coverage-title">
          <Panel className="h-full">
            <PanelHead>
              <PanelTitle id="coverage-title">What's covered</PanelTitle>
            </PanelHead>
            <PanelBody className="grid gap-5">
              <ScopeList items={included} kind="included" title="Included" />
              <ScopeList items={excluded} kind="excluded" title="Not included" />
              <a
                className="inline-flex min-w-0 items-center gap-1 font-mono text-muted-foreground text-xs hover:text-accent"
                href={`https://basescan.org/token/${usdcContract}`}
                rel="noreferrer"
                target="_blank"
              >
                <span className="truncate">USDC contract {usdcContract}</span>
                <ArrowUpRight aria-hidden className="shrink-0" size={12} />
              </a>
            </PanelBody>
          </Panel>
        </section>

        <section aria-labelledby="terms-title">
          <Panel className="h-full">
            <PanelHead>
              <PanelTitle id="terms-title">Key terms</PanelTitle>
            </PanelHead>
            <dl className="m-0 divide-y divide-border">
              {terms.map(({ definition, sample, term }) => (
                <div
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 px-4 py-2.5"
                  key={term}
                >
                  <dt className="font-medium text-md">{term}</dt>
                  <dd className="col-start-1 m-0 text-muted-foreground text-sm">{definition}</dd>
                  {sample && <dd className="col-start-2 row-span-2 row-start-1 m-0">{sample}</dd>}
                </div>
              ))}
            </dl>
          </Panel>
        </section>
      </div>

      <section aria-labelledby="questions-title">
        <Panel>
          <PanelHead>
            <PanelTitle id="questions-title">Common questions</PanelTitle>
          </PanelHead>
          <MethodologyQuestions />
          <p className="m-0 border-border border-t px-4 py-3 text-muted-foreground text-xs">
            Per-protocol edge cases are in the full attribution strategy, which also lists work that
            isn't live yet.{" "}
            <a className="text-accent underline underline-offset-2" href="/methodology/attribution">
              Read it as plain text
            </a>
          </p>
        </Panel>
      </section>
    </AppPage>
  );
}

function ScopeList({
  items,
  kind,
  title,
}: {
  items: ReactNode[];
  kind: "excluded" | "included";
  title: string;
}) {
  const Icon = kind === "included" ? Check : X;

  return (
    <div className="grid gap-2.5">
      <p className="eyebrow m-0">{title}</p>
      <ul className="m-0 grid list-none gap-2 p-0">
        {items.map((item, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static list that never reorders
          <li className="flex items-start gap-2.5 text-sm" key={index}>
            <span
              className={
                kind === "included"
                  ? "mt-px flex size-4.5 shrink-0 items-center justify-center rounded-full bg-surface-3 text-foreground"
                  : "mt-px flex size-4.5 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground"
              }
            >
              <Icon aria-hidden size={11} strokeWidth={2.5} />
            </span>
            <span className={kind === "included" ? "text-foreground" : "text-muted-foreground"}>
              {item}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
