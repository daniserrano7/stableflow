import assert from "node:assert/strict";
import { test } from "node:test";
import { EntitiesController } from "../dist/entities/entities.controller.js";
import { EntitiesService } from "../dist/entities/entities.service.js";

const fakeDb = {
  select: () => ({ from: () => ({ orderBy: async () => [] }) }),
  selectDistinctOn: () => ({ from: () => ({ orderBy: async () => [] }) }),
};

test("entity catalog pages summaries while retaining global totals", async () => {
  const service = new EntitiesService({ db: fakeDb });
  const first = await service.listEntities({ limit: 2, offset: 0 });
  const second = await service.listEntities({ limit: 2, offset: 2 });
  assert.equal(first.data.length, 2);
  assert.equal(second.data.length, 2);
  assert.notEqual(first.data[0].entityId, second.data[0].entityId);
  assert.equal(first.meta.totalEntities, second.meta.totalEntities);
  assert.equal(first.meta.hasMore, true);
  assert.equal(first.meta.limit, 2);
  assert.equal(second.meta.offset, 2);
});

test("entity catalog rejects unbounded or malformed paging parameters", () => {
  const controller = new EntitiesController({ listEntities: () => assert.fail("Invalid query") });
  for (const query of [{ limit: "101" }, { offset: "-1" }, { limit: "1.5" }]) {
    assert.throws(
      () => controller.listEntities(query),
      (error) => error.getStatus() === 400,
    );
  }
});
