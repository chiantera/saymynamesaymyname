
create function companion_private.refresh_checkins() returns void language plpgsql security definer set search_path='' as $$
begin
 if not companion_private.is_beta() then raise exception 'beta_access_required'; end if;
 update public.companion_checkins set status='skipped',version=version+1 where owner=auth.uid() and status='pending' and deadline<=now();
 update public.companion_checkins set status='pending',version=version+1,deadline=now()+interval '30 minutes',snoozed_until=null where owner=auth.uid() and status='deferred' and snoozed_until<=now();
end $$;
revoke all on function companion_private.refresh_checkins() from public,anon;
grant execute on function companion_private.refresh_checkins() to authenticated;
create function public.refresh_private_checkins() returns void language sql security invoker set search_path='' as $$ select companion_private.refresh_checkins() $$;
revoke all on function public.refresh_private_checkins() from public,anon;
grant execute on function public.refresh_private_checkins() to authenticated;

