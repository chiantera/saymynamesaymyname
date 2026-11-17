-- Read-only hosted smoke. Never claim a job, create a notice or activate AI.
do $$ begin
 if (select live_enabled from companion_private.ai_budget_config where id) is distinct from false then
  raise exception 'requires_disabled_runtime';end if;
 if has_table_privilege('authenticated','companion_private.support_notices','SELECT')
  or has_table_privilege('companion_meter','companion_private.support_notices','INSERT')
  or has_function_privilege('companion_meter','companion_private.ai_worker_job_core(text,jsonb)','EXECUTE')
  or has_function_privilege('anon','public.support_notice(text,jsonb)','EXECUTE')
  or not has_function_privilege('authenticated','public.support_notice(text,jsonb)','EXECUTE')
  or not (select relrowsecurity from pg_class where oid='companion_private.support_notices'::regclass) then
  raise exception 'support_permissions_invalid';end if;
 if (select count(*) from information_schema.columns where table_schema='companion_private'
   and table_name='support_notices')<>6 then raise exception 'unexpected_notice_fields';end if;
end $$;
