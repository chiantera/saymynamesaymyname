/*
 * AI consent: private future-context opt-in, per-reflection exclusions and
 * per-provider, per-capability approval (cloud only). Changes save immediately and
 * always carry the revision the person was looking at. These preferences never
 * start a network AI call. Styles live in styles/ai-settings.css (prefix ai-).
 */
import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw } from 'lucide-react';
import { cloudRequest } from './cloud';
import type { Entry } from './api';
import { Button, Check, Chip, EmptyState, Notice, Section } from './ui';

type Provider = {
  provider: string;
  capability: string;
  enabled: boolean;
  can_approve: boolean;
  approved: boolean;
  allow_fallback: boolean;
  review_revision: string | null;
  policy_url: string | null;
};

type Consent = {
  revision: number;
  journals: boolean;
  documents: boolean;
  chats: boolean;
  exclusions: string[];
  providers: Provider[];
};

/** What the status line under the heading reports. */
type Activity = 'loading' | 'saving' | 'saved' | 'idle';

const request = (action: string, args: Record<string, unknown> = {}) =>
  cloudRequest('/ai/consent', 'POST', { action, args }) as Promise<Consent>;

const names: Record<string, string> = {
  deepseek: 'DeepSeek',
  anthropic: 'Anthropic',
  mistral: 'Mistral',
  groq: 'Groq',
};

/** One group per provider, in the order the server first lists each provider. */
function groupByProvider(providers: Provider[]) {
  const groups = new Map<string, Provider[]>();
  for (const row of providers) {
    const group = groups.get(row.provider);
    if (group) group.push(row);
    else groups.set(row.provider, [row]);
  }
  return [...groups.entries()];
}

export default function AIConsent({ entries }: { entries: Entry[] }) {
  const { t } = useTranslation();
  const [config, setConfig] = useState<Consent | null>(null);
  const [activity, setActivity] = useState<Activity>('loading');
  const [error, setError] = useState(false);
  const busy = activity === 'loading' || activity === 'saving';
  const baseId = useId();
  const laterId = `${baseId}-later`;

  async function refresh() {
    setActivity('loading');
    setError(false);
    try {
      setConfig(await request('get'));
    } catch {
      setConfig(null);
      setError(true);
    } finally {
      setActivity('idle');
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function change(action: string, args: Record<string, unknown>) {
    if (!config) return;
    setActivity('saving');
    setError(false);
    let next: Activity = 'idle';
    try {
      setConfig(await request(action, { ...args, revision: config.revision }));
      next = 'saved';
    } catch {
      setError(true);
      setConfig(null);
    } finally {
      setActivity(next);
    }
  }

  const statusText =
    activity === 'loading'
      ? t('aiLoading')
      : activity === 'saving'
        ? t('aiSaving')
        : activity === 'saved'
          ? t('saved')
          : '';

  return (
    <Section
      className="ai-panel"
      title={t('aiConsentTitle')}
      ariaLabel={t('aiConsentTitle')}
      description={t('aiConsentNotice')}
      actions={
        <Button size="sm" icon={RefreshCw} disabled={busy} onClick={() => void refresh()}>
          {t('aiRefresh')}
        </Button>
      }
    >
      <p className="ai-status" aria-live="polite" data-activity={activity}>
        {statusText}
      </p>

      {error && (
        <Notice tone="error" role="alert">
          {t('sharingError')}
        </Notice>
      )}

      {config && (
        <div className="ai-body" aria-busy={busy}>
          <fieldset className="ai-block">
            <legend className="ai-legend">{t('aiSavedContext')}</legend>
            <ul className="rows ai-list">
              <li>
                <Check
                  label={t('aiJournals')}
                  checked={config.journals}
                  disabled={busy}
                  onChange={(event) =>
                    void change('context', {
                      journals: event.target.checked,
                      documents: false,
                      chats: false,
                    })
                  }
                />
              </li>
              <li className="ai-source">
                <Check label={t('aiDocuments')} checked={false} disabled aria-describedby={laterId} />
                <Chip>{t('aiUnavailable')}</Chip>
              </li>
              <li className="ai-source">
                <Check label={t('aiChats')} checked={false} disabled aria-describedby={laterId} />
                <Chip>{t('aiUnavailable')}</Chip>
              </li>
            </ul>
            <p className="ai-note" id={laterId}>
              {t('aiSourcesLater')}
            </p>
          </fieldset>

          <div className="ai-block">
            <h3>{t('aiExclusions')}</h3>
            {entries.length === 0 && <EmptyState>{t('emptyEntries')}</EmptyState>}
            {entries.length > 0 && (
              <ul className="rows ai-list ai-exclusions">
                {entries.map((entry) => (
                  <li key={entry.id}>
                    <Check
                      label={
                        <>
                          <span className="ai-exclusions__prefix">{t('aiExcludeItem')}: </span>
                          {entry.text.slice(0, 100)}
                        </>
                      }
                      disabled={busy}
                      checked={config.exclusions.includes(entry.id)}
                      onChange={(event) =>
                        void change('exclusion', {
                          entry_id: entry.id,
                          excluded: event.target.checked,
                        })
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="ai-block">
            <h3>{t('aiProviders')}</h3>
            {groupByProvider(config.providers).map(([providerKey, rows]) => (
              <div className="ai-provider" key={providerKey}>
                <h4 className="ai-provider__name">{names[providerKey] ?? providerKey}</h4>
                <ul className="rows ai-list">
                  {rows.map((provider) => {
                    const capabilityId = `${baseId}-${provider.provider}-${provider.capability}`;
                    const policy = provider.policy_url?.startsWith('https://')
                      ? provider.policy_url
                      : null;
                    return (
                      <li key={provider.provider + provider.capability}>
                        <div
                          className="ai-capability"
                          role="group"
                          aria-labelledby={capabilityId}
                        >
                          <div className="ai-capability__head">
                            <p className="ai-capability__name" id={capabilityId}>
                              {t('aiCapability_' + provider.capability)}
                            </p>
                            {policy && (
                              <a
                                className="ai-capability__policy"
                                href={policy}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {t('aiPolicy')}
                              </a>
                            )}
                          </div>
                          <Check
                            label={t('aiApproveProvider')}
                            hint={!provider.can_approve ? t('aiReviewPending') : undefined}
                            disabled={busy || (!provider.can_approve && !provider.approved)}
                            checked={provider.approved}
                            onChange={(event) =>
                              void change('provider', {
                                provider: provider.provider,
                                capability: provider.capability,
                                review_revision: provider.review_revision,
                                approved: event.target.checked,
                                allow_fallback: false,
                              })
                            }
                          />
                          <Check
                            label={t('aiFallback')}
                            disabled={busy || !provider.approved}
                            checked={provider.allow_fallback}
                            onChange={(event) =>
                              void change('provider', {
                                provider: provider.provider,
                                capability: provider.capability,
                                review_revision: provider.review_revision,
                                approved: true,
                                allow_fallback: event.target.checked,
                              })
                            }
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </Section>
  );
}
