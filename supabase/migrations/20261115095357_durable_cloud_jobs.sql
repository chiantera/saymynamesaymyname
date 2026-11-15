-- Worker can execute narrow functions, never browse private tables or Auth.
do $$ begin if not exists(select 1 from pg_roles where rolname='companion_worker') then create role companion_worker nologin; end if; end $$;
grant usage on schema companion_private to companion_worker;
create table companion_private.cloud_jobs(
 id uuid primary key default extensions.gen_random_uuid(), owner uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null, relationship_id uuid references public.companion_relationships(id) on delete cascade,
 member_generation bigint, locale text not null, scheduled boolean not null default false,
 status text not null default 'queued' check(status in ('queued','processing','done','cancelled','failed')),
 attempts integer not null default 0, lease uuid, lease_until timestamptz,
 available_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '30 minutes',
 created_at timestamptz not null default now(), finished_at timestamptz, unique(owner,request_id)
);
create unique index cloud_jobs_one_active on companion_private.cloud_jobs(owner) where status in ('queued','processing');
create index cloud_jobs_due on companion_private.cloud_jobs(available_at,created_at) where status in ('queued','processing');
create index cloud_jobs_relationship on companion_private.cloud_jobs(relationship_id);
alter table companion_private.cloud_jobs enable row level security;
revoke all on companion_private.cloud_jobs from public,anon,authenticated,companion_worker;
alter table public.companion_checkins add column cloud_job_id uuid unique references companion_private.cloud_jobs(id) on delete set null;

create function companion_private.job_allowed(j companion_private.cloud_jobs) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users u join public.beta_access b on b.user_id=u.id where u.id=j.owner and u.email_confirmed_at is not null and u.deleted_at is null)
 and (j.relationship_id is null or exists(select 1 from companion_private.memberships m where m.relationship_id=j.relationship_id and m.user_id=j.owner and m.generation=j.member_generation and m.status='active' and m.archived_at is null));
$$;
create function companion_private.queue_action(p_action text,p_args jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); j companion_private.cloud_jobs; rid uuid; gen bigint; loc text;
begin
 perform pg_advisory_xact_lock(731502615);
 if not companion_private.is_beta() then raise exception 'beta_access_required';end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,0));
 if p_action='list' then
  return coalesce((select jsonb_agg(jsonb_build_object('id',id,'status',status,'created_at',created_at,'attempts',attempts)) from (select * from companion_private.cloud_jobs where owner=actor order by created_at desc limit 30) q),'[]'::jsonb);
 elsif p_action='cancel' then
  update companion_private.cloud_jobs set status='cancelled',lease=null,lease_until=null,finished_at=now() where id=(p_args->>'id')::uuid and owner=actor and status in ('queued','processing');
  return '{}'::jsonb;
 elsif p_action<>'enqueue' then raise exception 'invalid_action';end if;
 select * into j from companion_private.cloud_jobs where owner=actor and request_id=(p_args->>'request_id')::uuid;
 if found then return jsonb_build_object('id',j.id,'status',j.status);end if;
 if exists(select 1 from public.companion_checkins where owner=actor and status in ('pending','deferred') and (status='deferred' or deadline>now())) then raise exception 'already_pending';end if;
 rid:=nullif(p_args->>'relationship_id','')::uuid;
 select locale into loc from public.companion_profiles where owner=actor;
 if loc is null then raise exception 'profile_required';end if;
 if rid is not null then select generation into gen from companion_private.memberships where relationship_id=rid and user_id=actor and status='active' and archived_at is null;
  if not found then raise exception 'member_unavailable';end if;end if;
 insert into companion_private.cloud_jobs(owner,request_id,relationship_id,member_generation,locale) values(actor,(p_args->>'request_id')::uuid,rid,gen,loc) returning * into j;
 return jsonb_build_object('id',j.id,'status',j.status);
end $$;
create function companion_private.claim_cloud_job() returns jsonb
language plpgsql security definer set search_path='' as $$
declare j companion_private.cloud_jobs;
begin
 perform pg_advisory_xact_lock(731502615);
 update companion_private.cloud_jobs set status=case when expires_at<=now() or not companion_private.job_allowed(cloud_jobs) then 'cancelled' else 'failed' end,finished_at=now(),lease=null,lease_until=null
 where status in ('queued','processing') and (expires_at<=now() or not companion_private.job_allowed(cloud_jobs) or (attempts>=3 and lease_until<=now()));
 select * into j from companion_private.cloud_jobs where expires_at>now() and attempts<3 and available_at<=now() and (status='queued' or (status='processing' and lease_until<=now())) order by created_at,id for update skip locked limit 1;
 if not found then return null;end if;
 update companion_private.cloud_jobs set status='processing',attempts=attempts+1,lease=extensions.gen_random_uuid(),lease_until=now()+interval '90 seconds' where id=j.id returning * into j;
 -- No journal/context text or recipient data is passed to this mock-only worker.
 return jsonb_build_object('id',j.id,'lease',j.lease,'locale',j.locale);
end $$;
create function companion_private.finish_cloud_job(p_id uuid,p_lease uuid,p_prompt text,p_draft text) returns boolean
language plpgsql security definer set search_path='' as $$
declare j companion_private.cloud_jobs;
begin
 perform pg_advisory_xact_lock(731502615);
 select * into j from companion_private.cloud_jobs where id=p_id for update;
 if not found or j.status<>'processing' or j.lease is distinct from p_lease or j.lease_until<=now() then return false;end if;
 perform pg_advisory_xact_lock(hashtextextended(j.owner::text,0));
 if j.expires_at<=now() or not companion_private.job_allowed(j) then
  update companion_private.cloud_jobs set status='cancelled',lease=null,lease_until=null,finished_at=now() where id=p_id;return false;end if;
 if p_prompt is null or p_draft is null or length(p_prompt) not between 1 and 1000 or length(p_draft) not between 1 and 5000 then raise exception 'invalid_content';end if;
 update public.companion_checkins set status='skipped',version=version+1 where owner=j.owner and status='pending' and deadline<=now();
 if exists(select 1 from public.companion_checkins where owner=j.owner and status in ('pending','deferred')) then
  update companion_private.cloud_jobs set status='cancelled',lease=null,lease_until=null,finished_at=now() where id=p_id;return false;end if;
 insert into public.companion_checkins(owner,locale,prompt,draft,deadline,cloud_job_id) values(j.owner,j.locale,p_prompt,p_draft,now()+interval '30 minutes',j.id);
 update companion_private.cloud_jobs set status='done',lease=null,lease_until=null,finished_at=now() where id=p_id;
 return true;
end $$;
revoke all on function companion_private.job_allowed(companion_private.cloud_jobs),companion_private.queue_action(text,jsonb),companion_private.claim_cloud_job(),companion_private.finish_cloud_job(uuid,uuid,text,text) from public,anon,authenticated,companion_worker;
grant execute on function companion_private.claim_cloud_job(),companion_private.finish_cloud_job(uuid,uuid,text,text) to companion_worker;
grant execute on function companion_private.queue_action(text,jsonb) to authenticated;
create function public.cloud_queue(p_action text,p_args jsonb default '{}'::jsonb) returns jsonb language sql security invoker set search_path='' as $$ select companion_private.queue_action(p_action,p_args) $$;
revoke all on function public.cloud_queue(text,jsonb) from public,anon,authenticated;
grant execute on function public.cloud_queue(text,jsonb) to authenticated;
