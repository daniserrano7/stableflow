-- Re-derive the bucket tables from the transfers and labels with the rules in
-- apps/indexer/src/handlers/base-usdc.handler.ts (getEntityFlowUpdates, getEntityPairFlowUpdate,
-- TransactionNetValueTracker) and compare with what the indexer wrote. Reads only the tables.
--   (load static labels first)  psql -v labels=/tmp/static-labels.tsv -f scripts/compare-aggregates.sql
create temp table static_labels (address text, grp text, policy text, entity_id text, entity_name text, category text);
copy static_labels from :'labels';

-- Static labels win; a discovered label applies from its first-seen block.
create temp table lbl as
select address, grp, policy, entity_id, entity_name, category, -1::numeric as from_block from static_labels
union all
select d.address, d.attribution_group, d.counting_policy, d.entity_id, d.entity_name, d.category, d.first_seen_block
from discovered_address_labels d where d.address not in (select address from static_labels);

create temp table t as
select tr.id, tr.block_number, tr.block_timestamp - (tr.block_timestamp % 60) as bucket_start, tr.value, tr.transaction_hash,
       f.grp as fg, f.policy as fp, f.entity_id as fe, f.entity_name as fn, f.category as fc,
       o.grp as tg, o.policy as tp, o.entity_id as te, o.entity_name as tn, o.category as tc
from usdc_transfers tr
left join lbl f on f.address = tr.from_address and f.from_block <= tr.block_number
left join lbl o on o.address = tr.to_address and o.from_block <= tr.block_number;

-- Entity flow legs
create temp table legs as
with c as (
  select *, (fg is null or tg is null or fg <> tg) as counted,
         coalesce(fp = 'boundary', false) as fb, coalesce(tp = 'boundary', false) as tb from t)
select bucket_start, 'out' as direction, case when fb then fe else 'unidentified' end as entity_id,
       case when fb then fn else 'Unidentified' end as entity_name, case when fb then fc else 'unidentified' end as category, value
from c where counted
union all
select bucket_start, 'in', case when tb then te else 'unidentified' end,
       case when tb then tn else 'Unidentified' end, case when tb then tc else 'unidentified' end, value
from c where counted;

-- Net value per transaction: sum of positive per-address net changes
create temp table tx_adj as
select transaction_hash, bucket_start, sum(greatest(net, 0)) as adj from (
  select transaction_hash, bucket_start, addr, sum(d) as net from (
    select tr.transaction_hash, tr.block_timestamp - (tr.block_timestamp % 60) as bucket_start, tr.to_address as addr, tr.value as d from usdc_transfers tr where from_address <> to_address
    union all select tr.transaction_hash, tr.block_timestamp - (tr.block_timestamp % 60), tr.from_address, -tr.value from usdc_transfers tr where from_address <> to_address) x
  group by 1,2,3) y group by 1,2;

select 'volume buckets: rows differing' as check, count(*) from (
  select bucket_start, count(*) n, sum(value) v from t group by 1) e
full join (select bucket_start, transfer_count n, total_value v from usdc_transfer_volume_buckets) a using (bucket_start)
where e.n is distinct from a.n or e.v is distinct from a.v
union all
select 'volume buckets: adjusted_value differing', count(*) from (select bucket_start, sum(adj) v from tx_adj group by 1) e
full join (select bucket_start, adjusted_value v from usdc_transfer_volume_buckets) a using (bucket_start)
where e.v is distinct from a.v
union all
select 'entity buckets: rows differing', count(*) from (
  select bucket_start, entity_id, direction, count(*) n, sum(value) v from legs group by 1,2,3) e
full join (select bucket_start, entity_id, direction, transfer_count n, total_value v from usdc_entity_flow_buckets) a using (bucket_start, entity_id, direction)
where e.n is distinct from a.n or e.v is distinct from a.v
union all
select 'entity buckets: expected rows', count(*) from (select 1 from legs group by bucket_start, entity_id, direction) z
union all
select 'pair buckets: rows differing', count(*) from (
  select bucket_start,
         case when fp = 'boundary' then fe else 'unidentified' end as from_entity_id,
         case when tp = 'boundary' then te else 'unidentified' end as to_entity_id, count(*) n, sum(value) v
  from t where fg is null or tg is null or fg <> tg group by 1,2,3) e
full join (select bucket_start, from_entity_id, to_entity_id, transfer_count n, total_value v from usdc_entity_pair_flow_buckets) a using (bucket_start, from_entity_id, to_entity_id)
where e.n is distinct from a.n or e.v is distinct from a.v
union all
select 'pair buckets: expected rows', count(*) from (select 1 from t where fg is null or tg is null or fg <> tg group by bucket_start,
  case when fp = 'boundary' then fe else 'unidentified' end, case when tp = 'boundary' then te else 'unidentified' end) z
union all
select 'bridge buckets: rows differing', count(*) from (
  select (b.block_timestamp - b.block_timestamp % 60) as bucket_start, bridge_id, direction, remote_network_id, coalesce(remote_chain_id::text,'-') rc, coalesce(remote_domain::text,'-') rd, count(*) n, sum(value) v
  from usdc_bridge_events b group by 1,2,3,4,5,6) e
full join (select bucket_start, bridge_id, direction, remote_network_id, coalesce(remote_chain_id::text,'-') rc, coalesce(remote_domain::text,'-') rd, event_count n, total_value v from usdc_bridge_flow_buckets) a
  using (bucket_start, bridge_id, direction, remote_network_id, rc, rd)
where e.n is distinct from a.n or e.v is distinct from a.v;
