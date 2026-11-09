-- Queries the Stableflow archiver and API issue, run by hand against the compat views.
-- Source: apps/indexer/archive/{tables,cycle}.ts and apps/api/src/**/*.service.ts (read, not run).
-- Usage: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f sql/stableflow-api-smoke.sql

\set live stableflow
\set arch stableflow_archive
create schema if not exists :"arch";

-- ensureArchiveTables: archive tables with the live columns (cycle.ts builds them from the Ponder schema)

create table if not exists :"arch".usdc_transfers (like :"live".usdc_transfers, primary key (id));
create table if not exists :"arch".usdc_transfer_volume_buckets (like :"live".usdc_transfer_volume_buckets, primary key (id));
create table if not exists :"arch".usdc_entity_flow_buckets (like :"live".usdc_entity_flow_buckets, primary key (id));
create table if not exists :"arch".usdc_entity_pair_flow_buckets (like :"live".usdc_entity_pair_flow_buckets, primary key (id));
create table if not exists :"arch".usdc_bridge_flow_buckets (like :"live".usdc_bridge_flow_buckets, primary key (id));
create table if not exists :"arch".usdc_bridge_events (like :"live".usdc_bridge_events, primary key (id));
create table if not exists :"arch".discovered_address_labels (like :"live".discovered_address_labels, primary key (id));

-- readFinalizedCheckpoint
select finalized_checkpoint from :"live"._ponder_checkpoint where chain_id = 8453;

-- runArchiveCycle: copyEvents / copyBuckets / copyLabels (upsertSql)
insert into :"arch".usdc_transfers (id, chain_id, block_number, block_timestamp, transaction_hash, log_index, from_address, to_address, value) select id, chain_id, block_number, block_timestamp, transaction_hash, log_index, from_address, to_address, value from :"live".usdc_transfers where block_number > -1
  on conflict (id) do update set chain_id = excluded.chain_id, block_number = excluded.block_number, block_timestamp = excluded.block_timestamp, transaction_hash = excluded.transaction_hash, log_index = excluded.log_index, from_address = excluded.from_address, to_address = excluded.to_address, value = excluded.value
  where (usdc_transfers.chain_id, usdc_transfers.block_number, usdc_transfers.block_timestamp, usdc_transfers.transaction_hash, usdc_transfers.log_index, usdc_transfers.from_address, usdc_transfers.to_address, usdc_transfers.value) is distinct from (excluded.chain_id, excluded.block_number, excluded.block_timestamp, excluded.transaction_hash, excluded.log_index, excluded.from_address, excluded.to_address, excluded.value);
insert into :"arch".usdc_transfer_volume_buckets (id, chain_id, token_address, bucket_size, bucket_start, transfer_count, total_value, adjusted_value) select id, chain_id, token_address, bucket_size, bucket_start, transfer_count, total_value, adjusted_value from :"live".usdc_transfer_volume_buckets where bucket_start >= -1
  on conflict (id) do update set chain_id = excluded.chain_id, token_address = excluded.token_address, bucket_size = excluded.bucket_size, bucket_start = excluded.bucket_start, transfer_count = excluded.transfer_count, total_value = excluded.total_value, adjusted_value = excluded.adjusted_value
  where (usdc_transfer_volume_buckets.chain_id, usdc_transfer_volume_buckets.token_address, usdc_transfer_volume_buckets.bucket_size, usdc_transfer_volume_buckets.bucket_start, usdc_transfer_volume_buckets.transfer_count, usdc_transfer_volume_buckets.total_value, usdc_transfer_volume_buckets.adjusted_value) is distinct from (excluded.chain_id, excluded.token_address, excluded.bucket_size, excluded.bucket_start, excluded.transfer_count, excluded.total_value, excluded.adjusted_value);
