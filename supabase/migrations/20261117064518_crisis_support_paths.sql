-- Only a generated-output notice. Never a user diagnosis or shared risk profile.
create table companion_private.support_notices(
 id uuid primary key default extensions.gen_random_uuid(),
 owner uuid not null references auth.users(id) on delete cascade,
 job_id uuid not null unique references companion_private.cloud_jobs(id) on delete cascade,
 kind text not null check(kind in ('self_harm','violence','stalking','refuse','unavailable')),
 origin text not null default 'generated_output' check(origin='generated_output'),
 created_at timestamptz not null default now()
);
create index support_notices_owner on companion_private.support_notices(owner,created_at);
alter table companion_private.support_notices enable row level security;
revoke all on companion_private.support_notices from public,anon,authenticated,companion_worker,companion_meter;

-- Keep the paid/publication logic intact and inaccessible except through its wrapper.
alter function companion_private.ai_worker_job(text,jsonb) rename to ai_worker_job_core;
revoke all on function companion_private.ai_worker_job_core(text,jsonb) from public,anon,authenticated,companion_worker,companion_meter;
create function companion_private.ai_worker_job(p_action text,p_args jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j companion_private.cloud_jobs; result jsonb;
begin
 if p_action<>'hold' then return companion_private.ai_worker_job_core(p_action,p_args);end if;
 perform pg_advisory_xact_lock(731502615);
 select * into j from companion_private.cloud_jobs
  where id=(p_args->>'job_id')::uuid and processor='deepseek' and status='processing'
   and lease=(p_args->>'lease')::uuid and lease_until>now() for update;
 if not found then return jsonb_build_object('held',false);end if;
 -- The core releases the lease even after live/review/consent revocation.
 result:=companion_private.ai_worker_job_core(p_action,p_args);
 if (result->>'held')::boolean and p_args->>'support_kind' in ('self_harm','violence','stalking','refuse','unavailable') then
  insert into companion_private.support_notices(owner,job_id,kind)
   values(j.owner,j.id,p_args->>'support_kind') on conflict(job_id) do nothing;
 end if;
 return result;
end $$;
revoke all on function companion_private.ai_worker_job(text,jsonb) from public,anon,authenticated,companion_worker;
grant execute on function companion_private.ai_worker_job(text,jsonb) to companion_meter;

-- Privileged storage access is necessary; authorization always comes from auth.uid.
-- Peek is discreet: not even the risk category is sent until an explicit reveal.
create function companion_private.support_notice(p_action text,p_args jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid(); n companion_private.support_notices;
begin
 if who is null or not companion_private.is_beta() then raise exception 'access_denied';end if;
 if p_action='peek' then
  select * into n from companion_private.support_notices where owner=who order by created_at,id limit 1;
  return jsonb_build_object('id',n.id);
 end if;
 select * into n from companion_private.support_notices where owner=who and id=(p_args->>'id')::uuid;
 if not found then return jsonb_build_object('id',null);end if;
 if p_action='reveal' then return jsonb_build_object('id',n.id,'kind',n.kind,'origin',n.origin);end if;
 if p_action='dismiss' then
  delete from companion_private.support_notices where owner=who and id=n.id;
  return jsonb_build_object('dismissed',true);
 end if;
 raise exception 'invalid_action';
end $$;
revoke all on function companion_private.support_notice(text,jsonb) from public,anon,companion_worker,companion_meter;
grant execute on function companion_private.support_notice(text,jsonb) to authenticated;
create function public.support_notice(p_action text,p_args jsonb default '{}') returns jsonb
language sql security invoker set search_path='' as $$select companion_private.support_notice(p_action,p_args)$$;
revoke all on function public.support_notice(text,jsonb) from public,anon;
grant execute on function public.support_notice(text,jsonb) to authenticated;
