import { Globe, Moon, Sun, Wifi, WifiOff, Zap } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { PublicationDetailDrawer } from './components/common/PublicationDetailDrawer';
import { filtersToSearchParams, searchParamsToFilters } from './domain/filters';
import type { FilterState, MissionProfile } from './domain/types';
import type { Locale } from './i18n/labels';
import { getLocalePack } from './i18n/registry';
import { DiagnosticsPage } from './pages/DiagnosticsPage';
import { EvidenceAtlasPage, type AtlasTab } from './pages/EvidenceAtlasPage';
import { HomePage, type AppRoute } from './pages/HomePage';
import { MissionTwinPage } from './pages/MissionTwinPage';
import { OfflineKnowledgePage } from './pages/OfflineKnowledgePage';
import {
  getLowDataMode,
  getSimulatedOffline,
  isOfflineActive,
  setLowDataMode,
  subscribeAdapterState,
} from './services/dataAdapter';

function parseInitialUrl() {
  if (typeof window === 'undefined') {
    return {
      route: 'home' as AppRoute,
      atlasTab: 'matrix' as AtlasTab,
      filters: {} as FilterState,
      locale: 'fr' as Locale,
      missionProfile: 'lunar' as MissionProfile,
      missionDays: 180,
    };
  }
  const params = new URLSearchParams(window.location.search);
  const view = params.get('view');
  const route: AppRoute =
    view === 'atlas' ||
    view === 'mission-twin' ||
    view === 'offline' ||
    view === 'diagnostics'
      ? view
      : 'home';

  const tabRaw = params.get('tab');
  const atlasTab: AtlasTab =
    tabRaw === 'graph' || tabRaw === 'timeline' ? tabRaw : 'matrix';

  const filters = searchParamsToFilters(params);
  const locale: Locale = filters.lang === 'en' ? 'en' : 'fr';
  const profileRaw = params.get('profile');
  const missionProfile: MissionProfile =
    profileRaw === 'mars' ? 'mars' : 'lunar';
  const daysRaw = Number(params.get('durationDays'));
  const missionDays =
    Number.isFinite(daysRaw) && daysRaw >= 7 && daysRaw <= 720 ? daysRaw : 180;

  return { route, atlasTab, filters, locale, missionProfile, missionDays };
}

