create function companion_private.ai_budget_maintenance() returns integer language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 perform pg_advisory_xact_lock(731502615);
 update companion_private.ai_usage_attempts set state='cancelled' where state='reserved' and expires_at<=now();
 update companion_private.ai_usage_attempts set state='unknown' where state='started' and expires_at<=now();
 -- Active unknown/estimated charges are not discarded as though settled at zero.
 with old as (
  delete from companion_private.ai_usage_attempts where id in (
   select id from companion_private.ai_usage_attempts where state in ('reconciled','cancelled') and created_at<now()-interval '90 days' order by created_at limit 1000
  ) returning budget_month,actual_eur,started_at
 ) insert into companion_private.ai_usage_rollups(month,reconciled_eur,attempts)
  select budget_month,coalesce(sum(actual_eur),0),count(started_at) from old group by budget_month
  on conflict(month) do update set reconciled_eur=companion_private.ai_usage_rollups.reconciled_eur+excluded.reconciled_eur,attempts=companion_private.ai_usage_rollups.attempts+excluded.attempts;
 get diagnostics n=row_count;
 delete from companion_private.ai_usage_rollups where month<(date_trunc('month',now() at time zone 'UTC')-interval '12 months')::date;
 return n;
end $$;
revoke all on function companion_private.ai_budget_maintenance() from public,anon,authenticated,companion_worker,companion_meter;

