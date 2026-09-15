# Architecture

## Shape and dependency direction

The application is a modular monolith with an explicit composition root in `src/main.ts`.
There is one Discord Gateway client, one PostgreSQL pool, one registry and one internal health server.
A database advisory lock enforces the initial singleton assumption for a given application ID.

```text
Discord Gateway
  -> interaction router (tenant allowlist, runtime permissions, cooldown, ACK, errors)
  -> registered module adapter
  -> service/repository with an explicit guild ID
  -> PostgreSQL

module adapter -> localized Components V2 response
```

`src/core` contains testable primitives. `src/discord` owns SDK interactions and UI composition.
`src/db` owns schema/query infrastructure. The system module provides a minimal working vertical slice.
Larger features should introduce module-local services and repository interfaces when their business
rules exist; do not generate empty folders, generic CRUD layers or dependency-injection frameworks.

## Interaction contract

The current registry handles chat-input commands, buttons, string select menus and modal submissions.
Other Discord interaction types are not silently claimed as implemented. Add typed adapter support
and tests when a feature needs user/role/channel selects, context menu commands or autocomplete.

Each handler declares user and bot permission bitfields. Both are rechecked using the interaction's
current permission snapshot; default command permissions alone are not authorization. Resource-specific
checks (role hierarchy, channel ownership, panel owner, ticket membership) belong in the relevant service.
The allowlist is checked before executing any handler. Other servers and DMs cannot run feature logic.

Ordinary handlers receive an ephemeral deferred response before database I/O. V2 flags are added when
editing the original response. The `manual` ACK path is specifically for immediate modal opening;
no database/API call may precede `showModal` on that path. A new handler needs a test for its ACK behavior.

`y1:<module>:<action>[:<entity>]` is a versioned stateless route, maximum 100 characters. Unknown/old
routes return a localized unavailable message. A database entity reference is not authorization. Static
routing works after a process restart; persistence of actual panel state must be implemented separately.
The foundation has no in-memory collectors as its long-lived routing mechanism.

The cooldown is per guild/user, bounded to 10,000 entries, with expired entries reclaimed when capacity
is needed. It fails closed when saturated. It is a process-local abuse guard, not a promise of distributed
rate limiting or a replacement for Discord REST rate-limit handling.

## Localization and UI

Initial dictionaries are `en` and `vi`, typed against the same keys and tested for placeholder parity.
Private responses follow Discord user locale (regional English and Vietnamese normalize to base locale),
then the configured default. Public module messages will use the guild locale repository first.
Only the server default is stored today; there is no user/profile or channel locale override yet.
No member message translation is performed.

V2 containers/text displays/action rows are the only rendering path included. Do not mix the traditional
`content`/`embeds` fields into such a message. All helper-generated messages suppress mentions. If a future
feature explicitly needs legacy embeds, implement a separately typed renderer with contract tests.

## Persistence

Tables: `guild_settings`, `audit_events`, plus the migration ledger. Guild IDs remain strings.
Reads do not create rows. A settings change creates the guild record as needed and inserts its audit
record plus configuration update in one transaction. An interaction ID is unique: duplicate delivery
must not overwrite later settings. This deduplication lasts only as long as the audit row is retained;
a durable job/idempotency table will be needed for future long-running actions.

Every repository method accepts a guild ID; runtime routes provide only an allowlisted guild ID.
The database does not use row-level security in this initial single-operator deployment. Tenant
isolation is therefore an application/repository invariant covered by integration tests, not an RLS claim.

SQL files are ordered, checksummed and applied under an advisory lock, transaction by transaction.
History must remain an exact prefix of the files. The bot refuses to start with a missing, edited or newer
migration history. It never applies migrations implicitly at startup.

The application database role is non-superuser but owns this application's database/schema objects.
A separate migration-only credential and a narrower runtime role are recommended release-hardening work.

## Runtime and operation

Only the Guilds intent is enabled; no message content, presence or member-list collection.
No sharding or replicas are preconfigured. Do not equate member count with measured throughput: load
and failure tests against real interaction traffic remain required before a capacity claim.

SIGINT/SIGTERM stop new work, disconnect the gateway, drain tracked tasks and close database resources
with a bounded emergency exit. A held DB connection provides a singleton lease; losing it stops the bot.
JSON logging excludes sensitive error messages, payloads and stack traces by default. Error responses
contain a correlation reference. This intentionally favors privacy over rich raw diagnostics.

The health endpoint is internal, not a dashboard. Liveness and readiness are separate. Readiness checks
Discord readiness and a database query. It is not a full synthetic interaction test or an SLO.
Audit retention runs at startup and hourly, deleting up to 1,000 expired rows per pass. It is best-effort
maintenance; a backlog can take several passes. Database and application logs are size-rotated by Compose.

Future durable scheduled actions must be transactionally recorded, retryable and idempotent. Add a job
worker/queue only when a feature provides concrete delivery and failure semantics. No exactly-once claim.
