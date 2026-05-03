-- Validacion rapida de estructura y seguridad para Nexus + Supabase
-- Ejecuta este script en SQL Editor despues de correr supabase_schema.sql

with checks as (
  select 'table:nexus_module_records' as check_name,
         exists (
           select 1
           from information_schema.tables
           where table_schema = 'public' and table_name = 'nexus_module_records'
         ) as ok
  union all
  select 'table:nexus_module_sequences',
         exists (
           select 1
           from information_schema.tables
           where table_schema = 'public' and table_name = 'nexus_module_sequences'
         )
  union all
  select 'table:nexus_user_app_state',
         exists (
           select 1
           from information_schema.tables
           where table_schema = 'public' and table_name = 'nexus_user_app_state'
         )
  union all
  select 'rls:nexus_module_records',
         coalesce((select relrowsecurity from pg_class where oid = 'public.nexus_module_records'::regclass), false)
  union all
  select 'rls:nexus_module_sequences',
         coalesce((select relrowsecurity from pg_class where oid = 'public.nexus_module_sequences'::regclass), false)
  union all
  select 'rls:nexus_user_app_state',
         coalesce((select relrowsecurity from pg_class where oid = 'public.nexus_user_app_state'::regclass), false)
  union all
  select 'policies:nexus_module_records',
         (select count(*) from pg_policies where schemaname = 'public' and tablename = 'nexus_module_records') >= 4
  union all
  select 'policies:nexus_module_sequences',
         (select count(*) from pg_policies where schemaname = 'public' and tablename = 'nexus_module_sequences') >= 4
  union all
  select 'policies:nexus_user_app_state',
         (select count(*) from pg_policies where schemaname = 'public' and tablename = 'nexus_user_app_state') >= 4
  union all
  select 'trigger:records_updated_at',
         exists (
           select 1
           from pg_trigger
           where tgname = 'tr_nexus_module_records_updated_at'
             and tgrelid = 'public.nexus_module_records'::regclass
             and not tgisinternal
         )
  union all
  select 'trigger:sequences_updated_at',
         exists (
           select 1
           from pg_trigger
           where tgname = 'tr_nexus_module_sequences_updated_at'
             and tgrelid = 'public.nexus_module_sequences'::regclass
             and not tgisinternal
         )
  union all
  select 'trigger:state_updated_at',
         exists (
           select 1
           from pg_trigger
           where tgname = 'tr_nexus_user_app_state_updated_at'
             and tgrelid = 'public.nexus_user_app_state'::regclass
             and not tgisinternal
         )
  union all
  select 'grant:authenticated_records_crud',
         has_table_privilege('authenticated', 'public.nexus_module_records', 'select,insert,update,delete')
  union all
  select 'grant:authenticated_sequences_crud',
         has_table_privilege('authenticated', 'public.nexus_module_sequences', 'select,insert,update,delete')
  union all
  select 'grant:authenticated_state_crud',
         has_table_privilege('authenticated', 'public.nexus_user_app_state', 'select,insert,update,delete')
  union all
  select 'constraint:records_seq_non_negative',
         exists (
           select 1 from pg_constraint
           where conname = 'nexus_module_records_seq_non_negative'
             and conrelid = 'public.nexus_module_records'::regclass
         )
  union all
  select 'constraint:sequences_last_seq_non_negative',
         exists (
           select 1 from pg_constraint
           where conname = 'nexus_module_sequences_last_seq_non_negative'
             and conrelid = 'public.nexus_module_sequences'::regclass
         )
)
select
  check_name,
  case when ok then 'PASS' else 'FAIL' end as result
from checks
order by check_name;