create function companion_private.ai_budget_view(p_action text,p_args jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();u companion_private.ai_user_budgets;cfg companion_private.ai_budget_config;posted numeric;held numeric;unknown_amount numeric;limit_amount numeric;month_now date:=date_trunc('month',now() at time zone 'UTC')::date;result jsonb;
begin
 perform pg_advisory_xact_lock(731502615);
 if not companion_private.is_beta() then raise exception 'beta_access_required';end if;
 select * into u from companion_private.ai_user_budgets where owner=actor;
 if not found then u.owner:=actor;u.revision:=0;u.paused:=false;u.monthly_eur:=20;end if;
 if p_action='save' then
  if u.revision is distinct from (p_args->>'revision')::bigint then raise exception 'stale_budget';end if;
  if jsonb_typeof(p_args->'paused') is distinct from 'boolean' then raise exception 'invalid_budget';end if;
  insert into companion_private.ai_user_budgets(owner,revision,paused,monthly_eur) values(actor,u.revision+1,(p_args->>'paused')::boolean,(p_args->>'monthly_eur')::numeric)
   on conflict(owner) do update set revision=excluded.revision,paused=excluded.paused,monthly_eur=excluded.monthly_eur returning * into u;
 elsif p_action<>'get' then raise exception 'invalid_action';end if;
 select * into cfg from companion_private.ai_budget_config where id;
 limit_amount:=least(u.monthly_eur,coalesce(cfg.monthly_eur,0));
 select coalesce(sum(coalesce(actual_eur,estimated_eur)),0) into posted from companion_private.ai_usage_attempts where owner=actor and budget_month=month_now and state in ('estimated','reconciled');
 select coalesce(sum(reserved_eur),0),coalesce(sum(reserved_eur) filter(where state='unknown'),0) into held,unknown_amount from companion_private.ai_usage_attempts where owner=actor and state in ('reserved','started','unknown');
 result:=jsonb_build_object('revision',u.revision,'monthly_eur',u.monthly_eur,'paused',u.paused,'effective_limit_eur',limit_amount,'live_enabled',coalesce(cfg.live_enabled,false),
  'month',month_now,'posted_eur',posted,'held_eur',held,'unknown_eur',unknown_amount,'remaining_eur',greatest(limit_amount-posted-held,0),
  'alert',case when posted+held=0 then 'none' when limit_amount=0 or posted+held>=limit_amount*.95 then '95' when posted+held>=limit_amount*.8 then '80' when posted+held>=limit_amount*.5 then '50' else 'none' end,
  'last_reconciled_at',(select max(reconciled_at) from companion_private.ai_usage_attempts where owner=actor));
 return result||jsonb_build_object('attempts',coalesce((select jsonb_agg(to_jsonb(q) order by q.created_at desc) from (
  select a.id,a.created_at,a.budget_month,a.state,a.kind,a.fallback,p.provider,p.capability,p.model,p.version as price_version,p.currency,p.unit,
   a.reserved_eur,a.estimated_eur,a.actual_eur,a.usage
  from companion_private.ai_usage_attempts a join companion_private.ai_prices p on p.id=a.price_id where a.owner=actor order by a.created_at desc,a.id limit 50
 ) q),'[]'::jsonb));
end $$;
revoke all on function companion_private.ai_budget_view(text,jsonb) from public,anon,authenticated,companion_worker,companion_meter;
grant execute on function companion_private.ai_budget_view(text,jsonb) to authenticated;
create function public.ai_budget(p_action text,p_args jsonb default '{}'::jsonb) returns jsonb language sql security invoker set search_path='' as $$select companion_private.ai_budget_view(p_action,p_args)$$;
revoke all on function public.ai_budget(text,jsonb) from public,anon,authenticated;
grant execute on function public.ai_budget(text,jsonb) to authenticated;

-- Restricted operator cost view: no owners, emails, prompt/context bodies or auth data.
create function companion_private.ai_budget_admin() returns jsonb language sql security definer set search_path='' as $$
 with m as(select date_trunc('month',now() at time zone 'UTC')::date as month), totals as(
 select coalesce(sum(coalesce(actual_eur,estimated_eur)) filter(where budget_month=(select month from m) and state in ('estimated','reconciled')),0) as posted,
 coalesce(sum(reserved_eur) filter(where state in ('reserved','started','unknown')),0) as held,
 count(*) filter(where state='unknown') as unknown_count,max(reconciled_at) as reconciled_at from companion_private.ai_usage_attempts
 ) select jsonb_build_object('month',m.month,'live_enabled',c.live_enabled,'target_eur',c.monthly_eur,'posted_eur',t.posted+coalesce(r.estimated_eur+r.reconciled_eur,0),'held_eur',t.held,
 'remaining_eur',greatest(c.monthly_eur-t.posted-t.held-coalesce(r.estimated_eur+r.reconciled_eur,0),0),'unknown_count',t.unknown_count,'last_reconciled_at',t.reconciled_at,
 'alert',case when t.posted+t.held+coalesce(r.estimated_eur+r.reconciled_eur,0)=0 then 'none' when c.monthly_eur=0 or t.posted+t.held+coalesce(r.estimated_eur+r.reconciled_eur,0)>=c.monthly_eur*.95 then '95' when t.posted+t.held+coalesce(r.estimated_eur+r.reconciled_eur,0)>=c.monthly_eur*.8 then '80' when t.posted+t.held+coalesce(r.estimated_eur+r.reconciled_eur,0)>=c.monthly_eur*.5 then '50' else 'none' end,
 'providers',coalesce((select jsonb_agg(to_jsonb(q)) from(select p.provider,coalesce(sum(coalesce(a.actual_eur,a.estimated_eur)) filter(where a.state in ('estimated','reconciled') and a.budget_month=m.month),0) as posted_eur,coalesce(sum(a.reserved_eur) filter(where a.state in ('reserved','started','unknown')),0) as held_eur,count(*) as attempts from companion_private.ai_usage_attempts a join companion_private.ai_prices p on p.id=a.price_id group by p.provider)q),'[]'::jsonb),
 'tasks',coalesce((select jsonb_agg(to_jsonb(q)) from(select kind,count(*) as attempts,coalesce(sum(coalesce(actual_eur,estimated_eur)),0) as posted_eur from companion_private.ai_usage_attempts where budget_month=m.month and state in ('estimated','reconciled') group by kind)q),'[]'::jsonb))
 from m cross join totals t cross join companion_private.ai_budget_config c left join companion_private.ai_usage_rollups r on r.month=m.month where c.id;
$$;
revoke all on function companion_private.ai_budget_admin() from public,anon,authenticated,companion_worker,companion_meter;
-- Keep one cron, with bounded retention and the static mock consumer only.
do $$ begin if exists(select 1 from pg_extension where extname='pg_cron') then
 perform cron.schedule('companion-cloud-tick','* * * * *','select companion_private.cleanup_ai_consents(); select companion_private.ai_budget_maintenance(); select companion_private.postgres_mock_tick()');
end if;end $$;