insert into :"arch".usdc_entity_flow_buckets (id, chain_id, token_address, bucket_size, bucket_start, entity_id, entity_name, category, direction, transfer_count, total_value) select id, chain_id, token_address, bucket_size, bucket_start, entity_id, entity_name, category, direction, transfer_count, total_value from :"live".usdc_entity_flow_buckets where bucket_start >= -1
  on conflict (id) do update set chain_id = excluded.chain_id, token_address = excluded.token_address, bucket_size = excluded.bucket_size, bucket_start = excluded.bucket_start, entity_id = excluded.entity_id, entity_name = excluded.entity_name, category = excluded.category, direction = excluded.direction, transfer_count = excluded.transfer_count, total_value = excluded.total_value
  where (usdc_entity_flow_buckets.chain_id, usdc_entity_flow_buckets.token_address, usdc_entity_flow_buckets.bucket_size, usdc_entity_flow_buckets.bucket_start, usdc_entity_flow_buckets.entity_id, usdc_entity_flow_buckets.entity_name, usdc_entity_flow_buckets.category, usdc_entity_flow_buckets.direction, usdc_entity_flow_buckets.transfer_count, usdc_entity_flow_buckets.total_value) is distinct from (excluded.chain_id, excluded.token_address, excluded.bucket_size, excluded.bucket_start, excluded.entity_id, excluded.entity_name, excluded.category, excluded.direction, excluded.transfer_count, excluded.total_value);
insert into :"arch".usdc_entity_pair_flow_buckets (id, chain_id, token_address, bucket_size, bucket_start, from_entity_id, from_entity_name, from_category, to_entity_id, to_entity_name, to_category, transfer_count, total_value) select id, chain_id, token_address, bucket_size, bucket_start, from_entity_id, from_entity_name, from_category, to_entity_id, to_entity_name, to_category, transfer_count, total_value from :"live".usdc_entity_pair_flow_buckets where bucket_start >= -1
  on conflict (id) do update set chain_id = excluded.chain_id, token_address = excluded.token_address, bucket_size = excluded.bucket_size, bucket_start = excluded.bucket_start, from_entity_id = excluded.from_entity_id, from_entity_name = excluded.from_entity_name, from_category = excluded.from_category, to_entity_id = excluded.to_entity_id, to_entity_name = excluded.to_entity_name, to_category = excluded.to_category, transfer_count = excluded.transfer_count, total_value = excluded.total_value
  where (usdc_entity_pair_flow_buckets.chain_id, usdc_entity_pair_flow_buckets.token_address, usdc_entity_pair_flow_buckets.bucket_size, usdc_entity_pair_flow_buckets.bucket_start, usdc_entity_pair_flow_buckets.from_entity_id, usdc_entity_pair_flow_buckets.from_entity_name, usdc_entity_pair_flow_buckets.from_category, usdc_entity_pair_flow_buckets.to_entity_id, usdc_entity_pair_flow_buckets.to_entity_name, usdc_entity_pair_flow_buckets.to_category, usdc_entity_pair_flow_buckets.transfer_count, usdc_entity_pair_flow_buckets.total_value) is distinct from (excluded.chain_id, excluded.token_address, excluded.bucket_size, excluded.bucket_start, excluded.from_entity_id, excluded.from_entity_name, excluded.from_category, excluded.to_entity_id, excluded.to_entity_name, excluded.to_category, excluded.transfer_count, excluded.total_value);
