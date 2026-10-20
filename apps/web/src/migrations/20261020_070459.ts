import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`users_sessions\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`created_at\` text,
  	\`expires_at\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`users_sessions_order_idx\` ON \`users_sessions\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`users_sessions_parent_id_idx\` ON \`users_sessions\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`users\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`name\` text NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`email\` text NOT NULL,
  	\`reset_password_token\` text,
  	\`reset_password_expiration\` text,
  	\`salt\` text,
  	\`hash\` text,
  	\`reset_password_requested_at\` text,
  	\`login_attempts\` numeric DEFAULT 0,
  	\`lock_until\` text
  );
  `)
  await db.run(sql`CREATE INDEX \`users_updated_at_idx\` ON \`users\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`users_created_at_idx\` ON \`users\` (\`created_at\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`users_email_idx\` ON \`users\` (\`email\`);`)
  await db.run(sql`CREATE TABLE \`services\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`name\` text NOT NULL,
  	\`slug\` text NOT NULL,
  	\`description\` text,
  	\`price_cents\` numeric NOT NULL,
  	\`duration_minutes\` numeric NOT NULL,
  	\`buffer_minutes\` numeric DEFAULT 0 NOT NULL,
  	\`active\` integer DEFAULT true NOT NULL,
  	\`sort_order\` numeric DEFAULT 0,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`services_slug_idx\` ON \`services\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`services_updated_at_idx\` ON \`services\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`services_created_at_idx\` ON \`services\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`customers\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`name\` text NOT NULL,
  	\`phone\` text NOT NULL,
  	\`preferences\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`customers_phone_idx\` ON \`customers\` (\`phone\`);`)
  await db.run(sql`CREATE INDEX \`customers_updated_at_idx\` ON \`customers\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`customers_created_at_idx\` ON \`customers\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`appointments\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`customer_id\` integer NOT NULL,
  	\`service_id\` integer NOT NULL,
  	\`starts_at\` text NOT NULL,
  	\`ends_at\` text NOT NULL,
  	\`blocked_until\` text NOT NULL,
  	\`service_name\` text NOT NULL,
  	\`price_cents\` numeric NOT NULL,
  	\`status\` text DEFAULT 'confirmed' NOT NULL,
  	\`notes\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`customer_id\`) REFERENCES \`customers\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`service_id\`) REFERENCES \`services\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`appointments_customer_idx\` ON \`appointments\` (\`customer_id\`);`)
  await db.run(sql`CREATE INDEX \`appointments_service_idx\` ON \`appointments\` (\`service_id\`);`)
  await db.run(sql`CREATE INDEX \`appointments_starts_at_idx\` ON \`appointments\` (\`starts_at\`);`)
  await db.run(sql`CREATE INDEX \`appointments_blocked_until_idx\` ON \`appointments\` (\`blocked_until\`);`)
  await db.run(sql`CREATE INDEX \`appointments_updated_at_idx\` ON \`appointments\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`appointments_created_at_idx\` ON \`appointments\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`time_off\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`reason\` text NOT NULL,
  	\`starts_at\` text NOT NULL,
  	\`ends_at\` text NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`time_off_updated_at_idx\` ON \`time_off\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`time_off_created_at_idx\` ON \`time_off\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`occupancy\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`key\` text NOT NULL,
  	\`appointment_id\` integer,
  	\`time_off_id\` integer,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`appointment_id\`) REFERENCES \`appointments\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`time_off_id\`) REFERENCES \`time_off\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`occupancy_key_idx\` ON \`occupancy\` (\`key\`);`)
  await db.run(sql`CREATE INDEX \`occupancy_appointment_idx\` ON \`occupancy\` (\`appointment_id\`);`)
  await db.run(sql`CREATE INDEX \`occupancy_time_off_idx\` ON \`occupancy\` (\`time_off_id\`);`)
  await db.run(sql`CREATE INDEX \`occupancy_updated_at_idx\` ON \`occupancy\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`occupancy_created_at_idx\` ON \`occupancy\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`phone_challenges\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`phone\` text NOT NULL,
  	\`code_hash\` text,
  	\`provider_id\` text,
  	\`expires_at\` text NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`phone_challenges_expires_at_idx\` ON \`phone_challenges\` (\`expires_at\`);`)
  await db.run(sql`CREATE INDEX \`phone_challenges_updated_at_idx\` ON \`phone_challenges\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`phone_challenges_created_at_idx\` ON \`phone_challenges\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`used_challenges\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`key\` text NOT NULL,
  	\`expires_at\` text NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`used_challenges_key_idx\` ON \`used_challenges\` (\`key\`);`)
  await db.run(sql`CREATE INDEX \`used_challenges_expires_at_idx\` ON \`used_challenges\` (\`expires_at\`);`)
  await db.run(sql`CREATE INDEX \`used_challenges_updated_at_idx\` ON \`used_challenges\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`used_challenges_created_at_idx\` ON \`used_challenges\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`customer_sessions\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`token_hash\` text NOT NULL,
  	\`customer_id\` integer NOT NULL,
  	\`expires_at\` text NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`customer_id\`) REFERENCES \`customers\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`customer_sessions_token_hash_idx\` ON \`customer_sessions\` (\`token_hash\`);`)
  await db.run(sql`CREATE INDEX \`customer_sessions_customer_idx\` ON \`customer_sessions\` (\`customer_id\`);`)
  await db.run(sql`CREATE INDEX \`customer_sessions_expires_at_idx\` ON \`customer_sessions\` (\`expires_at\`);`)
  await db.run(sql`CREATE INDEX \`customer_sessions_updated_at_idx\` ON \`customer_sessions\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`customer_sessions_created_at_idx\` ON \`customer_sessions\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`rate_limits\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`key\` text NOT NULL,
  	\`expires_at\` text NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`rate_limits_key_idx\` ON \`rate_limits\` (\`key\`);`)
  await db.run(sql`CREATE INDEX \`rate_limits_expires_at_idx\` ON \`rate_limits\` (\`expires_at\`);`)
  await db.run(sql`CREATE INDEX \`rate_limits_updated_at_idx\` ON \`rate_limits\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`rate_limits_created_at_idx\` ON \`rate_limits\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`payload_kv\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`key\` text NOT NULL,
  	\`data\` text NOT NULL
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`payload_kv_key_idx\` ON \`payload_kv\` (\`key\`);`)
  await db.run(sql`CREATE TABLE \`payload_locked_documents\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`global_slug\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_global_slug_idx\` ON \`payload_locked_documents\` (\`global_slug\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_updated_at_idx\` ON \`payload_locked_documents\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_created_at_idx\` ON \`payload_locked_documents\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`payload_locked_documents_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`users_id\` integer,
  	\`services_id\` integer,
  	\`customers_id\` integer,
  	\`appointments_id\` integer,
  	\`time_off_id\` integer,
  	\`occupancy_id\` integer,
  	\`phone_challenges_id\` integer,
  	\`used_challenges_id\` integer,
  	\`customer_sessions_id\` integer,
  	\`rate_limits_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_locked_documents\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`services_id\`) REFERENCES \`services\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`customers_id\`) REFERENCES \`customers\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`appointments_id\`) REFERENCES \`appointments\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`time_off_id\`) REFERENCES \`time_off\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`occupancy_id\`) REFERENCES \`occupancy\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`phone_challenges_id\`) REFERENCES \`phone_challenges\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`used_challenges_id\`) REFERENCES \`used_challenges\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`customer_sessions_id\`) REFERENCES \`customer_sessions\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`rate_limits_id\`) REFERENCES \`rate_limits\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_order_idx\` ON \`payload_locked_documents_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_parent_idx\` ON \`payload_locked_documents_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_path_idx\` ON \`payload_locked_documents_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_users_id_idx\` ON \`payload_locked_documents_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_services_id_idx\` ON \`payload_locked_documents_rels\` (\`services_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_customers_id_idx\` ON \`payload_locked_documents_rels\` (\`customers_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_appointments_id_idx\` ON \`payload_locked_documents_rels\` (\`appointments_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_time_off_id_idx\` ON \`payload_locked_documents_rels\` (\`time_off_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_occupancy_id_idx\` ON \`payload_locked_documents_rels\` (\`occupancy_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_phone_challenges_id_idx\` ON \`payload_locked_documents_rels\` (\`phone_challenges_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_used_challenges_id_idx\` ON \`payload_locked_documents_rels\` (\`used_challenges_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_customer_sessions_id_idx\` ON \`payload_locked_documents_rels\` (\`customer_sessions_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_rate_limits_id_idx\` ON \`payload_locked_documents_rels\` (\`rate_limits_id\`);`)
  await db.run(sql`CREATE TABLE \`payload_preferences\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`key\` text,
  	\`value\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_preferences_key_idx\` ON \`payload_preferences\` (\`key\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_updated_at_idx\` ON \`payload_preferences\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_created_at_idx\` ON \`payload_preferences\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`payload_preferences_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`users_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_preferences\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_order_idx\` ON \`payload_preferences_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_parent_idx\` ON \`payload_preferences_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_path_idx\` ON \`payload_preferences_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_users_id_idx\` ON \`payload_preferences_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE TABLE \`payload_migrations\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`name\` text,
  	\`batch\` numeric,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_migrations_updated_at_idx\` ON \`payload_migrations\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`payload_migrations_created_at_idx\` ON \`payload_migrations\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`shop_settings_weekly_hours\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`weekday\` text NOT NULL,
  	\`closed\` integer DEFAULT true,
  	\`opens\` text DEFAULT '09:00' NOT NULL,
  	\`closes\` text DEFAULT '17:00' NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`shop_settings\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`shop_settings_weekly_hours_order_idx\` ON \`shop_settings_weekly_hours\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`shop_settings_weekly_hours_parent_id_idx\` ON \`shop_settings_weekly_hours\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`shop_settings\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`booking_enabled\` integer DEFAULT false NOT NULL,
  	\`announcement\` text DEFAULT 'Aloha! Call or text us while we get online booking ready.',
  	\`lead_minutes\` numeric DEFAULT 60 NOT NULL,
  	\`booking_days\` numeric DEFAULT 30 NOT NULL,
  	\`cancellation_hours\` numeric DEFAULT 24 NOT NULL,
  	\`updated_at\` text,
  	\`created_at\` text
  );
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`users_sessions\`;`)
  await db.run(sql`DROP TABLE \`users\`;`)
  await db.run(sql`DROP TABLE \`services\`;`)
  await db.run(sql`DROP TABLE \`customers\`;`)
  await db.run(sql`DROP TABLE \`appointments\`;`)
  await db.run(sql`DROP TABLE \`time_off\`;`)
  await db.run(sql`DROP TABLE \`occupancy\`;`)
  await db.run(sql`DROP TABLE \`phone_challenges\`;`)
  await db.run(sql`DROP TABLE \`used_challenges\`;`)
  await db.run(sql`DROP TABLE \`customer_sessions\`;`)
  await db.run(sql`DROP TABLE \`rate_limits\`;`)
  await db.run(sql`DROP TABLE \`payload_kv\`;`)
  await db.run(sql`DROP TABLE \`payload_locked_documents\`;`)
  await db.run(sql`DROP TABLE \`payload_locked_documents_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_preferences\`;`)
  await db.run(sql`DROP TABLE \`payload_preferences_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_migrations\`;`)
  await db.run(sql`DROP TABLE \`shop_settings_weekly_hours\`;`)
  await db.run(sql`DROP TABLE \`shop_settings\`;`)
}
