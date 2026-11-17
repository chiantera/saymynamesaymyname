-- Dormant metadata-only adapter gate. No activation, prices, login or source grants.
create function companion_private.deepseek_authorize(p_args jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j companion_private.cloud_jobs; p companion_private.ai_prices;
begin
 perform pg_advisory_xact_lock(731502615);
 if not exists(select 1 from companion_private.ai_budget_config where id and live_enabled) then
  raise exception 'live_ai_disabled';
 end if;
 select * into j from companion_private.cloud_jobs where id=(p_args->>'job_id')::uuid;
 if not found or j.status<>'processing' or j.lease is null or j.lease_until is null
  or j.lease is distinct from (p_args->>'lease')::uuid or j.lease_until<=now()
  or j.expires_at<=now() or not companion_private.job_allowed(j) then raise exception 'job_unavailable';end if;
 -- No relationship context or recipient capabilities in this first adapter.
 if j.relationship_id is not null then raise exception 'solo_only';end if;
 select * into p from companion_private.ai_prices where id=(p_args->>'price_id')::uuid;
 if not found or p.provider<>'deepseek' or p.capability<>'chat' or p.unit<>'tokens'
  or p.model not in ('deepseek-flash','deepseek-v4-pro') or not p.enabled
  or p.reviewed_at>now() or p.valid_until<=now() or p.fx_asof>now() then raise exception 'price_unavailable';end if;
 if not exists(select 1 from companion_private.ai_provider_catalog c
   join companion_private.ai_provider_grants g using(provider,capability)
   where c.provider='deepseek' and c.capability='chat' and c.enabled
   and c.reviewed_at<=now() and c.review_revision is not null
   and g.owner=j.owner and g.approved and g.review_revision=c.review_revision) then
  raise exception 'processor_not_approved';end if;
 if exists(select 1 from companion_private.ai_user_budgets where owner=j.owner and paused) then
  raise exception 'budget_paused';end if;
 return jsonb_build_object('locale',j.locale,'model',p.model,'review_revision',
  (select review_revision from companion_private.ai_provider_catalog where provider='deepseek' and capability='chat'));
end $$;
revoke all on function companion_private.deepseek_authorize(jsonb) from public,anon,authenticated,companion_worker;
grant execute on function companion_private.deepseek_authorize(jsonb) to companion_meter;
