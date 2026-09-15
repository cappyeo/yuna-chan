#!/bin/sh
set -eu
# Runs only for a new PostgreSQL volume. Use SQL migrations/ALTER ROLE for later changes.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set=app_password="$APP_DATABASE_PASSWORD" <<'SQL'
CREATE ROLE yuna LOGIN PASSWORD :'app_password' NOSUPERUSER NOCREATEDB NOCREATEROLE;
ALTER DATABASE yuna OWNER TO yuna;
REVOKE ALL ON DATABASE yuna FROM PUBLIC;
GRANT CONNECT, TEMPORARY ON DATABASE yuna TO yuna;
GRANT USAGE, CREATE ON SCHEMA public TO yuna;
SQL
