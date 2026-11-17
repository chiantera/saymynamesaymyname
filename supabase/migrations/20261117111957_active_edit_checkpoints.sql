-- A separate checkpoint per editing session; deleted rows are content-free fences.
create table companion_private.active_edit_checkpoints (
 id uuid primary key,
 owner uuid not null references auth.users(id) on delete cascade,
 checkin_id uuid not null,
 base_version integer not null check (base_version >= 0),
 revision integer not null check (revision >= 0),
 text text check (text is null or length(text) <= 5000),
 updated_at timestamptz not null default now(),
 deleted_at timestamptz,
 foreign key (checkin_id,owner) references public.companion_checkins(id,owner) on delete cascade,
 check ((deleted_at is null and text is not null) or (deleted_at is not null and text is null))
);
create index active_edit_checkpoints_owner on companion_private.active_edit_checkpoints(owner,updated_at,id) where deleted_at is null;
alter table companion_private.active_edit_checkpoints enable row level security;
revoke all on companion_private.active_edit_checkpoints from public,anon,authenticated,companion_worker,companion_meter;

create function companion_private.active_edit_checkpoint(p_action text,p_args jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); item companion_private.active_edit_checkpoints;
 rid uuid; source_id uuid; source_version integer; rev integer; body text;
begin
 if actor is null or not companion_private.is_beta() then raise exception 'access_denied'; end if;
 if p_action='list' then
  return coalesce((select jsonb_agg(jsonb_build_object('id',id,'checkin_id',checkin_id,
   'base_version',base_version,'revision',revision,'text',text) order by updated_at,id)
   from companion_private.active_edit_checkpoints where owner=actor and deleted_at is null),'[]'::jsonb);
 end if;
 rid:=(p_args->>'id')::uuid;
 source_id:=(p_args->>'checkin_id')::uuid;
 source_version:=(p_args->>'base_version')::integer;
 if rid is null or source_id is null or source_version is null or source_version<0
  or not exists(select 1 from public.companion_checkins where id=source_id and owner=actor and version>=source_version)
 then raise exception 'invalid_input'; end if;
 if p_action='dismiss' then
  insert into companion_private.active_edit_checkpoints(id,owner,checkin_id,base_version,revision,text,deleted_at)
   values(rid,actor,source_id,source_version,0,null,now())
   on conflict(id) do update set text=null,deleted_at=coalesce(companion_private.active_edit_checkpoints.deleted_at,now())
   where companion_private.active_edit_checkpoints.owner=actor and companion_private.active_edit_checkpoints.checkin_id=source_id
    and companion_private.active_edit_checkpoints.base_version=source_version;
  return jsonb_build_object('dismissed',found);
 end if;
 if p_action<>'save' then raise exception 'invalid_action'; end if;
 rev:=(p_args->>'revision')::integer; body:=p_args->>'text';
 if rev is null or rev<1 or body is null or length(body)>5000 then raise exception 'invalid_input'; end if;
 insert into companion_private.active_edit_checkpoints(id,owner,checkin_id,base_version,revision,text)
  values(rid,actor,source_id,source_version,rev,body)
  on conflict(id) do update set revision=excluded.revision,text=excluded.text,updated_at=now()
  where companion_private.active_edit_checkpoints.owner=actor
   and companion_private.active_edit_checkpoints.checkin_id=source_id
   and companion_private.active_edit_checkpoints.base_version=source_version
   and companion_private.active_edit_checkpoints.deleted_at is null
   and companion_private.active_edit_checkpoints.revision<excluded.revision;
 select * into item from companion_private.active_edit_checkpoints where id=rid and owner=actor;
 if not found or item.deleted_at is not null or item.checkin_id<>source_id or item.base_version<>source_version
  or item.revision<>rev or item.text is distinct from body then raise exception 'checkpoint_unavailable'; end if;
 return jsonb_build_object('id',item.id,'revision',item.revision);
end $$;
revoke all on function companion_private.active_edit_checkpoint(text,jsonb) from public,anon,companion_worker,companion_meter;
grant execute on function companion_private.active_edit_checkpoint(text,jsonb) to authenticated;
create function public.active_edit_checkpoint(p_action text,p_args jsonb default '{}') returns jsonb
language sql security invoker set search_path='' as $$select companion_private.active_edit_checkpoint(p_action,p_args)$$;
revoke all on function public.active_edit_checkpoint(text,jsonb) from public,anon;
grant execute on function public.active_edit_checkpoint(text,jsonb) to authenticated;
