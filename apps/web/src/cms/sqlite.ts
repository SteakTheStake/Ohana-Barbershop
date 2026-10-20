import { sqliteAdapter } from "@payloadcms/db-sqlite";
import { finishTransaction } from "../lib/transaction-effects";

export function ohanaSQLite(args: Parameters<typeof sqliteAdapter>[0]): ReturnType<typeof sqliteAdapter> {
  const base = sqliteAdapter(args);
  return {
    ...base,
    init(options) {
      const db = base.init(options);
      const begin = db.beginTransaction.bind(db);
      const commit = db.commitTransaction.bind(db);
      const rollback = db.rollbackTransaction.bind(db);
      let tail = Promise.resolve();
      const releases = new Map<string | number, () => void>();

      // SQLite has one writer. Queue transactions rather than blocking Node's
      // event loop on SQLITE_BUSY. Database uniqueness remains the safety net.
      db.beginTransaction = async (...parameters) => {
        const previous = tail;
        let release!: () => void;
        tail = new Promise<void>((resolve) => { release = resolve; });
        await previous;
        try {
          const id = await begin(...parameters);
          if (id === null) release();
          else releases.set(id, release);
          return id;
        } catch (error) { release(); throw error; }
      };
      const unlock = async (id: Parameters<typeof commit>[0]) => {
        const key = await id;
        if (key == null) return;
        releases.get(key)?.();
        releases.delete(key);
      };
      db.commitTransaction = async (id) => {
        const key = await id;
        try {
          await commit(id);
          if (key != null) finishTransaction(key, true);
        } catch (error) {
          if (key != null) finishTransaction(key, false);
          throw error;
        } finally { await unlock(id); }
      };
      db.rollbackTransaction = async (id) => {
        const key = await id;
        try { await rollback(id); }
        finally {
          if (key != null) finishTransaction(key, false);
          await unlock(id);
        }
      };
      return db;
    },
  };
}
