"""Bounded solo-task policy. Rule hits deny; absence of hits never proves safety.

Arbitrary output also needs a reviewed local assessor's bound, fresh assessment.
No network processor or resource number is invented by this module.
"""
from dataclasses import dataclass
import hashlib
import json
import re
import time
import unicodedata

from .ai import CORE, LANGUAGES, MAX_OUTPUT, MODELS

POLICY = 'solo-safety-v1'

# Conservative indicators, not clinical detection. Covers the seven launch locales;
# negated/quoted mentions can also be held. Semantic assessment remains mandatory.
PATTERNS = {
    'self_harm': r'kill myself|end my life|suicid|self[ -]?harm|uccidermi|farmi del male|togliermi la vita|matarme|hacerme daño|selbstmord|mich töten|자살|자해|自杀|自殺|自残|自殘|尋死',
    'violence': r'kill (?:you|them|him|her)|hurt (?:you|them|him|her)|attack|stab|ucciderti|aggredir|accoltell|matarte|atacar|apuñal|töte|erstech|gewalt|죽이|살해|폭력|杀人|殺人|殺死|伤害|傷害|暴力',
    'stalking': r'stalk|spy on|track (?:their|his|her|your)|without (?:their|his|her) (?:consent|knowing)|pedinar|spiar|senza (?:il suo consenso|che lo sappia)|rastrear|espiar|sin su consentimiento|verfolgen|ausspion|heimlich|스토킹|몰래|위치 추적|跟踪|跟蹤|偷偷|定位.*(?:他|她|佢)|监视|監視',
    'refuse': r'ignore.{0,30}(?:instructions|rules)|system prompt|bypass.{0,30}(?:consent|block)|ignora.{0,30}istruzioni|ignora.{0,30}instrucciones|ignorier.{0,30}anweisung|지시.*무시|忽略.*指[令示]|無視.*指[令示]|your (?:wife|husband|girlfriend|boyfriend)|as your (?:therapist|psychologist)|i (?:have sent|sent|shared)|diagnos|diagnosi|diagnóstico|diagnose|진단|诊断|診斷|你(?:的|嘅)(?:丈夫|妻子|男朋友|女朋友)',
}
RULES = {kind: re.compile(pattern, re.IGNORECASE) for kind, pattern in PATTERNS.items()}


def fingerprint(text):
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


def normalized(text):
    # Zero-width/control insertion must not hide obvious indicators.
    text = unicodedata.normalize('NFKC', text).casefold()
    text = ''.join(c for c in text if unicodedata.category(c) != 'Cf')
    return re.sub(r'\s+', ' ', text)


@dataclass(frozen=True)
class Assessment:
    verdict: str
    digest: str
    locale: str
    phase: str
    policy: str
    expires_at: float


class PolicySafety:
    """assessor is a trusted, reviewed LOCAL component, never an unmetered API.

    Deployment ships with no assessor and no approved locale manifest. Rules can
    reject output immediately; only fresh, text/locale/policy-bound evidence can
    allow it. Test assessors are fictional and are not production safety reviews.
    """
    revision = POLICY

    def __init__(self, assessor=None, *, reviewed_locales=(), clock=time.time):
        self.assessor = assessor
        self.reviewed_locales = frozenset(reviewed_locales)
        self.clock = clock

    def check(self, text, *, phase, locale):
        if locale not in LANGUAGES or not isinstance(text, str) or len(text) > 24000:
            return 'unavailable'
        try:
            data = json.loads(text)
            if phase == 'input':
                # Validate policy text structurally; scanning the trusted core as
                # user text would misclassify its explicit risk prohibitions.
                expected = dict(model=data.get('model'), messages=[
                    dict(role='system', content=CORE),
                    dict(role='user', content='Write the JSON in ' + LANGUAGES[locale] + '.')],
                    max_tokens=MAX_OUTPUT, stream=False, thinking={'type':'disabled'},
                    tool_choice='none', response_format={'type':'json_object'})
                if (json.dumps(data,sort_keys=True) != json.dumps(expected,sort_keys=True)
                        or data['model'] not in MODELS):
                    return 'refuse'
                if not callable(self.assessor) or locale not in self.reviewed_locales:
                    return 'unavailable'
                return 'allow'
            if phase != 'output' or not isinstance(data, dict) or set(data) != {'prompt','draft'}:
                return 'refuse'
            if not all(isinstance(v,str) and v.strip() and len(v)<=5000 for v in data.values()):
                return 'refuse'
            for value in data.values():
                value.encode('utf-8')  # reject malformed Unicode, never pass it on
                clean = normalized(value)
                for verdict, rule in RULES.items():
                    if rule.search(clean):
                        return verdict
            if locale not in self.reviewed_locales or not callable(self.assessor):
                return 'unavailable'
            result = self.assessor(text, phase=phase, locale=locale, policy=self.revision)
            now = self.clock()
            if (not isinstance(result, Assessment) or result.digest != fingerprint(text)
                    or result.phase != phase or result.locale != locale
                    or result.policy != self.revision or type(result.expires_at) not in (int,float)
                    or not now < result.expires_at <= now+60):
                return 'unavailable'
            return result.verdict if result.verdict in {'allow','refuse','self_harm','violence','stalking'} else 'unavailable'
        except Exception:
            return 'unavailable'
