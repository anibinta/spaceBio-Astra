import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Compass,
  HelpCircle,
  Minus,
  ShieldAlert,
  Table,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { BIOLOGICAL_SYSTEMS } from '../domain/evidenceEngine';
import { MISSION_PHASES } from '../domain/missionTwinEngine';
import type {
  MissionPhase,
  MissionProfile,
  MissionRiskEntry,
  RiskCoverage,
} from '../domain/types';
import { PHASE_LABELS, SYSTEM_LABELS, type Locale } from '../i18n/labels';
import { dataAdapter } from '../services/dataAdapter';
import { CsvExportButton } from '../components/common/CsvExportButton';
import { SkeletonBlock } from '../components/common/Skeleton';

interface MissionTwinPageProps {
  locale: Locale;
  initialProfile?: MissionProfile;
  initialDurationDays?: number;
  onSyncMissionUrl: (profile: MissionProfile, durationDays: number) => void;
  onOpenPublication: (publicationId: string, passageId?: string) => void;
}

const COVERAGE_STYLE: Record<
  RiskCoverage,
  { surface: string; text: string; labelFr: string; labelEn: string; glyph: string }
> = {
  documented: {
    surface:
      'border-cyan-300 dark:border-cyan-800 bg-cyan-50/70 dark:bg-cyan-950/50 hover:border-cyan-500',
    text: 'text-cyan-800 dark:text-cyan-300',
    labelFr: 'Documenté',
    labelEn: 'Documented',
    glyph: '■',
  },
  extrapolated: {
    surface:
      'border-amber-300 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/40 hover:border-amber-500',
    text: 'text-amber-800 dark:text-amber-300',
    labelFr: 'Extrapolé',
    labelEn: 'Extrapolated',
    glyph: '▲',
  },
  unstudied: {
    surface:
      'border-slate-200 dark:border-slate-800 border-dashed bg-slate-50/50 dark:bg-slate-950/40 hover:border-slate-400',
    text: 'text-slate-600 dark:text-slate-400',
    labelFr: 'Non étudié',
    labelEn: 'Unstudied',
    glyph: '□',
  },
};

