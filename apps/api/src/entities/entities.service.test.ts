import assert from "node:assert/strict";
import { test } from "node:test";
import { baseAddressLabels } from "@stableflow/indexer/base-address-labels";
import type { EntityAddressLabel } from "@stableflow/shared";
import type { DatabaseService } from "../database/database.service.js";
import { EntitiesService } from "./entities.service.js";

type RegistryLabel = Pick<
  EntityAddressLabel,
  | "address"
  | "attributionGroup"
  | "category"
  | "countingPolicy"
  | "entityId"
  | "entityName"
  | "firstSeenBlock"
  | "role"
  | "sourceType"
>;

const makeService = (
  labels: RegistryLabel[] = [],
  identities: { entityId: string; entityName: string; category: string }[] = [],
) => {
  const query = (rows: unknown[]) => ({ from: () => ({ orderBy: () => Promise.resolve(rows) }) });
  return new EntitiesService({
    db: {
      select: () => query(labels),
      selectDistinctOn: () => query(identities),
    },
  } as unknown as DatabaseService);
};

const discoveredLabel = (overrides: Partial<RegistryLabel> = {}): RegistryLabel => ({
  address: "0xabcdef",
  attributionGroup: "discovered-protocol",
  category: "dex",
  countingPolicy: "boundary",
  entityId: "discovered-protocol",
  entityName: "Discovered Protocol",
  firstSeenBlock: "9007199254740993",
  role: "pool",
  sourceType: "factory_event",
  ...overrides,
});

test("includes every static entity before any labels or flows have been indexed", async () => {
  const result = await makeService().listEntities();
  assert.deepEqual(
    new Set(result.data.map((entity) => entity.entityId)),
    new Set(baseAddressLabels.map((label) => label.entityId)),
  );
  for (const entity of result.data) {
    const labels = baseAddressLabels.filter((label) => label.entityId === entity.entityId);
    assert.equal(
      entity.addressCount,
      new Set(labels.map((label) => label.address.toLowerCase())).size,
    );
    assert.equal(entity.labelCount, entity.addressCount);
    assert.equal(entity.firstSeenBlock, null);
    assert.equal(entity.latestSeenBlock, null);
    assert.deepEqual(entity.sourceTypes, ["static_config"]);
  }
  assert.equal(result.meta.totalEntities, result.data.length);
});

test("unions static, discovered and flow-only entities and recomputes category totals", async () => {
  const identity = { entityId: "flow-only", entityName: "Flow Only", category: "lending" };
  const result = await makeService(
    [
      discoveredLabel(),
      discoveredLabel({ address: "0x123456", firstSeenBlock: "9007199254740995" }),
    ],
    [identity, { entityId: "circle", entityName: "Old Circle", category: "old-category" }],
  ).listEntities();
  const discovered = result.data.find((entity) => entity.entityId === "discovered-protocol");
  assert.equal(discovered?.labelCount, 2);
  assert.equal(discovered.firstSeenBlock, "9007199254740993");
  assert.equal(discovered.latestSeenBlock, "9007199254740995");
  assert.deepEqual(
    result.data.find((entity) => entity.entityId === identity.entityId),
    {
      ...identity,
      addressCount: 0,
      labelCount: 0,
      firstSeenBlock: null,
      latestSeenBlock: null,
      roles: [],
      sourceTypes: [],
    },
  );
  assert.equal(result.data.find((entity) => entity.entityId === "circle")?.entityName, "Circle");
  assert.equal(new Set(result.data.map((entity) => entity.entityId)).size, result.data.length);
  assert.equal(
    result.meta.totalLabels,
    result.data.reduce((sum, entity) => sum + entity.labelCount, 0),
  );
  for (const category of result.meta.categories) {
    const entities = result.data.filter((entity) => entity.category === category.category);
    assert.equal(category.entityCount, entities.length);
    assert.equal(
      category.labelCount,
      entities.reduce((sum, entity) => sum + entity.labelCount, 0),
    );
  }
});

test("deduplicates overlapping addresses case-insensitively and merges label metadata", async () => {
  const staticLabel = baseAddressLabels[0];
  assert.ok(staticLabel);
  const baseline = await makeService().listEntities();
  const result = await makeService(
    [
      discoveredLabel({ ...staticLabel, address: staticLabel.address.toLowerCase() }),
      discoveredLabel({
        entityId: staticLabel.entityId,
        entityName: staticLabel.entityName,
        category: staticLabel.category,
      }),
    ],
    [staticLabel],
  ).listEntities();
  const before = baseline.data.find((entity) => entity.entityId === staticLabel.entityId);
  const after = result.data.find((entity) => entity.entityId === staticLabel.entityId);
  assert.ok(before && after);
  assert.equal(after.addressCount, before.addressCount + 1);
  assert.equal(after.labelCount, before.labelCount + 1);
  assert.ok(after.roles.includes("pool"));
  assert.ok(after.roles.includes(staticLabel.role));
  assert.ok(after.sourceTypes.includes("factory_event"));
  assert.equal(after.firstSeenBlock, "9007199254740993");
});
