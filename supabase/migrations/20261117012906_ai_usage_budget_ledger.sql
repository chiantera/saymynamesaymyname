-- Application accounting only: never grants permission to contact a processor.
do $$ begin if not exists(select 1 from pg_roles where rolname='companion_meter') then create role companion_meter nologin;end if;end $$;
grant usage on schema companion_private to companion_meter;
create table companion_private.ai_budget_config(id boolean primary key default true check(id),live_enabled boolean not null default false,monthly_eur numeric(18,6) not null default 20 check(monthly_eur between 0 and 20),buffer_bps integer not null default 1000 check(buffer_bps between 0 and 10000));
insert into companion_private.ai_budget_config values(true,false,20,1000);
create table companion_private.ai_user_budgets(owner uuid primary key references auth.users(id) on delete cascade,revision bigint not null default 0,paused boolean not null default false,monthly_eur numeric(18,6) not null default 20 check(monthly_eur between 0 and 20));
create table companion_private.ai_prices(
 id uuid primary key default extensions.gen_random_uuid(),provider text not null,capability text not null,model text not null check(model~'^[A-Za-z0-9._:/-]{1,120}$'),version text not null,
 currency text not null check(currency in ('EUR','USD')),eur_fx numeric(18,9) not null check(eur_fx between 0.000001 and 1000),fx_asof timestamptz not null,
 input_rate numeric(18,9) not null check(input_rate between 0 and 1000000),cached_rate numeric(18,9) not null check(cached_rate between 0 and 1000000),output_rate numeric(18,9) not null check(output_rate between 0 and 1000000),
 unit text not null check(unit in ('tokens','seconds','pages','characters','requests')),unit_rate numeric(18,9) not null check(unit_rate between 0 and 1000000),
 minimum_charge numeric(18,9) not null default 0 check(minimum_charge between 0 and 1000000),quantum numeric(18,9) not null default 0.000001 check(quantum>0 and quantum<=1),
 max_input bigint not null check(max_input between 0 and 1000000000),max_output bigint not null check(max_output between 0 and 1000000000),max_units numeric(18,6) not null check(max_units between 0 and 1000000000),
 reviewed_at timestamptz not null,valid_until timestamptz not null,enabled boolean not null default false,
 foreign key(provider,capability) references companion_private.ai_provider_catalog,unique(provider,model,version),check(valid_until>reviewed_at),check(currency<>'EUR' or eur_fx=1),
 check((unit='tokens' and max_units=0 and unit_rate=0) or (unit<>'tokens' and max_input=0 and max_output=0 and input_rate=0 and cached_rate=0 and output_rate=0))
);
create table companion_private.ai_usage_attempts(
 id uuid primary key default extensions.gen_random_uuid(),task_id uuid not null,job_id uuid references companion_private.cloud_jobs(id) on delete set null,
 owner uuid references auth.users(id) on delete set null,attempt_no integer not null check(attempt_no between 1 and 10),price_id uuid not null references companion_private.ai_prices,
 kind text not null check(kind in ('checkin','chat','summary','safety','ocr','transcription','tts')),fallback boolean not null default false,
 bounds jsonb not null,usage jsonb,provider_request_id text check(provider_request_id~'^[A-Za-z0-9_.:-]{1,200}$'),
 state text not null default 'reserved' check(state in ('reserved','started','unknown','estimated','reconciled','cancelled')),
 reserved_eur numeric(30,6) not null check(reserved_eur>=0),estimated_eur numeric(30,6),actual_eur numeric(30,6),actual_native numeric(30,9),actual_fx numeric(18,9),
 budget_month date not null default date_trunc('month',now() at time zone 'UTC')::date,
 created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '5 minutes',started_at timestamptz,reconciled_at timestamptz,
 unique(task_id,attempt_no)
);
create unique index ai_usage_provider_receipt on companion_private.ai_usage_attempts(price_id,provider_request_id) where provider_request_id is not null;
create index ai_usage_month on companion_private.ai_usage_attempts(budget_month,state);
create index ai_usage_owner on companion_private.ai_usage_attempts(owner,budget_month);
create index ai_usage_job on companion_private.ai_usage_attempts(job_id);
create index ai_usage_pending on companion_private.ai_usage_attempts(state,expires_at);
create table companion_private.ai_usage_rollups(month date primary key,estimated_eur numeric(30,6) not null default 0,reconciled_eur numeric(30,6) not null default 0,attempts bigint not null default 0);
alter table companion_private.ai_budget_config enable row level security;
alter table companion_private.ai_user_budgets enable row level security;
alter table companion_private.ai_prices enable row level security;
alter table companion_private.ai_usage_attempts enable row level security;
alter table companion_private.ai_usage_rollups enable row level security;
revoke all on companion_private.ai_budget_config,companion_private.ai_user_budgets,companion_private.ai_prices,companion_private.ai_usage_attempts,companion_private.ai_usage_rollups from public,anon,authenticated,companion_worker,companion_meter;

