create table companion_private.worker_health(id boolean primary key default true check(id),last_seen timestamptz not null,region text not null check(region='frankfurt'),mode text not null check(mode='mock'));
alter table companion_private.worker_health enable row level security;
revoke all on companion_private.worker_health from public,anon,authenticated,companion_worker;
create function companion_private.worker_heartbeat() returns void language sql security definer set search_path='' as $$
 insert into companion_private.worker_health values(true,now(),'frankfurt','mock') on conflict(id) do update set last_seen=excluded.last_seen;
$$;
create function companion_private.worker_status() returns jsonb language plpgsql security definer set search_path='' as $$
begin if not companion_private.is_beta() then raise exception 'beta_access_required';end if;
 return jsonb_build_object('ready',exists(select 1 from companion_private.worker_health where last_seen>now()-interval '2 minutes'),'mode','mock');end $$;
revoke all on function companion_private.worker_heartbeat(),companion_private.worker_status() from public,anon,authenticated,companion_worker;
grant execute on function companion_private.worker_heartbeat() to companion_worker;
grant execute on function companion_private.worker_status() to authenticated;
create function public.cloud_worker_status() returns jsonb language sql security invoker set search_path='' as $$select companion_private.worker_status()$$;
revoke all on function public.cloud_worker_status() from public,anon,authenticated;
grant execute on function public.cloud_worker_status() to authenticated;
