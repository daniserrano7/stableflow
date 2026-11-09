-- Compatibility views for the Stableflow API and archiver.
--
-- Both read Ponder's tables through a schema (`stableflow` in compose.yaml:
-- DATABASE_VIEWS_SCHEMA for the indexer, DATABASE_LIVE_SCHEMA for the API and archiver).
-- Ponder's column types are `text` for hex (lowercase) and `numeric(78)` for bigint. The
-- port writes lowercase text already, so these views only cast bigint columns and add the
-- `_ponder_checkpoint` table the archiver reads. Names and column order match
-- apps/indexer/ponder.schema.ts.
--
--   psql "$DATABASE_URL" -v views_schema=stableflow -f sql/stableflow-compat-views.sql
--
-- Re-running replaces the views. Run it after a reset (`envio start -r`), which drops them.
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
  transaction_hash,
  log_index,
  from_address,
  to_address,
  value::numeric(78) as value
from public.usdc_transfers;

create or replace view :"views_schema".usdc_transfer_volume_buckets as select
  id,
  chain_id,
  token_address,
  bucket_size,
  bucket_start::numeric(78) as bucket_start,
  transfer_count::numeric(78) as transfer_count,
  total_value::numeric(78) as total_value,
  adjusted_value::numeric(78) as adjusted_value
from public.usdc_transfer_volume_buckets;

create or replace view :"views_schema".usdc_entity_flow_buckets as select
  id,
  chain_id,
  token_address,
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
  token_address,
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
  token_address,
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
  transaction_hash,
  log_index,
  token_address,
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
  address,
  entity_id,
  entity_name,
  category,
  role,
  attribution_group,
  counting_policy,
  confidence,
  source_type,
  source_address,
  source_event,
  token0,
  token1,
  pool_kind,
  first_seen_block::numeric(78) as first_seen_block,
  transaction_hash,
  log_index
from public.discovered_address_labels;

-- The archiver (apps/indexer/archive/cycle.ts) reads the finalized block and its time from
-- Ponder's checkpoint string: 10 digits of timestamp, 16 of chain id, 16 of block number,
-- then 33 more it ignores. Blocks within max_reorg_depth of the indexed tip are not final.
create or replace view :"views_schema"._ponder_checkpoint as
with chain as (
  select id,
         case when end_block is not null and progress_block >= end_block then progress_block
              else greatest(progress_block - max_reorg_depth, start_block) end as finalized_block
  from public.envio_chains
)
select id as chain_id,
       lpad(coalesce((select max(block_timestamp) from public.usdc_transfers t
                      where t.block_number <= chain.finalized_block), 0)::text, 10, '0')
         || lpad(id::text, 16, '0')
         || lpad(finalized_block::text, 16, '0')
         || repeat('0', 33) as finalized_checkpoint
from chain;
