-- Disposable synthetic actors only. All rows and tokens are rolled back.
begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('90000000-0000-0000-0000-000000000001','membership-a@example.invalid',now()),
 ('90000000-0000-0000-0000-000000000002','membership-b@example.invalid',now()),
 ('90000000-0000-0000-0000-000000000003','membership-c@example.invalid',now()),
 ('90000000-0000-0000-0000-000000000004','membership-d@example.invalid',now());
insert into public.beta_access values
 ('90000000-0000-0000-0000-000000000001'),('90000000-0000-0000-0000-000000000002'),('90000000-0000-0000-0000-000000000003');
set local role authenticated;
do $$ declare r jsonb; c jsonb; begin
 perform set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000001',true);
 r:=public.relationship_action('create','{"label":"Fictional membership test","alias":"Alex"}');
 perform set_config('test_membership.rid',r->>'id',true);
 c:=public.create_private_checkin('en','Private fictional prompt','Private fictional draft');
 perform public.decide_private_checkin((c->>'id')::uuid,'approve',0,'Private fictional A history');
 r:=public.relationship_action('propose',jsonb_build_object('relationship_id',r->>'id','membership_version',1,'email','membership-b@example.invalid'));
 r:=public.relationship_action('issue',jsonb_build_object('invitation_id',r->>'id','version',0));
 perform set_config('test_membership.token_b',r->>'token',true);
end $$;
do $$ begin
 perform set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000003',true);
 begin
  perform public.relationship_invite_preview(current_setting('test_membership.token_b'));
  raise exception 'Forwarded token accepted';
 exception when raise_exception then if sqlerrm<>'invite_unavailable' then raise;end if; end;
 perform set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000002',true);
 perform public.relationship_action('accept',jsonb_build_object('token',current_setting('test_membership.token_b'),'alias','Blair'));
 if exists(select 1 from public.companion_entries) then raise exception 'Private history leaked';end if;
 begin
  perform public.relationship_action('accept',jsonb_build_object('token',current_setting('test_membership.token_b'),'alias','Blair'));
  raise exception 'Token replay accepted';
 exception when raise_exception then if sqlerrm<>'invite_unavailable' then raise;end if; end;
end $$;
do $$ declare r jsonb; begin
 perform set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000001',true);
 r:=public.relationship_action('propose',jsonb_build_object('relationship_id',current_setting('test_membership.rid'),'membership_version',2,'email','membership-c@example.invalid'));
 perform set_config('test_membership.invite_c',r->>'id',true);
 begin
  perform public.relationship_action('issue',jsonb_build_object('invitation_id',r->>'id','version',0));
  raise exception 'Unanimity bypass';
 exception when raise_exception then if sqlerrm<>'invite_not_ready' then raise;end if; end;
 perform set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000002',true);
 perform public.relationship_action('approve',jsonb_build_object('invitation_id',current_setting('test_membership.invite_c')));
 r:=public.relationship_action('issue',jsonb_build_object('invitation_id',current_setting('test_membership.invite_c'),'version',0));
 perform set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000003',true);
 perform public.relationship_action('accept',jsonb_build_object('token',r->>'token','alias','Casey'));
end $$;
do $$ declare members jsonb; begin
 perform set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000001',true);
 perform public.relationship_action('block','{"user_id":"90000000-0000-0000-0000-000000000002","value":true}');
 perform set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000002',true);
 members:=public.relationship_workspace()->'relationships'->0->'members';
 if not exists(select 1 from jsonb_array_elements(members) m where m->>'alias'='Casey' and (m->>'can_contact')::boolean)
  then raise exception 'B/C was blocked';end if;
 if exists(select 1 from jsonb_array_elements(members) m where m->>'alias'='Alex' and (m->>'can_contact')::boolean)
  then raise exception 'A/B contact bypass';end if;
 perform set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000001',true);
 perform public.relationship_action('leave',jsonb_build_object('relationship_id',current_setting('test_membership.rid'),'generation',1));
 if jsonb_array_length(public.relationship_workspace()->'relationships')<>0 then raise exception 'Leaving failed';end if;
 if exists(select 1 from public.companion_relationships where id=current_setting('test_membership.rid')::uuid)
  then raise exception 'Former creator retained live relationship access';end if;
 if (select count(*) from public.companion_entries)<>1 then raise exception 'Private history lost';end if;
 perform set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000004',true);
 begin
  perform public.relationship_workspace();raise exception 'Beta admission bypass';
 exception when raise_exception then if sqlerrm<>'beta_access_required' then raise;end if; end;
end $$;
rollback;
select 'membership_checks_passed' as result;
