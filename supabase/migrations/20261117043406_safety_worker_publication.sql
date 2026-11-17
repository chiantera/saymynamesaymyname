-- Offline-by-default local safety review. No reviewer approval is seeded.
create table companion_private.ai_safety_policies(
 id text primary key, enabled boolean not null default false,
 review_revision text, reviewed_at timestamptz, locales text[] not null default '{}',
 check(not enabled or (review_revision is not null and reviewed_at is not null and cardinality(locales)>0))
);
alter table companion_private.ai_safety_policies enable row level security;
revoke all on companion_private.ai_safety_policies from public,anon,authenticated,companion_worker,companion_meter;
insert into companion_private.ai_safety_policies(id) values('solo-safety-v1');
alter table companion_private.ai_usage_attempts add column output_digest text,
 add column safety_policy text, add column safety_review_revision text;
alter table companion_private.cloud_jobs add column processor text not null default 'mock'
 check(processor in ('mock','deepseek'));

-- Preserve existing mock behavior while excluding explicitly tagged AI jobs.
create or replace function companion_private.claim_cloud_job() returns jsonb
language plpgsql security definer set search_path='' as $$
declare j companion_private.cloud_jobs;
begin
 perform pg_advisory_xact_lock(731502615);
 update companion_private.cloud_jobs set status=case when expires_at<=now() or not companion_private.job_allowed(cloud_jobs) then 'cancelled' else 'failed' end,finished_at=now(),lease=null,lease_until=null
 where processor='mock' and status in ('queued','processing') and (expires_at<=now() or not companion_private.job_allowed(cloud_jobs) or (attempts>=3 and lease_until<=now()));
 select * into j from companion_private.cloud_jobs where processor='mock' and expires_at>now() and attempts<3 and available_at<=now() and (status='queued' or (status='processing' and lease_until<=now())) order by created_at,id for update skip locked limit 1;
 if not found then return null;end if;
 update companion_private.cloud_jobs set status='processing',attempts=attempts+1,lease=extensions.gen_random_uuid(),lease_until=now()+interval '90 seconds' where id=j.id returning * into j;
 return jsonb_build_object('id',j.id,'lease',j.lease,'locale',j.locale);
end $$;

alter function companion_private.finish_cloud_job(uuid,uuid,text,text) rename to finish_claimed_job;
revoke all on function companion_private.finish_claimed_job(uuid,uuid,text,text) from public,anon,authenticated,companion_worker,companion_meter;
create function companion_private.finish_cloud_job(p_id uuid,p_lease uuid,p_prompt text,p_draft text) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(731502615);
 if not exists(select 1 from companion_private.cloud_jobs where id=p_id and processor='mock') then return false;end if;
 return companion_private.finish_claimed_job(p_id,p_lease,p_prompt,p_draft);
end $$;
revoke all on function companion_private.finish_cloud_job(uuid,uuid,text,text) from public,anon,authenticated,companion_meter;
grant execute on function companion_private.finish_cloud_job(uuid,uuid,text,text) to companion_worker;

