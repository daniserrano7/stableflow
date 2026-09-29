import assert from "node:assert/strict";
import { test } from "node:test";
import { baseAddressLabels } from "@stableflow/indexer/base-address-labels";
import { parseTransferId, parseTransferListParams } from "@stableflow/shared";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { TransfersController } from "../dist/transfers/transfers.controller.js";
import { TransfersService } from "../dist/transfers/transfers.service.js";

test("transfer list parameters reject malformed filters and cursors before querying", () => {
  assert.deepEqual(parseTransferListParams(new URLSearchParams()), {
    filter: "all",
    cursor: null,
    direction: "older",
  });
  assert.equal(parseTransferListParams(new URLSearchParams("limit=10")).limit, 10);
  for (const query of [
    "filter=small",
    "cursor=-1:0",
    "cursor=1:1.5",
    "cursor=1:2147483648",
    "cursor=99999999999999999999:0",
    "direction=newer",
    "direction=sideways",
    "cursor=",
    "limit=0",
    "limit=51",
    "limit=1.5",
  ]) {
    assert.throws(() => parseTransferListParams(new URLSearchParams(query)), undefined, query);
  }
  const controller = new TransfersController({
    listTransfers() {
      assert.fail("Invalid request reached the database");
    },
  });
  assert.throws(
    () => controller.listTransfers("invalid"),
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
      await insert(`transfer-${log}`, 100, log, 1_000_000_000_000n);
    await insert("below-large", 101, 0, 9_999_999_999n);
    await insert("exact-large", 101, 1, 10_000_000_000n);
    await insert("below-whale", 101, 2, 999_999_999_999n);
    const service = new TransfersService({ db: drizzle(client) });
    const get = (query = "") =>
      service.listTransfers(parseTransferListParams(new URLSearchParams(query)));
    const first = await get("filter=whale");
    assert.equal(first.data.length, 50);
    assert.equal(first.data[0].id, "transfer-114");
    assert.equal(first.meta.newerCursor, null);
    assert.equal(first.meta.olderCursor, "100:65");
    assert.equal(first.data[0].from.entityId, from.entityId);
    const smallPage = await get("filter=whale&limit=5");
    assert.equal(smallPage.data.length, 5);
    assert.equal(smallPage.meta.limit, 5);
    assert.equal(
      (await get(`filter=whale&limit=5&cursor=${smallPage.meta.olderCursor}`)).data[0].id,
      "transfer-109",
    );
    const second = await get(`filter=whale&cursor=${first.meta.olderCursor}`);
    assert.equal(second.data[0].id, "transfer-64");
    assert.equal(second.data.at(-1).id, "transfer-15");
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

test("transfer IDs normalize case and reject malformed values before querying", async () => {
  const hash = `0x${"Ab".repeat(32)}`;
  assert.deepEqual(parseTransferId(`${hash}-7`), {
    id: `${hash.toLowerCase()}-7`,
    logIndex: 7,
    transactionHash: hash.toLowerCase(),
  });
  assert.equal(parseTransferId(`${hash}-007`)?.id, `${hash.toLowerCase()}-7`);
  for (const value of [
    "",
    "recent",
    `${hash}`,
    `${hash}-`,
    `${hash}--1`,
    `${hash}-2147483648`,
    `0x12-1`,
  ]) {
    assert.equal(parseTransferId(value), null, value);
  }
  const controller = new TransfersController({
    getTransfer() {
      return null;
    },
  });
  await assert.rejects(
    () => controller.getTransfer("not-a-transfer"),
    (error) => error.getStatus() === 400,
  );
  await assert.rejects(
    () => controller.getTransfer(`${hash}-1`),
    (error) => error.getStatus() === 404,
  );
});

test("transfer detail returns its transaction's transfers and adjusted value", {
  skip: !process.env.TEST_DATABASE_URL,
}, async () => {
  const client = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
  await client.connect();
  try {
    await client.query(`CREATE TEMP TABLE usdc_transfers (
      id text PRIMARY KEY, chain_id integer, block_number bigint, block_timestamp bigint,
      transaction_hash text, log_index integer, from_address text, to_address text, value numeric(78,0)
    )`);
    const [sender, router, receiver] = baseAddressLabels.map((label) => label.address);
    const hash = `0x${"b".repeat(64)}`;
    const other = `0x${"c".repeat(64)}`;
    // sender → router → receiver: two transfers, but only 1 USDC changes owner.
    for (const [txHash, log, from, to] of [
      [hash, 3, router, receiver],
      [hash, 1, sender, router],
      [other, 2, sender, receiver],
    ]) {
      await client.query(
        `INSERT INTO usdc_transfers VALUES ($1,8453,200,1770000000,$2,$3,$4,$5,1000000)`,
        [`${txHash}-${log}`, txHash, log, from, to],
      );
    }
    const service = new TransfersService({ db: drizzle(client) });
    const detail = await service.getTransfer(parseTransferId(`${hash}-3`));
    assert.equal(detail.data.transfer.id, `${hash}-3`);
    assert.deepEqual(
      detail.data.transaction.transfers.map((row) => row.id),
      [`${hash}-1`, `${hash}-3`],
    );
    assert.equal(detail.data.transaction.hash, hash);
    assert.equal(detail.data.transaction.transferCount, 2);
    assert.equal(detail.data.transaction.adjustedValue.raw, "1000000");
    assert.equal(await service.getTransfer(parseTransferId(`${hash}-9`)), null);
  } finally {
    await client.end();
  }
});
