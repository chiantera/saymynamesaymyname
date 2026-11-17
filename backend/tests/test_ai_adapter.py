"""Fictional HTTP only; no real credentials or local secrets file is read."""
import json
import uuid
import httpx
import pytest
from app.ai import (Composer, CORE, DeepSeekHTTP, Denied, Deployment, Task,
                    draft_content, receipt)


TASK = Task(*(str(uuid.uuid4()) for _ in range(3)))
APPROVED = Deployment(True, True, True, 'frankfurt')


def reply():
    return dict(id='fictional-receipt',model='deepseek-flash',
                choices=[dict(finish_reason='stop',message=dict(role='assistant',
                    content=json.dumps(dict(prompt='What matters today?',draft='I will pause.'))))],
                usage=dict(prompt_tokens=40,completion_tokens=20,prompt_cache_hit_tokens=10,
                           prompt_cache_miss_tokens=30,total_tokens=60))


class Gate:
    def __init__(self):
        self.calls=[];self.context=dict(locale='en',model='deepseek-flash',review_revision='fictional-v1')
        self.deny=None

    def authorize(self, task):
        self.calls.append('authorize')
        if self.deny:raise Denied(self.deny)
        return dict(self.context)

    def meter(self, action, **args):
        self.calls.append((action,args))
        return dict(id='fictional-attempt',state='reserved' if action=='reserve' else 'started')


class Safe:
    def __init__(self, outcome='allow'):self.outcome=outcome
    def check(self,text,*,phase,locale):return self.outcome


def harness(handler=None,safety=None,gate=None,**kwargs):
    calls=[];gate=gate or Gate()
    def send(request):
        calls.append(request)
        if handler:return handler(request,gate)
        return httpx.Response(200,json=reply())
    service=Composer(gate,deployment=APPROVED,safety=safety or Safe(),
                     provider=DeepSeekHTTP(transport=httpx.MockTransport(send)),
                     credentials=lambda:'fictional-key',**kwargs)
    return service,gate,calls


def actions(gate):return [c[0] for c in gate.calls if isinstance(c,tuple)]


def test_default_live_off_never_reads_key_or_touches_transport():
    def forbidden():raise AssertionError('must not read environment')
    service=Composer(Gate(),credentials=forbidden)
    with pytest.raises(Denied,match='live_ai_disabled'):service.compose(TASK)
    with pytest.raises(Denied,match='network_disabled'):DeepSeekHTTP().send(b'{}','fictional-key')
    for value in ('false',1,0,None):
        with pytest.raises(Denied,match='live_ai_disabled'):
            Deployment(value,True,True,'frankfurt').check()


def test_composition_has_central_prompt_fixed_route_and_committed_meter_order():
    service,gate,calls=harness()
    assert service.compose(TASK)['draft']=='I will pause.'
    assert len(calls)==1 and str(calls[0].url)=='https://api.deepseek.com/chat/completions'
    body=json.loads(calls[0].content)
    assert body['messages'][0]['content']==CORE
    assert body['thinking']=={'type':'disabled'} and body['stream'] is False
    assert body['tool_choice']=='none' and 'tools' not in body
    assert actions(gate)==['reserve','begin','report']
    assert gate.calls[-1]=='authorize'
    bounds=next(c[1]['bounds'] for c in gate.calls if isinstance(c,tuple) and c[0]=='reserve')
    assert bounds['input']>=len(calls[0].content) and bounds['output']==512


@pytest.mark.parametrize('outcome',['unavailable','refuse','self_harm','violence','stalking','unknown'])
def test_input_safety_fail_closed(outcome):
    service,gate,calls=harness(safety=Safe(outcome))
    with pytest.raises(Denied,match='safety_'):service.compose(TASK)
    assert not calls and not actions(gate)


def test_safety_exception_is_not_logged_or_returned():
    class Broken:
        def check(self,*args,**kwargs):raise RuntimeError('private text or credential')
    service,gate,calls=harness(safety=Broken())
    with pytest.raises(Denied,match='^safety_unavailable$'):service.compose(TASK)
    assert not calls


@pytest.mark.parametrize('status',[301,401,429,500])
def test_http_failures_never_retry_or_release_dispatched_cost(status):
    service,gate,calls=harness(lambda *_:httpx.Response(status,text='private provider body'))
    with pytest.raises(Denied,match='^provider_unavailable$'):service.compose(TASK)
    assert len(calls)==1 and actions(gate)==['reserve','begin','unknown']


def test_timeout_and_oversize_keep_unknown_hold():
    def timeout(request,_):raise httpx.ReadTimeout('fictional-secret',request=request)
    for handler in [timeout,lambda *_:httpx.Response(200,content=b'x'*64001)]:
        service,gate,calls=harness(handler)
        with pytest.raises(Denied,match='^provider_unavailable$'):service.compose(TASK)
        assert actions(gate)[-1]=='unknown' and len(calls)==1