insert into :"arch".usdc_bridge_flow_buckets (id, chain_id, token_address, bucket_size, bucket_start, bridge_id, bridge_name, direction, remote_network_id, remote_network_name, remote_network_ecosystem, bridge_remote_namespace, bridge_remote_id, remote_chain_id, remote_domain, event_count, total_value) select id, chain_id, token_address, bucket_size, bucket_start, bridge_id, bridge_name, direction, remote_network_id, remote_network_name, remote_network_ecosystem, bridge_remote_namespace, bridge_remote_id, remote_chain_id, remote_domain, event_count, total_value from :"live".usdc_bridge_flow_buckets where bucket_start >= -1
  on conflict (id) do update set chain_id = excluded.chain_id, token_address = excluded.token_address, bucket_size = excluded.bucket_size, bucket_start = excluded.bucket_start, bridge_id = excluded.bridge_id, bridge_name = excluded.bridge_name, direction = excluded.direction, remote_network_id = excluded.remote_network_id, remote_network_name = excluded.remote_network_name, remote_network_ecosystem = excluded.remote_network_ecosystem, bridge_remote_namespace = excluded.bridge_remote_namespace, bridge_remote_id = excluded.bridge_remote_id, remote_chain_id = excluded.remote_chain_id, remote_domain = excluded.remote_domain, event_count = excluded.event_count, total_value = excluded.total_value
  where (usdc_bridge_flow_buckets.chain_id, usdc_bridge_flow_buckets.token_address, usdc_bridge_flow_buckets.bucket_size, usdc_bridge_flow_buckets.bucket_start, usdc_bridge_flow_buckets.bridge_id, usdc_bridge_flow_buckets.bridge_name, usdc_bridge_flow_buckets.direction, usdc_bridge_flow_buckets.remote_network_id, usdc_bridge_flow_buckets.remote_network_name, usdc_bridge_flow_buckets.remote_network_ecosystem, usdc_bridge_flow_buckets.bridge_remote_namespace, usdc_bridge_flow_buckets.bridge_remote_id, usdc_bridge_flow_buckets.remote_chain_id, usdc_bridge_flow_buckets.remote_domain, usdc_bridge_flow_buckets.event_count, usdc_bridge_flow_buckets.total_value) is distinct from (excluded.chain_id, excluded.token_address, excluded.bucket_size, excluded.bucket_start, excluded.bridge_id, excluded.bridge_name, excluded.direction, excluded.remote_network_id, excluded.remote_network_name, excluded.remote_network_ecosystem, excluded.bridge_remote_namespace, excluded.bridge_remote_id, excluded.remote_chain_id, excluded.remote_domain, excluded.event_count, excluded.total_value);
insert into :"arch".usdc_bridge_events (id, chain_id, block_number, block_timestamp, transaction_hash, log_index, token_address, bridge_id, bridge_name, direction, source_event, remote_network_id, remote_network_name, remote_network_ecosystem, bridge_remote_namespace, bridge_remote_id, remote_chain_id, remote_domain, value) select id, chain_id, block_number, block_timestamp, transaction_hash, log_index, token_address, bridge_id, bridge_name, direction, source_event, remote_network_id, remote_network_name, remote_network_ecosystem, bridge_remote_namespace, bridge_remote_id, remote_chain_id, remote_domain, value from :"live".usdc_bridge_events where block_number > -1
  on conflict (id) do update set chain_id = excluded.chain_id, block_number = excluded.block_number, block_timestamp = excluded.block_timestamp, transaction_hash = excluded.transaction_hash, log_index = excluded.log_index, token_address = excluded.token_address, bridge_id = excluded.bridge_id, bridge_name = excluded.bridge_name, direction = excluded.direction, source_event = excluded.source_event, remote_network_id = excluded.remote_network_id, remote_network_name = excluded.remote_network_name, remote_network_ecosystem = excluded.remote_network_ecosystem, bridge_remote_namespace = excluded.bridge_remote_namespace, bridge_remote_id = excluded.bridge_remote_id, remote_chain_id = excluded.remote_chain_id, remote_domain = excluded.remote_domain, value = excluded.value
  where (usdc_bridge_events.chain_id, usdc_bridge_events.block_number, usdc_bridge_events.block_timestamp, usdc_bridge_events.transaction_hash, usdc_bridge_events.log_index, usdc_bridge_events.token_address, usdc_bridge_events.bridge_id, usdc_bridge_events.bridge_name, usdc_bridge_events.direction, usdc_bridge_events.source_event, usdc_bridge_events.remote_network_id, usdc_bridge_events.remote_network_name, usdc_bridge_events.remote_network_ecosystem, usdc_bridge_events.bridge_remote_namespace, usdc_bridge_events.bridge_remote_id, usdc_bridge_events.remote_chain_id, usdc_bridge_events.remote_domain, usdc_bridge_events.value) is distinct from (excluded.chain_id, excluded.block_number, excluded.block_timestamp, excluded.transaction_hash, excluded.log_index, excluded.token_address, excluded.bridge_id, excluded.bridge_name, excluded.direction, excluded.source_event, excluded.remote_network_id, excluded.remote_network_name, excluded.remote_network_ecosystem, excluded.bridge_remote_namespace, excluded.bridge_remote_id, excluded.remote_chain_id, excluded.remote_domain, excluded.value);