create function companion_private.ai_worker_job(p_action text,p_args jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j companion_private.cloud_jobs; a companion_private.ai_usage_attempts;
 p companion_private.ai_prices; s companion_private.ai_safety_policies; ctx jsonb;
 prompt_text text; draft_text text; digest_text text;
begin
 perform pg_advisory_xact_lock(731502615);
 if p_action='hold' then
  update companion_private.cloud_jobs set status='failed',lease=null,lease_until=null,finished_at=now()
   where id=(p_args->>'job_id')::uuid and status='processing'
    and lease=(p_args->>'lease')::uuid and lease_until>now();
  return jsonb_build_object('held',found);
 end if;
 if not exists(select 1 from companion_private.ai_budget_config where id and live_enabled) then raise exception 'live_ai_disabled';end if;
 select * into s from companion_private.ai_safety_policies where id='solo-safety-v1';
 if not found or not s.enabled or s.reviewed_at>now() then raise exception 'safety_unavailable';end if;
 if p_action='claim' then
  select * into p from companion_private.ai_prices where id=(p_args->>'price_id')::uuid;
  if not found or p.provider<>'deepseek' or p.capability<>'chat' or p.unit<>'tokens'
   or p.model not in ('deepseek-flash','deepseek-v4-pro') or not p.enabled
   or p.reviewed_at>now() or p.valid_until<=now() or p.fx_asof>now() then raise exception 'price_unavailable';end if;
  select q.* into j from companion_private.cloud_jobs q
   where q.processor='deepseek' and q.relationship_id is null and q.locale=any(s.locales)
    and q.expires_at>now() and q.attempts<3 and q.available_at<=now()
    and (q.status='queued' or (q.status='processing' and q.lease_until<=now()))
    and companion_private.job_allowed(q)
    and not exists(select 1 from companion_private.ai_user_budgets b where b.owner=q.owner and b.paused)
    and exists(select 1 from companion_private.ai_provider_catalog c join companion_private.ai_provider_grants g using(provider,capability)
     where c.provider='deepseek' and c.capability='chat' and c.enabled and c.reviewed_at<=now()
      and g.owner=q.owner and g.approved and g.review_revision=c.review_revision)
    -- Lost responses never cause a second paid call through automatic lease recovery.
    and not exists(select 1 from companion_private.ai_usage_attempts x where x.job_id=q.id and x.state<>'cancelled')
   order by q.created_at,q.id for update skip locked limit 1;
  if not found then return null;end if;
  update companion_private.cloud_jobs set status='processing',attempts=attempts+1,
   lease=extensions.gen_random_uuid(),lease_until=now()+interval '90 seconds' where id=j.id returning * into j;
  return jsonb_build_object('id',j.id,'lease',j.lease,'locale',j.locale,'attempt_no',
   coalesce((select max(attempt_no) from companion_private.ai_usage_attempts where job_id=j.id),0)+1);
 end if;
 if p_action not in ('authorize','publish') then raise exception 'invalid_action';end if;
 select * into j from companion_private.cloud_jobs where id=(p_args->>'job_id')::uuid and processor='deepseek';
 if not found then raise exception 'route_unavailable';end if;
 ctx:=companion_private.deepseek_authorize(p_args);
 if not (ctx->>'locale'=any(s.locales)) then raise exception 'safety_unavailable';end if;
 ctx:=ctx||jsonb_build_object('safety_policy',s.id,'safety_review_revision',s.review_revision);
 if p_action='authorize' then return ctx;end if;
 if ctx->>'review_revision' is distinct from p_args->>'review_revision'
  or s.id is distinct from p_args->>'safety_policy'
  or s.review_revision is distinct from p_args->>'safety_review_revision' then raise exception 'authorization_changed';end if;
 select * into a from companion_private.ai_usage_attempts where id=(p_args->>'attempt_id')::uuid;
 if not found or a.job_id is distinct from (p_args->>'job_id')::uuid
  or a.price_id is distinct from (p_args->>'price_id')::uuid or a.kind<>'checkin' or a.fallback
  or a.owner is distinct from j.owner or a.task_id is distinct from j.id
  or (a.usage->>'input')::numeric>(a.bounds->>'input')::numeric
  or (a.usage->>'output')::numeric>(a.bounds->>'output')::numeric
  or a.state not in ('estimated','reconciled') or a.usage is null or a.output_digest is not null then raise exception 'usage_unavailable';end if;
 prompt_text:=p_args->>'prompt';draft_text:=p_args->>'draft';
 if prompt_text is null or draft_text is null or length(trim(prompt_text)) not between 1 and 1000
  or length(trim(draft_text)) not between 1 and 5000 then raise exception 'invalid_content';end if;
 digest_text:=encode(extensions.digest(convert_to(octet_length(prompt_text)::text||':'||prompt_text||draft_text,'UTF8'),'sha256'),'hex');
 if digest_text is distinct from p_args->>'digest' then raise exception 'content_changed';end if;
 -- Existing finish function rechecks lease, account/membership and pending states.
 if not companion_private.finish_claimed_job((p_args->>'job_id')::uuid,(p_args->>'lease')::uuid,prompt_text,draft_text) then
  return jsonb_build_object('published',false);
 end if;
 update companion_private.ai_usage_attempts set output_digest=digest_text,
  safety_policy=s.id,safety_review_revision=s.review_revision where id=a.id;
 return jsonb_build_object('published',true);
end $$;
revoke all on function companion_private.ai_worker_job(text,jsonb) from public,anon,authenticated,companion_worker;
grant execute on function companion_private.ai_worker_job(text,jsonb) to companion_meter;
