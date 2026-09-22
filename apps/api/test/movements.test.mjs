import assert from "node:assert/strict";
import { test } from "node:test";
import { baseAddressLabels } from "@stableflow/indexer/base-address-labels";
import { parseMovementParams } from "@stableflow/shared";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { TransfersController } from "../dist/transfers/transfers.controller.js";
import { TransfersService } from "../dist/transfers/transfers.service.js";

test("movement parameters reject malformed filters and cursors before querying", () => {
  assert.deepEqual(parseMovementParams(new URLSearchParams()), {
    filter: "all",
    cursor: null,
    direction: "older",
  });
  for (const query of [
    "filter=small",
    "cursor=-1:0",
    "cursor=1:1.5",
    "cursor=1:2147483648",
    "cursor=99999999999999999999:0",
    "direction=newer",
    "direction=sideways",
    "cursor=",
  ]) {
    assert.throws(() => parseMovementParams(new URLSearchParams(query)), undefined, query);
  }
  const controller = new TransfersController({
    listMovements() {
      assert.fail("Invalid request reached the database");
    },
  });
  assert.throws(
    () => controller.listMovements("invalid"),
    (error) => error.getStatus() === 400,
  );
});

test("database pagination preserves same-block events, exact thresholds, and pages during new inserts", {
  skip: !process.env.TEST_DATABASE_URL,
}, async () => {
  const client = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
  await client.connect();
  try {
    // Connection-local tables keep this test isolated from persistent indexer data.
    await client.query(`CREATE TEMP TABLE usdc_transfers (
      id text PRIMARY KEY, chain_id integer, block_number bigint, block_timestamp bigint,
      transaction_hash text, log_index integer, from_address text, to_address text, value numeric(78,0)
    )`);
    const [from, to] = baseAddressLabels;
    const insert = async (id, block, log, value) =>
      client.query(`INSERT INTO usdc_transfers VALUES ($1,8453,$2,1770000000,$3,$4,$5,$6,$7)`, [
        id,
        block,
        `0x${"a".repeat(64)}`,
        log,
        from.address,
        to.address,
        value.toString(),
      ]);
    for (let log = 0; log < 115; log++)
      await insert(`movement-${log}`, 100, log, 1_000_000_000_000n);
    await insert("below-large", 101, 0, 9_999_999_999n);
    await insert("exact-large", 101, 1, 10_000_000_000n);
    await insert("below-whale", 101, 2, 999_999_999_999n);
    const service = new TransfersService({ db: drizzle(client) });
    const get = (query = "") =>
      service.listMovements(parseMovementParams(new URLSearchParams(query)));
    const first = await get("filter=whale");
    assert.equal(first.data.length, 50);
    assert.equal(first.data[0].id, "movement-114");
    assert.equal(first.meta.newerCursor, null);
    assert.equal(first.meta.olderCursor, "100:65");
    assert.equal(first.data[0].from.entityId, from.entityId);
    const second = await get(`filter=whale&cursor=${first.meta.olderCursor}`);
    assert.equal(second.data[0].id, "movement-64");
    assert.equal(second.data.at(-1).id, "movement-15");
    await insert("new-arrival", 102, 0, 1_000_000_000_000n);
    const secondAgain = await get(`filter=whale&cursor=${first.meta.olderCursor}`);
    assert.deepEqual(secondAgain.data, second.data);
    const back = await get(`filter=whale&direction=newer&cursor=${second.meta.newerCursor}`);
    assert.deepEqual(back.data, first.data);
    const last = await get(`filter=whale&cursor=${second.meta.olderCursor}`);
    assert.equal(last.data.length, 15);
    assert.equal(last.meta.olderCursor, null);
    assert.equal(
      new Set([...first.data, ...second.data, ...last.data].map((row) => row.id)).size,
      115,
    );
    const large = await get("filter=large");
    assert.ok(large.data.some((row) => row.id === "exact-large"));
    assert.ok(large.data.some((row) => row.id === "below-whale"));
    assert.ok(!large.data.some((row) => row.id === "below-large"));
    assert.ok((await get()).data.some((row) => row.id === "below-large"));
    const empty = await get("filter=whale&cursor=0:0");
    assert.equal(empty.data.length, 0);
    assert.equal(empty.meta.olderCursor, null);
    assert.equal(empty.meta.newerCursor, null);
  } finally {
    await client.end();
  }
});
