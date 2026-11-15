-- Private relationship membership and unanimous, recipient-bound invitation commands.
-- Private records never gain audience grants from membership.
alter table public.companion_relationships add column membership_version bigint not null default 1;

create table companion_private.memberships (
 relationship_id uuid not null references public.companion_relationships(id),
 user_id uuid not null references auth.users(id) on delete cascade,
 alias text not null check(length(btrim(alias)) between 1 and 80),
 status text not null default 'active' check(status in ('active','muted','left')),
 generation bigint not null default 1,
 archived_at timestamptz, joined_at timestamptz not null default clock_timestamp(), left_at timestamptz,
 primary key(relationship_id,user_id)
);
create index memberships_user on companion_private.memberships(user_id,relationship_id);
insert into companion_private.memberships(relationship_id,user_id,alias)
 select id,owner,'Member' from public.companion_relationships;

create table companion_private.user_blocks (
 blocker uuid not null references auth.users(id) on delete cascade,
 blocked uuid not null references auth.users(id) on delete cascade,
 display_alias text not null check(length(btrim(display_alias)) between 1 and 80),
 primary key(blocker,blocked), check(blocker<>blocked)
);
create index user_blocks_target on companion_private.user_blocks(blocked,blocker);
create table companion_private.invitations (
 id uuid primary key default gen_random_uuid(),
 relationship_id uuid not null references public.companion_relationships(id),
 proposer uuid not null references auth.users(id), target_email text not null,
 membership_version bigint not null, version bigint not null default 0,
 status text not null default 'proposed' check(status in ('proposed','issued','accepted','revoked')),
 token_digest text unique, issued_at timestamptz, expires_at timestamptz,
 created_at timestamptz not null default clock_timestamp(),
 check(status<>'issued' or (token_digest is not null and issued_at is not null and expires_at is not null and expires_at>issued_at))
);
create index invitations_relationship on companion_private.invitations(relationship_id);
create index invitations_proposer on companion_private.invitations(proposer);
create table companion_private.invitation_approvals (
 invitation_id uuid not null references companion_private.invitations(id) on delete cascade,
 member_id uuid not null references auth.users(id), member_generation bigint not null,
 primary key(invitation_id,member_id)
);
create index invitation_approvals_member on companion_private.invitation_approvals(member_id);
alter table companion_private.memberships enable row level security;
alter table companion_private.user_blocks enable row level security;
alter table companion_private.invitations enable row level security;
alter table companion_private.invitation_approvals enable row level security;
revoke all on companion_private.memberships,companion_private.user_blocks,
 companion_private.invitations,companion_private.invitation_approvals from public,anon,authenticated;

