create table companion_private.schedule_settings(
 owner uuid primary key references auth.users(id) on delete cascade,
 paused boolean not null default false,paused_until timestamptz,
 quiet_start time not null default '22:00',quiet_end time not null default '08:00',
 daily_cap integer not null default 3 check(daily_cap between 1 and 20),revision bigint not null default 1
);
create table companion_private.schedules(
 owner uuid not null references auth.users(id) on delete cascade,scope text not null default '',
 enabled boolean not null default false,cadence_hours integer not null default 6 check(cadence_hours between 3 and 12),
 primary key(owner,scope)
);
alter table companion_private.schedule_settings enable row level security;
alter table companion_private.schedules enable row level security;
revoke all on companion_private.schedule_settings,companion_private.schedules from public,anon,authenticated,companion_worker;
alter table companion_private.cloud_jobs add column schedule_revision bigint;
alter table public.companion_checkins drop constraint companion_checkins_status_check;
alter table public.companion_checkins add constraint companion_checkins_status_check check(status in ('pending','fulfilled','skipped','deferred','cancelled'));
create index cloud_jobs_receipts on companion_private.cloud_jobs(owner,finished_at) where scheduled and status='done';

create function companion_private.schedule_window(p_owner uuid,p_now timestamptz) returns boolean
language sql stable security definer set search_path='' as $$
 select not s.paused and (s.paused_until is null or s.paused_until<=p_now)
 and (s.quiet_start=s.quiet_end or not(case when s.quiet_start<s.quiet_end then
 (p_now at time zone p.timezone)::time>=s.quiet_start and (p_now at time zone p.timezone)::time<s.quiet_end
 else (p_now at time zone p.timezone)::time>=s.quiet_start or (p_now at time zone p.timezone)::time<s.quiet_end end))
 from companion_private.schedule_settings s join public.companion_profiles p on p.owner=s.owner where s.owner=p_owner;
$$;
create function companion_private.schedule_eligible(p_owner uuid,p_now timestamptz) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce(companion_private.schedule_window(p_owner,p_now),false)
 and (select count(*) from companion_private.cloud_jobs j where j.owner=p_owner and j.scheduled and j.status='done'
  and (j.finished_at at time zone p.timezone)::date=(p_now at time zone p.timezone)::date)<s.daily_cap
 and not exists(select 1 from companion_private.cloud_jobs j where j.owner=p_owner and j.scheduled and j.status='done'
  and j.finished_at>p_now-make_interval(hours=>(select min(cadence_hours) from companion_private.schedules where owner=p_owner and enabled)))
 from companion_private.schedule_settings s join public.companion_profiles p on p.owner=s.owner where s.owner=p_owner;
$$;
alter function companion_private.job_allowed(companion_private.cloud_jobs) rename to base_job_allowed;
create function companion_private.job_allowed(j companion_private.cloud_jobs) returns boolean
language sql stable security definer set search_path='' as $$
 select companion_private.base_job_allowed(j) and (not j.scheduled or (
 exists(select 1 from companion_private.schedule_settings s join companion_private.schedules c on c.owner=s.owner
 where s.owner=j.owner and c.scope=coalesce(j.relationship_id::text,'') and c.enabled and s.revision=j.schedule_revision)
 and coalesce(companion_private.schedule_eligible(j.owner,now()),false)));
$$;
create function companion_private.schedule_action(p_action text,p_args jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); v_scope text:=coalesce(p_args->>'scope',''); result jsonb;
begin
 perform pg_advisory_xact_lock(731502615);
 if not companion_private.is_beta() then raise exception 'beta_access_required';end if;
 if p_action='save' then
  if v_scope<>'' and not exists(select 1 from companion_private.memberships where relationship_id=v_scope::uuid and user_id=actor and status='active' and archived_at is null) then raise exception 'member_unavailable';end if;
  if not exists(select 1 from pg_timezone_names where name=(select timezone from public.companion_profiles where owner=actor)) then raise exception 'invalid_timezone';end if;
  if not exists(select 1 from companion_private.schedule_settings where owner=actor) and coalesce((p_args->>'revision')::bigint,0)<>0 then raise exception 'stale_schedule';end if;
  if exists(select 1 from companion_private.schedule_settings where owner=actor and revision is distinct from (p_args->>'revision')::bigint) then raise exception 'stale_schedule';end if;
  insert into companion_private.schedule_settings(owner,paused,paused_until,quiet_start,quiet_end,daily_cap)
   values(actor,(p_args->>'paused')::boolean,nullif(p_args->>'paused_until','')::timestamptz,(p_args->>'quiet_start')::time,(p_args->>'quiet_end')::time,(p_args->>'daily_cap')::integer)
   on conflict(owner) do update set paused=excluded.paused,paused_until=excluded.paused_until,quiet_start=excluded.quiet_start,quiet_end=excluded.quiet_end,daily_cap=excluded.daily_cap,revision=companion_private.schedule_settings.revision+1;
  insert into companion_private.schedules values(actor,v_scope,(p_args->>'enabled')::boolean,(p_args->>'cadence_hours')::integer)
   on conflict(owner,scope) do update set enabled=excluded.enabled,cadence_hours=excluded.cadence_hours;
  -- Every settings revision cancels old scheduled work; it is never replayed.
  update companion_private.cloud_jobs set status='cancelled',lease=null,lease_until=null,finished_at=now() where owner=actor and scheduled and status in ('queued','processing');
  update public.companion_checkins c set status='cancelled',version=version+1,deadline=null,snoozed_until=null
   where c.owner=actor and c.status in ('pending','deferred') and exists(select 1 from companion_private.cloud_jobs j where j.id=c.cloud_job_id and j.scheduled);
 elsif p_action<>'get' then raise exception 'invalid_action';end if;
 select jsonb_build_object('revision',s.revision,'paused',s.paused,'paused_until',s.paused_until,'quiet_start',to_char(s.quiet_start,'HH24:MI'),'quiet_end',to_char(s.quiet_end,'HH24:MI'),'daily_cap',s.daily_cap) into result from companion_private.schedule_settings s where s.owner=actor;
 return coalesce(result,jsonb_build_object('revision',0,'paused',false,'paused_until',null,'quiet_start','22:00','quiet_end','08:00','daily_cap',3))||jsonb_build_object('scopes',coalesce((select jsonb_agg(jsonb_build_object('scope',scope,'enabled',enabled,'cadence_hours',cadence_hours)) from companion_private.schedules where owner=actor),'[]'::jsonb));
