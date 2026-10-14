begin;
create schema if not exists meu_bolso_private;
revoke all on schema meu_bolso_private from public,anon,authenticated;
grant usage on schema meu_bolso_private to service_role;
create table meu_bolso_private.pluggy_connections (
 user_id uuid primary key references auth.users(id) on delete cascade,
 secret_id uuid not null,
 updated_at timestamptz not null default now()
);
alter table meu_bolso_private.pluggy_connections enable row level security;
revoke all on meu_bolso_private.pluggy_connections from public,anon,authenticated;
create function meu_bolso_private.pluggy_store(p_user uuid,p_credentials jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare sid uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 select secret_id into sid from meu_bolso_private.pluggy_connections where user_id=p_user for update;
 if sid is null then
   select vault.create_secret(p_credentials::text,'meu-bolso-pluggy-'||p_user::text) into sid;
   insert into meu_bolso_private.pluggy_connections(user_id,secret_id) values(p_user,sid);
 else
   perform vault.update_secret(sid,p_credentials::text);
   update meu_bolso_private.pluggy_connections set updated_at=now() where user_id=p_user;
 end if;
end $$;
create function meu_bolso_private.pluggy_load(p_user uuid) returns jsonb
language sql security definer set search_path='' as $$
 select s.decrypted_secret::jsonb from meu_bolso_private.pluggy_connections c join vault.decrypted_secrets s on s.id=c.secret_id where c.user_id=p_user
$$;
create function meu_bolso_private.pluggy_unlink(p_user uuid) returns void
language plpgsql security definer set search_path='' as $$
declare sid uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 select secret_id into sid from meu_bolso_private.pluggy_connections where user_id=p_user for update;
 delete from meu_bolso_private.pluggy_connections where user_id=p_user;
 if sid is not null then delete from vault.secrets where id=sid; end if;
 delete from public.meu_bolso_bank_cache where user_id=p_user;
end $$;
revoke all on function meu_bolso_private.pluggy_store(uuid,jsonb),meu_bolso_private.pluggy_load(uuid),meu_bolso_private.pluggy_unlink(uuid) from public,anon,authenticated;
grant execute on function meu_bolso_private.pluggy_store(uuid,jsonb),meu_bolso_private.pluggy_load(uuid),meu_bolso_private.pluggy_unlink(uuid) to service_role;
create function public.mb_pluggy_store(p_user uuid,p_credentials jsonb) returns void language sql security invoker set search_path='' as $$ select meu_bolso_private.pluggy_store(p_user,p_credentials) $$;
create function public.mb_pluggy_load(p_user uuid) returns jsonb language sql security invoker set search_path='' as $$ select meu_bolso_private.pluggy_load(p_user) $$;
create function public.mb_pluggy_unlink(p_user uuid) returns void language sql security invoker set search_path='' as $$ select meu_bolso_private.pluggy_unlink(p_user) $$;
revoke all on function public.mb_pluggy_store(uuid,jsonb),public.mb_pluggy_load(uuid),public.mb_pluggy_unlink(uuid) from public,anon,authenticated;
grant execute on function public.mb_pluggy_store(uuid,jsonb),public.mb_pluggy_load(uuid),public.mb_pluggy_unlink(uuid) to service_role;
create table public.meu_bolso_bank_cache (
 user_id uuid not null references auth.users(id) on delete cascade,
 account_id text not null,
 month text not null check(month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
 payload jsonb not null,
 fetched_at timestamptz not null default now(),
 primary key(user_id,account_id,month)
);
alter table public.meu_bolso_bank_cache enable row level security;
revoke all on public.meu_bolso_bank_cache from public,anon,authenticated;
grant select on public.meu_bolso_bank_cache to authenticated;
grant select,insert,update,delete on public.meu_bolso_bank_cache to service_role;
create policy bank_cache_owner on public.meu_bolso_bank_cache for select to authenticated using((select auth.uid())=user_id);
commit;