insert into :"arch".discovered_address_labels (id, chain_id, address, entity_id, entity_name, category, role, attribution_group, counting_policy, confidence, source_type, source_address, source_event, token0, token1, pool_kind, first_seen_block, transaction_hash, log_index) select id, chain_id, address, entity_id, entity_name, category, role, attribution_group, counting_policy, confidence, source_type, source_address, source_event, token0, token1, pool_kind, first_seen_block, transaction_hash, log_index from :"live".discovered_address_labels on conflict (id) do nothing;

-- second cycle must copy nothing new (idempotent upsert)
-- copyEvents removal of rows missing from live
delete from :"arch".usdc_transfers archived where archived.block_number > 53271799
  and not exists (select 1 from :"live".usdc_transfers live where live.id = archived.id);
-- liveCoverage
select min(bucket_start)::text from :"live".usdc_transfer_volume_buckets;
-- expireArchivedEvents
delete from :"arch".usdc_transfers where ctid = any(array(select ctid from :"arch".usdc_transfers where block_number < 53270100 limit 10000));

-- API: counts from archive after copy
select 'archive_transfers', count(*) from :"arch".usdc_transfers;

-- API flows.service: top entities over a window (grouped filter aggregates)
select category, entity_id, entity_name,
  coalesce(sum(transfer_count) filter (where direction = 'in'), 0)::text as inflow_count,
  coalesce(sum(total_value) filter (where direction = 'in'), 0)::text as inflow_value,
  coalesce(sum(total_value) filter (where direction = 'out'), 0)::text as outflow_value
from :"arch".usdc_entity_flow_buckets
where bucket_size = '1m' and bucket_start >= 1793330000 and bucket_start < 1793340000
group by entity_id, entity_name, category order by 5 desc limit 5;
-- flows: newest bucket
select max(bucket_start)::text from :"live".usdc_transfer_volume_buckets;
select max(bucket_start)::text from :"live".usdc_bridge_flow_buckets;
-- flows: pair flows, bridges, volume series
select from_entity_id, to_entity_id, sum(total_value)::text, sum(transfer_count)::text
from :"arch".usdc_entity_pair_flow_buckets group by 1,2 order by sum(total_value) desc limit 5;
select bridge_id, direction, remote_network_id, remote_chain_id, remote_domain, sum(event_count)::text, sum(total_value)::text
from :"arch".usdc_bridge_flow_buckets group by 1,2,3,4,5 order by sum(total_value) desc limit 5;
select bucket_start::text, sum(adjusted_value)::text, sum(transfer_count)::text
from :"arch".usdc_transfer_volume_buckets group by bucket_start order by bucket_start limit 3;
-- transfers.service: filtered page with keyset cursor, newest first
select id, block_number, log_index, from_address, to_address, value from :"arch".usdc_transfers
where value >= 10000000000 and (block_number < 53271000 or (block_number = 53271000 and log_index < 10))
order by block_number desc, log_index desc limit 5;
-- transfers.service: getTransactionTotals CTE
with transfers as (
  select from_address, to_address, value from :"arch".usdc_transfers
  where transaction_hash = (select transaction_hash from :"arch".usdc_transfers group by 1 having count(*) > 3 limit 1)
), nets as (
  select lower(address) as address, sum(delta) as net from (
    select to_address as address, value as delta from transfers union all select from_address, -value from transfers) legs group by 1)
select (select count(*) from transfers)::int as transfer_count,
       coalesce((select sum(net) from nets where net > 0), 0)::text as adjusted_value;
-- search.service: label and hash prefix search
select address, entity_name, role from :"arch".discovered_address_labels
where lower(address::text) like '0x4e65%' escape '\' or lower(entity_name) like 'aave%' escape '\' order by first_seen_block desc limit 5;
select id from :"arch".usdc_transfers where lower(transaction_hash::text) like '0x82cb%' escape '\' order by block_number desc, value desc limit 3;
-- entities.service: label detail with first_seen_block::text
select first_seen_block::text from :"arch".discovered_address_labels limit 1;
-- health
select 1;
