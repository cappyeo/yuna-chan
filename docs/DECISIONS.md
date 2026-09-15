# Scope and decisions

## Confirmed owner requirements

- Bootstrap an empty `cappyeo/yuna-chan` repository for long-term development.
- Eventually replace multiple community bots such as MEE6/Dyno; no early feature delivery required.
- Around five Discord servers; the largest has around 5,000 members.
- International community. Initial UI locales: Vietnamese and English; later locales should be additive.
- Components V2 is the main UI direction. Legacy embeds are a separate message mode, not mixed into V2.
- VPS deployment; hardware capacity is not a blocker.
- The assistant is the development collaborator; preserve context and conventions in the repository.

## Working interpretation

The answer to the dashboard question is interpreted as **no web dashboard**. There is no external
admin website in this scaffold. This is recorded explicitly rather than treating a typo as a new feature.

## Engineering choices made for the foundation

TypeScript strict + Node 24 + discord.js; one modular application rather than microservices.
PostgreSQL with Drizzle query/schema mapping; reviewed, append-only SQL migrations.
No Redis, external queue, paid API or SaaS dependency. npm is selected to keep the toolchain small.
Mandatory guild allowlist; not open for arbitrary servers to use. One active instance per database/app.
Two infrastructure commands prove the plumbing. No placeholder community modules or fake business logic.

## Data recommendations adopted as adjustable defaults

Do not store member chat, deleted/edited message content, transcripts or member profiles.
Store server locale and narrow configuration-change audit entries. Retain these audit entries for
90 days by default; tune `AUDIT_RETENTION_DAYS`. Keep normal logs free of message/user payloads.
Backups: recommend daily encrypted off-VPS copies and a 30-day rotation, but no remote destination
or scheduler is configured automatically. These are engineering defaults, not legal determinations.

## Not decided / not implemented

Community module priorities, moderation policy, staff role matrix, message-content intent, transcript
storage, imported data, per-user locale overrides, channel locale overrides, feature toggles, job queues,
and multi-process/shard deployment. Decide these at the relevant module task; do not guess them now.