def test_usage_missing_boolean_or_tool_charge_remains_unknown():
    for change in [dict(prompt_tokens=True),dict(server_tool_use={'tool_fetch':1})]:
        data=reply();data['usage'].update(change)
        service,gate,calls=harness(lambda *_:httpx.Response(200,json=data))
        with pytest.raises(Denied,match='usage_unavailable'):service.compose(TASK)
        assert actions(gate)[-1]=='unknown'


def test_output_safety_rejection_preserves_reported_charge():
    class OutputUnsafe:
        def check(self,text,*,phase,locale):return 'stalking' if phase=='output' else 'allow'
    service,gate,calls=harness(safety=OutputUnsafe())
    with pytest.raises(Denied,match='safety_stalking'):service.compose(TASK)
    assert actions(gate)==['reserve','begin','report']


def test_revocation_while_request_runs_prevents_return_but_not_accounting():
    def revoke(_,gate):
        gate.deny='processor_not_approved'
        return httpx.Response(200,json=reply())
    service,gate,calls=harness(revoke)
    with pytest.raises(Denied,match='processor_not_approved'):service.compose(TASK)
    assert actions(gate)==['reserve','begin','report']


def test_pre_dispatch_change_releases_only_unsent_reservation():
    gate=Gate()
    class Revoke:
        def __init__(self):self.n=0
        def check(self,*args,**kwargs):
            self.n+=1
            if self.n==1:gate.context['review_revision']='new-review'
            return 'allow'
    service,gate,calls=harness(gate=gate,safety=Revoke())
    with pytest.raises(Denied,match='authorization_changed'):service.compose(TASK)
    assert not calls and actions(gate)==['reserve','release']


@pytest.mark.parametrize('mutation',[
    lambda d:d['choices'][0].update(finish_reason='length'),
    lambda d:d['choices'][0]['message'].update(tool_calls=[{}]),
    lambda d:d['choices'][0]['message'].update(content='{"prompt":"","draft":"x"}'),
    lambda d:d.update(model='unapproved-model'),
])
def test_malformed_output_is_rejected_after_usage_recording(mutation):
    data=reply();mutation(data)
    service,gate,calls=harness(lambda *_:httpx.Response(200,json=data))
    with pytest.raises(Denied,match='output_rejected'):service.compose(TASK)
    assert actions(gate)[-1]=='report'


def test_usage_overrun_is_recorded_even_when_output_is_held():
    data=reply();data['usage'].update(completion_tokens=513,total_tokens=553)
    service,gate,calls=harness(lambda *_:httpx.Response(200,json=data))
    with pytest.raises(Denied,match='usage_bounds_exceeded'):service.compose(TASK)
    assert actions(gate)[-1]=='report'


@pytest.mark.parametrize('deployment',[
    Deployment(True,False,True,'frankfurt'),Deployment(True,True,False,'frankfurt'),
    Deployment(True,True,True,'elsewhere'),
])
def test_region_and_review_flags_are_independent_gates(deployment):
    with pytest.raises(Denied,match='live_ai_disabled'):
        Composer(Gate(),deployment=deployment).compose(TASK)


def test_unavailable_default_safety_blocks_with_other_gates_approved():
    gate=Gate()
    with pytest.raises(Denied,match='safety_unavailable'):
        Composer(gate,deployment=APPROVED).compose(TASK)
    assert not actions(gate)


def test_central_prompt_is_used_in_all_seven_languages():
    from app.ai import LANGUAGES
    for locale in LANGUAGES:
        gate=Gate();gate.context['locale']=locale
        service,gate,calls=harness(gate=gate)
        service.compose(TASK)
        assert json.loads(calls[0].content)['messages'][0]['content']==CORE


def test_accounting_outage_keeps_hold_and_never_returns_draft():
    class BrokenReport(Gate):
        def meter(self,action,**args):
            if action in ('report','unknown'):raise RuntimeError('private database error')
            return super().meter(action,**args)
    service,gate,calls=harness(gate=BrokenReport())
    with pytest.raises(Denied,match='^authorization_unavailable$'):service.compose(TASK)
    assert len(calls)==1 and 'begin' in actions(gate)


def test_credential_error_occurs_before_reservation():
    service,gate,calls=harness()
    def missing():raise Denied('credential_unavailable')
    service.credentials=missing
    with pytest.raises(Denied,match='credential_unavailable'):service.compose(TASK)
    assert not calls and not actions(gate)


def test_compressed_response_is_not_decoded_or_trusted():
    service,gate,calls=harness(lambda *_:httpx.Response(200,content=b'private',headers={'Content-Encoding':'identity-not-supported'}))
    with pytest.raises(Denied,match='provider_unavailable'):service.compose(TASK)
    assert actions(gate)[-1]=='unknown'
