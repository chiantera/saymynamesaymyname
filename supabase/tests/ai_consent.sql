begin;
insert into auth.users(id,email,email_confirmed_at) values('92000000-0000-0000-0000-000000000001','consent-fixture@example.invalid',now());
insert into public.beta_access values('92000000-0000-0000-0000-000000000001');
set local role authenticated;
select set_config('request.jwt.claim.sub','92000000-0000-0000-0000-000000000001',true);
do $$ declare state jsonb; c jsonb; eid uuid;begin
 state:=public.ai_consent('get');
 if (state->>'journals')::boolean or (state->>'revision')::bigint<>0 then raise exception 'defaults_not_private';end if;
 c:=public.create_private_checkin('en','Fictional consent prompt','Fictional consent draft');
 perform public.decide_private_checkin((c->>'id')::uuid,'approve',0,'Fictional private consent source');
 select id into eid from public.companion_entries limit 1;
 state:=public.ai_consent('context','{"revision":0,"journals":true,"documents":false,"chats":false}');
 state:=public.ai_consent('exclusion',jsonb_build_object('revision',1,'entry_id',eid,'excluded',true));
 if state->'exclusions'<>jsonb_build_array(eid) then raise exception 'exclusion_not_saved';end if;
 if public.ai_consent('eligible','{"provider":"deepseek","capability":"chat"}')<>'[]'::jsonb then raise exception 'unapproved_retrieval';end if;
 begin
  perform public.ai_consent('provider','{"revision":2,"provider":"deepseek","capability":"chat","approved":true,"allow_fallback":false,"review_revision":"not-reviewed"}');
  raise exception 'unreviewed_approval';
 exception when raise_exception then if sqlerrm<>'provider_unavailable' then raise;end if;end;
end $$;
select 'private-ai-consent-smoke-passed' as result;
rollback;
