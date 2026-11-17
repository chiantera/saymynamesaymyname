-- Read-only hosted smoke. No claims, provider requests or review activation.
do $$ begin
 if (select live_enabled from companion_private.ai_budget_config where id) is distinct from false
  or exists(select 1 from companion_private.ai_safety_policies where enabled) then
  raise exception 'requires_disabled_runtime';end if;
 begin
  perform companion_private.ai_worker_job('claim','{}');raise exception 'expected_disabled';
 exception when others then if sqlerrm<>'live_ai_disabled' then raise;end if;end;
 if not has_function_privilege('companion_meter','companion_private.ai_worker_job(text,jsonb)','EXECUTE')
  or has_function_privilege('authenticated','companion_private.ai_worker_job(text,jsonb)','EXECUTE')
  or has_function_privilege('anon','companion_private.ai_worker_job(text,jsonb)','EXECUTE')
  or has_function_privilege('companion_worker','companion_private.ai_worker_job(text,jsonb)','EXECUTE')
  or has_function_privilege('companion_worker','companion_private.finish_claimed_job(uuid,uuid,text,text)','EXECUTE')
  or has_function_privilege('companion_meter','companion_private.finish_claimed_job(uuid,uuid,text,text)','EXECUTE')
  or has_table_privilege('companion_meter','companion_private.ai_safety_policies','SELECT') then
  raise exception 'invalid_worker_permissions';end if;
end $$;
