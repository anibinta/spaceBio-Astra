import { Table, Grid3X3 } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  BIOLOGICAL_SYSTEMS,
  DURATION_BUCKETS,
  SPACE_CONDITIONS,
} from '../../domain/evidenceEngine';
import type {
  BiologicalSystem,
  DurationBucket,
  EvidenceCell,
  EvidenceStatus,
  SpaceCondition,
} from '../../domain/types';
import {
  CONDITION_LABELS,
  DURATION_LABELS,
  STATUS_LABELS,
  SYSTEM_LABELS,
  type Locale,
} from '../../i18n/labels';
import { CsvExportButton } from '../common/CsvExportButton';
import { StatusBadge } from '../common/StatusBadge';

interface EvidenceMatrixProps {
  cells: EvidenceCell[];
  selectedCondition: SpaceCondition;
  onSelectCondition: (condition: SpaceCondition) => void;
  selectedCellId: string | null;
  onSelectCell: (cell: EvidenceCell) => void;
  locale: Locale;
}

const CELL_STYLES: Record<EvidenceStatus, string> = {
  consensus:
    'border-cyan-300 dark:border-cyan-800 bg-cyan-50/70 dark:bg-cyan-950/50 hover:border-cyan-500',
  contradiction:
    'border-rose-300 dark:border-rose-800 bg-rose-50/70 dark:bg-rose-950/50 hover:border-rose-500',
  single_replication:
    'border-amber-300 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/40 hover:border-amber-500',
  empty:
    'border-slate-200 dark:border-slate-800 border-dashed bg-slate-50/50 dark:bg-slate-950/40 hover:border-slate-400',
};

