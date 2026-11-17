-- Fictional accounting only. No HTTP/provider call. Everything is rolled back.
begin;
select pg_advisory_xact_lock(731502615);
do $$ begin
 if (select live_enabled from companion_private.ai_budget_config where id) then raise exception 'live_accounting_smoke_refused';end if;
 if exists(select 1 from companion_private.ai_usage_attempts) then raise exception 'existing_usage_smoke_refused';end if;
end $$;
insert into auth.users(id,email,email_confirmed_at) values('93000000-0000-0000-0000-000000000001','budget-fixture@example.invalid',now());
insert into public.beta_access values('93000000-0000-0000-0000-000000000001');
update companion_private.ai_budget_config set live_enabled=true;
update companion_private.ai_provider_catalog set enabled=true,review_revision='fictional-budget-v1',policy_url='https://example.invalid/budget-policy',reviewed_at=now() where provider='deepseek' and capability='chat';
do $$ declare p uuid;j uuid;l uuid;begin
 insert into companion_private.ai_prices(provider,capability,model,version,currency,eur_fx,fx_asof,input_rate,cached_rate,output_rate,unit,unit_rate,max_input,max_output,max_units,reviewed_at,valid_until,enabled)
 values('deepseek','chat','fictional-budget-model','fixture-only','EUR',1,now(),1000000,0,0,'tokens',0,100,100,0,now(),now()+interval '1 day',true) returning id into p;
 l:=extensions.gen_random_uuid();
 insert into companion_private.cloud_jobs(owner,request_id,locale,status,lease,lease_until)
 values('93000000-0000-0000-0000-000000000001',extensions.gen_random_uuid(),'en','processing',l,now()+interval '90 seconds') returning id into j;
 perform set_config('budget_fixture.price',p::text,true);perform set_config('budget_fixture.job',j::text,true);perform set_config('budget_fixture.lease',l::text,true);
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','93000000-0000-0000-0000-000000000001',true);
select public.ai_consent('provider','{"revision":0,"provider":"deepseek","capability":"chat","approved":true,"allow_fallback":false,"review_revision":"fictional-budget-v1"}');
reset role;
-- Hosted admin invokes narrow functions. Restricted-role proof is in local tests.
do $$ declare r jsonb;aid uuid;begin
 r:=companion_private.ai_meter('reserve',jsonb_build_object('job_id',current_setting('budget_fixture.job'),'lease',current_setting('budget_fixture.lease'),'price_id',current_setting('budget_fixture.price'),'attempt_no',1,'kind','checkin','bounds',jsonb_build_object('input',10,'cached',0,'output',0,'units',0)));
 aid:=(r->>'id')::uuid;
 if (r->>'reserved_eur')::numeric<>11 then raise exception 'reservation_mismatch';end if;
 perform companion_private.ai_meter('begin',jsonb_build_object('id',aid,'lease',current_setting('budget_fixture.lease')));
 perform companion_private.ai_meter('unknown',jsonb_build_object('id',aid));
 begin
  perform companion_private.ai_meter('release',jsonb_build_object('id',aid));raise exception 'unknown_hold_released';
 exception when raise_exception then if sqlerrm<>'cannot_release_dispatched_charge' then raise;end if;end;
 perform companion_private.ai_meter('reconcile',jsonb_build_object('id',aid,'provider_request_id','fictional-budget-receipt','actual_native',4.5,'actual_fx',1));
 perform companion_private.ai_meter('reconcile',jsonb_build_object('id',aid,'provider_request_id','fictional-budget-receipt','actual_native',4.5,'actual_fx',1));
end $$;
set local role authenticated;
do $$ declare s jsonb;begin
 s:=public.ai_budget('get');
 if (s->>'posted_eur')::numeric<>4.5 or (s->>'held_eur')::numeric<>0 or (s->>'remaining_eur')::numeric<>15.5 then raise exception 'ledger_totals_mismatch';end if;
 perform public.ai_budget('save','{"revision":0,"paused":true,"monthly_eur":3}');
 s:=public.ai_budget('get');if s->>'alert'<>'95' then raise exception 'alert_missing';end if;
end $$;
select 'ai-budget-smoke-passed' as result;
rollback;
