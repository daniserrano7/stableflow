import assert from "node:assert/strict";
import { test } from "node:test";
import { FlowsController } from "../dist/flows/flows.controller.js";
import { FlowsService } from "../dist/flows/flows.service.js";

const aggregateRows = [
  {
    category: "unidentified",
    entityId: "unidentified",
    entityName: "Unidentified",
    inflowTransferCount: "4",
    inflowValue: "1000000000",
    outflowTransferCount: "4",
    outflowValue: "1000000000",
  },
  {
    category: "exchange",
    entityId: "busy-exchange",
    entityName: "Busy Exchange",
    inflowTransferCount: "3",
    inflowValue: "800000000",
    outflowTransferCount: "2",
    outflowValue: "700000000",
  },
  {
    category: "protocol",
    entityId: "net-receiver",
    entityName: "Net Receiver",
    inflowTransferCount: "1",
    inflowValue: "500000000",
    outflowTransferCount: "0",
    outflowValue: "0",
  },
];

function fakeDb() {
  let selectCount = 0;
  return {
    select() {
      selectCount++;
      const current = selectCount;
      return {
        from() {
          return {
            where() {
              if (current === 1) return [{ bucketStart: "1800000000" }];
              return { groupBy: () => aggregateRows };
            },
          };
        },
      };
    },
  };
}

test("gross ranks both directions while reporting signed net and excluding unidentified", async () => {
  const service = new FlowsService({ db: fakeDb() });
  const result = await service.listTopEntityFlows({
    mode: "gross",
    includeUnidentified: false,
    windowMinutes: 1440,
  });

  assert.deepEqual(
    result.data.map((row) => row.entityId),
    ["busy-exchange", "net-receiver"],
  );
  assert.equal(result.data[0].selected.raw, "1500000000");
  assert.equal(result.data[0].net.raw, "100000000");
  assert.equal(result.data[0].selectedTransferCount, 5);
  assert.equal(result.meta.includeUnidentified, false);
  assert.equal(result.meta.mode, "gross");
  const withUnidentified = await new FlowsService({ db: fakeDb() }).listTopEntityFlows({
    mode: "gross",
    includeUnidentified: true,
  });
  assert.equal(withUnidentified.data[0].entityId, "unidentified");
});

test("API validates gross mode and unidentified flag before querying", () => {
  let received;
  const controller = new FlowsController({
    listTopEntityFlows(options) {
      received = options;
      return options;
    },
  });
  controller.listTopEntityFlows({ mode: "gross", includeUnidentified: "false" });
  assert.equal(received.mode, "gross");
  assert.equal(received.includeUnidentified, false);
  assert.throws(
    () => controller.listTopEntityFlows({ includeUnidentified: "no" }),
    (error) => error.getStatus() === 400,
  );
});
