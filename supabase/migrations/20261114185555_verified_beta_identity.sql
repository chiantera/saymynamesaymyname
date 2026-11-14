-- Admission alone must not bypass the agreed verified-email requirement.
-- Read the current Auth record rather than editable user metadata or a stale JWT.
create or replace function companion_private.is_beta()
returns boolean language sql stable security definer set search_path=''
as $$
 select auth.uid() is not null and exists(
  select 1 from public.beta_access as admission
  join auth.users as identity on identity.id=admission.user_id
  where admission.user_id=auth.uid()
   and identity.email is not null
   and identity.email_confirmed_at is not null
   and identity.deleted_at is null
 );
$$;
revoke all on function companion_private.is_beta() from public,anon;
grant execute on function companion_private.is_beta() to authenticated;
