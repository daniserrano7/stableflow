import { ArrowRight, ChevronDown } from "lucide-react";
import { type ReactNode, useEffect } from "react";
import { Link } from "react-router";

interface Question {
  /** The answer as plain prose; it is also published as FAQ structured data. */
  answer: string;
  /** Diagram shown above the answer. */
  illustration?: ReactNode;
  /** Link shown below the answer. */
  link?: ReactNode;
  /** Stable anchor, so other pages can link straight to an answer (it opens on arrival). */
  id: string;
  question: string;
}

export const methodologyQuestions: Question[] = [
  {
    answer:
      "Each entity is measured at its own boundary. A transfer between two entities is outflow for one and inflow for the other, and moves inside an entity count for neither. Volume counts each transaction once, so adding up entity totals won't recreate it.",
    id: "entity-totals",
    question: "Why don't entity flows add up to total volume?",
  },
  {
    answer:
      "A routed swap emits one transfer per hop, so the same USDC shows up more than once. Volume adds up each address's positive net change in the transaction, which counts that USDC once.",
    id: "multi-hop",
    illustration: <HopChain />,
    question: "How are swaps with several hops counted?",
  },
  {
    answer:
      "Each known address gets an entity, a role, a confidence level and a source. Addresses of the same entity share one boundary, and only transfers crossing it change that entity's flows. An identity label on its own adds nothing to inflow or outflow.",
    id: "labels",
    illustration: (
      <StepChain steps={["Label the address", "Group it into an entity", "Count what crosses"]} />
    ),
    link: (
      <Link className="inline-flex items-center gap-1 text-accent hover:underline" to="/entities">
        Browse entities and their labels
        <ArrowRight aria-hidden size={13} />
      </Link>
    ),
    question: "How do addresses get labelled?",
  },
  {
    answer:
      "No label is known for the address yet. It could be a person, a contract or a service with many users, so read it as unknown rather than as a kind of wallet.",
    id: "unidentified",
    question: "What does Unidentified mean?",
  },
  {
    answer:
      "From the bridge protocol's own events, such as Circle CCTP messages or Across deposits and fills, not from a transfer to a bridge address. The supported protocols don't cover every cross-chain route.",
    id: "bridges",
    question: "How are bridge flows detected?",
  },
  {
    answer:
      "A transfer from the zero address is a mint, and one to the zero address is a burn. Both appear in Transfers and are tracked as supply changes, separately from entity flows.",
    id: "supply",
    question: "Where do mints and burns show up?",
  },
  {
    answer:
      "Transfers stream in live. The latest numbers can shift briefly while the indexer catches up or a block is reorganized. History starts at the block the indexer was set to begin from, not at Base's first block.",
    id: "freshness",
    question: "How fresh and complete is the data?",
  },
  {
    answer:
      "No. A transfer only shows USDC moving between two addresses. Stableflow labels who is involved, not why the USDC moved.",
    id: "intent",
    question: "Can a transfer tell me if it was a deposit, a swap or a repayment?",
  },
];

export function MethodologyQuestions() {
  useOpenHashTarget();

  return (
    <div className="divide-y divide-border">
      {methodologyQuestions.map((item) => (
        <details className="details-animated group scroll-mt-4" id={item.id} key={item.id}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3.5 font-medium text-md transition-colors duration-fast hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
            {item.question}
            <ChevronDown
              aria-hidden
              className="shrink-0 text-muted-foreground transition-transform duration-fast group-open:rotate-180"
              size={16}
            />
          </summary>
          <div className="grid max-w-3xl justify-items-start gap-3 px-4 pt-1.5 pb-4 text-muted-foreground text-sm leading-relaxed [&_p]:m-0">
            {item.illustration}
            <p>{item.answer}</p>
            {item.link}
          </div>
        </details>
      ))}
    </div>
  );
}

/** Opens the question a URL hash points at, on arrival and when the hash changes. */
function useOpenHashTarget() {
  useEffect(() => {
    const openTarget = () => {
      const target = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
      if (target instanceof HTMLDetailsElement) target.open = true;
    };
    openTarget();
    window.addEventListener("hashchange", openTarget);
    return () => window.removeEventListener("hashchange", openTarget);
  }, []);
}

function HopChain() {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 font-mono text-xs">
      <Hop>You</Hop>
      <HopArrow />
      <Hop>Router</Hop>
      <HopArrow />
      <Hop>Pool</Hop>
      <span className="ml-1 text-foreground">
        = 1,000 USDC volume, <span className="text-muted-foreground">not 2,000</span>
      </span>
    </div>
  );
}

function Hop({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-sm border border-border bg-surface-2 px-2 py-1 text-foreground">
      {children}
    </span>
  );
}

function HopArrow() {
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      1,000
      <ArrowRight aria-hidden size={12} />
    </span>
  );
}

function StepChain({ steps }: { steps: string[] }) {
  return (
    <ol className="m-0 flex list-none flex-wrap items-center gap-x-2 gap-y-1.5 p-0 font-mono text-xs">
      {steps.map((step, index) => (
        <li className="inline-flex items-center gap-2" key={step}>
          {index > 0 && <ArrowRight aria-hidden className="text-muted-foreground" size={12} />}
          <span className="rounded-sm border border-border bg-surface-2 px-2 py-1 text-foreground">
            <span className="mr-1.5 text-muted-foreground">{index + 1}</span>
            {step}
          </span>
        </li>
      ))}
    </ol>
  );
}