create function companion_private.current_member(p_relationship uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select companion_private.is_beta() and exists(select 1 from companion_private.memberships
  where relationship_id=p_relationship and user_id=auth.uid() and status<>'left');
$$;
create function companion_private.pair_blocked(p_a uuid,p_b uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from companion_private.user_blocks
  where (blocker=p_a and blocked=p_b) or (blocker=p_b and blocked=p_a));
$$;
create function companion_private.can_reach(p_relationship uuid,p_sender uuid,p_recipient uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select p_sender<>p_recipient and not companion_private.pair_blocked(p_sender,p_recipient)
 and (select count(*)=2 from auth.users u join public.beta_access b on b.user_id=u.id
  where u.id in (p_sender,p_recipient) and u.email_confirmed_at is not null and u.deleted_at is null)
 and exists(select 1 from companion_private.memberships where relationship_id=p_relationship
  and user_id=p_sender and status='active' and archived_at is null)
 and exists(select 1 from companion_private.memberships where relationship_id=p_relationship
  and user_id=p_recipient and status='active' and archived_at is null);
$$;
create function companion_private.invite_approved(p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from companion_private.invitations i
  join public.companion_relationships r on r.id=i.relationship_id
  where i.id=p_id and i.membership_version=r.membership_version
  and not exists(select 1 from companion_private.memberships m where m.relationship_id=r.id
   and m.status<>'left' and not exists(select 1 from companion_private.invitation_approvals a
    where a.invitation_id=i.id and a.member_id=m.user_id and a.member_generation=m.generation)));
$$;
create function companion_private.target_allowed(p_relationship uuid,p_user uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select not exists(select 1 from companion_private.memberships where relationship_id=p_relationship
  and user_id=p_user and status<>'left')
 and not exists(select 1 from companion_private.memberships m where m.relationship_id=p_relationship
  and m.status<>'left' and companion_private.pair_blocked(m.user_id,p_user));
$$;
create function companion_private.invalidate_invitations(p_relationship uuid) returns void
language sql security definer set search_path='' as $$
 update companion_private.invitations set status='revoked',version=version+1
 where relationship_id=p_relationship and status in ('proposed','issued');
$$;

-- Public relationship rows contain shared metadata only. Writes are atomic RPCs.
drop policy own_select on public.companion_relationships;
drop policy own_insert on public.companion_relationships;
drop policy own_update on public.companion_relationships;
revoke insert,update on public.companion_relationships from authenticated;
create policy member_select on public.companion_relationships for select to authenticated
 using((select companion_private.current_member(id)));

create function companion_private.invite_preview(p_token text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item companion_private.invitations; actor uuid:=auth.uid(); recipient text;
begin
 if not companion_private.is_beta() then raise exception 'beta_access_required'; end if;
 if p_token is null or p_token !~ '^[a-f0-9]{64}$' then raise exception 'invite_unavailable'; end if;
 select * into item from companion_private.invitations
  where token_digest=encode(extensions.digest(p_token,'sha256'),'hex');
 if not found then raise exception 'invite_unavailable'; end if;
 select lower(email) into recipient from auth.users where id=actor and email_confirmed_at is not null;
 if item.status<>'issued' or item.expires_at<=clock_timestamp() or item.target_email<>recipient
  or not companion_private.invite_approved(item.id)
  or not companion_private.target_allowed(item.relationship_id,actor)
 then raise exception 'invite_unavailable'; end if;
 return jsonb_build_object('label',(select label from public.companion_relationships where id=item.relationship_id),
  'expires_at',item.expires_at,'members',coalesce((select jsonb_agg(m.alias order by m.joined_at,m.user_id)
   from companion_private.memberships m where m.relationship_id=item.relationship_id and m.status<>'left'),'[]'::jsonb));
end $$;

create function companion_private.relationship_action(p_action text,p_args jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=auth.uid(); rid uuid; other_user uuid; member companion_private.memberships;
 item companion_private.invitations; rel public.companion_relationships;
 label_value text; alias_value text; email_value text; token_value text; flag boolean; result jsonb;
begin
 if not companion_private.is_beta() then raise exception 'beta_access_required'; end if;
 -- Prototype-wide ordering makes membership, invitation and pair-block changes
 -- linearizable without deadlocks. Replace with ordered group/pair locks when scaled.
 perform pg_advisory_xact_lock(731502615);
 if not companion_private.is_beta() then raise exception 'beta_access_required'; end if;
 if p_action='create' then
  label_value:=btrim(p_args->>'label'); alias_value:=btrim(p_args->>'alias');
  if label_value is null or length(label_value) not between 1 and 80
   or alias_value is null or length(alias_value) not between 1 and 80 then raise exception 'invalid_input'; end if;
  insert into public.companion_relationships(owner,label) values(actor,label_value) returning * into rel;
  insert into companion_private.memberships(relationship_id,user_id,alias) values(rel.id,actor,alias_value);
  return jsonb_build_object('id',rel.id,'label',rel.label);
 end if;

 if p_action='block' then
  other_user:=(p_args->>'user_id')::uuid;
  if other_user is null or other_user=actor or jsonb_typeof(p_args->'value') is distinct from 'boolean'
   then raise exception 'invalid_input'; end if;
  if not exists(select 1 from companion_private.memberships a join companion_private.memberships b
   on b.relationship_id=a.relationship_id where a.user_id=actor and b.user_id=other_user)
   then raise exception 'member_unavailable'; end if;
  flag:=(p_args->>'value')::boolean;
  if flag then
   -- Snapshot a currently accessible name, never follow future edits after leaving.
   select m.alias into alias_value from companion_private.memberships m
    join companion_private.memberships mine on mine.relationship_id=m.relationship_id
    where mine.user_id=actor and mine.status<>'left' and m.user_id=other_user and m.status<>'left'
    order by m.joined_at desc,m.relationship_id limit 1;
   insert into companion_private.user_blocks(blocker,blocked,display_alias)
    values(actor,other_user,coalesce(alias_value,'Member')) on conflict do nothing;
   -- Only invitations that would introduce contact across this specific pair.
   update companion_private.invitations i set status='revoked',version=version+1
   where i.status in ('proposed','issued') and (
    (i.target_email=(select lower(email) from auth.users where id=other_user)
     and exists(select 1 from companion_private.memberships m where m.relationship_id=i.relationship_id and m.user_id=actor and m.status<>'left'))
    or (i.target_email=(select lower(email) from auth.users where id=actor)
     and exists(select 1 from companion_private.memberships m where m.relationship_id=i.relationship_id and m.user_id=other_user and m.status<>'left')));
  else
   delete from companion_private.user_blocks where blocker=actor and blocked=other_user;
  end if;
  return jsonb_build_object('blocked',flag);
 end if;

 if p_action in ('accept','decline') then
  token_value:=p_args->>'token'; alias_value:=btrim(p_args->>'alias');
  result:=companion_private.invite_preview(token_value);
  if p_action='decline' then
   update companion_private.invitations set status='revoked',version=version+1
    where token_digest=encode(extensions.digest(token_value,'sha256'),'hex');
   return '{}'::jsonb;
  end if;
  if alias_value is null or length(alias_value) not between 1 and 80 then raise exception 'invalid_input'; end if;
  select * into item from companion_private.invitations
   where token_digest=encode(extensions.digest(token_value,'sha256'),'hex') for update;
  insert into companion_private.memberships(relationship_id,user_id,alias) values(item.relationship_id,actor,alias_value)
   on conflict(relationship_id,user_id) do update set status='active',alias=excluded.alias,
    generation=companion_private.memberships.generation+1,archived_at=null,left_at=null,joined_at=clock_timestamp();
  update companion_private.invitations set status='accepted',version=version+1 where id=item.id;
  update public.companion_relationships set membership_version=membership_version+1 where id=item.relationship_id;
  perform companion_private.invalidate_invitations(item.relationship_id);
  return jsonb_build_object('id',item.relationship_id);
 end if;

 if p_action in ('approve','reject','issue','revoke') then
  select * into item from companion_private.invitations where id=(p_args->>'invitation_id')::uuid for update;
  if not found then raise exception 'invite_unavailable'; end if;
  rid:=item.relationship_id;
 else rid:=(p_args->>'relationship_id')::uuid;
 end if;
 select * into rel from public.companion_relationships where id=rid for update;
 select * into member from companion_private.memberships where relationship_id=rid and user_id=actor and status<>'left';
 if not found or not companion_private.current_member(rid) then raise exception 'member_unavailable'; end if;

 case p_action
 when 'propose' then
  if (p_args->>'membership_version')::bigint is distinct from rel.membership_version then raise exception 'stale_membership'; end if;
  email_value:=lower(btrim(p_args->>'email'));
  if email_value is null or length(email_value)>254 or email_value !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
   then raise exception 'invalid_input'; end if;
  insert into companion_private.invitations(relationship_id,proposer,target_email,membership_version)
   values(rid,actor,email_value,rel.membership_version) returning * into item;
  -- Explicit proposal is this actor's approval, never another member's vote.
  insert into companion_private.invitation_approvals values(item.id,actor,member.generation);
  return jsonb_build_object('id',item.id);
 when 'approve' then
  if item.status<>'proposed' or item.membership_version<>rel.membership_version then raise exception 'invite_unavailable'; end if;
  insert into companion_private.invitation_approvals values(item.id,actor,member.generation) on conflict do nothing;
 when 'reject','revoke' then
  if item.status not in ('proposed','issued') then raise exception 'invite_unavailable'; end if;
  update companion_private.invitations set status='revoked',version=version+1 where id=item.id;
 when 'issue' then
  if item.status not in ('proposed','issued') or item.version is distinct from (p_args->>'version')::bigint
   or (item.status='issued' and item.expires_at<=clock_timestamp())
   or not companion_private.invite_approved(item.id) then raise exception 'invite_not_ready'; end if;
  select id into other_user from auth.users where lower(email)=item.target_email and deleted_at is null;
  if other_user is not null and not companion_private.target_allowed(rid,other_user) then raise exception 'invite_unavailable'; end if;
  token_value:=encode(extensions.gen_random_bytes(32),'hex');
  update companion_private.invitations set status='issued',version=version+1,
   token_digest=encode(extensions.digest(token_value,'sha256'),'hex'),issued_at=clock_timestamp(),
   expires_at=clock_timestamp()+interval '7 days' where id=item.id returning * into item;
  return jsonb_build_object('token',token_value,'expires_at',item.expires_at);
 when 'leave','archive','mute','alias' then
  if member.generation is distinct from (p_args->>'generation')::bigint then raise exception 'stale_membership'; end if;
  if p_action='leave' then
   update companion_private.memberships set status='left',left_at=clock_timestamp() where relationship_id=rid and user_id=actor;
   update public.companion_relationships set membership_version=membership_version+1 where id=rid;
   perform companion_private.invalidate_invitations(rid);
  elsif p_action='alias' then
   alias_value:=btrim(p_args->>'alias');
   if alias_value is null or length(alias_value) not between 1 and 80 then raise exception 'invalid_input'; end if;
   update companion_private.memberships set alias=alias_value where relationship_id=rid and user_id=actor;
  else
   if jsonb_typeof(p_args->'value') is distinct from 'boolean' then raise exception 'invalid_input'; end if;
   flag:=(p_args->>'value')::boolean;
   if p_action='archive' then
    update companion_private.memberships set archived_at=case when flag then clock_timestamp() else null end where relationship_id=rid and user_id=actor;
   else
    update companion_private.memberships set status=case when flag then 'muted' else 'active' end where relationship_id=rid and user_id=actor;
   end if;
  end if;
 else raise exception 'invalid_action';
 end case;
 return '{}'::jsonb;
end $$;

create function companion_private.relationship_workspace() returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); result jsonb;
begin
 if not companion_private.is_beta() then raise exception 'beta_access_required'; end if;
 select jsonb_build_object('relationships',coalesce(jsonb_agg(jsonb_build_object(
  'id',r.id,'label',r.label,'membership_version',r.membership_version,
  'mine',jsonb_build_object('alias',me.alias,'generation',me.generation,'muted',me.status='muted','archived',me.archived_at is not null),
  'members',coalesce((select jsonb_agg(jsonb_build_object('user_id',m.user_id,'alias',m.alias,'is_self',m.user_id=actor,
    'can_contact',companion_private.can_reach(r.id,actor,m.user_id),
    'blocked_by_me',exists(select 1 from companion_private.user_blocks b where b.blocker=actor and b.blocked=m.user_id)) order by m.joined_at,m.user_id)
   from companion_private.memberships m where m.relationship_id=r.id and m.status<>'left'),'[]'::jsonb),
  'invitations',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'email',i.target_email,'version',i.version,
    'status',case when i.status='issued' and i.expires_at<=clock_timestamp() then 'expired' else i.status end,
    'expires_at',i.expires_at,'approved',companion_private.invite_approved(i.id),
    'approval_count',(select count(*) from companion_private.invitation_approvals a where a.invitation_id=i.id),
    'member_count',(select count(*) from companion_private.memberships n where n.relationship_id=r.id and n.status<>'left'),
    'my_approval',exists(select 1 from companion_private.invitation_approvals a where a.invitation_id=i.id and a.member_id=actor and a.member_generation=me.generation)) order by i.created_at desc)
   from companion_private.invitations i where i.relationship_id=r.id and i.status in ('proposed','issued')),'[]'::jsonb)
 ) order by r.created_at,r.id),'[]'::jsonb)) into result
 from public.companion_relationships r join companion_private.memberships me on me.relationship_id=r.id
 where me.user_id=actor and me.status<>'left';
 return result || jsonb_build_object('blocks',coalesce((select jsonb_agg(jsonb_build_object('user_id',b.blocked,
  'alias',b.display_alias))
  from companion_private.user_blocks b where b.blocker=actor),'[]'::jsonb));
