-- Compatibility views for the Stableflow API and archiver.
--
-- They read Ponder's tables through a schema (DATABASE_VIEWS_SCHEMA, `stableflow` in
-- compose.yaml) whose tables have Ponder's column types: `hex` columns are bytea and
-- `bigint` columns are numeric(78). HyperIndex stores addresses and hashes as text, so
-- these views cast them back. Names and column order match apps/indexer/ponder.schema.ts.
--
--   psql "$DATABASE_URL" -v views_schema=stableflow -f sql/stableflow-compat-views.sql
--
-- `views_schema` defaults to `stableflow`. Re-running replaces the views.
\if :{?views_schema}
\else
  \set views_schema stableflow
\endif

create schema if not exists :"views_schema";

create or replace view :"views_schema".usdc_transfers as select
  id,
  chain_id,
  block_number::numeric(78) as block_number,
  block_timestamp::numeric(78) as block_timestamp,
  decode(substr(transaction_hash, 3), 'hex') as transaction_hash,
  log_index,
  decode(substr(from_address, 3), 'hex') as from_address,
  decode(substr(to_address, 3), 'hex') as to_address,
  value::numeric(78) as value
from public.usdc_transfers;

create or replace view :"views_schema".usdc_transfer_volume_buckets as select
  id,
  chain_id,
  decode(substr(token_address, 3), 'hex') as token_address,
  bucket_size,
  bucket_start::numeric(78) as bucket_start,
  transfer_count::numeric(78) as transfer_count,
  total_value::numeric(78) as total_value,
  adjusted_value::numeric(78) as adjusted_value
from public.usdc_transfer_volume_buckets;

create or replace view :"views_schema".usdc_entity_flow_buckets as select
  id,
  chain_id,
  decode(substr(token_address, 3), 'hex') as token_address,
  bucket_size,
  bucket_start::numeric(78) as bucket_start,
  entity_id,
  entity_name,
  category,
  direction,
  transfer_count::numeric(78) as transfer_count,
  total_value::numeric(78) as total_value
from public.usdc_entity_flow_buckets;

create or replace view :"views_schema".usdc_entity_pair_flow_buckets as select
  id,
  chain_id,
  decode(substr(token_address, 3), 'hex') as token_address,
  bucket_size,
  bucket_start::numeric(78) as bucket_start,
  from_entity_id,
  from_entity_name,
  from_category,
  to_entity_id,
  to_entity_name,
  to_category,
  transfer_count::numeric(78) as transfer_count,
  total_value::numeric(78) as total_value
from public.usdc_entity_pair_flow_buckets;

create or replace view :"views_schema".usdc_bridge_flow_buckets as select
  id,
  chain_id,
  decode(substr(token_address, 3), 'hex') as token_address,
  bucket_size,
  bucket_start::numeric(78) as bucket_start,
  bridge_id,
  bridge_name,
  direction,
  remote_network_id,
  remote_network_name,
  remote_network_ecosystem,
  bridge_remote_namespace,
  bridge_remote_id,
  remote_chain_id::numeric(78) as remote_chain_id,
  remote_domain,
  event_count::numeric(78) as event_count,
  total_value::numeric(78) as total_value
from public.usdc_bridge_flow_buckets;

create or replace view :"views_schema".usdc_bridge_events as select
  id,
  chain_id,
  block_number::numeric(78) as block_number,
  block_timestamp::numeric(78) as block_timestamp,
  decode(substr(transaction_hash, 3), 'hex') as transaction_hash,
  log_index,
  decode(substr(token_address, 3), 'hex') as token_address,
  bridge_id,
  bridge_name,
  direction,
  source_event,
  remote_network_id,
  remote_network_name,
  remote_network_ecosystem,
  bridge_remote_namespace,
  bridge_remote_id,
  remote_chain_id::numeric(78) as remote_chain_id,
  remote_domain,
  value::numeric(78) as value
from public.usdc_bridge_events;

create or replace view :"views_schema".discovered_address_labels as select
  id,
  chain_id,
  decode(substr(address, 3), 'hex') as address,
  entity_id,
  entity_name,
  category,
  role,
  attribution_group,
  counting_policy,
  confidence,
  source_type,
  decode(substr(source_address, 3), 'hex') as source_address,
  source_event,
  decode(substr(token0, 3), 'hex') as token0,
  decode(substr(token1, 3), 'hex') as token1,
  pool_kind,
  first_seen_block::numeric(78) as first_seen_block,
  decode(substr(transaction_hash, 3), 'hex') as transaction_hash,
  log_index
from public.discovered_address_labels;
