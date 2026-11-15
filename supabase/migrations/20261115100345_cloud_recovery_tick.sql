create function companion_private.schedule_current(j companion_private.cloud_jobs) returns boolean language sql stable security definer set search_path='' as $$
 select companion_private.base_job_allowed(j) and (not j.scheduled or exists(
  select 1 from companion_private.schedule_settings s join companion_private.schedules c on c.owner=s.owner
  where s.owner=j.owner and c.scope=coalesce(j.relationship_id::text,'') and c.enabled and s.revision=j.schedule_revision
   and not s.paused and (s.paused_until is null or s.paused_until<=now())));
$$;
create function companion_private.cloud_tick() returns integer language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(731502615);
 update companion_private.cloud_jobs set status=case when attempts>=3 and expires_at>now() and companion_private.schedule_current(cloud_jobs) then 'failed' else 'cancelled' end,lease=null,lease_until=null,finished_at=now()
  where status in ('queued','processing') and (expires_at<=now() or not companion_private.schedule_current(cloud_jobs) or (attempts>=3 and lease_until<=now()));
 update public.companion_checkins c set status='cancelled',version=version+1,deadline=null,snoozed_until=null
  where status in ('pending','deferred') and exists(select 1 from companion_private.cloud_jobs j where j.id=c.cloud_job_id and not companion_private.schedule_current(j));
 update public.companion_checkins set status='skipped',version=version+1,deadline=null where status='pending' and deadline<=now();
 update public.companion_checkins c set status='pending',version=version+1,deadline=now()+interval '30 minutes',snoozed_until=null
  where status='deferred' and snoozed_until<=now() and (cloud_job_id is null or exists(select 1 from companion_private.cloud_jobs j where j.id=c.cloud_job_id and companion_private.schedule_current(j) and (not j.scheduled or companion_private.schedule_window(j.owner,now()))));
 if exists(select 1 from companion_private.worker_health where last_seen>now()-interval '2 minutes') then return companion_private.dispatch_cloud_due();end if;
 return 0;
end $$;
create or replace function companion_private.refresh_checkins() returns void language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(731502615);
 if not companion_private.is_beta() then raise exception 'beta_access_required';end if;
 update public.companion_checkins c set status='cancelled',version=version+1,deadline=null,snoozed_until=null
  where owner=auth.uid() and status in ('pending','deferred') and exists(select 1 from companion_private.cloud_jobs j where j.id=c.cloud_job_id and not companion_private.schedule_current(j));
 update public.companion_checkins set status='skipped',version=version+1,deadline=null where owner=auth.uid() and status='pending' and deadline<=now();
 update public.companion_checkins c set status='pending',version=version+1,deadline=now()+interval '30 minutes',snoozed_until=null
  where owner=auth.uid() and status='deferred' and snoozed_until<=now() and (cloud_job_id is null or exists(select 1 from companion_private.cloud_jobs j where j.id=c.cloud_job_id and companion_private.schedule_current(j) and (not j.scheduled or companion_private.schedule_window(j.owner,now()))));
end $$;
revoke all on function companion_private.schedule_current(companion_private.cloud_jobs),companion_private.cloud_tick() from public,anon,authenticated,companion_worker;
-- pg_cron is available in Supabase; vanilla isolated PostgreSQL fixtures omit it.
do $$ begin
 if exists(select 1 from pg_available_extensions where name='pg_cron') then
  create extension if not exists pg_cron;
  perform cron.schedule('companion-cloud-tick','* * * * *','select companion_private.cloud_tick()');
 end if;
end $$;

-- Match the global-before-owner lock order used by scheduling.
create or replace function companion_private.create_checkin(p_locale text,p_prompt text,p_draft text) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); result public.companion_checkins;
begin
 perform pg_advisory_xact_lock(731502615);
 if not companion_private.is_beta() then raise exception 'beta_access_required'; end if;
 if p_locale not in ('en','it','es','ko','zh-Hans','yue-Hant','de') or length(p_prompt)>1000 or length(p_draft)>5000 then raise exception 'invalid_input'; end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,0));
 update public.companion_checkins set status='skipped',version=version+1 where owner=actor and status='pending' and deadline<=now();
 update public.companion_checkins set status='pending',version=version+1,deadline=now()+interval '30 minutes',snoozed_until=null where owner=actor and status='deferred' and snoozed_until<=now();
 if exists(select 1 from public.companion_checkins where owner=actor and status in ('pending','deferred')) then raise exception 'already_pending'; end if;
 insert into public.companion_checkins(owner,locale,prompt,draft,deadline) values(actor,p_locale,p_prompt,p_draft,now()+interval '30 minutes') returning * into result;
 return to_jsonb(result);
end $$;
create or replace function companion_private.decide_checkin(p_id uuid,p_action text,p_version integer,p_text text) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); item public.companion_checkins; next_status text;
begin
 perform pg_advisory_xact_lock(731502615);
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
