import { ArrowRight, Compass, Database, Layers } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { EvidenceCell, SystemEvidenceSummary } from '../domain/types';
import type { Locale } from '../i18n/labels';
import type { HealthResponse } from '../services/apiClient';
import { dataAdapter } from '../services/dataAdapter';
import { SkeletonBlock } from '../components/common/Skeleton';
import { NaturalLanguageSearch } from '../components/search/NaturalLanguageSearch';

export type AppRoute = 'home' | 'atlas' | 'mission-twin' | 'offline' | 'diagnostics';

interface HomePageProps {
  locale: Locale;
  onNavigate: (route: AppRoute) => void;
  onOpenPublication: (publicationId: string, passageId?: string) => void;
}

export function HomePage({
  locale,
  onNavigate,
  onOpenPublication,
}: HomePageProps) {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [cells, setCells] = useState<EvidenceCell[]>([]);
  const [summary, setSummary] = useState<SystemEvidenceSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([dataAdapter.getHealth(), dataAdapter.getEvidenceCells()])
      .then(([hRes, cRes]) => {
        if (!cancelled) {
          setHealth(hRes);
          setCells(cRes.data.cells);
          setSummary(cRes.data.systemSummary);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const statusTotals = cells.reduce(
    (acc, c) => {
      acc[c.status]++;
      return acc;
    },
    { consensus: 0, contradiction: 0, single_replication: 0, empty: 0 },
  );

  return (
    <div className="space-y-8">
      <div className="space-y-3 max-w-3xl">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-50 [text-wrap:balance]">
          {locale === 'fr'
            ? 'Cartographiez les consensus, contradictions et lacunes de la biologie spatiale'
            : 'Map Consensus, Contradictions, and Gaps in Space Biology'}
        </h1>
        <p className="text-base leading-relaxed text-slate-600 dark:text-slate-300">
          {locale === 'fr'
            ? 'Plateforme traçable reliant chaque affirmation scientifique jusqu’au passage source pour les chercheurs, gestionnaires et architectes de missions Lune et Mars.'
            : 'Traceable evidence platform linking every scientific claim to its source passage for researchers, program managers, and Moon/Mars mission architects.'}
        </p>
      </div>

      <NaturalLanguageSearch
        locale={locale}
        onOpenPublication={onOpenPublication}
      />

      {/* Key Indicators Strip */}
      <section aria-label={locale === 'fr' ? 'Indicateurs clés' : 'Key metrics'}>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4 space-y-1">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {locale === 'fr'
                  ? 'Publications indexées'
                  : 'Indexed Publications'}
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-50">
                {health?.counts.corpusTargetCount ?? 608}
                <span className="ml-2 text-xs font-normal text-amber-700 dark:text-amber-300">
                  ({health?.counts.publications ?? 24}{' '}
                  {locale === 'fr' ? 'démo' : 'demo'})
                </span>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                {health?.counts.passages ?? 0}{' '}
                {locale === 'fr' ? 'passages' : 'passages'} ·{' '}
                {health?.counts.claims ?? 0}{' '}
                {locale === 'fr' ? 'affirmations' : 'claims'}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4 space-y-1">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {locale === 'fr' ? 'Systèmes couverts' : 'Systems Covered'}
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-50">
                {summary.length || 7}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {locale === 'fr'
                  ? 'Os, muscle, immunité, vision, cognition, microbiome, cardio'
                  : 'Bone, muscle, immune, vision, cognition, microbiome, cardio'}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4 space-y-1">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {locale === 'fr'
                  ? 'Cellules de preuve par statut'
                  : 'Evidence Cells by Status'}
              </div>
              <div className="text-sm font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-50 pt-1">
                <span className="text-cyan-700 dark:text-cyan-300">
                  ✓ {statusTotals.consensus}
                </span>
                {' · '}
                <span className="text-rose-700 dark:text-rose-300">
                  △ {statusTotals.contradiction}
                </span>
                {' · '}
                <span className="text-amber-700 dark:text-amber-300">
                  ○ {statusTotals.single_replication}
                </span>
              </div>
              <div className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                — {statusTotals.empty}{' '}
                {locale === 'fr' ? 'lacunes identifiées' : 'identified gaps'}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4 space-y-1">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {locale === 'fr' ? 'Langues & Hors ligne' : 'Languages & Offline'}
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-50">
                FR / EN
              </div>
              <div className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                {health
                  ? `${Math.round(health.offlineIndex.gzipBytes / 1024)} Ko gzip`
                  : '—'}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 3 Quick-Access Modules */}
      <section aria-labelledby="quick-access-heading" className="space-y-3">
        <h2
          id="quick-access-heading"
          className="text-sm font-semibold text-slate-700 dark:text-slate-300"
        >
          {locale === 'fr' ? 'Accès rapides' : 'Quick Access'}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            type="button"
            onClick={() => onNavigate('atlas')}
            className="group rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 text-left hover:border-cyan-500 transition-colors focus-visible:outline-2 focus-visible:outline-cyan-500 flex flex-col justify-between gap-4"
          >
            <div className="space-y-2">
              <Layers
                className="h-5 w-5 text-cyan-600 dark:text-cyan-400"
                aria-hidden="true"
              />
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {locale === 'fr' ? 'Atlas des preuves' : 'Evidence Atlas'}
              </h3>
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                {locale === 'fr'
                  ? 'Matrice interactive Systèmes × Durées, inspection jusqu’aux passages sources et export CSV.'
                  : 'Interactive Systems × Durations matrix, passage-level inspection, and CSV export.'}
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-700 dark:text-cyan-400">
              <span>{locale === 'fr' ? 'Ouvrir l’Atlas' : 'Open Atlas'}</span>
              <ArrowRight
                className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('mission-twin')}
            className="group rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 text-left hover:border-cyan-500 transition-colors focus-visible:outline-2 focus-visible:outline-cyan-500 flex flex-col justify-between gap-4"
          >
            <div className="space-y-2">
              <Compass
                className="h-5 w-5 text-amber-600 dark:text-amber-400"
                aria-hidden="true"
              />
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {locale === 'fr' ? 'Jumeau Mission' : 'Mission Twin'}
              </h3>
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                {locale === 'fr'
                  ? 'Registre de risques Lune et Mars par phase de vol (transit, surface, séjour, retour).'
                  : 'Moon and Mars risk registry by flight phase (transit, surface, stay, return).'}
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-700 dark:text-cyan-400">
              <span>
                {locale === 'fr'
                  ? 'Consulter le Jumeau'
                  : 'Explore Mission Twin'}
              </span>
              <ArrowRight
                className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('offline')}
            className="group rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 text-left hover:border-cyan-500 transition-colors focus-visible:outline-2 focus-visible:outline-cyan-500 flex flex-col justify-between gap-4"
          >
            <div className="space-y-2">
              <Database
                className="h-5 w-5 text-slate-600 dark:text-slate-300"
                aria-hidden="true"
              />
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {locale === 'fr' ? 'Savoir hors ligne' : 'Offline Knowledge'}
              </h3>
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                {locale === 'fr'
                  ? 'Index compressé local, synchronisation PWA et exploration des publications sans connexion.'
                  : 'Compressed local index, PWA synchronization, and offline publication browsing.'}
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-700 dark:text-cyan-400">
              <span>
                {locale === 'fr' ? 'Gérer l’index local' : 'Manage Local Index'}
              </span>
              <ArrowRight
                className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </span>
          </button>
        </div>
      </section>
    </div>
  );
}
