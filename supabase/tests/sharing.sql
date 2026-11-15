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
do $$ declare eid uuid; sid uuid; rid uuid:=current_setting('test_membership.rid')::uuid; begin
 perform set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000001',true);
 select id into eid from public.companion_entries limit 1;
 sid:=(public.reflection_sharing('share',jsonb_build_object('entry_id',eid,'relationship_id',rid,'membership_version',3,
  'recipients',jsonb_build_array('90000000-0000-0000-0000-000000000002')))->>'id')::uuid;
 perform set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000003',true);
 begin
  perform public.reflection_sharing('read',jsonb_build_object('share_id',sid));
  raise exception 'Unselected recipient read source';
 exception when raise_exception then if sqlerrm<>'sharing_unavailable' then raise;end if;end;
 perform set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000002',true);
 if public.reflection_sharing('read',jsonb_build_object('share_id',sid))->>'text'<>'Private fictional A history'
  then raise exception 'Shared copy missing';end if;
 if exists(select 1 from public.companion_entries) then raise exception 'Original leaked';end if;
 perform set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000001',true);
 perform public.reflection_sharing('revoke',jsonb_build_object('share_id',sid,'recipient','90000000-0000-0000-0000-000000000002'));
 perform set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000002',true);
 begin
  perform public.reflection_sharing('read',jsonb_build_object('share_id',sid));
  raise exception 'Revoked copy readable';
 exception when raise_exception then if sqlerrm<>'sharing_unavailable' then raise;end if;end;
 perform set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000001',true);
 sid:=(public.reflection_sharing('share',jsonb_build_object('entry_id',eid,'relationship_id',rid,'membership_version',3,
  'recipients',jsonb_build_array('90000000-0000-0000-0000-000000000002','90000000-0000-0000-0000-000000000003')))->>'id')::uuid;
 perform public.relationship_action('block','{"user_id":"90000000-0000-0000-0000-000000000002","value":true}');
 perform set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000002',true);
 begin
  perform public.reflection_sharing('read',jsonb_build_object('share_id',sid));
  raise exception 'Blocked copy readable';
 exception when raise_exception then if sqlerrm<>'sharing_unavailable' then raise;end if;end;
 perform set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000003',true);
 perform public.reflection_sharing('read',jsonb_build_object('share_id',sid));
end $$;
select 'sharing-smoke-passed' as result;
rollback;
