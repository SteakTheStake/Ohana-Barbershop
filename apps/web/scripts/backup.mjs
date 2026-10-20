import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { constants, copyFile, mkdtemp, open, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync, backup } from "node:sqlite";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const MAGIC = Buffer.from("OHANABK1");
const HEADER_BYTES = MAGIC.length + 12;

function encryptionKey(hex) {
  if (!/^[0-9a-f]{64}$/i.test(hex ?? "")) throw new Error("BACKUP_KEY must be 32 random bytes encoded as 64 hex characters.");
  return Buffer.from(hex, "hex");
}

export function checkDatabase(filename) {
  const db = new DatabaseSync(filename, { readOnly: true });
  try {
    const rows = db.prepare("PRAGMA integrity_check").all();
    if (rows.length !== 1 || Object.values(rows[0])[0] !== "ok") throw new Error("Backup integrity check failed.");
    if (db.prepare("PRAGMA foreign_key_check").all().length) throw new Error("Backup has broken references.");
  } finally { db.close(); }
}

export async function createBackup(source, destination, hexKey) {
  const key = encryptionKey(hexKey);
  await stat(source); // Never create an empty source database after a path typo.
  const temp = await mkdtemp(path.join(os.tmpdir(), "ohana-backup-"));
  try {
    const snapshot = path.join(temp, "snapshot.db");
    const db = new DatabaseSync(source, { readOnly: true });
    try { await backup(db, snapshot); } finally { db.close(); }
    checkDatabase(snapshot);
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    cipher.setAAD(MAGIC);
    const encrypted = path.join(temp, "encrypted");
    await writeFile(encrypted, Buffer.concat([MAGIC, iv]), { mode: 0o600 });
    await pipeline(createReadStream(snapshot), cipher, createWriteStream(encrypted, { flags: "a", mode: 0o600 }));
    const file = await open(encrypted, "a");
    try { await file.write(cipher.getAuthTag()); await file.sync(); } finally { await file.close(); }
    // Exclusive copy: existing backups are never overwritten.
    await copyFile(encrypted, destination, constants.COPYFILE_EXCL);
    return { createdAt: new Date().toISOString(), bytes: (await stat(destination)).size };
  } finally { await rm(temp, { recursive: true, force: true }); }
}

export async function restoreBackup(source, destination, hexKey) {
  const key = encryptionKey(hexKey);
  const size = (await stat(source)).size;
  if (size <= HEADER_BYTES + 16) throw new Error("Invalid backup.");
  const input = await open(source, "r");
  const header = Buffer.alloc(HEADER_BYTES), tag = Buffer.alloc(16);
  try {
    await input.read(header, 0, header.length, 0);
    await input.read(tag, 0, tag.length, size - 16);
  } finally { await input.close(); }
  if (!header.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error("Unknown backup format.");
  const temp = await mkdtemp(path.join(os.tmpdir(), "ohana-restore-"));
  try {
    const snapshot = path.join(temp, "restored.db");
    const decipher = createDecipheriv("aes-256-gcm", key, header.subarray(MAGIC.length));
    decipher.setAAD(MAGIC);
    decipher.setAuthTag(tag);
    await pipeline(createReadStream(source, { start: HEADER_BYTES, end: size - 17 }),
      decipher, createWriteStream(snapshot, { flags: "wx", mode: 0o600 }));
    checkDatabase(snapshot);
    await copyFile(snapshot, destination, constants.COPYFILE_EXCL);
  } finally { await rm(temp, { recursive: true, force: true }); }
}

async function main() {
  const [command, source, destination] = process.argv.slice(2);
  if (command === "create") {
    if (!source || !destination) throw new Error("Usage: backup.mjs create <database.db> <new-backup.enc>");
    const result = await createBackup(source, destination, process.env.BACKUP_KEY);
    // Written only after a verified, encrypted backup succeeds.
    await writeFile(`${destination}.json`, JSON.stringify(result), { flag: "wx", mode: 0o600 });
    console.log("Verified encrypted backup created. Copy it off-host and monitor this command's exit status.");
  } else if (command === "restore") {
    if (!source || !destination) throw new Error("Usage: backup.mjs restore <backup.enc> <NEW-database.db>");
    await restoreBackup(source, destination, process.env.BACKUP_KEY);
    console.log("Backup authenticated, restored to a new file, and integrity checked. Live database unchanged.");
  } else if (command === "verify") {
    const metadata = JSON.parse(await readFile(`${source}.json`, "utf8"));
    const age = Date.now() - Date.parse(metadata.createdAt);
    if (!Number.isFinite(age) || age < 0 || age > 24 * 3600_000) throw new Error("Backup is missing or over 24 hours old.");
    const temp = await mkdtemp(path.join(os.tmpdir(), "ohana-drill-"));
    try { await restoreBackup(source, path.join(temp, "drill.db"), process.env.BACKUP_KEY); }
    finally { await rm(temp, { recursive: true, force: true }); }
    console.log("Recent backup passed an authenticated restore drill.");
  } else throw new Error("Choose create, restore, or verify.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => { console.error("Backup operation failed. Check paths, permissions, key and disk space. No live database was replaced."); process.exitCode = 1; });
}
