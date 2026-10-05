/** Plain-language noun for an entity category, for page descriptions and llms.txt. */
export function describeEntityCategory(category: string) {
  switch (category) {
    case "dex":
      return "decentralized exchange";
    case "cex":
      return "centralized exchange";
    case "lending":
      return "lending protocol";
    case "bridge":
      return "bridge";
    case "stablecoin_issuer":
      return "stablecoin issuer";
    case "system":
      return "Base system contract";
    case "unidentified":
      return "pool of unlabelled wallets";
    default:
      return category.replace(/_/g, " ");
  }
}

/** "a decentralized exchange", "an oracle". */
export const withIndefiniteArticle = (noun: string) =>
  `${/^[aeiou]/i.test(noun) ? "an" : "a"} ${noun}`;