end $$;
create function companion_private.dispatch_cloud_due(p_now timestamptz default now()) returns integer
language plpgsql security definer set search_path='' as $$
declare s record; inserted integer:=0; j companion_private.cloud_jobs;
begin
 perform pg_advisory_xact_lock(731502615);
 update public.companion_checkins set status='skipped',version=version+1,deadline=null where status='pending' and deadline<=p_now;
 for s in select c.*,p.locale,st.revision,m.generation from companion_private.schedules c join companion_private.schedule_settings st on st.owner=c.owner join public.companion_profiles p on p.owner=c.owner
 left join companion_private.memberships m on m.user_id=c.owner and m.relationship_id::text=c.scope
 where c.enabled and (c.scope='' or (m.status='active' and m.archived_at is null))
 order by (select max(finished_at) from companion_private.cloud_jobs q where q.owner=c.owner and coalesce(q.relationship_id::text,'')=c.scope and q.scheduled and q.status='done') nulls first,c.scope
 loop
  perform pg_advisory_xact_lock(hashtextextended(s.owner::text,0));
  if inserted>=100 then exit;end if;
  if not coalesce(companion_private.schedule_eligible(s.owner,p_now),false) then continue;end if;
  if exists(select 1 from companion_private.cloud_jobs where owner=s.owner and (status in ('queued','processing') or (scheduled and status='done' and coalesce(relationship_id::text,'')=s.scope and finished_at>p_now-make_interval(hours=>s.cadence_hours)))) then continue;end if;
  if exists(select 1 from public.companion_checkins where owner=s.owner and status in ('pending','deferred')) then continue;end if;
  j.owner:=s.owner;j.relationship_id:=nullif(s.scope,'')::uuid;j.member_generation:=s.generation;
  if not companion_private.base_job_allowed(j) then continue;end if;
  insert into companion_private.cloud_jobs(owner,request_id,relationship_id,member_generation,locale,scheduled,schedule_revision,created_at,available_at,expires_at)
   values(s.owner,extensions.gen_random_uuid(),j.relationship_id,s.generation,s.locale,true,s.revision,p_now,p_now,p_now+interval '30 minutes');
  inserted:=inserted+1;
 end loop;
 return inserted;
end $$;
revoke all on function companion_private.schedule_window(uuid,timestamptz),companion_private.schedule_eligible(uuid,timestamptz),companion_private.job_allowed(companion_private.cloud_jobs),companion_private.base_job_allowed(companion_private.cloud_jobs),companion_private.schedule_action(text,jsonb),companion_private.dispatch_cloud_due(timestamptz) from public,anon,authenticated,companion_worker;
grant execute on function companion_private.schedule_action(text,jsonb) to authenticated;
create function public.cloud_schedule(p_action text,p_args jsonb default '{}'::jsonb) returns jsonb language sql security invoker set search_path='' as $$ select companion_private.schedule_action(p_action,p_args) $$;
revoke all on function public.cloud_schedule(text,jsonb) from public,anon,authenticated;
grant execute on function public.cloud_schedule(text,jsonb) to authenticated;
create function companion_private.validate_profile_timezone() returns trigger language plpgsql set search_path='' as $$
begin if not exists(select 1 from pg_timezone_names where name=new.timezone) then raise exception 'invalid_timezone';end if;return new;end $$;
revoke all on function companion_private.validate_profile_timezone() from public,anon,authenticated,companion_worker;
create trigger validate_profile_timezone before insert or update on public.companion_profiles for each row execute function companion_private.validate_profile_timezone();
