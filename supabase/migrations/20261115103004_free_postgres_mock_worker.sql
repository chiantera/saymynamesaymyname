-- Temporary no-extra-host mock executor. No HTTP, AI calls or private context.
create table companion_private.mock_catalog(locale text primary key,prompt text not null,draft text not null);
alter table companion_private.mock_catalog enable row level security;
revoke all on companion_private.mock_catalog from public,anon,authenticated,companion_worker;
insert into companion_private.mock_catalog values
 ('en','What could make today feel a little lighter?','Today I want to make room for one small thing that matters to me.'),
 ('it','Cosa potrebbe rendere oggi un po’ più leggero?','Oggi voglio fare spazio a una piccola cosa che per me conta.'),
 ('es','¿Qué podría hacer que hoy sea un poco más llevadero?','Hoy quiero hacer espacio para algo pequeño que me importa.'),
 ('ko','오늘을 조금 더 가볍게 만들어 줄 것은 무엇인가요?','오늘은 나에게 소중한 작은 일 하나를 위한 여유를 만들고 싶어요.'),
 ('zh-Hans','什么能让今天轻松一点？','今天，我想为一件对自己重要的小事留出空间。'),
 ('yue-Hant','有咩可以令今日輕鬆少少？','今日，我想留啲空間畀一件自己重視嘅小事。'),
 ('de','Was könnte deinen heutigen Tag etwas leichter machen?','Heute möchte ich einer kleinen Sache Raum geben, die mir wichtig ist.');

create function companion_private.postgres_mock_tick() returns integer
language plpgsql security definer set search_path='' as $$
declare job jsonb; copy companion_private.mock_catalog; completed integer:=0; n integer;
begin
 -- Serialize with all existing membership/block/scheduling/worker actions.
 perform pg_advisory_xact_lock(731502615);
 -- Dispatch validates all the same schedule, pause, membership and cap rules.
 -- A successful transaction commits heartbeat and publication together; failures
 -- leave neither false readiness nor partially completed jobs behind.
 perform companion_private.worker_heartbeat();
 perform companion_private.cloud_tick();
 for n in 1..10 loop
  job:=companion_private.claim_cloud_job();
  if job is null then exit;end if;
  select * into copy from companion_private.mock_catalog where locale=job->>'locale';
  if not found then raise exception 'mock_locale_unavailable';end if;
  if companion_private.finish_cloud_job((job->>'id')::uuid,(job->>'lease')::uuid,copy.prompt,copy.draft) then completed:=completed+1;end if;
 end loop;
 return completed;
end $$;
revoke all on function companion_private.postgres_mock_tick() from public,anon,authenticated,companion_worker;
-- Same named cron: no second scheduler. Restore cloud_tick() when Render is ready.
do $$ begin
 if exists(select 1 from pg_extension where extname='pg_cron') then
  perform cron.schedule('companion-cloud-tick','* * * * *','select companion_private.postgres_mock_tick()');
 end if;
end $$;