export default function App() {
  const initial = parseInitialUrl();
  const [route, setRoute] = useState<AppRoute>(initial.route);
  const [atlasTab, setAtlasTab] = useState<AtlasTab>(initial.atlasTab);
  const [filters, setFilters] = useState<FilterState>(initial.filters);
  const [locale, setLocale] = useState<Locale>(initial.locale);
  const [missionProfile, setMissionProfile] = useState<MissionProfile>(
    initial.missionProfile,
  );
  const [missionDays, setMissionDays] = useState<number>(initial.missionDays);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [simOffline, setSimOffline] = useState<boolean>(getSimulatedOffline());
  const [lowData, setLowData] = useState<boolean>(getLowDataMode());
  const [drawerPub, setDrawerPub] = useState<{
    publicationId: string;
    passageId?: string;
  } | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    const unsub = subscribeAdapterState(() => {
      setSimOffline(getSimulatedOffline());
      setLowData(getLowDataMode());
    });
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      unsub();
    };
  }, []);

  // Synchronize current route, tab, filters, mission params, and language into URL for exact view sharing
  useEffect(() => {
    const params = filtersToSearchParams({ ...filters, lang: locale });
    if (route !== 'home') {
      params.set('view', route);
    }
    if (route === 'atlas' && atlasTab !== 'matrix') {
      params.set('tab', atlasTab);
    }
    if (route === 'mission-twin') {
      params.set('profile', missionProfile);
      params.set('durationDays', String(missionDays));
    }
    const qs = params.toString();
    const targetUrl = qs
      ? `${window.location.pathname}?${qs}`
      : window.location.pathname;
    window.history.replaceState(null, '', targetUrl);
  }, [route, atlasTab, filters, locale, missionProfile, missionDays]);

  const syncMissionUrl = useCallback(
    (profile: MissionProfile, durationDays: number) => {
      setMissionProfile(profile);
      setMissionDays(durationDays);
    },
    [],
  );

  const openPublication = (publicationId: string, passageId?: string) => {
    setDrawerPub({ publicationId, passageId });
  };

  const navItems: Array<{ id: AppRoute; labelFr: string; labelEn: string }> = [
    { id: 'home', labelFr: 'Accueil', labelEn: 'Home' },
    { id: 'atlas', labelFr: 'Atlas des preuves', labelEn: 'Evidence Atlas' },
    { id: 'mission-twin', labelFr: 'Jumeau Mission', labelEn: 'Mission Twin' },
    { id: 'offline', labelFr: 'Hors ligne', labelEn: 'Offline' },
  ];

  const pack = getLocalePack(locale);
  const offlineEffective = !isOnline || simOffline || isOfflineActive();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 transition-colors">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 rounded-md bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white"
      >
        {pack.nav.skipToContent}
      </a>
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/90">
        <div className="mx-auto max-w-[1360px] px-4 sm:px-6 py-3.5 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => setRoute('home')}
            className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-cyan-500 rounded"
          >
            SpaceBio Atlas
          </button>

          <nav
            aria-label={locale === 'fr' ? 'Navigation principale' : 'Primary navigation'}
            className="hidden md:flex items-center gap-6 text-sm font-medium"
          >
            {navItems.map((item) => {
              const active = route === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setRoute(item.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors focus-visible:outline-2 focus-visible:outline-cyan-500 ${
                    active
                      ? 'border-cyan-500 text-cyan-700 dark:text-cyan-300'
                      : 'border-transparent text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {locale === 'fr' ? item.labelFr : item.labelEn}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
              aria-label={
                theme === 'dark'
                  ? locale === 'fr'
                    ? 'Activer le mode clair'
                    : 'Switch to light mode'
                  : locale === 'fr'
                    ? 'Activer le mode sombre'
                    : 'Switch to dark mode'
              }
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-cyan-500"
            >
              {theme === 'dark' ? (
                <Sun className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <Moon className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span>
                {theme === 'dark'
                  ? locale === 'fr'
                    ? 'Mode clair'
                    : 'Light'
                  : locale === 'fr'
                    ? 'Mode sombre'
                    : 'Dark'}
              </span>
            </button>
          </div>
        </div>

        {/* Mobile navigation row */}
        <nav
          aria-label={locale === 'fr' ? 'Navigation mobile' : 'Mobile navigation'}
          className="flex md:hidden items-center gap-4 overflow-x-auto px-4 pb-2.5 text-xs font-medium"
        >
          {navItems.map((item) => {
            const active = route === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setRoute(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`whitespace-nowrap shrink-0 py-1 border-b-2 ${
                  active
                    ? 'border-cyan-500 text-cyan-700 dark:text-cyan-300'
                    : 'border-transparent text-slate-600 dark:text-slate-400'
                }`}
              >
                {locale === 'fr' ? item.labelFr : item.labelEn}
              </button>
            );
          })}
        </nav>
      </header>

      {/* Scientific Context & Connection Ribbon */}
      <div className="border-b border-slate-200 dark:border-slate-800/80 bg-slate-100/80 dark:bg-slate-900/60">
        <div className="mx-auto max-w-[1360px] px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-700 dark:text-slate-300">
            <span className="font-mono font-semibold text-amber-800 dark:text-amber-300">
              {locale === 'fr'
                ? 'DONNÉES DE DÉMONSTRATION'
                : 'DEMO DATASET'}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {locale === 'fr'
                ? 'Échantillon structuré représentatif du corpus NASA (608 publications cibles)'
                : 'Structured sample representing target NASA corpus (608 publications)'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <span
              role="status"
              aria-live="polite"
              className="inline-flex items-center gap-1.5 font-mono text-[11px] text-slate-600 dark:text-slate-300"
            >
              {!offlineEffective ? (
                <Wifi className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" aria-hidden="true" />
              ) : (
                <WifiOff className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
              )}
              <span>
                {!offlineEffective
                  ? locale === 'fr'
                    ? 'En ligne · API'
                    : 'Online · API'
                  : simOffline
                    ? locale === 'fr'
                      ? 'Hors ligne simulé · IndexedDB'
                      : 'Simulated offline · IndexedDB'
                    : locale === 'fr'
                      ? 'Hors ligne · IndexedDB'
                      : 'Offline · IndexedDB'}
              </span>
            </span>

            <button
              type="button"
              aria-pressed={lowData}
              onClick={() => setLowDataMode(!lowData)}
              className={`inline-flex items-center gap-1 font-mono text-[11px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-cyan-500 ${
                lowData
                  ? 'text-cyan-700 dark:text-cyan-300'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Zap className="h-3 w-3" aria-hidden="true" />
              <span>
                {locale === 'fr' ? 'Mode léger' : 'Low-data'}
                {lowData ? ' (ON)' : ''}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setLocale((l) => (l === 'fr' ? 'en' : 'fr'))}
              className="inline-flex items-center gap-1 font-mono text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-cyan-700 dark:hover:text-cyan-300 focus-visible:outline-2 focus-visible:outline-cyan-500"
            >
              <Globe className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{locale === 'fr' ? 'FR / EN' : 'EN / FR'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main id="main-content" className="flex-1 mx-auto w-full max-w-[1360px] px-4 sm:px-6 py-8">
        {route === 'home' && (
          <HomePage
            locale={locale}
            onNavigate={setRoute}
            onOpenPublication={openPublication}
          />
        )}

        {route === 'atlas' && (
          <EvidenceAtlasPage
            locale={locale}
            filters={filters}
            activeTab={atlasTab}
            onChangeTab={setAtlasTab}
            onChangeFilters={setFilters}
            onResetFilters={() => setFilters({})}
            onOpenPublication={openPublication}
          />
        )}

        {route === 'mission-twin' && (
          <MissionTwinPage
            locale={locale}
            initialProfile={missionProfile}
            initialDurationDays={missionDays}
            onSyncMissionUrl={syncMissionUrl}
            onOpenPublication={openPublication}
          />
        )}

        {route === 'offline' && (
          <OfflineKnowledgePage
            locale={locale}
            onOpenPublication={openPublication}
          />
        )}

        {route === 'diagnostics' && <DiagnosticsPage locale={locale} />}
      </main>

      {/* Footer with Sources, Licenses, and Diagnostics Link */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/90">
        <div className="mx-auto max-w-[1360px] px-4 sm:px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-xs text-slate-600 dark:text-slate-400">
          <div className="space-y-1">
            <p className="font-medium text-slate-800 dark:text-slate-200">
              {locale === 'fr'
                ? 'Sources & Licences : Jeu de démonstration synthétique (CC-BY-4.0) · Schéma compatible NASA OSDR (608 publications cibles).'
                : 'Sources & Licenses: Synthetic Demo Dataset (CC-BY-4.0) · Compatible with NASA OSDR schema (608 target publications).'}
            </p>
            <p>
              {locale === 'fr'
                ? 'Avertissement : Outil d’exploration scientifique. Aucune recommandation médicale individuelle.'
                : 'Disclaimer: Scientific exploration tool. No individual medical advice is provided.'}
            </p>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <a
              href="/api/v1/openapi.json"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline text-slate-700 dark:text-slate-300"
            >
              OpenAPI 3.1
            </a>
            <button
              type="button"
              onClick={() => setRoute('diagnostics')}
              className="font-medium text-cyan-700 dark:text-cyan-400 hover:underline"
            >
              {locale === 'fr' ? 'Diagnostics' : 'Diagnostics'}
            </button>
          </div>
        </div>
      </footer>

      <PublicationDetailDrawer
        publicationId={drawerPub?.publicationId ?? null}
        highlightPassageId={drawerPub?.passageId ?? null}
        locale={locale}
        onClose={() => setDrawerPub(null)}
      />
    </div>
  );
}
