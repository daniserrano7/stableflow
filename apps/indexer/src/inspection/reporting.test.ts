import assert from "node:assert/strict";
import test from "node:test";
import { formatPercent, formatUsdc, getOverallStatus } from "./reporting.js";

test("formatUsdc formats six-decimal token units", () => {
  assert.equal(formatUsdc(1_234_567n), "1.234567 USDC");
});

test("formatPercent handles empty and non-empty totals", () => {
  assert.equal(formatPercent(0n, 0n), "0.00%");
  assert.equal(formatPercent(25n, 100n), "25.00%");
  assert.equal(formatPercent(1n, 3n), "33.33%");
});

test("getOverallStatus prioritizes failures, then warnings", () => {
  assert.equal(getOverallStatus([{ details: "", name: "a", status: "PASS" }]), "PASS");
  assert.equal(getOverallStatus([{ details: "", name: "a", status: "WARN" }]), "WARN");
  assert.equal(
    getOverallStatus([
      { details: "", name: "a", status: "WARN" },
      { details: "", name: "b", status: "FAIL" },
    ]),
    "FAIL",
  );
});
