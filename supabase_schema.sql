create extension if not exists pgcrypto;

create table if not exists public.nexus_module_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  module_id text not null,
  record_internal_id text not null,
  seq bigint not null default 0,
  record_id text not null default '',
  created_label text not null default '',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, module_id, record_internal_id)
);

create index if not exists idx_nexus_module_records_user_module
  on public.nexus_module_records(user_id, module_id);

create index if not exists idx_nexus_module_records_user_module_seq
  on public.nexus_module_records(user_id, module_id, seq);

create index if not exists idx_nexus_module_records_user_module_created_at
  on public.nexus_module_records(user_id, module_id, created_at);

create table if not exists public.nexus_module_sequences (
  user_id uuid not null references auth.users(id) on delete cascade,
  module_id text not null,
  last_seq bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, module_id)
);

create table if not exists public.nexus_user_app_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  activity_log jsonb not null default '[]'::jsonb,
  due_alerts_state jsonb not null default '{}'::jsonb,
  notifications_last_read_at text not null default '',
  last_opened_module text not null default '',
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'nexus_module_records_module_id_not_blank'
      and conrelid = 'public.nexus_module_records'::regclass
  ) then
    alter table public.nexus_module_records
      add constraint nexus_module_records_module_id_not_blank
      check (length(trim(module_id)) > 0);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'nexus_module_records_record_internal_id_not_blank'
      and conrelid = 'public.nexus_module_records'::regclass
  ) then
    alter table public.nexus_module_records
      add constraint nexus_module_records_record_internal_id_not_blank
      check (length(trim(record_internal_id)) > 0);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'nexus_module_records_seq_non_negative'
      and conrelid = 'public.nexus_module_records'::regclass
  ) then
    alter table public.nexus_module_records
      add constraint nexus_module_records_seq_non_negative
      check (seq >= 0);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'nexus_module_sequences_module_id_not_blank'
      and conrelid = 'public.nexus_module_sequences'::regclass
  ) then
    alter table public.nexus_module_sequences
      add constraint nexus_module_sequences_module_id_not_blank
      check (length(trim(module_id)) > 0);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'nexus_module_sequences_last_seq_non_negative'
      and conrelid = 'public.nexus_module_sequences'::regclass
  ) then
    alter table public.nexus_module_sequences
      add constraint nexus_module_sequences_last_seq_non_negative
      check (last_seq >= 0);
  end if;
end
$$;

create or replace function public.nexus_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tr_nexus_module_records_updated_at on public.nexus_module_records;
create trigger tr_nexus_module_records_updated_at
before update on public.nexus_module_records
for each row
execute function public.nexus_set_updated_at();

drop trigger if exists tr_nexus_module_sequences_updated_at on public.nexus_module_sequences;
create trigger tr_nexus_module_sequences_updated_at
before update on public.nexus_module_sequences
for each row
execute function public.nexus_set_updated_at();

drop trigger if exists tr_nexus_user_app_state_updated_at on public.nexus_user_app_state;
create trigger tr_nexus_user_app_state_updated_at
before update on public.nexus_user_app_state
for each row
execute function public.nexus_set_updated_at();

alter table public.nexus_module_records enable row level security;
alter table public.nexus_module_sequences enable row level security;
alter table public.nexus_user_app_state enable row level security;

drop policy if exists "nexus_records_select_own" on public.nexus_module_records;
create policy "nexus_records_select_own"
on public.nexus_module_records
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "nexus_records_insert_own" on public.nexus_module_records;
create policy "nexus_records_insert_own"
on public.nexus_module_records
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "nexus_records_update_own" on public.nexus_module_records;
create policy "nexus_records_update_own"
on public.nexus_module_records
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "nexus_records_delete_own" on public.nexus_module_records;
create policy "nexus_records_delete_own"
on public.nexus_module_records
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "nexus_sequences_select_own" on public.nexus_module_sequences;
create policy "nexus_sequences_select_own"
on public.nexus_module_sequences
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "nexus_sequences_insert_own" on public.nexus_module_sequences;
create policy "nexus_sequences_insert_own"
on public.nexus_module_sequences
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "nexus_sequences_update_own" on public.nexus_module_sequences;
create policy "nexus_sequences_update_own"
on public.nexus_module_sequences
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "nexus_sequences_delete_own" on public.nexus_module_sequences;
create policy "nexus_sequences_delete_own"
on public.nexus_module_sequences
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "nexus_state_select_own" on public.nexus_user_app_state;
create policy "nexus_state_select_own"
on public.nexus_user_app_state
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "nexus_state_insert_own" on public.nexus_user_app_state;
create policy "nexus_state_insert_own"
on public.nexus_user_app_state
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "nexus_state_update_own" on public.nexus_user_app_state;
create policy "nexus_state_update_own"
on public.nexus_user_app_state
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "nexus_state_delete_own" on public.nexus_user_app_state;
create policy "nexus_state_delete_own"
on public.nexus_user_app_state
for delete
to authenticated
using (auth.uid() = user_id);

grant usage on schema public to authenticated, service_role;

revoke all on table public.nexus_module_records from public;
revoke all on table public.nexus_module_sequences from public;
revoke all on table public.nexus_user_app_state from public;
revoke all on table public.nexus_module_records from anon;
revoke all on table public.nexus_module_sequences from anon;
revoke all on table public.nexus_user_app_state from anon;

grant select, insert, update, delete on table public.nexus_module_records to authenticated, service_role;
grant select, insert, update, delete on table public.nexus_module_sequences to authenticated, service_role;
grant select, insert, update, delete on table public.nexus_user_app_state to authenticated, service_role;