end $$;

-- Helpers are not client APIs. Only scoped entry points and the RLS helper execute.
revoke all on function companion_private.current_member(uuid),companion_private.pair_blocked(uuid,uuid),
 companion_private.can_reach(uuid,uuid,uuid),companion_private.invite_approved(uuid),
 companion_private.target_allowed(uuid,uuid),companion_private.invalidate_invitations(uuid),
 companion_private.invite_preview(text),companion_private.relationship_action(text,jsonb),
 companion_private.relationship_workspace() from public,anon,authenticated;
grant execute on function companion_private.current_member(uuid),companion_private.invite_preview(text),
 companion_private.relationship_action(text,jsonb),companion_private.relationship_workspace() to authenticated;
create function public.relationship_action(p_action text,p_args jsonb default '{}'::jsonb) returns jsonb
language sql security invoker set search_path='' as $$ select companion_private.relationship_action(p_action,p_args) $$;
create function public.relationship_workspace() returns jsonb
language sql security invoker set search_path='' as $$ select companion_private.relationship_workspace() $$;
create function public.relationship_invite_preview(p_token text) returns jsonb
language sql security invoker set search_path='' as $$ select companion_private.invite_preview(p_token) $$;
revoke all on function public.relationship_action(text,jsonb),public.relationship_workspace(),public.relationship_invite_preview(text) from public,anon,authenticated;
grant execute on function public.relationship_action(text,jsonb),public.relationship_workspace(),public.relationship_invite_preview(text) to authenticated;