export function MissionTwinPage({
  locale,
  initialProfile = 'lunar',
  initialDurationDays = 180,
  onSyncMissionUrl,
  onOpenPublication,
}: MissionTwinPageProps) {
  const [profile, setProfile] = useState<MissionProfile>(initialProfile);
  const [durationDays, setDurationDays] = useState<number>(initialDurationDays);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [risks, setRisks] = useState<MissionRiskEntry[]>([]);
  const [selectedRisk, setSelectedRisk] = useState<MissionRiskEntry | null>(null);
  const [tableView, setTableView] = useState(false);

  useEffect(() => {
    onSyncMissionUrl(profile, durationDays);
  }, [profile, durationDays, onSyncMissionUrl]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    dataAdapter
      .getMissionRisks({ profile, durationDays })
      .then((res) => {
        if (!cancelled) {
          setRisks(res.data.risks);
          setSelectedRisk((prev) => {
            if (prev) {
              const matching = res.data.risks.find(
                (r) =>
                  r.biologicalSystem === prev.biologicalSystem &&
                  r.missionPhase === prev.missionPhase,
              );
              if (matching) return matching;
            }
            return (
              res.data.risks.find((r) => r.coverage === 'documented') ??
              res.data.risks[0] ??
              null
            );
          });
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Erreur de chargement Jumeau Mission',
          );
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [profile, durationDays]);

  const riskMap = useMemo(() => {
    const map = new Map<string, MissionRiskEntry>();
    for (const r of risks) {
      map.set(`${r.biologicalSystem}__${r.missionPhase}`, r);
    }
    return map;
  }, [risks]);

  const coverageTotals = useMemo(() => {
    return risks.reduce(
      (acc, r) => {
        acc[r.coverage]++;
        return acc;
      },
      { documented: 0, extrapolated: 0, unstudied: 0 },
    );
  }, [risks]);

  const csvRows = risks.map((r) => [
    r.missionProfile,
    r.durationDays,
    SYSTEM_LABELS[locale][r.biologicalSystem],
    PHASE_LABELS[locale][r.missionPhase],
    locale === 'fr'
      ? COVERAGE_STYLE[r.coverage].labelFr
      : COVERAGE_STYLE[r.coverage].labelEn,
    r.totalSubjects,
    r.publicationCount,
    r.avgConfidence,
    r.extrapolationBasis ?? '',
    r.sourcePassageIds.join('; '),
    'Piste à valider par des experts',
  ]);

  const renderCoverageIcon = (cov: RiskCoverage) => {
    if (cov === 'documented') {
      return <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
    }
    if (cov === 'extrapolated') {
      return <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
    }
    return <Minus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
  };

  return (
    <div className="space-y-6">
      {/* Mandatory Permanent Disclaimer Banner */}
      <div
        role="note"
        className="flex items-start gap-3 rounded-lg border border-amber-400/80 dark:border-amber-700 bg-amber-50/90 dark:bg-amber-950/40 px-4 py-3 text-xs text-amber-950 dark:text-amber-200"
      >
        <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
        <div className="space-y-0.5">
          <p className="font-semibold uppercase tracking-wide">
            {locale === 'fr'
              ? 'Piste à valider par des experts'
              : 'Lead for expert validation'}
          </p>
          <p>
            {locale === 'fr'
              ? 'Ce registre aide les architectes de mission à distinguer les risques documentés, extrapolés et non étudiés. Aucune recommandation médicale individuelle n’est fournie.'
              : 'This registry helps mission architects distinguish documented, extrapolated, and unstudied risks. No individual medical advice is provided.'}
          </p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            {locale === 'fr'
              ? 'Jumeau Mission — Lune & Mars'
              : 'Mission Twin — Moon & Mars'}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {locale === 'fr'
              ? 'Registre de risques par système biologique et phase de mission selon la durée d’exposition simulée.'
              : 'Risk registry by biological system and mission phase filtered by simulated exposure duration.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setTableView((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            {tableView ? (
              <Compass className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Table className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span>
              {tableView
                ? locale === 'fr'
                  ? 'Vue registre'
                  : 'Registry view'
                : locale === 'fr'
                  ? 'Vue tableau'
                  : 'Table view'}
            </span>
          </button>

          <CsvExportButton
            filename={`spacebio-mission-twin-${profile}-${durationDays}d.csv`}
            headers={[
              'Profile',
              'DurationDays',
              'System',
              'Phase',
              'Coverage',
              'Subjects_n',
              'Publications',
              'AvgConfidence',
              'ExtrapolationBasis',
              'SourcePassageIDs',
              'Disclaimer',
            ]}
            rows={csvRows}
            locale={locale}
          />
        </div>
      </div>

      {/* Mission Profile + Duration Slider Controls */}
      <section
        aria-label={
          locale === 'fr' ? 'Paramètres de mission' : 'Mission parameters'
        }
        className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 grid grid-cols-1 lg:grid-cols-[auto_1fr_auto] gap-6 items-center"
      >
        <div className="space-y-1.5">
          <span className="block text-xs font-semibold text-slate-600 dark:text-slate-400">
            {locale === 'fr' ? 'Architecture mission' : 'Mission profile'}
          </span>
          <div className="inline-flex rounded-md border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 p-0.5">
            <button
              type="button"
              onClick={() => {
                setProfile('lunar');
                if (durationDays > 180) setDurationDays(90);
              }}
              aria-pressed={profile === 'lunar'}
              className={`rounded px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                profile === 'lunar'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {locale === 'fr' ? 'Lune (Artemis)' : 'Moon (Artemis)'}
            </button>
            <button
              type="button"
              onClick={() => {
                setProfile('mars');
                if (durationDays < 180) setDurationDays(400);
              }}
              aria-pressed={profile === 'mars'}
              className={`rounded px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                profile === 'mars'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {locale === 'fr' ? 'Mars (Conjonction)' : 'Mars (Conjunction)'}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label
              htmlFor="mission-duration-slider"
              className="text-xs font-semibold text-slate-700 dark:text-slate-200"
            >
              {locale === 'fr'
                ? 'Durée d’exposition filtrée :'
                : 'Filtered mission duration:'}{' '}
              <span className="font-mono text-sm text-cyan-700 dark:text-cyan-300">
                {durationDays} {locale === 'fr' ? 'jours' : 'days'}
              </span>
            </label>
            <div className="flex items-center gap-1.5">
              {[10, 45, 180, 400].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setDurationDays(preset)}
                  className={`rounded border px-2 py-0.5 text-[11px] font-mono transition-colors ${
                    durationDays === preset
                      ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-200'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {preset}j
                </button>
              ))}
            </div>
          </div>
          <input
            id="mission-duration-slider"
            type="range"
            min={7}
            max={720}
            step={1}
            value={durationDays}
            onChange={(e) => setDurationDays(Number(e.target.value))}
            className="w-full accent-cyan-500 cursor-pointer"
          />
          <div className="flex justify-between text-[11px] font-mono text-slate-400">
            <span>7j</span>
            <span>90j</span>
            <span>365j</span>
            <span>720j</span>
          </div>
        </div>

        <div className="flex flex-col gap-1 text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">
          <span className="text-cyan-700 dark:text-cyan-300">
            ■ {coverageTotals.documented}{' '}
            {locale === 'fr' ? 'documentés' : 'documented'}
          </span>
          <span className="text-amber-700 dark:text-amber-300">
            ▲ {coverageTotals.extrapolated}{' '}
            {locale === 'fr' ? 'extrapolés' : 'extrapolated'}
          </span>
          <span className="text-slate-500 dark:text-slate-400">
            □ {coverageTotals.unstudied}{' '}
            {locale === 'fr' ? 'non étudiés' : 'unstudied'}
          </span>
        </div>
      </section>

      {error && (
        <div
          role="alert"
          className="rounded-md border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 p-4 text-sm text-rose-800 dark:text-rose-200"
        >
          {error}
        </div>
      )}

      {loading ? (
        <SkeletonBlock className="h-96 w-full" />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6 items-start">
          {!tableView ? (
            <section className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 overflow-x-auto">
              <div className="min-w-[720px]">
                <div className="grid grid-cols-[165px_repeat(4,minmax(135px,1fr))] gap-2 pb-2 text-xs font-semibold text-slate-600 dark:text-slate-400">
                  <div className="px-2 py-1">
                    {locale === 'fr' ? 'Système' : 'System'}
                  </div>
                  {MISSION_PHASES.map((phase: MissionPhase) => (
                    <div key={phase} className="px-2 py-1 text-center">
                      {PHASE_LABELS[locale][phase]}
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

                      {MISSION_PHASES.map((phase) => {
                        const entry = riskMap.get(`${sys}__${phase}`);
                        if (!entry) return <div key={phase} />;
                        const style = COVERAGE_STYLE[entry.coverage];
                        const isSelected = selectedRisk?.id === entry.id;

                        return (
                          <button
                            key={entry.id}
                            type="button"
                            onClick={() => setSelectedRisk(entry)}
                            className={`min-w-0 flex flex-col items-start justify-between rounded-md border p-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-cyan-500 ${style.surface} ${
                              isSelected ? 'ring-2 ring-cyan-500' : ''
                            }`}
                          >
                            <span
                              className={`inline-flex items-center gap-1 text-xs font-semibold max-w-full ${style.text}`}
                            >
                              {renderCoverageIcon(entry.coverage)}
                              <span aria-hidden="true" className="font-mono text-[11px]">
                                {style.glyph}
                              </span>
                              <span className="truncate">
                                {locale === 'fr' ? style.labelFr : style.labelEn}
                              </span>
                            </span>
                            <div className="mt-2 w-full flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-600 dark:text-slate-300">
                              <span>n = {entry.totalSubjects}</span>
                              <span>{entry.publicationCount} pub.</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ) : (
            <section className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                    <th className="py-2 pr-3 font-semibold">Système</th>
                    <th className="py-2 pr-3 font-semibold">Phase</th>
                    <th className="py-2 pr-3 font-semibold">Couverture</th>
                    <th className="py-2 pr-3 font-mono">n</th>
                    <th className="py-2 pr-3 font-mono">Pubs</th>
                    <th className="py-2 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {risks.map((entry) => {
                    const style = COVERAGE_STYLE[entry.coverage];
                    return (
                      <tr key={entry.id}>
                        <td className="py-2 pr-3 font-medium">
                          {SYSTEM_LABELS[locale][entry.biologicalSystem]}
                        </td>
                        <td className="py-2 pr-3">
                          {PHASE_LABELS[locale][entry.missionPhase]}
                        </td>
                        <td className={`py-2 pr-3 font-semibold ${style.text}`}>
                          {style.glyph}{' '}
                          {locale === 'fr' ? style.labelFr : style.labelEn}
                        </td>
                        <td className="py-2 pr-3 font-mono tabular-nums">
                          {entry.totalSubjects}
                        </td>
                        <td className="py-2 pr-3 font-mono tabular-nums">
                          {entry.publicationCount}
                        </td>
                        <td className="py-2">
                          <button
                            type="button"
                            onClick={() => setSelectedRisk(entry)}
                            className="text-cyan-700 dark:text-cyan-400 font-medium hover:underline"
                          >
                            {locale === 'fr' ? 'Inspecter' : 'Inspect'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          )}

          {/* Side Detail Panel */}
          <aside className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 space-y-4">
            {selectedRisk ? (
              <>
                <div className="space-y-1.5 border-b border-slate-200 dark:border-slate-800 pb-3">
                  <div
                    className={`inline-flex items-center gap-1.5 text-xs font-semibold ${COVERAGE_STYLE[selectedRisk.coverage].text}`}
                  >
                    {renderCoverageIcon(selectedRisk.coverage)}
                    <span>
                      {locale === 'fr'
                        ? COVERAGE_STYLE[selectedRisk.coverage].labelFr
                        : COVERAGE_STYLE[selectedRisk.coverage].labelEn}
                    </span>
                  </div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {SYSTEM_LABELS[locale][selectedRisk.biologicalSystem]} ·{' '}
                    {PHASE_LABELS[locale][selectedRisk.missionPhase]}
                  </h2>
                  <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                    {selectedRisk.missionProfile.toUpperCase()} ·{' '}
                    {selectedRisk.durationDays}j · n ={' '}
                    {selectedRisk.totalSubjects}, {selectedRisk.publicationCount}{' '}
                    pubs
                  </p>
                </div>

                {selectedRisk.extrapolationBasis && (
                  <div className="rounded-md border border-amber-300 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                    <p className="font-semibold">
                      {locale === 'fr'
                        ? 'Base d’extrapolation :'
                        : 'Extrapolation basis:'}
                    </p>
                    <p>{selectedRisk.extrapolationBasis}</p>
                  </div>
                )}

                {selectedRisk.coverage === 'unstudied' && (
                  <div className="rounded-md border border-dashed border-slate-300 dark:border-slate-700 p-4 text-xs text-slate-600 dark:text-slate-400 space-y-1">
                    <p className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>
                        {locale === 'fr'
                          ? 'Zone non étudiée (lacune critique)'
                          : 'Unstudied area (critical gap)'}
                      </span>
                    </p>
                    <p>
                      {locale === 'fr'
                        ? 'Aucune donnée directe ni condition voisine exploitable pour cette phase et cette durée.'
                        : 'No direct data or adjacent condition available for this phase and duration.'}
                    </p>
                  </div>
                )}

                {selectedRisk.limitations.length > 0 && (
                  <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                      {locale === 'fr' ? 'Limites signalées :' : 'Limitations:'}
                    </p>
                    <p>{selectedRisk.limitations.join(' · ')}</p>
                  </div>
                )}

                {selectedRisk.publicationIds.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {locale === 'fr'
                        ? `Publications & passages sources (${selectedRisk.sourcePassageIds.length})`
                        : `Source publications & passages (${selectedRisk.sourcePassageIds.length})`}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {selectedRisk.publicationIds.map((pubId) => (
                        <button
                          key={pubId}
                          type="button"
                          onClick={() =>
                            onOpenPublication(
                              pubId,
                              selectedRisk.sourcePassageIds[0],
                            )
                          }
                          className="inline-flex items-center gap-1 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1 text-xs font-mono text-cyan-700 dark:text-cyan-400 hover:border-cyan-500"
                        >
                          <BookOpen className="h-3 w-3" aria-hidden="true" />
                          <span>{pubId}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <p className="border-t border-slate-200 dark:border-slate-800 pt-3 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                  {locale === 'fr'
                    ? 'Piste à valider par des experts · Aucune recommandation médicale.'
                    : 'Lead for expert validation · No medical recommendation.'}
                </p>
              </>
            ) : null}
          </aside>
        </div>
      )}
    </div>
  );
}
