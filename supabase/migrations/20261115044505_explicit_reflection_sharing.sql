-- Private originals remain owner-only. Explicit grants expose immutable snapshots.
create table companion_private.reflection_shares (
 id uuid primary key default extensions.gen_random_uuid(),
 entry_id uuid not null references public.companion_entries(id) on delete cascade,
 owner uuid not null references auth.users(id) on delete cascade,
 relationship_id uuid not null references public.companion_relationships(id) on delete cascade,
 text text not null, locale text not null, owner_alias text not null,
 created_at timestamptz not null default clock_timestamp()
);
create table companion_private.reflection_recipients (
 share_id uuid not null references companion_private.reflection_shares(id) on delete cascade,
 recipient uuid not null references auth.users(id) on delete cascade,
 recipient_alias text not null, revoked_at timestamptz,
 primary key(share_id,recipient)
);
create index reflection_shares_owner on companion_private.reflection_shares(owner);
create index reflection_shares_entry on companion_private.reflection_shares(entry_id);
create index reflection_shares_relationship on companion_private.reflection_shares(relationship_id);
create index reflection_recipients_user on companion_private.reflection_recipients(recipient);
alter table companion_private.reflection_shares enable row level security;
alter table companion_private.reflection_recipients enable row level security;
revoke all on companion_private.reflection_shares,companion_private.reflection_recipients from public,anon,authenticated;

-- A block terminates this pair's grants across spaces. Unblocking never resurrects them.
create function companion_private.block_revoke_reflections() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(731502615);
 update companion_private.reflection_recipients g set revoked_at=clock_timestamp()
 from companion_private.reflection_shares s where s.id=g.share_id and g.revoked_at is null
 and ((s.owner=new.blocker and g.recipient=new.blocked) or (s.owner=new.blocked and g.recipient=new.blocker));
 return new;
end $$;
revoke all on function companion_private.block_revoke_reflections() from public,anon,authenticated;
create trigger block_revoke_reflections after insert on companion_private.user_blocks
 for each row execute function companion_private.block_revoke_reflections();

create function companion_private.reflection_sharing(p_action text,p_args jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); entry public.companion_entries; sid uuid; rid uuid;
 recipient_id uuid; recipients uuid[]; result jsonb; sender_alias text;
begin
 perform pg_advisory_xact_lock(731502615);
 if not companion_private.is_beta() then raise exception 'beta_access_required'; end if;
 case p_action
 when 'share' then
  select * into entry from public.companion_entries where id=(p_args->>'entry_id')::uuid and owner=actor;
  if not found then raise exception 'sharing_unavailable'; end if;
  rid:=(p_args->>'relationship_id')::uuid;
  if not exists(select 1 from public.companion_relationships where id=rid
   and membership_version=(p_args->>'membership_version')::bigint) then raise exception 'sharing_unavailable'; end if;
  select array_agg(value::uuid) into recipients from jsonb_array_elements_text(p_args->'recipients');
  if coalesce(cardinality(recipients),0) not between 1 and 100
   or exists(select 1 from unnest(recipients) x group by x having count(*)>1)
   then raise exception 'sharing_unavailable'; end if;
  foreach recipient_id in array recipients loop
   if recipient_id is null or not companion_private.can_reach(rid,actor,recipient_id)
    then raise exception 'sharing_unavailable'; end if;
  end loop;
  select alias into sender_alias from companion_private.memberships where relationship_id=rid and user_id=actor;
  insert into companion_private.reflection_shares(entry_id,owner,relationship_id,text,locale,owner_alias)
   values(entry.id,actor,rid,entry.text,entry.locale,sender_alias) returning id into sid;
  insert into companion_private.reflection_recipients(share_id,recipient,recipient_alias)
   select sid,m.user_id,m.alias from companion_private.memberships m
   where m.relationship_id=rid and m.user_id=any(recipients);
  return jsonb_build_object('id',sid);
 when 'revoke' then
  update companion_private.reflection_recipients g set revoked_at=coalesce(g.revoked_at,clock_timestamp())
   from companion_private.reflection_shares s where s.id=g.share_id and s.owner=actor
   and s.id=(p_args->>'share_id')::uuid and g.recipient=(p_args->>'recipient')::uuid;
  if not found then raise exception 'sharing_unavailable'; end if;
  return '{}'::jsonb;
 when 'read' then
  select jsonb_build_object('id',s.id,'text',s.text,'locale',s.locale) into result
   from companion_private.reflection_shares s join companion_private.reflection_recipients g on g.share_id=s.id
   where s.id=(p_args->>'share_id')::uuid and g.recipient=actor and g.revoked_at is null
   and not companion_private.pair_blocked(s.owner,actor)
   and exists(select 1 from public.beta_access b join auth.users u on u.id=b.user_id
    where b.user_id=s.owner and u.email_confirmed_at is not null and u.deleted_at is null);
  if result is null then raise exception 'sharing_unavailable'; end if;
  return result;
 when 'workspace' then
  return jsonb_build_object('sent',coalesce((select jsonb_agg(jsonb_build_object(
    'id',s.id,'entry_id',s.entry_id,'created_at',s.created_at,'recipients',
    (select jsonb_agg(jsonb_build_object('user_id',g.recipient,'alias',g.recipient_alias,'revoked',g.revoked_at is not null))
     from companion_private.reflection_recipients g where g.share_id=s.id)))
   from companion_private.reflection_shares s where s.owner=actor),'[]'::jsonb),
   'received',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'alias',s.owner_alias,'created_at',s.created_at))
   from companion_private.reflection_shares s join companion_private.reflection_recipients g on g.share_id=s.id
   where g.recipient=actor and g.revoked_at is null and not companion_private.pair_blocked(s.owner,actor)
   and exists(select 1 from public.beta_access b join auth.users u on u.id=b.user_id
    where b.user_id=s.owner and u.email_confirmed_at is not null and u.deleted_at is null)),'[]'::jsonb));
 else raise exception 'invalid_action';
 end case;
end $$;
revoke all on function companion_private.reflection_sharing(text,jsonb) from public,anon,authenticated;
grant execute on function companion_private.reflection_sharing(text,jsonb) to authenticated;
create function public.reflection_sharing(p_action text,p_args jsonb default '{}'::jsonb) returns jsonb
language sql security invoker set search_path='' as $$ select companion_private.reflection_sharing(p_action,p_args) $$;
revoke all on function public.reflection_sharing(text,jsonb) from public,anon,authenticated;
grant execute on function public.reflection_sharing(text,jsonb) to authenticated;
