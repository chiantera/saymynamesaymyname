-- Synthetic-only hosted verification. Refuse to claim real queued work.
begin;
do $$ begin if exists(select 1 from companion_private.cloud_jobs where status in ('queued','processing')) then raise exception 'active_jobs_present_smoke_refused';end if;end $$;
insert into auth.users(id,email,email_confirmed_at) values('91000000-0000-0000-0000-000000000001','cloud-worker-fixture@example.invalid',now());
insert into public.beta_access values('91000000-0000-0000-0000-000000000001');
set local role authenticated;
select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000001',true);
insert into public.companion_profiles(owner,locale,timezone) values(auth.uid(),'it','Europe/Rome');
do $$ declare j jsonb; begin
 j:=public.cloud_queue('enqueue',jsonb_build_object('request_id',extensions.gen_random_uuid()));
 perform set_config('test_cloud.job',j->>'id',true);
 if public.cloud_worker_status()->>'mode'<>'mock' then raise exception 'mode_mismatch';end if;
end $$;
reset role;
-- Execute the free included worker as the cron owner, using only synthetic work.
do $$ begin
 if companion_private.postgres_mock_tick()<>1 then raise exception 'free_tick_publication_failed';end if;
 if companion_private.postgres_mock_tick()<>0 then raise exception 'free_tick_duplicate';end if;
end $$;
reset role;
set local role authenticated;
do $$ begin
 if (select count(*) from public.companion_checkins)<>1 then raise exception 'checkin_count';end if;
 if (select count(*) from public.companion_entries)<>0 then raise exception 'approval_bypassed';end if;
 perform public.cloud_schedule('save','{"revision":0,"enabled":false,"cadence_hours":6,"paused":true,"quiet_start":"22:00","quiet_end":"08:00","daily_cap":3}');
end $$;
select 'free-worker-smoke-passed' as result;
rollback;
