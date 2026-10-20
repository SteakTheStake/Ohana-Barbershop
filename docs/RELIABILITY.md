# Owner Reliability And Recovery

## What Is Protected

- The shop Schedule is authoritative. Google is a delayed, read-only mirror.
- Owner appointment creates/edits/status changes and customer booking creates
  carry a UUID save ID. A receipt and appointment commit in the same SQLite
  transaction; identical retries return the original response.
- Reusing a save ID with different details is rejected. The browser retries
  transient failures once with a 20-second timeout per attempt. An uncertain
  owner/customer booking keeps the original request in the open page and offers
  a safe check/retry instead of letting the user edit another booking.
- Owner appointment edits and status changes require the revision seen when
  the form opened. The check runs inside the transaction; stale changes get 409.
- Appointment history is append-only through normal APIs and commits with the
  visit, including changes through the CMS and customer API. It records actor,
  time/status/service/revision snapshots, but not phones, names or notes.
  History is not retroactive and is not a tamper-proof log against DB admins.
- Schedule refresh failures/offline/stale data show a warning. Print day makes
  a private snapshot for an outage; it is not an offline booking queue.

Save IDs live only in the mounted browser page. Closing/reloading the page
discards the retry context: inspect Schedule/My appointments before starting
again. Receipts remain in the database, including original response details,
and must be treated as customer data in retention/removal workflows. No receipt
cleanup is scheduled because silently expiring IDs permits old requests to run
again. Non-appointment settings, customer edits, and time-off forms do not yet
have revision/idempotency protection. Customer reschedule/cancel still enforce
ownership and policy but do not yet use owner-style revision checks.

## Deployment Gate

This is a single-writer SQLite application. Use one always-on Node process,
persistent local disk, HTTPS, restricted filesystem access, disk-space alerts,
and a process supervisor (for example systemd with `Restart=on-failure`).
Do not run multiple replicas or put SQLite on a network share.

1. Back up the existing database before deploying.
2. Deploy code and install the locked dependencies.
3. Production startup applies the additive reliability migration: revision
   defaults to 1 on existing appointments; receipt/history tables start empty.
4. Check `/api/health` returns 200 and `{"status":"ok"}`. It probes a DB read,
   not Twilio delivery, Google freshness, disk writes, or backup freshness.
5. Configure an external uptime monitor to poll that endpoint every minute and
   alert the operator after repeated failures. Set provider-specific alerts for
   SMS verification and host disk usage. No monitoring service is provisioned
   automatically by this repository.
6. Confirm real Twilio verification, owner sign-in, booking, reschedule, cancel,
   and recovery with approved test data before enabling public booking.

At the reverse proxy and monitoring provider, redact `/api/calendar/*` paths,
cookies, authorization headers and request bodies. Application API handlers do
not log caught exception objects, which can contain SQL parameters/customer
data; arrange restricted, redacted infrastructure diagnostics separately.

## Encrypted Backups

The backup script requires Node 22.16+ (or a supported newer Node release)
for the native SQLite online backup API. It includes committed WAL data,
checks SQLite integrity/foreign keys, encrypts with AES-256-GCM, and never
overwrites an existing backup or restore destination. Temporary plaintext
snapshots are removed on ordinary completion/failure; restrict the OS temp
directory/Windows account ACLs and use encrypted disks for crash remnants.

Generate a 32-byte key locally, store it as server-only `BACKUP_KEY` (64 hex
characters), and escrow a copy in a separate password manager. Do not put the
key in Git, shell command arguments, or the backup destination. Key loss makes
restoration impossible; retain old keys when rotating encryption keys.

From `apps/web`, with the key loaded securely into the environment:

```sh
pnpm backup create /var/lib/ohana/ohana.db /secure-backups/ohana-UNIQUE-TIMESTAMP.enc
pnpm backup verify /secure-backups/ohana-UNIQUE-TIMESTAMP.enc
pnpm backup restore /secure-backups/ohana-UNIQUE-TIMESTAMP.enc /recovery/ohana-NEW.db
```

Create parent directories first with restricted permissions. `verify` requires
the companion `.json` success metadata and rejects backups over 24 hours old;
it decrypts into a temporary file and runs an integrity/foreign-key check.
It does not replace testing the restored app against a copied database.

Configure a scheduler on the actual host to run `create` every 15 minutes with
a unique destination, copy the encrypted file and metadata to independent
off-host storage, and alert on any nonzero exit or missed run. Run `verify`
daily and an isolated application restore drill monthly. Set retention,
storage encryption/access, and off-host credentials with the owner. This code
does not install timers, upload backups, delete old files or send alerts.
An hourly/daily job must not be represented as meeting a 15-minute data-loss
target. Suggested goals (15 minutes lost / 1 hour recovery) remain unproven
until timed restore drills and off-host delivery are verified.

## Outage Procedure

1. Stop new online booking if possible; record calls on a secure paper log.
2. Read the printed schedule as a snapshot, and do not promise overlapping
   times while the server's latest state is unknown.
3. Operator checks host uptime, free disk, process logs and `/api/health`.
4. If restoration is necessary, stop the server. Restore a verified encrypted
   backup to a NEW file, preserving the current DB and its WAL/SHM files.
5. Point an isolated instance at the recovered file and verify owner sign-in,
   services, appointments and occupancy. Reconcile bookings made after backup.
6. Switch `DATABASE_URL` to the validated recovered file and restart one app
   process. Do not run two copies accepting bookings.
7. Reconcile the secure paper log, check the calendar subscription and resume.

No recovery script overwrites the live database. A restored older database
can roll back calendar-token rotation and auth revocation: rotate the feed
link, review sessions and revoke as appropriate after a restore.

## Owner Access And Remaining Setup

Password-reset email delivery is still not configured. Before launch, choose
an email provider/adapter, configure sender DNS, verify actual reset delivery,
and arrange a restricted operator recovery procedure. Do not consider logging
reset emails to the console a production recovery solution.

Google OAuth/API sync and durable SMS appointment notifications remain separate
work. They require credentials, delivery workers, reconciliation and deployment
configuration; the subscription must not be described as instant sync.
