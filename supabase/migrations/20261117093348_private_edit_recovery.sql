-- Immutable, private displaced-edit copies. Deletion keeps a content-free
-- tombstone so a delayed retry cannot recreate the same dismissed copy.
create table companion_private.edit_recoveries(
 id uuid primary key,
 owner uuid not null references auth.users(id) on delete cascade,
 checkin_id uuid not null,
 base_version integer not null check(base_version>=0),
 text text check(text is null or length(text)<=5000),
 created_at timestamptz not null default now(),
 deleted_at timestamptz,
 foreign key(checkin_id,owner) references public.companion_checkins(id,owner) on delete cascade,
 check((deleted_at is null and text is not null) or (deleted_at is not null and text is null))
);
create index edit_recoveries_owner on companion_private.edit_recoveries(owner,created_at,id) where deleted_at is null;
alter table companion_private.edit_recoveries enable row level security;
revoke all on companion_private.edit_recoveries from public,anon,authenticated,companion_worker,companion_meter;

create function companion_private.edit_recovery(p_action text,p_args jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); item companion_private.edit_recoveries;
 rid uuid; source_id uuid; source_version integer; body text;
begin
 if actor is null or not companion_private.is_beta() then raise exception 'access_denied';end if;
 if p_action='list' then
  return coalesce((select jsonb_agg(jsonb_build_object('id',id,'checkin_id',checkin_id,
   'base_version',base_version,'text',text,'created_at',created_at) order by created_at,id)
   from companion_private.edit_recoveries where owner=actor and deleted_at is null),'[]'::jsonb);
 end if;
 rid:=(p_args->>'id')::uuid;
 if rid is null then raise exception 'invalid_input';end if;
 if p_action='dismiss' then
  source_id:=(p_args->>'checkin_id')::uuid;
  source_version:=(p_args->>'base_version')::integer;
  if source_id is null or source_version is null or source_version<0
   or not exists(select 1 from public.companion_checkins where id=source_id and owner=actor and version>=source_version)
  then raise exception 'invalid_input';end if;
  insert into companion_private.edit_recoveries(id,owner,checkin_id,base_version,text,deleted_at)
   values(rid,actor,source_id,source_version,null,now()) on conflict(id) do nothing;
  update companion_private.edit_recoveries set text=null,deleted_at=coalesce(deleted_at,now())
   where id=rid and owner=actor and checkin_id=source_id and base_version=source_version;
  return jsonb_build_object('dismissed',found);
 end if;
 if p_action<>'save' then raise exception 'invalid_action';end if;
 source_id:=(p_args->>'checkin_id')::uuid;
 source_version:=(p_args->>'base_version')::integer;
 body:=p_args->>'text';
 if source_id is null or source_version is null or source_version<0 or body is null or length(body)>5000
  or not exists(select 1 from public.companion_checkins where id=source_id and owner=actor and version>=source_version)
 then raise exception 'invalid_input';end if;
 insert into companion_private.edit_recoveries(id,owner,checkin_id,base_version,text)
  values(rid,actor,source_id,source_version,body) on conflict(id) do nothing;
 select * into item from companion_private.edit_recoveries where id=rid and owner=actor;
 if not found or item.deleted_at is not null or item.checkin_id<>source_id
  or item.base_version<>source_version or item.text is distinct from body then raise exception 'recovery_unavailable';end if;
 return jsonb_build_object('id',item.id);
end $$;
revoke all on function companion_private.edit_recovery(text,jsonb) from public,anon,companion_worker,companion_meter;
grant execute on function companion_private.edit_recovery(text,jsonb) to authenticated;
create function public.edit_recovery(p_action text,p_args jsonb default '{}') returns jsonb
language sql security invoker set search_path='' as $$select companion_private.edit_recovery(p_action,p_args)$$;
revoke all on function public.edit_recovery(text,jsonb) from public,anon;
grant execute on function public.edit_recovery(text,jsonb) to authenticated;
