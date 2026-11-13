import {
  BookOpen,
  CheckCircle2,
  Database,
  Download,
  RefreshCw,
  Search,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { SearchHit } from '../domain/types';
import {
  DIRECTION_LABELS,
  SECTION_LABELS,
  SYSTEM_LABELS,
  type Locale,
} from '../i18n/labels';
import { getLocalePack } from '../i18n/registry';
import { usePWAInstall } from '../hooks/usePWAInstall';
import {
  dataAdapter,
  getLowDataMode,
  getSimulatedOffline,
  isOfflineActive,
  setLowDataMode,
  setSimulatedOffline,
  subscribeAdapterState,
} from '../services/dataAdapter';
import {
  getDiagnosticsSnapshot,
  subscribeDiagnostics,
  type DiagnosticsSnapshot,
} from '../services/diagnostics';
import { PWAInstallButton } from '../components/common/PWAInstallButton';

interface OfflineKnowledgePageProps {
  locale: Locale;
  onOpenPublication: (publicationId: string, passageId?: string) => void;
}

export function OfflineKnowledgePage({
  locale,
  onOpenPublication,
}: OfflineKnowledgePageProps) {
  const pack = getLocalePack(locale);
  const { swStatus } = usePWAInstall();
  const [diag, setDiag] = useState<DiagnosticsSnapshot>(getDiagnosticsSnapshot);
  const [simOffline, setSimOffline] = useState(getSimulatedOffline());
  const [lowData, setLowData] = useState(getLowDataMode());
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [localQuery, setLocalQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searchMs, setSearchMs] = useState<number | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    const unsubDiag = subscribeDiagnostics(setDiag);
    const unsubAdapter = subscribeAdapterState(() => {
      setSimOffline(getSimulatedOffline());
      setLowData(getLowDataMode());
    });
    return () => {
      unsubDiag();
      unsubAdapter();
    };
  }, []);

  // Load initial local publications/passages on mount so offline browser is immediately populated
  useEffect(() => {
    let cancelled = false;
    dataAdapter
      .searchLocalDirect('', {}, 1, 8)
      .then((res) => {
        if (!cancelled) {
          setHits(res.data);
          setSearchMs(res.meta.tookMs);
        }
      })
      .catch(() => {
        // user can click Sync
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await dataAdapter.syncNow(true);
      setSyncMessage(
        locale === 'fr'
          ? `Index local synchronisé (${Math.round(res.record.gzipBytes / 1024)} Ko gzip · ${res.record.bundle.publications.length} publications).`
          : `Local index synced (${Math.round(res.record.gzipBytes / 1024)} KB gzip · ${res.record.bundle.publications.length} publications).`,
      );
      const searchRes = await dataAdapter.searchLocalDirect(localQuery, {}, 1, 12);
      setHits(searchRes.data);
      setSearchMs(searchRes.meta.tookMs);
    } catch (err: unknown) {
      setSyncMessage(
        err instanceof Error
          ? err.message
          : locale === 'fr'
            ? 'Échec de synchronisation.'
            : 'Sync failed.',
      );
    } finally {
      setSyncing(false);
    }
  };

  const runLocalSearch = async (q: string) => {
    setSearchError(null);
    try {
      const res = await dataAdapter.searchLocalDirect(q, {}, 1, 12);
      setHits(res.data);
      setSearchMs(res.meta.tookMs);
    } catch (err: unknown) {
      setSearchError(err instanceof Error ? err.message : 'Erreur recherche locale');
    }
  };

  const offlineNow = isOfflineActive();
  const swLabel =
    swStatus === 'active'
      ? locale === 'fr'
        ? 'Actif'
        : 'Active'
      : swStatus === 'blocked'
        ? locale === 'fr'
          ? 'Restreint (iframe) · IndexedDB actif'
          : 'Restricted (iframe) · IndexedDB active'
        : swStatus === 'registering'
          ? locale === 'fr'
            ? 'Initialisation…'
            : 'Registering…'
          : locale === 'fr'
            ? 'Non supporté · IndexedDB actif'
            : 'Unsupported · IndexedDB active';

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            {pack.offline.title}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-3xl">
            {pack.offline.subtitle}
          </p>
        </div>
        <div className="shrink-0">
          <PWAInstallButton locale={locale} />
        </div>
      </div>

      {/* Sync & Storage Status Grid */}
      <section
        aria-label={locale === 'fr' ? 'État du stockage hors ligne' : 'Offline storage status'}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4 space-y-1">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {locale === 'fr' ? 'Source de données active' : 'Active Data Source'}
          </div>
          <div className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100">
            {offlineNow ? (
              <WifiOff className="h-4 w-4 text-amber-500" aria-hidden="true" />
            ) : (
              <Wifi className="h-4 w-4 text-cyan-500" aria-hidden="true" />
            )}
            <span>
              {offlineNow
                ? locale === 'fr'
                  ? 'Index local (IndexedDB)'
                  : 'Local Index (IndexedDB)'
                : 'API REST + Cache'}
            </span>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            SW: {swLabel}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4 space-y-1">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {locale === 'fr' ? 'Taille mesurée de l’index' : 'Measured Index Size'}
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-50">
            {diag.offlineGzipBytes > 0
              ? `${(diag.offlineGzipBytes / 1024).toFixed(1)} Ko`
              : '—'}
          </div>
          <div className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
            {diag.offlineJsonBytes > 0
              ? `${(diag.offlineJsonBytes / 1024).toFixed(1)} Ko JSON brut`
              : locale === 'fr'
                ? 'Non synchronisé'
                : 'Not synced'}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4 space-y-1">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {locale === 'fr' ? 'Dernière synchronisation' : 'Last Synced'}
          </div>
          <div className="text-sm font-semibold font-mono text-slate-900 dark:text-slate-100 pt-1">
            {diag.lastSyncedAt
              ? new Date(diag.lastSyncedAt).toLocaleTimeString(
                  locale === 'fr' ? 'fr-FR' : 'en-US',
                )
              : '—'}
          </div>
          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
            SHA-256: {diag.sha256 ? diag.sha256.slice(0, 14) + '…' : '—'}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4 space-y-1">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {locale === 'fr' ? 'Latence recherche locale' : 'Local Search Latency'}
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-cyan-700 dark:text-cyan-300">
            {searchMs !== null
              ? `${searchMs} ms`
              : diag.lastLocalSearchMs !== null
                ? `${diag.lastLocalSearchMs} ms`
                : '—'}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {locale === 'fr' ? 'Objectif < 200 ms' : 'Target < 200 ms'}
          </div>
        </div>
      </section>

      {/* Controls: Sync, Simulated Offline, Low-Data Mode, Download */}
      <section className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void handleSync()}
            disabled={syncing || (offlineNow && !simOffline)}
            className="inline-flex items-center gap-2 rounded-md bg-cyan-600 hover:bg-cyan-700 disabled:opacity-60 px-4 py-2 text-xs font-semibold text-white transition-colors focus-visible:outline-2 focus-visible:outline-cyan-500"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>{syncing ? pack.offline.syncing : pack.offline.syncNow}</span>
          </button>

          <button
            type="button"
            aria-pressed={simOffline}
            onClick={() => setSimulatedOffline(!simOffline)}
            className={`inline-flex items-center gap-2 rounded-md border px-4 py-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-cyan-500 ${
              simOffline
                ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200'
                : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 hover:border-cyan-500'
            }`}
          >
            {simOffline ? (
              <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Database className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span>
              {simOffline
                ? pack.offline.disableSimOffline
                : pack.offline.simulateOffline}
            </span>
          </button>

          <button
            type="button"
            aria-pressed={lowData}
            onClick={() => setLowDataMode(!lowData)}
            className={`inline-flex items-center gap-2 rounded-md border px-4 py-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-cyan-500 ${
              lowData
                ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-200'
                : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 hover:border-cyan-500'
            }`}
          >
            <Zap className="h-3.5 w-3.5" aria-hidden="true" />
            <span>
              {pack.offline.lowDataMode}
              {locale === 'fr' ? ' : ' : ': '}
              {lowData
                ? locale === 'fr'
                  ? 'Activé'
                  : 'On'
                : locale === 'fr'
                  ? 'Inactif'
                  : 'Off'}
            </span>
          </button>

          <a
            href="/api/v1/export/offline-index?format=gzip"
            download="spacebio-atlas-offline-index.json.gz"
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-cyan-500 transition-colors"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{pack.offline.downloadBundle}</span>
          </a>
        </div>

        {syncMessage && (
          <p
            role="status"
            aria-live="polite"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-cyan-700 dark:text-cyan-300"
          >
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{syncMessage}</span>
          </p>
        )}

        <p className="text-xs text-slate-500 dark:text-slate-400">
          {locale === 'fr'
            ? 'Le mode faible consommation de données désactive les animations CSS, la synthèse vocale et bascule l’interrogation en extraction locale instantanée sans appel réseau.'
            : 'Low-data mode disables CSS animations and speech synthesis, switching natural-language queries to instant local extraction without extra network bandwidth.'}
        </p>
      </section>

      {/* Instant Local Search Browser */}
      <section
        aria-labelledby="offline-search-heading"
        className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2
            id="offline-search-heading"
            className="text-base font-semibold text-slate-900 dark:text-slate-100"
          >
            {pack.offline.localSearchTitle}
          </h2>
          <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
            {hits.length} {locale === 'fr' ? 'passages affichés' : 'passages shown'}
            {searchMs !== null ? ` · ${searchMs} ms` : ''}
          </span>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void runLocalSearch(localQuery);
          }}
          className="flex flex-col sm:flex-row gap-3"
        >
          <label htmlFor="local-offline-search" className="sr-only">
            {pack.offline.localSearchPlaceholder}
          </label>
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
              aria-hidden="true"
            />
            <input
              id="local-offline-search"
              type="search"
              value={localQuery}
              onChange={(e) => {
                const next = e.target.value;
                setLocalQuery(next);
                void runLocalSearch(next);
              }}
              placeholder={pack.offline.localSearchPlaceholder}
              className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-9 pr-4 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
            />
          </div>
          <button
            type="submit"
            className="rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:border-cyan-500 whitespace-nowrap"
          >
            {locale === 'fr' ? 'Filtrer localement' : 'Filter locally'}
          </button>
        </form>

        {searchError && (
          <div
            role="alert"
            className="rounded-md border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 p-3 text-xs text-rose-800 dark:text-rose-200"
          >
            {searchError}
          </div>
        )}

        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {hits.map((hit) => (
            <article key={hit.passage.id} className="py-3.5 space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-2 font-mono text-slate-500 dark:text-slate-400">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {hit.passage.id}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{SECTION_LABELS[locale][hit.passage.section]}</span>
                  <span aria-hidden="true">·</span>
                  <span>{hit.publication.year}</span>
                  {hit.claims[0] && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>
                        {SYSTEM_LABELS[locale][hit.claims[0].biologicalSystem]} (
                        {DIRECTION_LABELS[locale][hit.claims[0].effectDirection]})
                      </span>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    onOpenPublication(hit.publication.id, hit.passage.id)
                  }
                  className="inline-flex items-center gap-1 text-xs font-medium text-cyan-700 dark:text-cyan-400 hover:underline"
                >
                  <BookOpen className="h-3 w-3" aria-hidden="true" />
                  <span>{hit.publication.id}</span>
                </button>
              </div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {locale === 'fr'
                  ? hit.publication.titleFr ?? hit.publication.title
                  : hit.publication.title}
              </h3>
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                {locale === 'fr'
                  ? hit.passage.textFr ?? hit.passage.text
                  : hit.passage.text}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
