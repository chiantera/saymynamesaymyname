-- Read-only dormant-gate smoke; refuses a live-enabled environment.
do $$ begin
 if (select live_enabled from companion_private.ai_budget_config where id) is distinct from false then
  raise exception 'requires_disabled_runtime';
 end if;
 begin
  perform companion_private.deepseek_authorize('{}'::jsonb);
  raise exception 'expected_disabled';
 exception when others then
  if sqlerrm<>'live_ai_disabled' then raise;end if;
 end;
 if not has_function_privilege('companion_meter','companion_private.deepseek_authorize(jsonb)','EXECUTE')
  or has_function_privilege('anon','companion_private.deepseek_authorize(jsonb)','EXECUTE')
  or has_function_privilege('authenticated','companion_private.deepseek_authorize(jsonb)','EXECUTE')
  or has_function_privilege('companion_worker','companion_private.deepseek_authorize(jsonb)','EXECUTE') then
  raise exception 'invalid_dispatch_permissions';
 end if;
end $$;
