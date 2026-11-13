import { BookOpen, ShieldAlert, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Claim, EvidenceCell, Passage, Publication } from '../../domain/types';
import {
  CONDITION_LABELS,
  DIRECTION_LABELS,
  DURATION_LABELS,
  EVIDENCE_LEVEL_LABELS,
  SECTION_LABELS,
  SYSTEM_LABELS,
  type Locale,
} from '../../i18n/labels';
import { dataAdapter } from '../../services/dataAdapter';
import { SkeletonBlock } from '../common/Skeleton';
import { StatusBadge } from '../common/StatusBadge';

interface EvidenceCellPanelProps {
  cell: EvidenceCell | null;
  locale: Locale;
  onClose: () => void;
  onOpenPublication: (publicationId: string, passageId?: string) => void;
}

export function EvidenceCellPanel({
  cell,
  locale,
  onClose,
  onOpenPublication,
}: EvidenceCellPanelProps) {
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<{
    claims: Claim[];
    passages: Passage[];
    publications: Publication[];
  } | null>(null);

  useEffect(() => {
    if (!cell || cell.status === 'empty') {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    dataAdapter
      .getEvidenceCellDetail(cell.id)
      .then((res) => {
        if (!cancelled) {
          setDetail({
            claims: res.data.claims,
            passages: res.data.passages,
            publications: res.data.publications,
          });
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cell]);

  if (!cell) {
    return (
      <aside className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 flex flex-col justify-center items-start space-y-2">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {locale === 'fr'
            ? 'Inspecteur de cellule de preuve'
            : 'Evidence Cell Inspector'}
        </h3>
        <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
          {locale === 'fr'
            ? 'Cliquez sur une cellule de la matrice pour consulter ses affirmations, ses passages sources, les effectifs (n) et les limites méthodologiques.'
            : 'Select any cell in the matrix to inspect its extracted claims, source passages, sample sizes (n), and methodological limitations.'}
        </p>
      </aside>
    );
  }

  const passageById = new Map(
    (detail?.passages ?? []).map((p) => [p.id, p]),
  );
  const pubById = new Map(
    (detail?.publications ?? []).map((p) => [p.id, p]),
  );

  return (
    <aside
      aria-labelledby="cell-panel-title"
      className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 space-y-4"
    >
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="space-y-1.5">
          <StatusBadge status={cell.status} locale={locale} />
          <h3
            id="cell-panel-title"
            className="text-sm font-semibold text-slate-900 dark:text-slate-100"
          >
            {SYSTEM_LABELS[locale][cell.biologicalSystem]} ·{' '}
            {CONDITION_LABELS[locale][cell.spaceCondition]}
          </h3>
          <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
            {DURATION_LABELS[locale][cell.durationBucket]} · n ={' '}
            {cell.totalSubjects}{' '}
            {locale === 'fr' ? 'sujets' : 'subjects'}, {cell.publicationCount}{' '}
            {locale === 'fr' ? 'publications' : 'publications'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={locale === 'fr' ? 'Fermer inspecteur' : 'Close inspector'}
          className="rounded border border-slate-200 dark:border-slate-700 p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      {cell.status === 'empty' ? (
        <div className="rounded-md border border-dashed border-slate-300 dark:border-slate-700 p-4 text-xs text-slate-600 dark:text-slate-400 space-y-2">
          <p className="font-semibold text-slate-800 dark:text-slate-200">
            {locale === 'fr'
              ? 'Zone de lacune identifiée (0 publication)'
              : 'Identified Research Gap (0 publications)'}
          </p>
          <p>
            {locale === 'fr'
              ? 'Aucune étude de l’index actuel ne documente cette combinaison système × condition × durée.'
              : 'No studies in the current index document this system × condition × duration combination.'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {locale === 'fr' ? 'Ventilation effets' : 'Effect breakdown'}
              </div>
              <div className="mt-1 text-slate-800 dark:text-slate-200">
                ↑{cell.directionBreakdown.increase} · ↓
                {cell.directionBreakdown.decrease} · ={cell.directionBreakdown.no_effect}
              </div>
            </div>
            <div className="rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {locale === 'fr' ? 'Confiance moyenne' : 'Avg confidence'}
              </div>
              <div className="mt-1 text-slate-800 dark:text-slate-200">
                {(cell.avgConfidence * 100).toFixed(0)}%{' '}
                {!cell.hasHumanValidatedClaim &&
                  (locale === 'fr' ? '(non validé)' : '(unvalidated)')}
              </div>
            </div>
          </div>

          {cell.limitationsSummary.length > 0 && (
            <div className="rounded-md border border-amber-300 dark:border-amber-800/70 bg-amber-50/70 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
              <ShieldAlert
                className="h-4 w-4 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div>
                <p className="font-semibold">
                  {locale === 'fr' ? 'Limites signalées :' : 'Reported limitations:'}
                </p>
                <p className="mt-0.5">
                  {cell.limitationsSummary.join(' · ')}
                </p>
              </div>
            </div>
          )}

          {loading ? (
            <div className="space-y-2">
              <SkeletonBlock className="h-20 w-full" />
              <SkeletonBlock className="h-20 w-full" />
            </div>
          ) : (
            <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
              {(detail?.claims ?? []).map((claim) => {
                const passage = passageById.get(claim.passageId);
                const pub = pubById.get(claim.publicationId);
                return (
                  <article
                    key={claim.id}
                    className="rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60 p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      <span>
                        {claim.id} · {DIRECTION_LABELS[locale][claim.effectDirection]}
                      </span>
                      <span>
                        n = {claim.sampleSize ?? '?'} {claim.sampleUnit} ·{' '}
                        {claim.year}
                      </span>
                    </div>

                    <p className="text-xs font-medium text-slate-900 dark:text-slate-100">
                      {locale === 'fr'
                        ? claim.statementFr ?? claim.statement
                        : claim.statement}
                    </p>

                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                      {claim.organism} ·{' '}
                      {EVIDENCE_LEVEL_LABELS[locale][claim.evidenceLevel]} ·{' '}
                      {claim.relationType}
                    </div>

                    {passage && (
                      <div className="border-t border-slate-200 dark:border-slate-800 pt-2 space-y-1">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                          <span>
                            {passage.id} ·{' '}
                            {SECTION_LABELS[locale][passage.section]} ·{' '}
                            {passage.isAuthorInterpretation
                              ? locale === 'fr'
                                ? 'Interprétation'
                                : 'Interpretation'
                              : locale === 'fr'
                                ? 'Mesure'
                                : 'Measured'}
                          </span>
                          {pub && (
                            <button
                              type="button"
                              onClick={() =>
                                onOpenPublication(pub.id, passage.id)
                              }
                              className="inline-flex items-center gap-1 font-sans font-medium text-cyan-700 dark:text-cyan-400 hover:underline shrink-0"
                            >
                              <BookOpen className="h-3 w-3" aria-hidden="true" />
                              <span>{pub.id}</span>
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                          {locale === 'fr'
                            ? passage.textFr ?? passage.text
                            : passage.text}
                        </p>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </aside>
  );
}