create function companion_private.freeze_ai_price() returns trigger language plpgsql set search_path='' as $$
begin if to_jsonb(new)-'enabled' is distinct from to_jsonb(old)-'enabled' then raise exception 'price_versions_are_immutable';end if;return new;end $$;
revoke all on function companion_private.freeze_ai_price() from public,anon,authenticated,companion_worker,companion_meter;
create trigger freeze_ai_price before update on companion_private.ai_prices for each row execute function companion_private.freeze_ai_price();

create function companion_private.ai_charge(p companion_private.ai_prices,u jsonb,maximum boolean default false) returns numeric
language plpgsql immutable set search_path='' as $$
declare i numeric; c numeric; o numeric; n numeric;native numeric;
begin
 if u is null or jsonb_typeof(u)<>'object' or exists(select 1 from jsonb_object_keys(u) k where k not in ('input','cached','output','units')) then raise exception 'invalid_usage';end if;
 i:=(u->>'input')::numeric;c:=(u->>'cached')::numeric;o:=(u->>'output')::numeric;n:=(u->>'units')::numeric;
 if i is null or c is null or o is null or n is null or not(i between 0 and 1000000000 and c between 0 and i and o between 0 and 1000000000 and n between 0 and 1000000000 and i=trunc(i) and c=trunc(c) and o=trunc(o)) then raise exception 'invalid_usage';end if;
 if (p.unit='tokens' and n<>0) or (p.unit<>'tokens' and (i<>0 or c<>0 or o<>0)) then raise exception 'invalid_usage';end if;
 if maximum then native:=i*greatest(p.input_rate,p.cached_rate)/1000000+o*p.output_rate/1000000+n*p.unit_rate;
 else native:=(i-c)*p.input_rate/1000000+c*p.cached_rate/1000000+o*p.output_rate/1000000+n*p.unit_rate;end if;
 native:=ceil(greatest(native,p.minimum_charge)/p.quantum)*p.quantum;
 return ceil(native*p.eur_fx*1000000)/1000000;
end $$;
revoke all on function companion_private.ai_charge(companion_private.ai_prices,jsonb,boolean) from public,anon,authenticated,companion_worker,companion_meter;