export function EvidenceMatrix({
  cells,
  selectedCondition,
  onSelectCondition,
  selectedCellId,
  onSelectCell,
  locale,
}: EvidenceMatrixProps) {
  const [viewMode, setViewMode] = useState<'heatmap' | 'table'>('heatmap');

  const cellMap = useMemo(() => {
    const map = new Map<string, EvidenceCell>();
    for (const c of cells) {
      map.set(`${c.biologicalSystem}__${c.spaceCondition}__${c.durationBucket}`, c);
    }
    return map;
  }, [cells]);

  const conditionCells = useMemo(
    () => cells.filter((c) => c.spaceCondition === selectedCondition),
    [cells, selectedCondition],
  );

  const csvRows = useMemo(
    () =>
      conditionCells.map((c) => [
        SYSTEM_LABELS[locale][c.biologicalSystem],
        CONDITION_LABELS[locale][c.spaceCondition],
        DURATION_LABELS[locale][c.durationBucket],
        STATUS_LABELS[locale][c.status],
        c.claimCount,
        c.publicationCount,
        c.totalSubjects,
        c.avgConfidence,
        c.passageIds.join('; '),
      ]),
    [conditionCells, locale],
  );

  const getCell = (sys: BiologicalSystem, dur: DurationBucket) =>
    cellMap.get(`${sys}__${selectedCondition}__${dur}`);

  return (
    <section
      aria-labelledby="matrix-heading"
      className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 space-y-4"
    >
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h2
            id="matrix-heading"
            className="text-base font-semibold text-slate-900 dark:text-slate-50"
          >
            {locale === 'fr'
              ? 'Matrice interactive des preuves (Système × Durée)'
              : 'Interactive Evidence Matrix (System × Duration)'}
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {locale === 'fr'
              ? 'Sélectionnez une condition spatiale et cliquez sur une cellule pour tracer les affirmations jusqu’aux passages.'
              : 'Select a space condition and click any cell to inspect claims down to their source passages.'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="inline-flex rounded-md border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('heatmap')}
              aria-pressed={viewMode === 'heatmap'}
              className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                viewMode === 'heatmap'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Grid3X3 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{locale === 'fr' ? 'Matrice' : 'Heatmap'}</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              aria-pressed={viewMode === 'table'}
              className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Table className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{locale === 'fr' ? 'Tableau' : 'Table'}</span>
            </button>
          </div>

          <CsvExportButton
            filename={`spacebio-matrix-${selectedCondition}.csv`}
            headers={[
              'System',
              'Condition',
              'Duration',
              'Status',
              'Claims',
              'Publications',
              'Subjects_n',
              'AvgConfidence',
              'PassageIDs',
            ]}
            rows={csvRows}
            locale={locale}
          />
        </div>
      </div>

      {/* Space condition selector */}
      <div
        role="tablist"
        aria-label={
          locale === 'fr' ? 'Conditions spatiales' : 'Space conditions'
        }
        className="flex flex-wrap gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-3"
      >
        {SPACE_CONDITIONS.map((cond) => {
          const active = cond === selectedCondition;
          const nonEmptyCount = cells.filter(
            (c) => c.spaceCondition === cond && c.status !== 'empty',
          ).length;
          return (
            <button
              key={cond}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSelectCondition(cond)}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                active
                  ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-200'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 hover:border-slate-400'
              }`}
            >
              <span>{CONDITION_LABELS[locale][cond]}</span>
              <span className="font-mono text-[11px] opacity-75">
                ({nonEmptyCount})
              </span>
            </button>
          );
        })}
      </div>

      {viewMode === 'heatmap' ? (
        <div className="overflow-x-auto">
          <div className="min-w-[720px]">
            <div className="grid grid-cols-[165px_repeat(4,minmax(135px,1fr))] gap-2 pb-2 text-xs font-semibold text-slate-600 dark:text-slate-400">
              <div className="px-2 py-1">
                {locale === 'fr' ? 'Système biologique' : 'Biological System'}
              </div>
              {DURATION_BUCKETS.map((dur) => (
                <div key={dur} className="px-2 py-1 text-center font-mono">
                  {DURATION_LABELS[locale][dur]}
                </div>
              ))}
            </div>

            <div className="space-y-2">
              {BIOLOGICAL_SYSTEMS.map((sys) => (
                <div
                  key={sys}
                  className="grid grid-cols-[165px_repeat(4,minmax(135px,1fr))] gap-2 items-stretch"
                >
                  <div className="flex items-center px-2 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {SYSTEM_LABELS[locale][sys]}
                  </div>

                  {DURATION_BUCKETS.map((dur) => {
                    const cell = getCell(sys, dur);
                    if (!cell) return <div key={dur} />;
                    const isSelected = selectedCellId === cell.id;

                    return (
                      <button
                        key={cell.id}
                        type="button"
                        onClick={() => onSelectCell(cell)}
                        title={`${SYSTEM_LABELS[locale][sys]} · ${DURATION_LABELS[locale][dur]} : ${STATUS_LABELS[locale][cell.status]} (n = ${cell.totalSubjects}, ${cell.publicationCount} pubs)`}
                        className={`min-w-0 flex flex-col items-start justify-between rounded-md border p-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 ${CELL_STYLES[cell.status]} ${
                          isSelected ? 'ring-2 ring-cyan-500' : ''
                        }`}
                      >
                        <StatusBadge status={cell.status} locale={locale} inline />
                        <div className="mt-2 w-full flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-600 dark:text-slate-300">
                          <span>
                            {cell.status === 'empty'
                              ? 'n = 0'
                              : `n = ${cell.totalSubjects}`}
                          </span>
                          <span>
                            {cell.publicationCount}{' '}
                            {locale === 'fr' ? 'pub.' : 'pubs'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <th className="py-2 pr-3 font-semibold">
                  {locale === 'fr' ? 'Système' : 'System'}
                </th>
                <th className="py-2 pr-3 font-semibold">
                  {locale === 'fr' ? 'Durée' : 'Duration'}
                </th>
                <th className="py-2 pr-3 font-semibold">
                  {locale === 'fr' ? 'Statut' : 'Status'}
                </th>
                <th className="py-2 pr-3 font-semibold font-mono">n</th>
                <th className="py-2 pr-3 font-semibold font-mono">
                  {locale === 'fr' ? 'Pubs' : 'Pubs'}
                </th>
                <th className="py-2 font-semibold">
                  {locale === 'fr' ? 'Action' : 'Action'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {conditionCells.map((cell) => (
                <tr key={cell.id}>
                  <td className="py-2 pr-3 font-medium text-slate-800 dark:text-slate-200">
                    {SYSTEM_LABELS[locale][cell.biologicalSystem]}
                  </td>
                  <td className="py-2 pr-3 font-mono text-slate-600 dark:text-slate-300">
                    {DURATION_LABELS[locale][cell.durationBucket]}
                  </td>
                  <td className="py-2 pr-3">
                    <StatusBadge status={cell.status} locale={locale} />
                  </td>
                  <td className="py-2 pr-3 font-mono tabular-nums">
                    {cell.totalSubjects}
                  </td>
                  <td className="py-2 pr-3 font-mono tabular-nums">
                    {cell.publicationCount}
                  </td>
                  <td className="py-2">
                    <button
                      type="button"
                      onClick={() => onSelectCell(cell)}
                      className="text-cyan-700 dark:text-cyan-400 font-medium hover:underline"
                    >
                      {locale === 'fr' ? 'Inspecter' : 'Inspect'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
