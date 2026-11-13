import { BarChart3, Table } from 'lucide-react';
import { useState } from 'react';
import type { SystemEvidenceSummary } from '../../domain/types';
import { SYSTEM_LABELS, type Locale } from '../../i18n/labels';
import { CsvExportButton } from '../common/CsvExportButton';

interface SystemStackedBarsProps {
  summary: SystemEvidenceSummary[];
  locale: Locale;
}

export function SystemStackedBars({ summary, locale }: SystemStackedBarsProps) {
  const [tableView, setTableView] = useState(false);

  const csvRows = summary.map((s) => [
    SYSTEM_LABELS[locale][s.biologicalSystem],
    s.consensus,
    s.contradiction,
    s.single_replication,
    s.empty,
    s.totalClaims,
    s.totalSubjects,
    s.publicationCount,
  ]);

  return (
    <section
      aria-labelledby="stacked-bars-heading"
      className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2
            id="stacked-bars-heading"
            className="text-base font-semibold text-slate-900 dark:text-slate-50"
          >
            {locale === 'fr'
              ? 'Répartition des cellules par système physiologique'
              : 'Evidence Cell Breakdown by Biological System'}
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {locale === 'fr'
              ? 'Comparaison des consensus, contradictions, réplications uniques et lacunes (28 cellules par système).'
              : 'Comparison of consensus, contradictions, single replications, and gaps (28 cells per system).'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTableView((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            {tableView ? (
              <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Table className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span>
              {tableView
                ? locale === 'fr'
                  ? 'Vue graphique'
                  : 'Chart view'
                : locale === 'fr'
                  ? 'Vue tableau'
                  : 'Table view'}
            </span>
          </button>

          <CsvExportButton
            filename="spacebio-system-breakdown.csv"
            headers={[
              'System',
              'Consensus',
              'Contradiction',
              'SingleReplication',
              'Empty',
              'TotalClaims',
              'TotalSubjects',
              'Publications',
            ]}
            rows={csvRows}
            locale={locale}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-xs bg-cyan-500" aria-hidden="true" />
          <span>{locale === 'fr' ? '✓ Consensus' : '✓ Consensus'}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-xs bg-rose-500" aria-hidden="true" />
          <span>{locale === 'fr' ? '△ Contradiction' : '△ Contradiction'}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-xs bg-amber-500" aria-hidden="true" />
          <span>
            {locale === 'fr' ? '○ Réplication unique' : '○ Single replication'}
          </span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-xs bg-slate-300 dark:bg-slate-700" aria-hidden="true" />
          <span>{locale === 'fr' ? '— Lacune' : '— Gap'}</span>
        </span>
      </div>

      {!tableView ? (
        <div
          className="space-y-3"
          role="img"
          aria-label={
            locale === 'fr'
              ? 'Graphique en barres empilées des statuts de preuve par système biologique'
              : 'Stacked bar chart of evidence status by biological system'
          }
        >
          {summary.map((row) => {
            const totalCells =
              row.consensus +
              row.contradiction +
              row.single_replication +
              row.empty || 1;
            const pCons = (row.consensus / totalCells) * 100;
            const pCont = (row.contradiction / totalCells) * 100;
            const pSingle = (row.single_replication / totalCells) * 100;
            const pEmpty = (row.empty / totalCells) * 100;

            return (
              <div key={row.biologicalSystem} className="space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {SYSTEM_LABELS[locale][row.biologicalSystem]}
                  </span>
                  <span className="font-mono tabular-nums text-[11px] text-slate-500 dark:text-slate-400">
                    ✓{row.consensus} · △{row.contradiction} · ○
                    {row.single_replication} · —{row.empty} | n ={' '}
                    {row.totalSubjects}, {row.publicationCount}{' '}
                    {locale === 'fr' ? 'pubs' : 'pubs'}
                  </span>
                </div>
                <div className="flex h-3 w-full overflow-hidden rounded-sm bg-slate-200 dark:bg-slate-800">
                  {row.consensus > 0 && (
                    <div
                      style={{ width: `${pCons}%` }}
                      title={`Consensus: ${row.consensus}`}
                      className="bg-cyan-500"
                    />
                  )}
                  {row.contradiction > 0 && (
                    <div
                      style={{ width: `${pCont}%` }}
                      title={`Contradiction: ${row.contradiction}`}
                      className="bg-rose-500"
                    />
                  )}
                  {row.single_replication > 0 && (
                    <div
                      style={{ width: `${pSingle}%` }}
                      title={`Single replication: ${row.single_replication}`}
                      className="bg-amber-500"
                    />
                  )}
                  {row.empty > 0 && (
                    <div
                      style={{ width: `${pEmpty}%` }}
                      title={`Empty: ${row.empty}`}
                      className="bg-slate-300 dark:bg-slate-700"
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <th className="py-2 pr-3 font-semibold">
                  {locale === 'fr' ? 'Système' : 'System'}
                </th>
                <th className="py-2 pr-3 font-mono">✓</th>
                <th className="py-2 pr-3 font-mono">△</th>
                <th className="py-2 pr-3 font-mono">○</th>
                <th className="py-2 pr-3 font-mono">—</th>
                <th className="py-2 pr-3 font-mono">n</th>
                <th className="py-2 font-mono">Pubs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono tabular-nums">
              {summary.map((row) => (
                <tr key={row.biologicalSystem}>
                  <td className="py-2 pr-3 font-sans font-medium text-slate-800 dark:text-slate-200">
                    {SYSTEM_LABELS[locale][row.biologicalSystem]}
                  </td>
                  <td className="py-2 pr-3 text-cyan-700 dark:text-cyan-300">
                    {row.consensus}
                  </td>
                  <td className="py-2 pr-3 text-rose-700 dark:text-rose-300">
                    {row.contradiction}
                  </td>
                  <td className="py-2 pr-3 text-amber-700 dark:text-amber-300">
                    {row.single_replication}
                  </td>
                  <td className="py-2 pr-3 text-slate-500">{row.empty}</td>
                  <td className="py-2 pr-3">{row.totalSubjects}</td>
                  <td className="py-2">{row.publicationCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
