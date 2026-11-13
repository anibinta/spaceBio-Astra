import { ExternalLink, ShieldAlert, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Claim, Passage, Publication } from '../../domain/types';
import {
  DIRECTION_LABELS,
  EVIDENCE_LEVEL_LABELS,
  SECTION_LABELS,
  SYSTEM_LABELS,
  type Locale,
} from '../../i18n/labels';
import { dataAdapter } from '../../services/dataAdapter';
import { SkeletonBlock } from './Skeleton';

interface PublicationDetailDrawerProps {
  publicationId: string | null;
  highlightPassageId?: string | null;
  locale: Locale;
  onClose: () => void;
}

export function PublicationDetailDrawer({
  publicationId,
  highlightPassageId,
  locale,
  onClose,
}: PublicationDetailDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<{
    publication: Publication;
    passages: Passage[];
    claims: Claim[];
  } | null>(null);

  useEffect(() => {
    if (!publicationId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    dataAdapter
      .getPublicationDetail(publicationId)
      .then((res) => {
        if (!cancelled) {
          setDetail(res.data);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erreur de chargement');
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [publicationId]);

  useEffect(() => {
    if (!publicationId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [publicationId, onClose]);

  if (!publicationId) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/60"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pub-drawer-title"
    >
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <aside className="relative z-10 flex h-full w-full max-w-2xl flex-col border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 px-6 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono">
              <span>{publicationId}</span>
              <span aria-hidden="true">·</span>
              <span>
                {locale === 'fr' ? 'DONNÉES DE DÉMONSTRATION' : 'DEMO DATA'}
              </span>
            </div>
            <h2
              id="pub-drawer-title"
              className="mt-1 text-lg font-semibold leading-snug text-slate-900 dark:text-slate-50"
            >
              {detail
                ? locale === 'fr'
                  ? detail.publication.titleFr ?? detail.publication.title
                  : detail.publication.title
                : locale === 'fr'
                  ? 'Chargement de la publication…'
                  : 'Loading publication…'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={locale === 'fr' ? 'Fermer le panneau' : 'Close panel'}
            className="rounded-md border border-slate-200 dark:border-slate-700 p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-2 focus-visible:outline-cyan-500"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {loading && (
            <div className="space-y-3">
              <SkeletonBlock className="h-6 w-3/4" />
              <SkeletonBlock className="h-24 w-full" />
              <SkeletonBlock className="h-24 w-full" />
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="rounded-md border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 p-4 text-sm text-rose-800 dark:text-rose-200"
            >
              {error}
            </div>
          )}

          {detail && !loading && (
            <>
              <div className="rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-4 text-sm space-y-2">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
                  <span>{detail.publication.authors.join(', ')}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">{detail.publication.year}</span>
                  <span aria-hidden="true">·</span>
                  <span>{detail.publication.journal}</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono text-slate-500 dark:text-slate-400">
                  <span>DOI: {detail.publication.doi ?? 'N/A'}</span>
                  <span aria-hidden="true">·</span>
                  <span>PMID: {detail.publication.pmid ?? 'N/A'}</span>
                  <span aria-hidden="true">·</span>
                  <span>{detail.publication.fullTextStatus}</span>
                </div>
                <div className="pt-1 flex flex-wrap items-center gap-3">
                  {detail.publication.externalLinks.map((link) => (
                    <a
                      key={link.url}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-cyan-700 dark:text-cyan-400 hover:underline"
                    >
                      <span>{link.label}</span>
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </a>
                  ))}
                </div>
              </div>

              <section aria-labelledby="passages-heading" className="space-y-3">
                <h3
                  id="passages-heading"
                  className="text-sm font-semibold text-slate-900 dark:text-slate-100"
                >
                  {locale === 'fr'
                    ? `Passages sources traçables (${detail.passages.length})`
                    : `Traceable Source Passages (${detail.passages.length})`}
                </h3>

                {detail.passages.map((passage) => {
                  const isHighlighted = highlightPassageId === passage.id;
                  const passageClaims = detail.claims.filter(
                    (c) => c.passageId === passage.id,
                  );
                  return (
                    <article
                      key={passage.id}
                      className={`rounded-md border p-4 space-y-3 ${
                        isHighlighted
                          ? 'border-cyan-500 bg-cyan-50/40 dark:bg-cyan-950/30'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <div className="flex items-center gap-2 font-mono">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {passage.id}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{SECTION_LABELS[locale][passage.section]}</span>
                          <span aria-hidden="true">·</span>
                          <span>
                            {passage.position.pageLabel ?? `§${passage.position.paragraphIndex + 1}`}
                          </span>
                        </div>
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                          {passage.isAuthorInterpretation
                            ? locale === 'fr'
                              ? 'Interprétation des auteurs'
                              : 'Author interpretation'
                            : locale === 'fr'
                              ? 'Résultat mesuré'
                              : 'Measured result'}
                        </span>
                      </div>

                      <p className="text-sm leading-relaxed text-slate-800 dark:text-slate-200">
                        {locale === 'fr'
                          ? passage.textFr ?? passage.text
                          : passage.text}
                      </p>

                      {locale === 'fr' && passage.autoTranslated && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {locale === 'fr'
                            ? 'Contenu traduit automatiquement depuis la source anglaise.'
                            : 'Machine-translated content.'}
                        </p>
                      )}

                      {passageClaims.length > 0 && (
                        <div className="border-t border-slate-200 dark:border-slate-800 pt-3 space-y-2">
                          {passageClaims.map((claim) => (
                            <div
                              key={claim.id}
                              className="text-xs space-y-1 text-slate-700 dark:text-slate-300"
                            >
                              <p className="font-medium text-slate-900 dark:text-slate-100">
                                {locale === 'fr'
                                  ? claim.statementFr ?? claim.statement
                                  : claim.statement}
                              </p>
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                                <span>{SYSTEM_LABELS[locale][claim.biologicalSystem]}</span>
                                <span aria-hidden="true">·</span>
                                <span>{DIRECTION_LABELS[locale][claim.effectDirection]}</span>
                                <span aria-hidden="true">·</span>
                                <span>
                                  n = {claim.sampleSize ?? '?'} {claim.sampleUnit}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span>{claim.organism}</span>
                                <span aria-hidden="true">·</span>
                                <span>{EVIDENCE_LEVEL_LABELS[locale][claim.evidenceLevel]}</span>
                                <span aria-hidden="true">·</span>
                                <span>
                                  {locale === 'fr' ? 'Confiance' : 'Confidence'}:{' '}
                                  {(claim.confidenceScore * 100).toFixed(0)}%
                                </span>
                              </div>
                              {(!claim.humanValidated || claim.limitations.length > 0) && (
                                <div className="flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-300">
                                  <ShieldAlert
                                    className="h-3.5 w-3.5 mt-0.5 shrink-0"
                                    aria-hidden="true"
                                  />
                                  <span>
                                    {!claim.humanValidated
                                      ? locale === 'fr'
                                        ? 'Non validé par un humain · '
                                        : 'Not human-validated · '
                                      : ''}
                                    {claim.limitations.join(' · ')}
                                  </span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </article>
                  );
                })}
              </section>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
