import assert from "node:assert/strict";
import test from "node:test";
import { parseInspectionArgs } from "./args.js";

test("parseInspectionArgs returns defaults", () => {
  assert.deepEqual(parseInspectionArgs([]), {
    json: false,
    limit: 10,
    minutes: 60,
  });
});

test("parseInspectionArgs parses supported flags", () => {
  assert.deepEqual(
    parseInspectionArgs([
      "--minutes",
      "15",
      "--limit",
      "5",
      "--json",
      "--address",
      "0x1234",
      "--reason",
      "wrong entity",
    ]),
    {
      address: "0x1234",
      json: true,
      limit: 5,
      minutes: 15,
      reason: "wrong entity",
    },
  );
});

test("parseInspectionArgs tolerates a pnpm argument separator", () => {
  assert.deepEqual(parseInspectionArgs(["--", "--minutes", "15"]), {
    json: false,
    limit: 10,
    minutes: 15,
  });
});

test("parseInspectionArgs rejects invalid positive integers", () => {
  assert.throws(() => parseInspectionArgs(["--minutes", "0"]), /positive integer/);
  assert.throws(() => parseInspectionArgs(["--limit", "1.5"]), /positive integer/);
});
