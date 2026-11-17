"""Static response routing, never diagnosis, generation or emergency dispatch.

Generated-output failures are about the content, not the user's mental state.
No private text, country, phone number or exception detail enters a notice.
"""
from .ai import Denied

KINDS = frozenset({'self_harm', 'violence', 'stalking', 'refuse', 'unavailable'})


def support_kind(error):
    if isinstance(error, Denied) and len(error.args) == 1:
        for kind in KINDS:
            if error.args[0] == 'safety_' + kind:
                return kind
    return None


def response_path(kind, *, origin='generated_output'):
    """Allowlisted plan for future request handlers; contains no provider output.

User-disclosure handling stays dormant until reviewed intake/locale evaluation.
The current worker may only create generated-output notices.
"""
    if kind not in KINDS or origin != 'generated_output':
        raise ValueError('unsupported_support_path')
    return dict(kind=kind, origin=origin, withhold=True, notify_others=False,
                infer_user_crisis=False, automatic_crisis_copy=False,
                resources='user_selected_country', persona=False)
