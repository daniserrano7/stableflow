-- Production database roles. Idempotent: safe to re-run, e.g. to rotate passwords.
--
-- Run once as the database owner (Railway's `postgres` user) before the first deploy:
--
--   psql "$DATABASE_PUBLIC_URL" \
--     -v indexer_password="$INDEXER_DB_PASSWORD" \
--     -v worker_password="$WORKER_DB_PASSWORD" \
--     -v api_password="$API_DB_PASSWORD" \
--     -v api_dev_password="$API_DEV_DB_PASSWORD" \
--     -f infra/postgres/roles.sql
--
-- Schemas:
--   indexer_<deployment>  one per indexer deployment, recent rows only; owned by stableflow_indexer
--   stableflow            Ponder views of the live deployment; read by the stream and archiver
--   stableflow_archive    history the API reads; written by the archiver (stableflow_worker)
--   stableflow_ops        label workflow state; owned by stableflow_worker
--   stableflow_indexer    each deployment's start block; owned by stableflow_indexer
--   ponder_sync           Ponder's RPC bookkeeping; owned by stableflow_indexer

\set ON_ERROR_STOP on

-- Login roles -------------------------------------------------------------------

SELECT 'CREATE ROLE stableflow_indexer LOGIN'
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'stableflow_indexer') \gexec
SELECT 'CREATE ROLE stableflow_worker LOGIN'
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'stableflow_worker') \gexec
SELECT 'CREATE ROLE stableflow_api LOGIN'
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'stableflow_api') \gexec
SELECT 'CREATE ROLE stableflow_api_dev LOGIN'
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'stableflow_api_dev') \gexec
SELECT 'CREATE ROLE stableflow_reader NOLOGIN'
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'stableflow_reader') \gexec

ALTER ROLE stableflow_indexer PASSWORD :'indexer_password';
ALTER ROLE stableflow_worker PASSWORD :'worker_password';
ALTER ROLE stableflow_api PASSWORD :'api_password';
ALTER ROLE stableflow_api_dev PASSWORD :'api_dev_password';

-- The indexer reads archived labels and the archive's newest block on start.
GRANT stableflow_reader TO stableflow_api, stableflow_api_dev, stableflow_worker, stableflow_indexer;

-- API roles only read. The dev API reaches production over the public proxy, so
-- it also gets a connection cap.
ALTER ROLE stableflow_api SET default_transaction_read_only = on;
ALTER ROLE stableflow_api SET statement_timeout = '30s';
ALTER ROLE stableflow_api_dev SET default_transaction_read_only = on;
ALTER ROLE stableflow_api_dev SET statement_timeout = '30s';
ALTER ROLE stableflow_api_dev CONNECTION LIMIT 10;

-- Indexer: creates a schema per deployment, the views schema, ponder_sync and its
-- start-block bookkeeping.
SELECT format('GRANT CREATE ON DATABASE %I TO stableflow_indexer', current_database()) \gexec

-- Views schema: Ponder drops and recreates the views on every deployment, so
-- readers get SELECT through default privileges rather than per-view grants.
CREATE SCHEMA IF NOT EXISTS stableflow AUTHORIZATION stableflow_indexer;
GRANT USAGE ON SCHEMA stableflow TO stableflow_reader;
ALTER DEFAULT PRIVILEGES FOR ROLE stableflow_indexer IN SCHEMA stableflow
  GRANT SELECT ON TABLES TO stableflow_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA stableflow TO stableflow_reader;

-- Archive: the archiver creates its tables on start; readers get SELECT through
-- default privileges.
CREATE SCHEMA IF NOT EXISTS stableflow_archive AUTHORIZATION stableflow_worker;
GRANT USAGE ON SCHEMA stableflow_archive TO stableflow_reader;
ALTER DEFAULT PRIVILEGES FOR ROLE stableflow_worker IN SCHEMA stableflow_archive
  GRANT SELECT ON TABLES TO stableflow_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA stableflow_archive TO stableflow_reader;

-- Ops schema: worker-only; the label worker creates its tables lazily.
CREATE SCHEMA IF NOT EXISTS stableflow_ops AUTHORIZATION stableflow_worker;
