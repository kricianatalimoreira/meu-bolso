begin;
create table public.meu_bolso_state (
  user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  data jsonb not null default '{"records":[],"budget":0}'::jsonb,
  revision bigint not null default 1 check (revision > 0),
  constraint valid_state check (
    jsonb_typeof(data) = 'object' and
    jsonb_typeof(data->'records') = 'array' and
    jsonb_typeof(data->'budget') = 'number' and
    (data->>'budget')::numeric >= 0
  )
);
alter table public.meu_bolso_state enable row level security;
revoke all on public.meu_bolso_state from anon;
grant select,insert,update on public.meu_bolso_state to authenticated;
create policy state_select on public.meu_bolso_state for select to authenticated using ((select auth.uid()) = user_id);
create policy state_insert on public.meu_bolso_state for insert to authenticated with check ((select auth.uid()) = user_id);
create policy state_update on public.meu_bolso_state for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
commit;
