#!/bin/bash
# Creates the test database alongside the dev one (POSTGRES_DB creates only the
# latter). Postgres runs everything in docker-entrypoint-initdb.d exactly once,
# on an empty data directory - so this does not run again on later starts, and
# `docker compose down -v` is what you need to get a fresh pair.
set -euo pipefail

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
	CREATE DATABASE craftybass_test OWNER $POSTGRES_USER;
EOSQL
