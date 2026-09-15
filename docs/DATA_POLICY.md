# Initial data policy

This is a configurable engineering policy, not a statement that a privacy law has been satisfied.
The owner must publish the bot's actual behavior to the community before live feature rollout.

## Stored now

- Guild configuration: guild ID, default bot language and last modification timestamp.
- Narrow settings audit: generated ID, Discord interaction ID, guild ID, actor ID, action name,
  selected language and timestamp. No chat content, usernames or member profiles.
- Migration names/checksums and timestamps; these contain no community message data.

All Discord IDs are potentially identifying data. Repository access alone is not permission to export
a live database. Never place database dumps, tokens, user datasets or production `.env` files in GitHub.

## Retention actually implemented

Settings remain until explicitly removed by an operator. Removing the bot does **not** automatically
wipe settings today. Document and implement a verified operator deletion/export path before widening
access beyond the current owner-managed community.

Audit entries older than `AUDIT_RETENTION_DAYS` (default 90) are purged in batches at startup and hourly.
This does not delete existing backup copies. Backup expiration and erasure reconciliation need a separate
operator procedure. No indefinite retention is implied for future moderation/transcript features.

Logs have no chat/request bodies or raw errors and use bounded size-based rotation (3 x 10 MB per
Compose service), not a time-based 14-day guarantee. The environment might retain container/provider logs
elsewhere; review that separately.

## Not collected

Ordinary or deleted/edited member messages, attachments, IP addresses, presence histories, ticket
transcripts, XP history and member profiles. No AI/translation provider receives member content.
These features do not exist in the foundation. New collection requires a module-specific purpose,
access model, retention limit and deletion/export design.

## Backups (recommendation, not an installed scheduler)

Use `ops/backup.sh` for a custom-format PostgreSQL dump. The file is restricted to the local operator
and excluded from Git. Encrypt before uploading off-VPS; keep the key separate from the dump.
Recommended starting policy: daily off-VPS backup, 30-day rotation and a periodic restore test to a
separate database. No cloud destination, recurring job, encryption key or destructive retention task
has been set up by this scaffold. Files are not encrypted by `backup.sh` itself.
