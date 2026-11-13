import {
  Activity,
  CheckCircle2,
  FileText,
  Globe,
  Play,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { BenchmarkQuestion } from '../domain/types';
import type { Locale } from '../i18n/labels';
import {
  getAvailableLocales,
  getLocalePack,
  verifyLocaleKeyParity,
} from '../i18n/registry';
import { dataAdapter } from '../services/dataAdapter';
import {
  getDiagnosticsSnapshot,
  subscribeDiagnostics,
  type DiagnosticsSnapshot,
} from '../services/diagnostics';

interface DiagnosticsPageProps {
  locale: Locale;
}

interface BenchmarkRunRow {
  question: BenchmarkQuestion;
  passed: boolean;
  tookMs: number;
  citedPassages: number;
  mode: string;
}

export function DiagnosticsPage({ locale }: DiagnosticsPageProps) {
  const pack = getLocalePack(locale);
  const [diag, setDiag] = useState<DiagnosticsSnapshot>(getDiagnosticsSnapshot);
  const [questions, setQuestions] = useState<BenchmarkQuestion[]>([]);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<BenchmarkRunRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const missingLocaleKeys = verifyLocaleKeyParity();
  const availableLocales = getAvailableLocales();

  useEffect(() => {
    const unsub = subscribeDiagnostics(setDiag);
    dataAdapter
      .getBenchmarkQuestions()
      .then((res) => setQuestions(res.data))
      .catch(() => undefined);
    return () => unsub();
  }, []);

  const runBenchmarkSuite = async () => {
    setRunning(true);
    setError(null);
    try {
      const qList =
        questions.length > 0
          ? questions
          : (await dataAdapter.getBenchmarkQuestions()).data;
      setQuestions(qList);

      const nextRows: BenchmarkRunRow[] = [];
      for (const q of qList) {
        const start = performance.now();
        const scopedFilters = {
          system: q.expectedSystem,
          ...(q.expectedCondition ? { condition: q.expectedCondition } : {}),
          ...(q.expectedDuration ? { duration: q.expectedDuration } : {}),
        };
        const [cellsRes, searchRes] = await Promise.all([
          dataAdapter.getEvidenceCells(scopedFilters),
          dataAdapter.searchLocalDirect(q.question, scopedFilters, 1, 8),
        ]);
        const tookMs = Number((performance.now() - start).toFixed(2));
        const citedPassages = searchRes.sourcePassageIds.length;
        const statusMatched = cellsRes.data.cells.some(
          (c) => c.status === q.expectedStatus,
        );
        const passed =
          statusMatched &&
          (q.expectedStatus === 'empty'
            ? citedPassages === 0
            : citedPassages >= q.expectedMinPassages);
        nextRows.push({
          question: q,
          passed,
          tookMs,
          citedPassages,
          mode: 'local_bm25',
        });
      }
      setResults(nextRows);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Erreur lors de l’exécution du benchmark',
      );
    } finally {
      setRunning(false);
    }
  };

  const passCount = results.filter((r) => r.passed).length;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          {pack.diagnostics.title}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-3xl">
          {pack.diagnostics.subtitle}
        </p>
      </div>

      {/* Measured Runtime Telemetry Strip */}
      <section
        aria-label={locale === 'fr' ? 'Mesures temps réel' : 'Runtime measurements'}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4 space-y-1">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {locale === 'fr' ? 'Chargement initial mesuré' : 'Measured Initial Load'}
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-50">
            {diag.initialLoadMs !== null ? `${diag.initialLoadMs} ms` : '—'}
          </div>
          <div className="text-xs text-cyan-700 dark:text-cyan-400 font-mono">
            {diag.initialLoadMs !== null && diag.initialLoadMs < 3000
              ? '✓ < 3000 ms'
              : locale === 'fr'
                ? 'Cible < 3000 ms'
                : 'Target < 3000 ms'}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4 space-y-1">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {locale === 'fr' ? 'Recherche locale (BM25)' : 'Local Search (BM25)'}
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-50">
            {diag.lastLocalSearchMs !== null ? `${diag.lastLocalSearchMs} ms` : '—'}
          </div>
          <div className="text-xs text-cyan-700 dark:text-cyan-400 font-mono">
            {diag.avgLocalSearchMs !== null
              ? `moy. ${diag.avgLocalSearchMs} ms (< 200 ms)`
              : locale === 'fr'
                ? 'Cible < 200 ms'
                : 'Target < 200 ms'}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4 space-y-1">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {locale === 'fr' ? 'Dernière latence API REST' : 'Last REST API Latency'}
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-50">
            {diag.lastApiLatencyMs !== null ? `${diag.lastApiLatencyMs} ms` : '—'}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            {diag.apiCallCount} {locale === 'fr' ? 'appels API' : 'API calls'} ·{' '}
            {diag.activeSource}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4 space-y-1">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {locale === 'fr' ? 'Poids index hors ligne' : 'Offline Index Size'}
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-50">
            {diag.offlineGzipBytes > 0
              ? `${(diag.offlineGzipBytes / 1024).toFixed(1)} Ko`
              : '—'}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            {diag.offlineJsonBytes > 0
              ? `${(diag.offlineJsonBytes / 1024).toFixed(1)} Ko JSON`
              : 'IndexedDB'}
          </div>
        </div>
      </section>

      {/* Interactive 22 Benchmark Questions Runner */}
      <section className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Activity className="h-4 w-4 text-cyan-500" aria-hidden="true" />
              <span>
                {locale === 'fr'
                  ? `Batterie de non-régression (${questions.length || 22} questions de référence)`
                  : `Regression Benchmark (${questions.length || 22} reference questions)`}
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {locale === 'fr'
                ? 'Vérifie la couverture des passages sources et le temps de réponse (< 200 ms en local) sur les 22 questions officielles.'
                : 'Verifies source passage grounding and response latency (< 200 ms locally) across all 22 official benchmark questions.'}
            </p>
          </div>

          <button
            type="button"
            onClick={() => void runBenchmarkSuite()}
            disabled={running}
            className="inline-flex items-center gap-2 rounded-md bg-cyan-600 hover:bg-cyan-700 disabled:opacity-60 px-4 py-2 text-xs font-semibold text-white transition-colors focus-visible:outline-2 focus-visible:outline-cyan-500"
          >
            <Play className="h-3.5 w-3.5" aria-hidden="true" />
            <span>
              {running
                ? pack.diagnostics.runningBenchmark
                : pack.diagnostics.runBenchmark}
            </span>
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-md border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 p-3 text-xs text-rose-800 dark:text-rose-200"
          >
            {error}
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
              <span className="font-semibold text-cyan-700 dark:text-cyan-300">
                {passCount} / {results.length}{' '}
                {locale === 'fr' ? 'réussies' : 'passed'}
              </span>
              <span className="text-slate-500 dark:text-slate-400">
                max{' '}
                {Math.max(...results.map((r) => r.tookMs)).toFixed(2)} ms
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                    <th className="py-2 pr-3 font-mono">ID</th>
                    <th className="py-2 pr-3 font-semibold">
                      {locale === 'fr' ? 'Question' : 'Question'}
                    </th>
                    <th className="py-2 pr-3 font-mono">
                      {locale === 'fr' ? 'Statut attendu' : 'Expected'}
                    </th>
                    <th className="py-2 pr-3 font-mono">Passages</th>
                    <th className="py-2 pr-3 font-mono">ms</th>
                    <th className="py-2 font-semibold">Verdict</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {results.map((row) => (
                    <tr key={row.question.id}>
                      <td className="py-2 pr-3 font-mono font-semibold">
                        {row.question.id}
                      </td>
                      <td className="py-2 pr-3 max-w-md text-slate-800 dark:text-slate-200">
                        {row.question.question}
                      </td>
                      <td className="py-2 pr-3 font-mono text-slate-500 dark:text-slate-400">
                        {row.question.expectedStatus}
                      </td>
                      <td className="py-2 pr-3 font-mono tabular-nums">
                        {row.citedPassages} (min {row.question.expectedMinPassages})
                      </td>
                      <td className="py-2 pr-3 font-mono tabular-nums">
                        {row.tookMs}
                      </td>
                      <td className="py-2">
                        {row.passed ? (
                          <span className="inline-flex items-center gap-1 font-medium text-cyan-700 dark:text-cyan-300">
                            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>PASS</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-medium text-rose-700 dark:text-rose-300">
                            <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>FAIL</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Sources, Licenses, Safeguards, and Extensible i18n */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 space-y-3">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <FileText className="h-4 w-4 text-cyan-500" aria-hidden="true" />
            <span>
              {locale === 'fr'
                ? 'Sources, licences & transparence des données'
                : 'Sources, Licenses & Data Transparency'}
            </span>
          </h2>
          <ul className="space-y-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            <li>
              <strong>DONNÉES DE DÉMONSTRATION :</strong>{' '}
              {locale === 'fr'
                ? '24 publications synthétiques représentatives, 26 passages et 25 affirmations modélisées (CC-BY-4.0), structurées pour un corpus cible de 608 publications NASA OSDR. Aucun DOI réel n’est inventé.'
                : '24 representative synthetic publications, 26 passages, and 25 claims (CC-BY-4.0) structured for a 608-publication NASA OSDR target corpus. No real DOIs are fabricated.'}
            </li>
            <li>
              <strong>OpenAPI 3.1 :</strong>{' '}
              <a
                href="/api/v1/openapi.json"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-700 dark:text-cyan-400 hover:underline font-mono"
              >
                /api/v1/openapi.json
              </a>
            </li>
            <li className="flex items-start gap-2 text-amber-800 dark:text-amber-300">
              <Globe className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden="true" />
              <span>
                {locale === 'fr'
                  ? `Architecture i18n JSON extensible (${availableLocales.map((l) => l.code).join(', ')}) — ${missingLocaleKeys.length} clé(s) manquante(s) entre fr.json et en.json.`
                  : `Extensible JSON i18n architecture (${availableLocales.map((l) => l.code).join(', ')}) — ${missingLocaleKeys.length} missing key(s) between fr.json and en.json.`}
              </span>
            </li>
          </ul>
        </section>

        <section className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 space-y-3">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-500" aria-hidden="true" />
            <span>
              {locale === 'fr'
                ? 'Garde-fous scientifiques & éthiques actifs'
                : 'Active Scientific & Ethical Safeguards'}
            </span>
          </h2>
          <ul className="space-y-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300 list-disc pl-4">
            <li>
              {locale === 'fr'
                ? 'Traçabilité obligatoire : chaque affirmation et chaque phrase synthétisée renvoie à son identifiant de passage source.'
                : 'Mandatory traceability: every claim and synthesized sentence links back to its source passage ID.'}
            </li>
            <li>
              {locale === 'fr'
                ? 'Alerte automatique sur petits effectifs (n < 15), modèles animaux uniquement, corrélations non causales et affirmations non validées par un expert.'
                : 'Automatic flagging of small samples (n < 15), animal-only studies, non-causal correlations, and unvalidated claims.'}
            </li>
            <li>
              {locale === 'fr'
                ? 'Jumeau Mission : mention permanente « Piste à valider par des experts » et exclusion stricte de toute recommandation médicale individuelle.'
                : 'Mission Twin: permanent "Lead for expert validation" notice and strict exclusion of individual medical advice.'}
            </li>
            <li>
              {locale === 'fr'
                ? 'Indication explicite « Contenu traduit automatiquement » lorsque la traduction automatique est affichée.'
                : 'Explicit "Machine-translated content" notice whenever translated passages are shown.'}
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
