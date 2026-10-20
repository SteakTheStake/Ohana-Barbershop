import assert from "node:assert/strict";
import { test } from "node:test";
import type { PayloadRequest } from "payload";
import { afterCommit, finishTransaction } from "./transaction-effects";

const tick = () => new Promise((resolve) => setImmediate(resolve));

test("external work runs only after a successful commit and is deduplicated within a transaction", async () => {
  const req = { transactionID: "commit-test" } as PayloadRequest;
  let calls = 0;
  await afterCommit(req, "calendar", async () => { calls++; });
  await afterCommit(req, "calendar", async () => { calls++; });
  await tick();
  assert.equal(calls, 0);
  finishTransaction("commit-test", true);
  await tick();
  assert.equal(calls, 1);
  finishTransaction("commit-test", true);
  await tick();
  assert.equal(calls, 1);
});

test("rollback discards external work and transactions cannot leak callbacks into a later save", async () => {
  let calls = 0;
  await afterCommit({ transactionID: "rollback-test" } as PayloadRequest, "calendar", async () => { calls++; });
  finishTransaction("rollback-test", false);
  finishTransaction("rollback-test", true);
  await tick();
  assert.equal(calls, 0);
  await assert.rejects(afterCommit({} as PayloadRequest, "calendar", async () => {}), /requires a database transaction/);
});
