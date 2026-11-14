
create schema if not exists companion_private;
revoke all on schema companion_private from public,anon;
grant usage on schema companion_private to authenticated;

create table public.beta_access(user_id uuid primary key references auth.users(id) on delete cascade);
alter table public.beta_access enable row level security;
revoke all on public.beta_access from anon,authenticated;

create function companion_private.is_beta() returns boolean language sql stable security definer set search_path=''
as $$ select auth.uid() is not null and exists(select 1 from public.beta_access where user_id=auth.uid()) $$;
revoke all on function companion_private.is_beta() from public,anon;
grant execute on function companion_private.is_beta() to authenticated;
create function public.has_beta_access() returns boolean language sql stable security invoker set search_path=''
as $$ select companion_private.is_beta() $$;
revoke all on function public.has_beta_access() from public,anon;
grant execute on function public.has_beta_access() to authenticated;

create table public.companion_profiles(
 owner uuid primary key references auth.users(id) on delete cascade,
 locale text not null default 'en' check(locale in ('en','it','es','ko','zh-Hans','yue-Hant','de')),
 timezone text not null default 'Europe/Berlin', updated_at timestamptz not null default now()
);
create table public.companion_relationships(
 id uuid primary key default gen_random_uuid(), owner uuid not null references auth.users(id) on delete cascade,
 label text not null check(length(label) between 1 and 80), created_at timestamptz not null default now()
);
create table public.companion_checkins(
 id uuid primary key default gen_random_uuid(), owner uuid not null references auth.users(id) on delete cascade,
 locale text not null, status text not null default 'pending' check(status in ('pending','fulfilled','skipped','deferred')),
 version integer not null default 0, prompt text not null, draft text not null,
 created_at timestamptz not null default now(), deadline timestamptz, snoozed_until timestamptz,
 unique(id,owner)
);
create table public.companion_entries(
 id uuid primary key default gen_random_uuid(), owner uuid not null references auth.users(id) on delete cascade,
 checkin_id uuid unique, text text not null check(length(text) between 1 and 5000),
 locale text not null, created_at timestamptz not null default now(),
 foreign key(checkin_id,owner) references public.companion_checkins(id,owner) on delete cascade
);

alter table public.companion_profiles enable row level security;
revoke all on public.companion_profiles from anon,authenticated;
grant select on public.companion_profiles to authenticated;
create policy own_select on public.companion_profiles for select to authenticated using(owner=(select auth.uid()) and (select companion_private.is_beta()));

alter table public.companion_relationships enable row level security;
revoke all on public.companion_relationships from anon,authenticated;
grant select on public.companion_relationships to authenticated;
create policy own_select on public.companion_relationships for select to authenticated using(owner=(select auth.uid()) and (select companion_private.is_beta()));

alter table public.companion_checkins enable row level security;
revoke all on public.companion_checkins from anon,authenticated;
grant select on public.companion_checkins to authenticated;
create policy own_select on public.companion_checkins for select to authenticated using(owner=(select auth.uid()) and (select companion_private.is_beta()));

alter table public.companion_entries enable row level security;
revoke all on public.companion_entries from anon,authenticated;
grant select on public.companion_entries to authenticated;
create policy own_select on public.companion_entries for select to authenticated using(owner=(select auth.uid()) and (select companion_private.is_beta()));

grant insert,update on public.companion_profiles to authenticated;
create policy own_insert on public.companion_profiles for insert to authenticated with check(owner=(select auth.uid()) and (select companion_private.is_beta()));
create policy own_update on public.companion_profiles for update to authenticated using(owner=(select auth.uid()) and (select companion_private.is_beta())) with check(owner=(select auth.uid()) and (select companion_private.is_beta()));

grant insert,update on public.companion_relationships to authenticated;
create policy own_insert on public.companion_relationships for insert to authenticated with check(owner=(select auth.uid()) and (select companion_private.is_beta()));
create policy own_update on public.companion_relationships for update to authenticated using(owner=(select auth.uid()) and (select companion_private.is_beta())) with check(owner=(select auth.uid()) and (select companion_private.is_beta()));

create function companion_private.create_checkin(p_locale text,p_prompt text,p_draft text) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); result public.companion_checkins;
begin
 if not companion_private.is_beta() then raise exception 'beta_access_required'; end if;
 if p_locale not in ('en','it','es','ko','zh-Hans','yue-Hant','de') or length(p_prompt)>1000 or length(p_draft)>5000 then raise exception 'invalid_input'; end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,0));
 update public.companion_checkins set status='skipped',version=version+1 where owner=actor and status='pending' and deadline<=now();
 update public.companion_checkins set status='pending',version=version+1,deadline=now()+interval '30 minutes',snoozed_until=null where owner=actor and status='deferred' and snoozed_until<=now();
 if exists(select 1 from public.companion_checkins where owner=actor and status in ('pending','deferred')) then raise exception 'already_pending'; end if;
 insert into public.companion_checkins(owner,locale,prompt,draft,deadline) values(actor,p_locale,p_prompt,p_draft,now()+interval '30 minutes') returning * into result;
 return to_jsonb(result);
end $$;
create function companion_private.decide_checkin(p_id uuid,p_action text,p_version integer,p_text text) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); item public.companion_checkins; next_status text;
begin
 if not companion_private.is_beta() then raise exception 'beta_access_required'; end if;
 select * into item from public.companion_checkins where id=p_id and owner=actor for update;
 if not found then raise exception 'not_found'; end if;
 if item.status<>'pending' or item.version<>p_version or item.deadline<=now() then raise exception 'stale_decision'; end if;
 next_status:=case p_action when 'approve' then 'fulfilled' when 'skip' then 'skipped' when 'snooze' then 'deferred' else null end;
 if next_status is null then raise exception 'invalid_action'; end if;
 if p_action='approve' and (p_text is null or length(trim(p_text)) not between 1 and 5000) then raise exception 'invalid_text'; end if;
 update public.companion_checkins set status=next_status,version=version+1,deadline=null,snoozed_until=case when p_action='snooze' then now()+interval '1 hour' else null end where id=p_id;
 if p_action='approve' then insert into public.companion_entries(owner,checkin_id,text,locale) values(actor,p_id,trim(p_text),item.locale); end if;
 return jsonb_build_object('status',next_status);
end $$;
revoke all on function companion_private.create_checkin(text,text,text) from public,anon;
revoke all on function companion_private.decide_checkin(uuid,text,integer,text) from public,anon;
grant execute on function companion_private.create_checkin(text,text,text),companion_private.decide_checkin(uuid,text,integer,text) to authenticated;
create function public.create_private_checkin(p_locale text,p_prompt text,p_draft text) returns jsonb language sql security invoker set search_path='' as $$ select companion_private.create_checkin(p_locale,p_prompt,p_draft) $$;
create function public.decide_private_checkin(p_id uuid,p_action text,p_version integer,p_text text default '') returns jsonb language sql security invoker set search_path='' as $$ select companion_private.decide_checkin(p_id,p_action,p_version,p_text) $$;
revoke all on function public.create_private_checkin(text,text,text),public.decide_private_checkin(uuid,text,integer,text) from public,anon;
grant execute on function public.create_private_checkin(text,text,text),public.decide_private_checkin(uuid,text,integer,text) to authenticated;
create index on public.companion_checkins(owner,created_at desc);
create index on public.companion_entries(owner,created_at desc);
create index on public.companion_relationships(owner);
