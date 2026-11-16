-- Saved-context preferences and processor approval are separate from sharing/auth.
create table companion_private.ai_preferences(
 owner uuid primary key references auth.users(id) on delete cascade,revision bigint not null default 0,
 journals boolean not null default false,documents boolean not null default false,chats boolean not null default false
);
create table companion_private.ai_provider_catalog(
 provider text not null,capability text not null,review_revision text,policy_url text,reviewed_at timestamptz,
 enabled boolean not null default false,primary key(provider,capability),check(policy_url is null or policy_url like 'https://%'),
 check(not enabled or (review_revision is not null and policy_url like 'https://%' and reviewed_at is not null))
);
insert into companion_private.ai_provider_catalog(provider,capability) values
 ('deepseek','chat'),('anthropic','chat'),('anthropic','ocr'),('mistral','ocr'),('groq','transcription');
create table companion_private.ai_provider_grants(
 owner uuid not null references auth.users(id) on delete cascade,provider text not null,capability text not null,
 approved boolean not null default false,allow_fallback boolean not null default false,review_revision text,
 primary key(owner,provider,capability),foreign key(provider,capability) references companion_private.ai_provider_catalog,
 check(not allow_fallback or approved)
);
alter table public.companion_entries add constraint companion_entries_id_owner unique(id,owner);
create table companion_private.ai_entry_exclusions(
 owner uuid not null references auth.users(id) on delete cascade,entry_id uuid not null,
 primary key(owner,entry_id),foreign key(entry_id,owner) references public.companion_entries(id,owner) on delete cascade
);
create table companion_private.ai_consent_events(
 id bigint generated always as identity primary key,owner uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('context','provider','exclusion')),details jsonb not null,created_at timestamptz not null default now()
);
create index ai_consent_events_owner on companion_private.ai_consent_events(owner,created_at);
create index ai_consent_events_expiry on companion_private.ai_consent_events(created_at);
alter table companion_private.ai_preferences enable row level security;
alter table companion_private.ai_provider_catalog enable row level security;
alter table companion_private.ai_provider_grants enable row level security;
alter table companion_private.ai_entry_exclusions enable row level security;
alter table companion_private.ai_consent_events enable row level security;
revoke all on companion_private.ai_preferences,companion_private.ai_provider_catalog,companion_private.ai_provider_grants,companion_private.ai_entry_exclusions,companion_private.ai_consent_events from public,anon,authenticated,companion_worker;

create function companion_private.invalidate_provider_review() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.review_revision is distinct from old.review_revision then
  insert into companion_private.ai_consent_events(owner,kind,details)
   select owner,'provider',jsonb_build_object('provider',new.provider,'capability',new.capability,'approved',false,'reason','review_changed')
   from companion_private.ai_provider_grants where provider=new.provider and capability=new.capability and approved;
  update companion_private.ai_provider_grants set approved=false,allow_fallback=false,review_revision=null where provider=new.provider and capability=new.capability;
 end if;return new;
end $$;
revoke all on function companion_private.invalidate_provider_review() from public,anon,authenticated,companion_worker;
create trigger invalidate_provider_review after update of review_revision on companion_private.ai_provider_catalog for each row execute function companion_private.invalidate_provider_review();

