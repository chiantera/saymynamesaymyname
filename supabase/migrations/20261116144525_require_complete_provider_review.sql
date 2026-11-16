-- CHECK predicates must return false rather than NULL when review data is absent.
alter table companion_private.ai_provider_catalog add constraint ai_provider_complete_review
 check(not enabled or (review_revision is not null and policy_url is not null and policy_url like 'https://%' and reviewed_at is not null));
create or replace function companion_private.invalidate_provider_review() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.review_revision is distinct from old.review_revision or new.policy_url is distinct from old.policy_url then
  insert into companion_private.ai_consent_events(owner,kind,details)
   select owner,'provider',jsonb_build_object('provider',new.provider,'capability',new.capability,'approved',false,'reason','review_changed')
   from companion_private.ai_provider_grants where provider=new.provider and capability=new.capability and approved;
  update companion_private.ai_provider_grants set approved=false,allow_fallback=false,review_revision=null where provider=new.provider and capability=new.capability;
 end if;return new;
end $$;
revoke all on function companion_private.invalidate_provider_review() from public,anon,authenticated,companion_worker;
drop trigger invalidate_provider_review on companion_private.ai_provider_catalog;
create trigger invalidate_provider_review after update of review_revision,policy_url on companion_private.ai_provider_catalog for each row execute function companion_private.invalidate_provider_review();

