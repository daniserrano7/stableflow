import assert from "node:assert/strict";
import test from "node:test";
import { describeError } from "../src/utils/describe-error.js";

test("connection errors keep their cause when the message is empty", () => {
  const timeout = Object.assign(new Error("connect ETIMEDOUT 10.0.0.1:5432"), {
    code: "ETIMEDOUT",
  });
  const refused = Object.assign(new Error(""), { code: "ECONNREFUSED" });

  assert.equal(
    describeError(new AggregateError([timeout, refused], "")),
    "ETIMEDOUT: connect ETIMEDOUT 10.0.0.1:5432; ECONNREFUSED",
  );
  assert.equal(describeError(new Error("")), "Error");
  assert.equal(describeError("plain"), "plain");
});
