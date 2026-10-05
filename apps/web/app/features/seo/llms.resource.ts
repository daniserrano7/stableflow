import { transferThresholds } from "@stableflow/shared";
import { getMcpPublicUrl } from "~/config/mcp.server";
import { absoluteUrl, site } from "~/config/site";
import { fetchEntityCatalog } from "./entity-catalog.server";
import { describeEntityCategory } from "./entity-copy";
import { sitePages } from "./site-pages";

const usdcContract = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

/** llms.txt (https://llmstxt.org): a plain summary of the site for language models and agents. */
export async function loader({ request }: { request: Request }) {
  const entities = await fetchEntityCatalog(request.signal);
  const mcpUrl = getMcpPublicUrl();
  const format = (value: number) => value.toLocaleString("en-US");

  const sections = [
    `# ${site.name}`,
    `> ${site.description}`,
    [
      `${site.name} is a public, read-only explorer. It is not a wallet, trading tool or investment advice.`,
      "",
      `- Scope: Base mainnet (chain 8453) and native USDC (${usdcContract}). USDbC, other chains and other stablecoins are excluded.`,
      "- Flows are measured at each entity's boundary: inflow is USDC entering an entity, outflow is USDC leaving it, net flow is inflow minus outflow. Moves inside an entity count for neither side.",
      "- Volume counts each transaction once, so multi-hop swaps are not double counted.",
      `- A large transfer is ${format(transferThresholds.large)} USDC or more; a whale transfer is ${format(transferThresholds.whale)} USDC or more.`,
      "- Data streams in live. Individual transfers are kept for 14 days; history starts at the block indexing began, not at Base's first block.",
      "- All times are UTC.",
    ].join("\n"),
    [
      "## Pages",
      "",
      ...sitePages.map((page) => `- [${page.title}](${absoluteUrl(page.path)}): ${page.summary}`),
    ].join("\n"),
  ];

  if (entities && entities.length > 0) {
    sections.push(
      [
        "## Entities",
        "",
        ...entities.map(
          (entity) =>
            `- [${entity.entityName}](${absoluteUrl(`/entities/${encodeURIComponent(entity.entityId)}`)}): ${describeEntityCategory(entity.category)}`,
        ),
      ].join("\n"),
    );
  }

  if (mcpUrl) {
    sections.push(
      [
        "## MCP server",
        "",
        `- Endpoint (Streamable HTTP): ${mcpUrl}`,
        "- Anonymous and read-only. Tools cover recent and historical transfers, flow KPIs, top entity flows, the flow graph, the entity catalog, search, entity detail and two-entity comparison.",
      ].join("\n"),
    );
  }

  sections.push(
    [
      "## Optional",
      "",
      `- [Attribution strategy](${absoluteUrl("/methodology/attribution")}): the full flow attribution design as plain text, including per-protocol edge cases.`,
      `- [Source code](${site.repositoryUrl})`,
    ].join("\n"),
  );

  return new Response(`${sections.join("\n\n")}\n`, {
    headers: {
      "Cache-Control": `public, max-age=${entities ? 3600 : 300}`,
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
