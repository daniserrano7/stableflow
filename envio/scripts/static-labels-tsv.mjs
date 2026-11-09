// Writes the curated address labels (src/labels/base-address-labels.ts) as TSV for scripts/compare-aggregates.sql.
import { baseAddressLabels } from "../src/labels/base-address-labels.ts";
for (const l of baseAddressLabels)
  console.log([l.address.toLowerCase(), l.attributionGroup, l.countingPolicy, l.entityId, l.entityName, l.category].join("\t"));
