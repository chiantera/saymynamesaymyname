-- Invitation addresses are matched by mailbox, not by exact spelling.
--
-- Gmail delivers "first.last+tag@gmail.com" and "firstlast@googlemail.com" to the
-- same inbox as "firstlast@gmail.com", but sign-in reports the canonical address.
-- An invitation typed with dots could therefore never be accepted. Matching uses a
-- normalised key: lower case everywhere, and for gmail.com/googlemail.com dots and
-- "+tag" are removed from the local part. Other providers are compared exactly
-- (lower case only), because their rules differ.
--
-- Also refuses inviting yourself, which could never succeed.

create function companion_private.email_key(p_email text) returns text
language sql immutable set search_path='' as $$
 select case
  when split_part(e,'@',2) in ('gmail.com','googlemail.com')
   then replace(split_part(split_part(e,'@',1),'+',1),'.','')||'@gmail.com'
  else e end
 from (select lower(btrim(p_email)) as e) s
$$;
revoke all on function companion_private.email_key(text) from public,anon;
grant execute on function companion_private.email_key(text) to authenticated;

create or replace function companion_private.invite_preview(p_token text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item companion_private.invitations; actor uuid:=auth.uid(); recipient text;
begin
 if actor is null then raise exception 'invite_unavailable'; end if;
 if p_token is null or p_token !~ '^[a-f0-9]{64}$' then raise exception 'invite_unavailable'; end if;
 select companion_private.email_key(email) into recipient from auth.users
  where id=actor and email_confirmed_at is not null and deleted_at is null;
 if recipient is null then raise exception 'invite_unavailable'; end if;
 select * into item from companion_private.invitations
  where token_digest=encode(extensions.digest(p_token,'sha256'),'hex');
 if not found then raise exception 'invite_unavailable'; end if;
 if item.status<>'issued' or item.expires_at<=clock_timestamp()
  or companion_private.email_key(item.target_email)<>recipient
  or not companion_private.invite_approved(item.id)
  or not companion_private.target_allowed(item.relationship_id,actor)
 then raise exception 'invite_unavailable'; end if;
 return jsonb_build_object('label',(select label from public.companion_relationships where id=item.relationship_id),
  'expires_at',item.expires_at,'members',coalesce((select jsonb_agg(m.alias order by m.joined_at,m.user_id)
   from companion_private.memberships m where m.relationship_id=item.relationship_id and m.status<>'left'),'[]'::jsonb));
end $$;

create function companion_private.is_own_email(p_email text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users where id=auth.uid()
  and companion_private.email_key(email)=companion_private.email_key(p_email))
$$;
revoke all on function companion_private.is_own_email(text) from public,anon;
grant execute on function companion_private.is_own_email(text) to authenticated;

create or replace function public.relationship_action(p_action text,p_args jsonb default '{}'::jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
begin
 if p_action in ('accept','decline') then
  return companion_private.redeem_invitation(p_action,p_args);
 end if;
 if p_action='propose' and companion_private.is_own_email(p_args->>'email') then
  raise exception 'invite_self';
 end if;
 return companion_private.relationship_action(p_action,p_args);
end $$;
