import { Calendar, Grid3X3, Network } from 'lucide-react';
import { useEffect, useState } from 'react';
import type {
  EvidenceCell,
  FilterState,
  GraphData,
  SpaceCondition,
  SystemEvidenceSummary,
  TimelinePoint,
} from '../domain/types';
import type { Locale } from '../i18n/labels';
import { dataAdapter } from '../services/dataAdapter';
import { MatrixSkeleton, SkeletonBlock } from '../components/common/Skeleton';
import { EvidenceCellPanel } from '../components/evidence/EvidenceCellPanel';
import { EvidenceMatrix } from '../components/evidence/EvidenceMatrix';
import { FilterBar } from '../components/evidence/FilterBar';
import { KnowledgeGraphView } from '../components/evidence/KnowledgeGraphView';
import { SystemStackedBars } from '../components/evidence/SystemStackedBars';
import { TimelineView } from '../components/evidence/TimelineView';

export type AtlasTab = 'matrix' | 'graph' | 'timeline';

interface EvidenceAtlasPageProps {
  locale: Locale;
  filters: FilterState;
  activeTab: AtlasTab;
  onChangeTab: (tab: AtlasTab) => void;
  onChangeFilters: (next: FilterState) => void;
  onResetFilters: () => void;
  onOpenPublication: (publicationId: string, passageId?: string) => void;
}

export function EvidenceAtlasPage({
  locale,
  filters,
  activeTab,
  onChangeTab,
  onChangeFilters,
  onResetFilters,
  onOpenPublication,
}: EvidenceAtlasPageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cells, setCells] = useState<EvidenceCell[]>([]);
  const [summary, setSummary] = useState<SystemEvidenceSummary[]>([]);
  const [graph, setGraph] = useState<GraphData>({
    nodes: [],
    edges: [],
    passageIds: [],
  });
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const [selectedCondition, setSelectedCondition] = useState<SpaceCondition>(
    filters.condition || 'microgravity',
  );
  const [selectedCell, setSelectedCell] = useState<EvidenceCell | null>(null);

  useEffect(() => {
    if (filters.condition) {
      setSelectedCondition(filters.condition);
    }
  }, [filters.condition]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    // For matrix we load cells matching q/section/year/system/duration/status while keeping condition tabs browseable unless condition filter is explicitly locked
    const cellFilters: FilterState = { ...filters };
    Promise.all([
      dataAdapter.getEvidenceCells(cellFilters),
      dataAdapter.getGraph(filters),
      dataAdapter.getTimeline(filters),
    ])
      .then(([cellRes, graphRes, timeRes]) => {
        if (!cancelled) {
          setCells(cellRes.data.cells);
          setSummary(cellRes.data.systemSummary);
          setGraph(graphRes.data);
          setTimeline(timeRes.data);

          setSelectedCell((prev) => {
            if (prev) {
              const found = cellRes.data.cells.find((c) => c.id === prev.id);
              if (found) return found;
            }
            return (
              cellRes.data.cells.find(
                (c) =>
                  c.spaceCondition === (filters.condition || selectedCondition) &&
                  c.status !== 'empty',
              ) ??
              cellRes.data.cells.find((c) => c.status !== 'empty') ??
              null
            );
          });
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Erreur de chargement Atlas',
          );
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [filters, selectedCondition]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            {locale === 'fr' ? 'Atlas des preuves' : 'Evidence Atlas'}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {locale === 'fr'
              ? 'Explorez la matrice de consensus, le graphe de connaissances et la chronologie annuelle avec filtres combinables.'
              : 'Explore the consensus matrix, knowledge graph, and annual timeline with combinable URL-synced filters.'}
          </p>
        </div>

        {/* Sub-view tabs */}
        <div
          role="tablist"
          aria-label={
            locale === 'fr' ? 'Vues de l’Atlas' : 'Atlas Views'
          }
          className="inline-flex rounded-md border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 p-1 shrink-0 self-start lg:self-auto"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'matrix'}
            onClick={() => onChangeTab('matrix')}
            className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === 'matrix'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Grid3X3 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{locale === 'fr' ? 'Matrice' : 'Matrix'}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'graph'}
            onClick={() => onChangeTab('graph')}
            className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === 'graph'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Network className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{locale === 'fr' ? 'Graphe' : 'Graph'}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'timeline'}
            onClick={() => onChangeTab('timeline')}
            className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === 'timeline'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{locale === 'fr' ? 'Chronologie' : 'Timeline'}</span>
          </button>
        </div>
      </div>

      <FilterBar
        filters={filters}
        onChange={onChangeFilters}
        onReset={onResetFilters}
        locale={locale}
      />

      {error && (
        <div
          role="alert"
          className="rounded-md border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 p-4 text-sm text-rose-800 dark:text-rose-200"
        >
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-6">
          <MatrixSkeleton />
          <SkeletonBlock className="h-64 w-full" />
        </div>
      ) : (
        <>
          {activeTab === 'matrix' && (
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_390px] gap-6 items-start">
              <div className="space-y-6 min-w-0">
                <EvidenceMatrix
                  cells={cells}
                  selectedCondition={selectedCondition}
                  onSelectCondition={(cond) => {
                    setSelectedCondition(cond);
                    if (filters.condition && filters.condition !== cond) {
                      onChangeFilters({ ...filters, condition: cond });
                    }
                    const firstNonEmpty =
                      cells.find(
                        (c) => c.spaceCondition === cond && c.status !== 'empty',
                      ) ??
                      cells.find((c) => c.spaceCondition === cond) ??
                      null;
                    setSelectedCell(firstNonEmpty);
                  }}
                  selectedCellId={selectedCell?.id ?? null}
                  onSelectCell={setSelectedCell}
                  locale={locale}
                />

                <SystemStackedBars summary={summary} locale={locale} />
              </div>

              <div className="xl:sticky xl:top-4">
                <EvidenceCellPanel
                  cell={selectedCell}
                  locale={locale}
                  onClose={() => setSelectedCell(null)}
                  onOpenPublication={onOpenPublication}
                />
              </div>
            </div>
          )}

          {activeTab === 'graph' && (
            <KnowledgeGraphView
              graph={graph}
              locale={locale}
              onOpenPublication={onOpenPublication}
            />
          )}

          {activeTab === 'timeline' && (
            <TimelineView
              timeline={timeline}
              locale={locale}
              onOpenPublication={onOpenPublication}
            />
          )}
        </>
      )}
    </div>
  );
}
