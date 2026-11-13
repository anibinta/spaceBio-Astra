import { BookOpen, Calendar, Table } from 'lucide-react';
import { useState } from 'react';
import type { TimelinePoint } from '../../domain/types';
import type { Locale } from '../../i18n/labels';
import { CsvExportButton } from '../common/CsvExportButton';

interface TimelineViewProps {
  timeline: TimelinePoint[];
  locale: Locale;
  onOpenPublication: (publicationId: string) => void;
}

export function TimelineView({
  timeline,
  locale,
  onOpenPublication,
}: TimelineViewProps) {
  const [tableView, setTableView] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number | null>(
    timeline[timeline.length - 1]?.year ?? null,
  );

  const activePoint =
    timeline.find((t) => t.year === selectedYear) ??
    timeline[timeline.length - 1] ??
    null;

  const maxClaims = Math.max(1, ...timeline.map((t) => t.claimCount));

  const csvRows = timeline.map((t) => [
    t.year,
    t.publicationCount,
    t.claimCount,
    t.consensusClaims,
    t.contradictionClaims,
    t.singleReplicationClaims,
    t.publicationIds.join('; '),
    t.passageIds.join('; '),
  ]);

  return (
    <section
      aria-labelledby="timeline-heading"
      className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2
            id="timeline-heading"
            className="text-base font-semibold text-slate-900 dark:text-slate-50"
          >
            {locale === 'fr'
              ? 'Chronologie des connaissances par année'
              : 'Knowledge Timeline by Year'}
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {locale === 'fr'
              ? 'Évolution annuelle des publications, affirmations et statuts de preuve. Cliquez sur une année pour inspecter ses études.'
              : 'Annual evolution of publications, claims, and evidence statuses. Click any year to inspect its studies.'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setTableView((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            {tableView ? (
              <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Table className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span>
              {tableView
                ? locale === 'fr'
                  ? 'Vue frise'
                  : 'Timeline view'
                : locale === 'fr'
                  ? 'Vue tableau'
                  : 'Table view'}
            </span>
          </button>

          <CsvExportButton
            filename="spacebio-timeline.csv"
            headers={[
              'Year',
              'Publications',
              'Claims',
              'ConsensusClaims',
              'ContradictionClaims',
              'SingleReplicationClaims',
              'PublicationIDs',
              'PassageIDs',
            ]}
            rows={csvRows}
            locale={locale}
          />
        </div>
      </div>

      {timeline.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-xs text-slate-500 dark:text-slate-400">
          {locale === 'fr'
            ? 'Aucune publication pour cette plage temporelle ou ces filtres.'
            : 'No publications match this year range or filter selection.'}
        </div>
      ) : !tableView ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-9 gap-2 items-end pt-4 pb-2 border-b border-slate-200 dark:border-slate-800">
            {timeline.map((point) => {
              const barHeight = Math.max(
                18,
                Math.round((point.claimCount / maxClaims) * 120),
              );
              const isSelected = activePoint?.year === point.year;

              return (
                <button
                  key={point.year}
                  type="button"
                  onClick={() => setSelectedYear(point.year)}
                  title={`${point.year}: ${point.publicationCount} pubs, ${point.claimCount} claims`}
                  className={`flex flex-col items-center gap-2 rounded-md border p-2 transition-colors focus-visible:outline-2 focus-visible:outline-cyan-500 ${
                    isSelected
                      ? 'border-cyan-500 bg-cyan-50/50 dark:bg-cyan-950/40'
                      : 'border-transparent hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                    {point.claimCount} aff.
                  </span>
                  <div
                    style={{ height: `${barHeight}px` }}
                    className="w-8 flex flex-col justify-end overflow-hidden rounded-t bg-slate-200 dark:bg-slate-800"
                  >
                    {point.consensusClaims > 0 && (
                      <div
                        style={{
                          height: `${(point.consensusClaims / point.claimCount) * 100}%`,
                        }}
                        className="bg-cyan-500 w-full"
                      />
                    )}
                    {point.contradictionClaims > 0 && (
                      <div
                        style={{
                          height: `${(point.contradictionClaims / point.claimCount) * 100}%`,
                        }}
                        className="bg-rose-500 w-full"
                      />
                    )}
                    {point.singleReplicationClaims > 0 && (
                      <div
                        style={{
                          height: `${(point.singleReplicationClaims / point.claimCount) * 100}%`,
                        }}
                        className="bg-amber-500 w-full"
                      />
                    )}
                  </div>
                  <span className="text-xs font-mono font-semibold text-slate-800 dark:text-slate-200">
                    {point.year}
                  </span>
                  <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    {point.publicationCount} pub.
                  </span>
                </button>
              );
            })}
          </div>

          {activePoint && (
            <div className="rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 font-mono">
                  {activePoint.year} · {activePoint.publicationCount}{' '}
                  {locale === 'fr' ? 'publications' : 'publications'} ·{' '}
                  {activePoint.claimCount}{' '}
                  {locale === 'fr' ? 'affirmations' : 'claims'}
                </h3>
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                  {activePoint.passageIds.length}{' '}
                  {locale === 'fr' ? 'passages sources' : 'source passages'}
                </span>
              </div>

              <ul className="space-y-2">
                {activePoint.publicationIds.map((pubId, idx) => (
                  <li
                    key={pubId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
                  >
                    <span className="text-slate-800 dark:text-slate-200">
                      {activePoint.highlights[idx] ?? pubId}
                    </span>
                    <button
                      type="button"
                      onClick={() => onOpenPublication(pubId)}
                      className="inline-flex items-center gap-1 font-mono font-medium text-cyan-700 dark:text-cyan-400 hover:underline shrink-0"
                    >
                      <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{pubId}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <th className="py-2 pr-3 font-mono">Année</th>
                <th className="py-2 pr-3 font-mono">Pubs</th>
                <th className="py-2 pr-3 font-mono">Affirmations</th>
                <th className="py-2 pr-3 font-mono">✓ Cons.</th>
                <th className="py-2 pr-3 font-mono">△ Contrad.</th>
                <th className="py-2 font-mono">Publications IDs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono tabular-nums">
              {timeline.map((t) => (
                <tr key={t.year}>
                  <td className="py-2 pr-3 font-semibold">{t.year}</td>
                  <td className="py-2 pr-3">{t.publicationCount}</td>
                  <td className="py-2 pr-3">{t.claimCount}</td>
                  <td className="py-2 pr-3 text-cyan-700 dark:text-cyan-300">
                    {t.consensusClaims}
                  </td>
                  <td className="py-2 pr-3 text-rose-700 dark:text-rose-300">
                    {t.contradictionClaims}
                  </td>
                  <td className="py-2 text-[11px]">{t.publicationIds.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
