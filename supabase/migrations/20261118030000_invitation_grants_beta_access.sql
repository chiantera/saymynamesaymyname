-- Accepting a unanimously approved, recipient-bound invitation also admits the
-- accepting verified account to the invite-only beta (owner decision 2026-11-18).
--
-- Preview and accept/decline no longer require prior beta admission, because an
-- unadmitted invitee could otherwise never see or accept their invitation. Every
-- other invitation check is unchanged: issued status, expiry, single use, digest
-- lookup, the caller's verified email equal to the target, current unanimous
-- approval, and no membership or pair block conflict. Declining admits nobody.
-- All other relationship actions still require beta admission.

create or replace function companion_private.invite_preview(p_token text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item companion_private.invitations; actor uuid:=auth.uid(); recipient text;
begin
 if actor is null then raise exception 'invite_unavailable'; end if;
 if p_token is null or p_token !~ '^[a-f0-9]{64}$' then raise exception 'invite_unavailable'; end if;
 select lower(email) into recipient from auth.users
  where id=actor and email_confirmed_at is not null and deleted_at is null;
 if recipient is null then raise exception 'invite_unavailable'; end if;
 select * into item from companion_private.invitations
  where token_digest=encode(extensions.digest(p_token,'sha256'),'hex');
 if not found then raise exception 'invite_unavailable'; end if;
 if item.status<>'issued' or item.expires_at<=clock_timestamp() or item.target_email<>recipient
  or not companion_private.invite_approved(item.id)
  or not companion_private.target_allowed(item.relationship_id,actor)
 then raise exception 'invite_unavailable'; end if;
 return jsonb_build_object('label',(select label from public.companion_relationships where id=item.relationship_id),
  'expires_at',item.expires_at,'members',coalesce((select jsonb_agg(m.alias order by m.joined_at,m.user_id)
   from companion_private.memberships m where m.relationship_id=item.relationship_id and m.status<>'left'),'[]'::jsonb));
end $$;

create function companion_private.redeem_invitation(p_action text,p_args jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); item companion_private.invitations; token_value text; alias_value text;
begin
 if p_action not in ('accept','decline') then raise exception 'invalid_input'; end if;
 -- Same global ordering lock as relationship_action.
 perform pg_advisory_xact_lock(731502615);
 token_value:=p_args->>'token'; alias_value:=btrim(p_args->>'alias');
 perform companion_private.invite_preview(token_value);  -- every recipient/approval check
 select * into item from companion_private.invitations
  where token_digest=encode(extensions.digest(token_value,'sha256'),'hex') for update;
 if p_action='decline' then
  update companion_private.invitations set status='revoked',version=version+1 where id=item.id;
  return '{}'::jsonb;
 end if;
 if alias_value is null or length(alias_value) not between 1 and 80 then raise exception 'invalid_input'; end if;
 insert into companion_private.memberships(relationship_id,user_id,alias) values(item.relationship_id,actor,alias_value)
  on conflict(relationship_id,user_id) do update set status='active',alias=excluded.alias,
   generation=companion_private.memberships.generation+1,archived_at=null,left_at=null,joined_at=clock_timestamp();
 update companion_private.invitations set status='accepted',version=version+1 where id=item.id;
 update public.companion_relationships set membership_version=membership_version+1 where id=item.relationship_id;
 perform companion_private.invalidate_invitations(item.relationship_id);
 insert into public.beta_access(user_id) values(actor) on conflict do nothing;
 return jsonb_build_object('id',item.relationship_id,'admitted',true);
end $$;
revoke all on function companion_private.redeem_invitation(text,jsonb) from public,anon;
grant execute on function companion_private.redeem_invitation(text,jsonb) to authenticated;

create or replace function public.relationship_action(p_action text,p_args jsonb default '{}'::jsonb) returns jsonb
language sql security invoker set search_path='' as $$
 select case when p_action in ('accept','decline')
  then companion_private.redeem_invitation(p_action,p_args)
  else companion_private.relationship_action(p_action,p_args) end
$$;
