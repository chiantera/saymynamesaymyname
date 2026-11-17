-- Read-only hosted smoke; no real recovery content is read or written.
do $$ begin
 if not (select relrowsecurity from pg_class where oid='companion_private.edit_recoveries'::regclass)
  or has_table_privilege('authenticated','companion_private.edit_recoveries','SELECT')
  or has_table_privilege('companion_meter','companion_private.edit_recoveries','INSERT')
  or has_table_privilege('companion_worker','companion_private.edit_recoveries','SELECT')
  or has_function_privilege('anon','public.edit_recovery(text,jsonb)','EXECUTE')
  or not has_function_privilege('authenticated','public.edit_recovery(text,jsonb)','EXECUTE')
  or (select live_enabled from companion_private.ai_budget_config where id) is distinct from false then
  raise exception 'recovery_permissions_invalid';end if;
 begin
  perform companion_private.edit_recovery('list','{}');raise exception 'expected_access_denied';
 exception when others then if sqlerrm<>'access_denied' then raise;end if;end;
end $$;
