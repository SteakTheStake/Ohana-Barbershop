import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`save_receipts\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`key\` text NOT NULL,
  	\`fingerprint\` text NOT NULL,
  	\`result\` text NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`save_receipts_key_idx\` ON \`save_receipts\` (\`key\`);`)
  await db.run(sql`CREATE INDEX \`save_receipts_updated_at_idx\` ON \`save_receipts\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`save_receipts_created_at_idx\` ON \`save_receipts\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`appointment_history\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`appointment_id\` numeric NOT NULL,
  	\`action\` text NOT NULL,
  	\`actor\` text NOT NULL,
  	\`before\` text,
  	\`after\` text NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`appointment_history_appointment_id_idx\` ON \`appointment_history\` (\`appointment_id\`);`)
  await db.run(sql`CREATE INDEX \`appointment_history_updated_at_idx\` ON \`appointment_history\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`appointment_history_created_at_idx\` ON \`appointment_history\` (\`created_at\`);`)
  await db.run(sql`ALTER TABLE \`appointments\` ADD \`revision\` numeric DEFAULT 1 NOT NULL;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`save_receipts\`;`)
  await db.run(sql`DROP TABLE \`appointment_history\`;`)
  await db.run(sql`ALTER TABLE \`appointments\` DROP COLUMN \`revision\`;`)
}