create function companion_private.ai_consent(p_action text,p_args jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); prefs companion_private.ai_preferences; catalog companion_private.ai_provider_catalog; eid uuid; result jsonb; val boolean;
begin
 perform pg_advisory_xact_lock(731502615);
 if not companion_private.is_beta() then raise exception 'beta_access_required';end if;
 select * into prefs from companion_private.ai_preferences where owner=actor;
 if not found then prefs.owner:=actor;prefs.revision:=0;prefs.journals:=false;prefs.documents:=false;prefs.chats:=false;end if;
 if p_action in ('context','provider','exclusion') then
  if prefs.revision is distinct from (p_args->>'revision')::bigint then raise exception 'stale_consent';end if;
  if p_action='context' then
   -- Documents and saved chats are not implemented context sources yet.
   if (p_args->>'documents')::boolean is distinct from false or (p_args->>'chats')::boolean is distinct from false or jsonb_typeof(p_args->'journals') is distinct from 'boolean' then raise exception 'source_unavailable';end if;
   prefs.journals:=(p_args->>'journals')::boolean;
  elsif p_action='provider' then
   select * into catalog from companion_private.ai_provider_catalog where provider=p_args->>'provider' and capability=p_args->>'capability';
   if not found then raise exception 'provider_unavailable';end if;
   if jsonb_typeof(p_args->'approved') is distinct from 'boolean' or jsonb_typeof(p_args->'allow_fallback') is distinct from 'boolean' then raise exception 'invalid_consent';end if;
   val:=(p_args->>'approved')::boolean;
   if val and (catalog.review_revision is null or catalog.policy_url is null or catalog.reviewed_at is null or catalog.review_revision is distinct from p_args->>'review_revision') then raise exception 'provider_unavailable';end if;
   if not val and (p_args->>'allow_fallback')::boolean then raise exception 'invalid_consent';end if;
   insert into companion_private.ai_provider_grants values(actor,catalog.provider,catalog.capability,val,(p_args->>'allow_fallback')::boolean,case when val then catalog.review_revision else null end)
    on conflict(owner,provider,capability) do update set approved=excluded.approved,allow_fallback=excluded.allow_fallback,review_revision=excluded.review_revision;
  else
   eid:=(p_args->>'entry_id')::uuid;
   if not exists(select 1 from public.companion_entries where id=eid and owner=actor) then raise exception 'source_unavailable';end if;
   if jsonb_typeof(p_args->'excluded') is distinct from 'boolean' then raise exception 'invalid_consent';end if;
   if (p_args->>'excluded')::boolean then insert into companion_private.ai_entry_exclusions values(actor,eid) on conflict do nothing;
   else delete from companion_private.ai_entry_exclusions where owner=actor and entry_id=eid;end if;
  end if;
  insert into companion_private.ai_preferences values(actor,prefs.revision+1,prefs.journals,false,false)
   on conflict(owner) do update set revision=excluded.revision,journals=excluded.journals;
  insert into companion_private.ai_consent_events(owner,kind,details) values(actor,p_action,
   case p_action when 'context' then jsonb_build_object('journals',prefs.journals,'documents',false,'chats',false)
   when 'provider' then jsonb_build_object('provider',catalog.provider,'capability',catalog.capability,'approved',val,'allow_fallback',(p_args->>'allow_fallback')::boolean,'review_revision',case when val then catalog.review_revision else null end)
   else jsonb_build_object('entry_id',eid,'excluded',(p_args->>'excluded')::boolean) end);
  prefs.revision:=prefs.revision+1;
 elsif p_action='eligible' then
  -- Metadata-only preview of own original reflections. No shared-source retrieval.
  if p_args->>'capability' is distinct from 'chat' or not prefs.journals or not exists(select 1 from companion_private.ai_provider_catalog c join companion_private.ai_provider_grants g using(provider,capability)
   where c.provider=p_args->>'provider' and c.capability=p_args->>'capability' and c.enabled and g.owner=actor and g.approved and g.review_revision=c.review_revision
    and (not coalesce((p_args->>'fallback')::boolean,false) or g.allow_fallback)) then return '[]'::jsonb;end if;
  return coalesce((select jsonb_agg(e.id) from public.companion_entries e where e.owner=actor and not exists(select 1 from companion_private.ai_entry_exclusions x where x.owner=actor and x.entry_id=e.id)),'[]'::jsonb);
 elsif p_action<>'get' then raise exception 'invalid_action';end if;
 result:=jsonb_build_object('revision',prefs.revision,'journals',prefs.journals,'documents',false,'chats',false,
 'providers',coalesce((select jsonb_agg(jsonb_build_object('provider',c.provider,'capability',c.capability,'enabled',c.enabled,'review_revision',c.review_revision,'policy_url',c.policy_url,
  'can_approve',c.review_revision is not null and c.policy_url is not null and c.reviewed_at is not null,
  'approved',coalesce(g.approved and g.review_revision=c.review_revision,false),'allow_fallback',coalesce(g.approved and g.review_revision=c.review_revision and g.allow_fallback,false)) order by c.provider,c.capability)
 from companion_private.ai_provider_catalog c left join companion_private.ai_provider_grants g on g.provider=c.provider and g.capability=c.capability and g.owner=actor),'[]'::jsonb),
 'exclusions',coalesce((select jsonb_agg(entry_id) from companion_private.ai_entry_exclusions where owner=actor),'[]'::jsonb));
 return result;
end $$;
revoke all on function companion_private.ai_consent(text,jsonb) from public,anon,authenticated,companion_worker;
grant execute on function companion_private.ai_consent(text,jsonb) to authenticated;
create function public.ai_consent(p_action text,p_args jsonb default '{}'::jsonb) returns jsonb language sql security invoker set search_path='' as $$select companion_private.ai_consent(p_action,p_args)$$;
revoke all on function public.ai_consent(text,jsonb) from public,anon,authenticated;
grant execute on function public.ai_consent(text,jsonb) to authenticated;

create function companion_private.cleanup_ai_consents() returns integer language plpgsql security definer set search_path='' as $$
declare n integer;
begin delete from companion_private.ai_consent_events where id in (select id from companion_private.ai_consent_events where created_at<now()-interval '90 days' order by created_at limit 1000);
 get diagnostics n=row_count;return n;end $$;
revoke all on function companion_private.cleanup_ai_consents() from public,anon,authenticated,companion_worker;
-- Retain the single dispatcher and bounded free worker; add metadata retention.
do $$ begin if exists(select 1 from pg_extension where extname='pg_cron') then
 perform cron.schedule('companion-cloud-tick','* * * * *','select companion_private.cleanup_ai_consents(); select companion_private.postgres_mock_tick()');
end if;end $$;