create function companion_private.ai_meter(p_action text,p_args jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j companion_private.cloud_jobs;a companion_private.ai_usage_attempts;p companion_private.ai_prices;cfg companion_private.ai_budget_config;ub companion_private.ai_user_budgets;owner_id uuid;amount numeric;project_used numeric;own_used numeric;month_now date:=date_trunc('month',now() at time zone 'UTC')::date;rid text;
begin
 perform pg_advisory_xact_lock(731502615);
 select * into cfg from companion_private.ai_budget_config where id;
 -- Only never-dispatched reservations may expire. Unknown/started charges keep holds.
 update companion_private.ai_usage_attempts set state='cancelled' where state='reserved' and expires_at<=now();
 if p_action in ('reserve','begin') then
  if cfg.live_enabled is distinct from true then raise exception 'live_ai_disabled';end if;
  if p_action='reserve' then
   select * into j from companion_private.cloud_jobs where id=(p_args->>'job_id')::uuid;
   if not found then raise exception 'job_unavailable';end if;
   select * into p from companion_private.ai_prices where id=(p_args->>'price_id')::uuid;
   if not found then raise exception 'price_unavailable';end if;
  else
   select * into a from companion_private.ai_usage_attempts where id=(p_args->>'id')::uuid;
   if not found or a.state<>'reserved' then raise exception 'attempt_unavailable';end if;
   select * into j from companion_private.cloud_jobs where id=a.job_id;
   if not found then raise exception 'job_unavailable';end if;
   select * into p from companion_private.ai_prices where id=a.price_id;
  end if;
  if j.status<>'processing' or j.lease is null or j.lease_until is null or j.lease is distinct from (p_args->>'lease')::uuid or j.lease_until<=now() or j.expires_at<=now() or not companion_private.job_allowed(j) then raise exception 'job_unavailable';end if;
  if not p.enabled or p.reviewed_at>now() or p.valid_until<=now() or p.fx_asof>now() then raise exception 'price_unavailable';end if;
  owner_id:=j.owner;
  if not exists(select 1 from companion_private.ai_provider_catalog c join companion_private.ai_provider_grants g using(provider,capability) where c.provider=p.provider and c.capability=p.capability and c.enabled and g.owner=owner_id and g.approved and g.review_revision=c.review_revision and (not case when p_action='begin' then a.fallback else coalesce((p_args->>'fallback')::boolean,false) end or g.allow_fallback)) then raise exception 'processor_not_approved';end if;
  select * into ub from companion_private.ai_user_budgets where owner=owner_id;
  if found and ub.paused then raise exception 'budget_paused';end if;
  if p_action='reserve' then
   if not ((p.capability='chat' and p_args->>'kind' in ('checkin','chat','summary','safety')) or p.capability=p_args->>'kind') then raise exception 'invalid_task_kind';end if;
   amount:=companion_private.ai_charge(p,p_args->'bounds',true);
   if (p_args->'bounds'->>'input')::numeric>p.max_input or (p_args->'bounds'->>'output')::numeric>p.max_output or (p_args->'bounds'->>'units')::numeric>p.max_units then raise exception 'usage_bounds_exceeded';end if;
   select * into a from companion_private.ai_usage_attempts where task_id=j.id and attempt_no=(p_args->>'attempt_no')::integer;
   if found then
    if a.price_id<>p.id or a.bounds is distinct from p_args->'bounds' or a.kind is distinct from p_args->>'kind' or a.fallback is distinct from coalesce((p_args->>'fallback')::boolean,false) then raise exception 'attempt_conflict';end if;
    return jsonb_build_object('id',a.id,'state',a.state,'reserved_eur',a.reserved_eur);
   end if;
   amount:=ceil(amount*(1+cfg.buffer_bps::numeric/10000)*1000000)/1000000;
  else amount:=0;end if;
  select coalesce(sum(case when state in ('reserved','started','unknown') then reserved_eur when budget_month=month_now then coalesce(actual_eur,estimated_eur,0) else 0 end),0) into project_used from companion_private.ai_usage_attempts where state<>'cancelled';
  project_used:=project_used+coalesce((select estimated_eur+reconciled_eur from companion_private.ai_usage_rollups where month=month_now),0);
  select coalesce(sum(case when state in ('reserved','started','unknown') then reserved_eur when budget_month=month_now then coalesce(actual_eur,estimated_eur,0) else 0 end),0) into own_used from companion_private.ai_usage_attempts where owner=owner_id and state<>'cancelled';
  if project_used+amount>cfg.monthly_eur or own_used+amount>coalesce(ub.monthly_eur,20) then raise exception 'budget_exhausted';end if;
  if p_action='reserve' then
   insert into companion_private.ai_usage_attempts(task_id,job_id,owner,attempt_no,price_id,kind,fallback,bounds,reserved_eur)
    values(j.id,j.id,owner_id,(p_args->>'attempt_no')::integer,p.id,p_args->>'kind',coalesce((p_args->>'fallback')::boolean,false),p_args->'bounds',amount) returning * into a;
  else update companion_private.ai_usage_attempts set state='started',started_at=now(),budget_month=month_now where id=a.id returning * into a;end if;
  return jsonb_build_object('id',a.id,'state',a.state,'reserved_eur',a.reserved_eur);
 end if;
 select * into a from companion_private.ai_usage_attempts where id=(p_args->>'id')::uuid;
 if not found then raise exception 'attempt_unavailable';end if;
 select * into p from companion_private.ai_prices where id=a.price_id;
 case p_action
 when 'release' then
  if a.state not in ('reserved','cancelled') then raise exception 'cannot_release_dispatched_charge';end if;
  update companion_private.ai_usage_attempts set state='cancelled' where id=a.id;
 when 'unknown' then
  if a.state not in ('started','unknown') then raise exception 'attempt_unavailable';end if;
  update companion_private.ai_usage_attempts set state='unknown' where id=a.id;
 when 'report','reconcile' then
  rid:=p_args->>'provider_request_id';
  if rid is null or rid!~'^[A-Za-z0-9_.:-]{1,200}$' then raise exception 'receipt_required';end if;
  if exists(select 1 from companion_private.ai_usage_attempts x join companion_private.ai_prices xp on xp.id=x.price_id where xp.provider=p.provider and x.provider_request_id=rid and x.id<>a.id) then raise exception 'duplicate_provider_receipt';end if;
  if a.provider_request_id is not null and a.provider_request_id<>rid then raise exception 'receipt_conflict';end if;
  if p_action='report' then
   amount:=companion_private.ai_charge(p,p_args->'usage',false);
   if a.state in ('estimated','reconciled') then
    if a.usage is distinct from p_args->'usage' or a.provider_request_id<>rid then raise exception 'receipt_conflict';end if;
   elsif a.state in ('started','unknown') then update companion_private.ai_usage_attempts set state='estimated',estimated_eur=amount,usage=p_args->'usage',provider_request_id=rid where id=a.id;
   else raise exception 'attempt_unavailable';end if;
  else
   if (p_args->>'actual_native')::numeric is null or not ((p_args->>'actual_native')::numeric between 0 and 1000000000) or (p_args->>'actual_fx')::numeric is null or not ((p_args->>'actual_fx')::numeric between 0.000001 and 1000) or (p.currency='EUR' and (p_args->>'actual_fx')::numeric<>1) then raise exception 'invalid_charge';end if;
   amount:=ceil((p_args->>'actual_native')::numeric*(p_args->>'actual_fx')::numeric*1000000)/1000000;
   if a.state='reconciled' then
    if a.actual_native is distinct from (p_args->>'actual_native')::numeric or a.actual_fx is distinct from (p_args->>'actual_fx')::numeric or a.provider_request_id<>rid then raise exception 'receipt_conflict';end if;
   elsif a.state in ('started','unknown','estimated') then update companion_private.ai_usage_attempts set state='reconciled',actual_eur=amount,actual_native=(p_args->>'actual_native')::numeric,actual_fx=(p_args->>'actual_fx')::numeric,provider_request_id=rid,reconciled_at=now() where id=a.id;
   else raise exception 'attempt_unavailable';end if;
  end if;
 else raise exception 'invalid_action';end case;
 return jsonb_build_object('id',a.id,'state',(select state from companion_private.ai_usage_attempts where id=a.id));
end $$;
revoke all on function companion_private.ai_meter(text,jsonb) from public,anon,authenticated,companion_worker,companion_meter;
grant execute on function companion_private.ai_meter(text,jsonb) to companion_meter;
