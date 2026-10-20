import assert from "node:assert/strict";
import test from "node:test";
import type { ReadOnlyDb } from "./db.js";
import { getOverallStatus } from "./reporting.js";
import { buildReconcileReport } from "./reports.js";

const createFakeDb = (): ReadOnlyDb => ({
  close: async () => {},
  query: async <Row>(text: string): Promise<Row[]> => {
    if (text.includes("total_indexed_transfers")) {
      return [
        {
          latest_block: "100",
          latest_timestamp: "1200",
          total_indexed_transfers: "5",
        },
      ] as Row[];
    }

    if (text.includes("from usdc_transfers")) {
      return [
        {
          max_block: "100",
          min_block: "96",
          total_value: "10000000",
          transfer_count: "5",
        },
      ] as Row[];
    }

    if (text.includes("from usdc_transfer_volume_buckets")) {
      return [
        {
          row_count: "2",
          total_value: "10000000",
          transfer_count: "5",
        },
      ] as Row[];
    }

    if (text.includes("from usdc_entity_flow_buckets")) {
      return [
        {
          total_value: "20000000",
          transfer_count: "10",
          unidentified_value: "10000000",
        },
      ] as Row[];
    }

    if (text.includes("from usdc_entity_pair_flow_buckets")) {
      return [
        {
          total_value: "10000000",
          transfer_count: "5",
        },
      ] as Row[];
    }

    if (text.includes("from usdc_bridge_flow_buckets")) {
      return [
        {
          bridge_remote_id: "1",
          bridge_remote_namespace: "across-chain-id",
          bridge_id: "across",
          bridge_name: "Across",
          direction: "inbound",
          event_count: "1",
          remote_chain_id: "1",
          remote_domain: null,
          remote_network_ecosystem: "evm",
          remote_network_id: "ethereum",
          remote_network_name: "Ethereum",
          total_value: "1000000",
        },
      ] as Row[];
    }

    throw new Error(`Unexpected query: ${text}`);
  },
});

test("buildReconcileReport passes coherent raw and derived metrics", async () => {
  const report = await buildReconcileReport(createFakeDb(), {
    json: false,
    limit: 10,
    minutes: 10,
  });

  assert.ok(!("message" in report));
  assert.equal(getOverallStatus(report.checks), "PASS");
  assert.equal(report.rawTransfers.transferCount, 5n);
  assert.equal(report.volumeBuckets.transferCount, 5n);
  assert.equal(report.entityFlowMetrics.transferCount, 10n);
  assert.equal(report.entityPairFlowMetrics.transferCount, 5n);
});
