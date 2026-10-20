import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { createBackup, restoreBackup } from "../scripts/backup.mjs";

test("encrypted backups include live WAL data and restore only to new files", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "ohana-backup-test-"));
  const source = path.join(temp, "live.db"), encrypted = path.join(temp, "backup.enc"), restored = path.join(temp, "restored.db");
  const key = randomBytes(32).toString("hex");
  const db = new DatabaseSync(source);
  try {
    db.exec("PRAGMA journal_mode=WAL; CREATE TABLE visits (name TEXT); INSERT INTO visits VALUES ('Private Customer');");
    await createBackup(source, encrypted, key);
    assert.ok(!(await readFile(encrypted)).includes(Buffer.from("Private Customer")));
    db.exec("INSERT INTO visits VALUES ('Later visit');");
    await restoreBackup(encrypted, restored, key);
    const copy = new DatabaseSync(restored, { readOnly: true });
    try { assert.equal(copy.prepare("SELECT COUNT(*) AS total FROM visits").get().total, 1); }
    finally { copy.close(); }
    await assert.rejects(restoreBackup(encrypted, source, key), /exist|EEXIST/);
    assert.equal(db.prepare("SELECT COUNT(*) AS total FROM visits").get().total, 2);
    await assert.rejects(createBackup(source, encrypted, key), /exist|EEXIST/);
    await assert.rejects(restoreBackup(encrypted, path.join(temp, "wrong-key.db"), randomBytes(32).toString("hex")));
    const tampered = await readFile(encrypted);
    tampered[30] ^= 1;
    const bad = path.join(temp, "tampered.enc");
    await writeFile(bad, tampered);
    await assert.rejects(restoreBackup(bad, path.join(temp, "tampered.db"), key));
    await assert.rejects(createBackup(path.join(temp, "missing.db"), path.join(temp, "empty.enc"), key));
  } finally { db.close(); await rm(temp, { recursive: true, force: true, maxRetries: 5 }); }
});
