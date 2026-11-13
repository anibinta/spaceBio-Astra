import { Check, Link2, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import {
  BIOLOGICAL_SYSTEMS,
  DURATION_BUCKETS,
  SPACE_CONDITIONS,
} from '../../domain/evidenceEngine';
import type {
  BiologicalSystem,
  DurationBucket,
  EvidenceStatus,
  FilterState,
  PassageSection,
  SpaceCondition,
} from '../../domain/types';
import {
  CONDITION_LABELS,
  DURATION_LABELS,
  SECTION_LABELS,
  STATUS_LABELS,
  SYSTEM_LABELS,
  type Locale,
} from '../../i18n/labels';

interface FilterBarProps {
  filters: FilterState;
  onChange: (next: FilterState) => void;
  onReset: () => void;
  locale: Locale;
}

const SECTIONS: PassageSection[] = [
  'Results',
  'Discussion',
  'Conclusion',
  'Introduction',
];

const STATUSES: EvidenceStatus[] = [
  'consensus',
  'contradiction',
  'single_replication',
  'empty',
];

export function FilterBar({
  filters,
  onChange,
  onReset,
  locale,
}: FilterBarProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyShareUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback if clipboard API is restricted
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const update = (patch: Partial<FilterState>) => {
    onChange({ ...filters, ...patch });
  };

  return (
    <section
      aria-label={
        locale === 'fr' ? 'Filtres combinables' : 'Combinable filters'
      }
      className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
          {locale === 'fr'
            ? 'Filtres combinables (synchronisés avec l’URL)'
            : 'Combinable Filters (URL-synchronized)'}
        </h2>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => void handleCopyShareUrl()}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-cyan-500 transition-colors whitespace-nowrap"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" aria-hidden="true" />
            ) : (
              <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span>
              {copied
                ? locale === 'fr'
                  ? 'Lien copié'
                  : 'Link copied'
                : locale === 'fr'
                  ? 'Partager cette vue'
                  : 'Share view URL'}
            </span>
          </button>

          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{locale === 'fr' ? 'Réinitialiser' : 'Reset'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-2.5">
        <div>
          <label
            htmlFor="filter-q"
            className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1"
          >
            {locale === 'fr' ? 'Mot-clé' : 'Keyword'}
          </label>
          <input
            id="filter-q"
            type="search"
            value={filters.q ?? ''}
            onChange={(e) => update({ q: e.target.value || undefined })}
            placeholder={locale === 'fr' ? 'Ex: ostéocyte, SANS…' : 'e.g. bone, SANS…'}
            className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
          />
        </div>

        <div>
          <label
            htmlFor="filter-system"
            className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1"
          >
            {locale === 'fr' ? 'Système' : 'System'}
          </label>
          <select
            id="filter-system"
            value={filters.system ?? ''}
            onChange={(e) =>
              update({
                system: (e.target.value as BiologicalSystem) || undefined,
              })
            }
            className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
          >
            <option value="">{locale === 'fr' ? 'Tous' : 'All'}</option>
            {BIOLOGICAL_SYSTEMS.map((s) => (
              <option key={s} value={s}>
                {SYSTEM_LABELS[locale][s]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="filter-condition"
            className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1"
          >
            {locale === 'fr' ? 'Condition spatiale' : 'Space condition'}
          </label>
          <select
            id="filter-condition"
            value={filters.condition ?? ''}
            onChange={(e) =>
              update({
                condition: (e.target.value as SpaceCondition) || undefined,
              })
            }
            className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
          >
            <option value="">{locale === 'fr' ? 'Toutes' : 'All'}</option>
            {SPACE_CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {CONDITION_LABELS[locale][c]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="filter-duration"
            className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1"
          >
            {locale === 'fr' ? 'Durée' : 'Duration'}
          </label>
          <select
            id="filter-duration"
            value={filters.duration ?? ''}
            onChange={(e) =>
              update({
                duration: (e.target.value as DurationBucket) || undefined,
              })
            }
            className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
          >
            <option value="">{locale === 'fr' ? 'Toutes' : 'All'}</option>
            {DURATION_BUCKETS.map((d) => (
              <option key={d} value={d}>
                {DURATION_LABELS[locale][d]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="filter-section"
            className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1"
          >
            {locale === 'fr' ? 'Section texte' : 'Text section'}
          </label>
          <select
            id="filter-section"
            value={filters.section ?? ''}
            onChange={(e) =>
              update({
                section: (e.target.value as PassageSection) || undefined,
              })
            }
            className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
          >
            <option value="">{locale === 'fr' ? 'Toutes' : 'All'}</option>
            {SECTIONS.map((sec) => (
              <option key={sec} value={sec}>
                {SECTION_LABELS[locale][sec]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="filter-status"
            className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1"
          >
            {locale === 'fr' ? 'Statut preuve' : 'Evidence status'}
          </label>
          <select
            id="filter-status"
            value={filters.status ?? ''}
            onChange={(e) =>
              update({
                status: (e.target.value as EvidenceStatus) || undefined,
              })
            }
            className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
          >
            <option value="">{locale === 'fr' ? 'Tous' : 'All'}</option>
            {STATUSES.map((st) => (
              <option key={st} value={st}>
                {STATUS_LABELS[locale][st]}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <div>
            <label
              htmlFor="filter-year-from"
              className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1"
            >
              {locale === 'fr' ? 'Année ≥' : 'Year ≥'}
            </label>
            <input
              id="filter-year-from"
              type="number"
              min={1960}
              max={2035}
              value={filters.yearFrom ?? ''}
              onChange={(e) =>
                update({
                  yearFrom: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              placeholder="2016"
              className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1.5 text-xs font-mono text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
            />
          </div>
          <div>
            <label
              htmlFor="filter-year-to"
              className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1"
            >
              {locale === 'fr' ? 'Année ≤' : 'Year ≤'}
            </label>
            <input
              id="filter-year-to"
              type="number"
              min={1960}
              max={2035}
              value={filters.yearTo ?? ''}
              onChange={(e) =>
                update({
                  yearTo: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              placeholder="2025"
              className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1.5 text-xs font-mono text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
