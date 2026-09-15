#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
umask 077
mkdir -p backups
file="backups/yuna-$(date -u +%Y%m%dT%H%M%SZ)-$$.dump"
tmp=$(mktemp backups/.dump.XXXXXX)
trap 'rm -f "$tmp"' EXIT HUP INT TERM
docker compose exec -T db pg_dump -U postgres -d yuna --format=custom > "$tmp"
test -s "$tmp"
mv "$tmp" "$file"
printf 'Backup written: %s\n' "$file"
# No automatic deletion or remote upload. Configure an encrypted off-host backup policy.
