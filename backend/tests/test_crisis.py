import pytest
from app.ai import Denied
from app.crisis import KINDS, response_path, support_kind

@pytest.mark.parametrize('kind', sorted(KINDS))
def test_static_paths_never_diagnose_or_contact_others(kind):
    assert support_kind(Denied('safety_' + kind)) == kind
    path = response_path(kind)
    assert path['withhold'] and not path['persona']
    assert not path['notify_others'] and not path['infer_user_crisis']
    assert not path['automatic_crisis_copy']
    with pytest.raises(ValueError): response_path(kind, origin='user_disclosure')

@pytest.mark.parametrize('error', [Exception('safety_self_harm'), Denied('private text'),
                                 Denied('safety_self_harm', 'extra'), Denied('safety_self_harm\nsecret')])
def test_arbitrary_errors_are_never_saved_or_treated_as_user_risk(error):
    assert support_kind(error) is None
