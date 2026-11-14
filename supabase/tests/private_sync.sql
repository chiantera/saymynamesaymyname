
begin;
insert into auth.users(id,email) values ('10000000-0000-0000-0000-000000000001','actor-a@example.invalid'),('10000000-0000-0000-0000-000000000002','actor-b@example.invalid');
insert into public.beta_access values('10000000-0000-0000-0000-000000000001'),('10000000-0000-0000-0000-000000000002');
insert into public.companion_profiles(owner) values('10000000-0000-0000-0000-000000000001'),('10000000-0000-0000-0000-000000000002');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
select public.create_private_checkin('en','Fictional prompt','Fictional draft');
do $$
declare cid uuid;
begin
 if (select count(*) from public.companion_profiles)<>1 then raise exception 'RLS leak'; end if;
 select id into cid from public.companion_checkins limit 1;
 perform public.decide_private_checkin(cid,'approve',0,'Reviewed fictional reflection');
 if (select count(*) from public.companion_entries)<>1 then raise exception 'Missing artifact'; end if;
 begin
  perform public.decide_private_checkin(cid,'approve',0,'Duplicate');
  raise exception 'Duplicate accepted';
 exception when raise_exception then
  if sqlerrm<>'stale_decision' then raise; end if;
 end;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
do $$ begin
 if exists(select 1 from public.companion_entries) then raise exception 'Cross-user entry leak';end if;
 if exists(select 1 from public.companion_checkins) then raise exception 'Cross-user checkin leak';end if;
 if (select count(*) from public.companion_profiles)<>1 then raise exception 'Cross-user profile leak';end if;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',true);
do $$ begin
 if public.has_beta_access() then raise exception 'Admission bypass'; end if;
 if exists(select 1 from public.companion_profiles) then raise exception 'Unadmitted read'; end if;
 begin
  perform public.create_private_checkin('en','unauthorized','draft');
  raise exception 'Unadmitted write';
 exception when raise_exception then
  if sqlerrm<>'beta_access_required' then raise; end if;
 end;
end $$;
rollback;
