# Maintainer and coding-agent instructions

## Product context

Yuna-chan is a community-owned multi-purpose Discord bot, not a public SaaS product. The initial
scope is approximately five servers, largest approximately 5,000 members. User interface languages:
Vietnamese and English; make more locales additive. The owner delegates design and implementation
to the assistant in active development sessions. Do not imply unattended or permanent maintenance.

The current milestone is **foundation only**. Do not add moderation, tickets, leveling, giveaways,
music, AI, translation APIs or a dashboard without an explicit feature task. `/system` and `/settings`
are narrow infrastructure acceptance paths. VPS capacity is not a blocking product question.

## Read before changing code

Read `docs/DECISIONS.md`, `docs/ARCHITECTURE.md`, `docs/DATA_POLICY.md` and `docs/VERIFICATION.md`.
The repository is the source of durable project context. Do not rely on conversation memory.

## Boundaries

- Strict TypeScript, ESM, Node 24; use explicit `.ts` relative imports. Build rewrites to `.js`.
- Keep runtime dependencies small. Do not add a framework, queue, Redis or microservice speculatively.
- Modules go under `src/modules/<name>/` and are explicitly registered in `src/modules/index.ts`.
- Core does not import a concrete feature module. Put SDK code in adapters; keep policies testable.
- All tenant data access requires a guild ID. IDs are strings, never floating-point numbers.
- Recheck runtime permissions for commands, buttons, selects and modal submissions.
- `custom_id` is routing data, never proof of authorization. Never put a token or secret in it.
- Stateful long-lived interactions need database storage, expiry and resource/actor authorization.
- Defer ordinary interactions before I/O. Modal-opening actions must use the explicit manual ACK path
  and call `showModal` without slow I/O first. Do not attempt a modal after deferring.
- Use Components V2 helpers. No legacy `content` or `embeds` on V2 messages. Suppress unsolicited mentions.
- User-visible text belongs in both dictionaries. Keep placeholders identical; English is fallback.
- Do not collect message content, transcripts or member profiles without a module-specific data decision.
- Never log tokens, interaction payloads, database URLs, private content or raw SDK/SQL errors.

## Database and operational safety

Migrations are append-only numbered SQL files. Drizzle maps types/queries; SQL is the migration source
of truth. Change `schema.ts` and add a migration together. Never edit an applied migration or use
schema push against production. Test a backup restore before destructive migration design.
The runtime checks checksums and refuses missing/newer migrations; it does not migrate automatically.

The default application is a singleton. The advisory lease prevents two processes for the same
application/database. Do not introduce replicas without redesigning event ownership and idempotency.
Scheduled Discord work needs durable jobs and retry/idempotency design, not long in-memory timers.

Do not change repository visibility or invent a license. Use small reviewable commits/PRs, never
force-push, delete data, rotate secrets, grant Administrator or deploy to the live VPS unprompted.

## Required checks

Run typecheck, unit tests, SDK tests, integration tests, build and dependency audit when supported.
Keep `package-lock.json` committed after initial generation. Use `npm ci` thereafter.
When a check cannot run, record it as **not run**, never passed. Attach the precise failure or missing
prerequisite and update `docs/VERIFICATION.md`. CI configuration is not evidence of a successful CI run.
