-- Compare indexed rows with the TSVs from scripts/expected-from-rpc.mjs for one block range.
--   psql "$DATABASE_URL" -v dir=/path/to/out -v from=53260000 -v to=53261799 -f scripts/compare.sql
create schema if not exists verify;
drop table if exists verify.exp_transfers, verify.exp_bridge;
create table verify.exp_transfers (id text, block_number bigint, transaction_hash text, log_index int, from_address text, to_address text, value numeric);
create table verify.exp_bridge (id text, block_number bigint, bridge_id text, direction text, source_event text, value numeric, remote_chain_id text, remote_domain text);
-- Server-side COPY: the file must be readable by the Postgres server (run psql in the container).
select :'dir' || '/expected_transfers.tsv' as exp_t, :'dir' || '/expected_bridge.tsv' as exp_b \gset
copy verify.exp_transfers from :'exp_t';
copy verify.exp_bridge from :'exp_b';

select 'transfers expected' as check, count(*) from verify.exp_transfers
union all select 'transfers indexed', count(*) from public.usdc_transfers where block_number between :from and :to
union all select 'transfers missing from index', count(*) from (select id from verify.exp_transfers except select id from public.usdc_transfers) x
union all select 'transfers unexpected in index', count(*) from (select id from public.usdc_transfers where block_number between :from and :to except select id from verify.exp_transfers) x
union all select 'transfers with a differing field', count(*) from verify.exp_transfers e join public.usdc_transfers t using (id)
  where (e.block_number, e.transaction_hash, e.log_index, e.from_address, e.to_address, e.value)
        is distinct from (t.block_number, t.transaction_hash, t.log_index, t.from_address, t.to_address, t.value)
union all select 'bridge expected', count(*) from verify.exp_bridge
union all select 'bridge indexed', count(*) from public.usdc_bridge_events where block_number between :from and :to
union all select 'bridge missing from index', count(*) from (select id from verify.exp_bridge except select id from public.usdc_bridge_events) x
union all select 'bridge unexpected in index', count(*) from (select id from public.usdc_bridge_events where block_number between :from and :to except select id from verify.exp_bridge) x
union all select 'bridge with a differing field', count(*) from verify.exp_bridge e join public.usdc_bridge_events b using (id)
  where (e.bridge_id, e.direction, e.source_event, e.value, coalesce(e.remote_chain_id,''), coalesce(e.remote_domain,''))
        is distinct from (b.bridge_id, b.direction, b.source_event, b.value, coalesce(b.remote_chain_id::text,''), coalesce(b.remote_domain::text,''));
