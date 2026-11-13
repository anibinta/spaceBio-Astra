import {
  AlertTriangle,
  BookOpen,
  Search,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { NaturalLanguageAnswer } from '../../domain/types';
import {
  DIRECTION_LABELS,
  SECTION_LABELS,
  type Locale,
} from '../../i18n/labels';
import { dataAdapter, getLowDataMode, subscribeAdapterState } from '../../services/dataAdapter';
import { SkeletonBlock } from '../common/Skeleton';

interface NaturalLanguageSearchProps {
  locale: Locale;
  onOpenPublication: (publicationId: string, passageId?: string) => void;
}

const SAMPLE_QUERIES: Record<Locale, string[]> = {
  fr: [
    'La microgravité diminue-t-elle la densité osseuse entre 14 et 90 jours ?',
    'Y a-t-il une contradiction sur la perte osseuse entre 90 et 365 jours ?',
    'Que sait-on du microbiome intestinal sur les vols de longue durée ?',
    'Existe-t-il des preuves sur le régolithe lunaire et la cognition ?',
  ],
  en: [
    'Does microgravity decrease bone mineral density over 14-90 days?',
    'Are there contradictions in long-duration gut microbiome diversity?',
    'What is documented about ocular SANS markers in microgravity?',
    'Are there studies on lunar regolith and cognition?',
  ],
};

export function NaturalLanguageSearch({
  locale,
  onOpenPublication,
}: NaturalLanguageSearchProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<NaturalLanguageAnswer | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lowData, setLowData] = useState(getLowDataMode());
  const speechSupported =
    !lowData && typeof window !== 'undefined' && 'speechSynthesis' in window;

  useEffect(() => {
    return subscribeAdapterState(() => setLowData(getLowDataMode()));
  }, []);

  useEffect(() => {
    return () => {
      if (speechSupported) {
        window.speechSynthesis.cancel();
      }
    };
  }, [speechSupported]);

  const runQuery = async (textToAsk: string) => {
    const trimmed = textToAsk.trim();
    if (trimmed.length < 2) {
      setError(
        locale === 'fr'
          ? 'Veuillez saisir une question d’au moins 2 caractères.'
          : 'Please enter a question of at least 2 characters.',
      );
      return;
    }
    setQuery(trimmed);
    setError(null);
    setLoading(true);
    if (speechSupported) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }

    try {
      const res = await dataAdapter.askNaturalLanguage(trimmed, locale);
      setAnswer(res.data);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : locale === 'fr'
            ? 'Erreur lors de la recherche.'
            : 'Search error.',
      );
    } finally {
      setLoading(false);
    }
  };

  const toggleAudio = () => {
    if (!speechSupported || !answer) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    const text = answer.sentences.map((s) => s.text).join('. ');
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = locale === 'fr' ? 'fr-FR' : 'en-US';
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const findPubIdForPassage = (passageId: string): string | null => {
    if (!answer) return null;
    const all = [...answer.supportingPassages, ...answer.contradictingPassages];
    const match = all.find((item) => item.passage.id === passageId);
    return match?.publication.id ?? null;
  };

  return (
    <section
      aria-labelledby="nl-search-heading"
      className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6 space-y-5"
    >
      <div className="space-y-1">
        <h2
          id="nl-search-heading"
          className="text-lg font-semibold text-slate-900 dark:text-slate-50"
        >
          {locale === 'fr'
            ? 'Recherche scientifique en langage naturel'
            : 'Natural-Language Evidence Search'}
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {locale === 'fr'
            ? 'Chaque phrase générée ou extraite renvoie directement à son passage source et distingue les études favorables des résultats contradictoires.'
            : 'Every generated or extracted sentence links directly to its source passage and separates supporting from contradicting studies.'}
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void runQuery(query);
        }}
        className="flex flex-col sm:flex-row gap-3"
      >
        <label htmlFor="nl-search-input" className="sr-only">
          {locale === 'fr'
            ? 'Posez une question de recherche en biologie spatiale'
            : 'Ask a space biology research question'}
        </label>
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
            aria-hidden="true"
          />
          <input
            id="nl-search-input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              locale === 'fr'
                ? 'Ex. : La microgravité réduit-elle la densité osseuse entre 14 et 90 jours ?'
                : 'e.g., Does microgravity reduce bone mineral density over 14-90 days?'
            }
            className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-cyan-600 hover:bg-cyan-700 disabled:opacity-60 px-5 py-2.5 text-sm font-semibold text-white transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          <span>
            {loading
              ? locale === 'fr'
                ? 'Analyse…'
                : 'Searching…'
              : locale === 'fr'
                ? 'Interroger les preuves'
                : 'Query Evidence'}
          </span>
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {locale === 'fr' ? 'Questions rapides :' : 'Sample queries:'}
        </span>
        {SAMPLE_QUERIES[locale].map((sample) => (
          <button
            key={sample}
            type="button"
            onClick={() => void runQuery(sample)}
            className="rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-2.5 py-1 text-xs text-slate-700 dark:text-slate-300 hover:border-cyan-500 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors text-left"
          >
            {sample}
          </button>
        ))}
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-md border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 p-3 text-sm text-rose-800 dark:text-rose-200"
        >
          {error}
        </div>
      )}

      {loading && (
        <div className="space-y-3 pt-2">
          <SkeletonBlock className="h-5 w-1/3" />
          <SkeletonBlock className="h-20 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SkeletonBlock className="h-32 w-full" />
            <SkeletonBlock className="h-32 w-full" />
          </div>
        </div>
      )}

      {answer && !loading && (
        <div className="border-t border-slate-200 dark:border-slate-800 pt-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {answer.mode === 'gemini_grounded'
                  ? locale === 'fr'
                    ? 'Synthèse ancrée sur passages'
                    : 'Grounded Passage Synthesis'
                  : locale === 'fr'
                    ? 'Mode extractif direct (passages vérifiés)'
                    : 'Direct Extractive Mode (verified passages)'}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {answer.sourcePassageIds.length}{' '}
                {locale === 'fr' ? 'passages cités' : 'cited passages'}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{answer.tookMs} ms</span>
            </div>

            {speechSupported && answer.sentences.length > 0 && (
              <button
                type="button"
                onClick={toggleAudio}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
              >
                {isSpeaking ? (
                  <VolumeX className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span>
                  {isSpeaking
                    ? locale === 'fr'
                      ? 'Arrêter la lecture'
                      : 'Stop Audio'
                    : locale === 'fr'
                      ? 'Résumé audio'
                      : 'Audio Summary'}
                </span>
              </button>
            )}
          </div>

          <div className="rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 p-4 space-y-2.5">
            {answer.sentences.map((sentence, idx) => (
              <p
                key={idx}
                className="text-sm leading-relaxed text-slate-800 dark:text-slate-200"
              >
                <span>{sentence.text} </span>
                {sentence.passageIds.map((pid) => {
                  const pubId = findPubIdForPassage(pid);
                  return (
                    <button
                      key={pid}
                      type="button"
                      onClick={() => pubId && onOpenPublication(pubId, pid)}
                      disabled={!pubId}
                      className="ml-1 inline-flex items-center font-mono text-xs font-medium text-cyan-700 dark:text-cyan-400 hover:underline focus-visible:outline-2 focus-visible:outline-cyan-500"
                    >
                      [{pid}]
                    </button>
                  );
                })}
              </p>
            ))}
          </div>

          {(answer.safeguards.hasSmallSample ||
            answer.safeguards.hasAnimalModelsOnly ||
            answer.safeguards.hasCorrelationOnly ||
            answer.safeguards.hasLowConfidence ||
            answer.safeguards.hasUnvalidatedClaims) && (
            <div className="flex items-start gap-2.5 rounded-md border border-amber-300 dark:border-amber-800/80 bg-amber-50/70 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200">
              <AlertTriangle
                className="h-4 w-4 mt-0.5 shrink-0"
                aria-hidden="true"
              />
              <div className="space-y-1">
                <p className="font-semibold">
                  {locale === 'fr'
                    ? 'Garde-fous scientifiques détectés :'
                    : 'Scientific safeguards detected:'}
                </p>
                <p>
                  {[
                    answer.safeguards.hasSmallSample
                      ? locale === 'fr'
                        ? 'Petits effectifs (n < 15)'
                        : 'Small sample sizes (n < 15)'
                      : null,
                    answer.safeguards.hasAnimalModelsOnly
                      ? locale === 'fr'
                        ? 'Modèles animaux uniquement'
                        : 'Animal models only'
                      : null,
                    answer.safeguards.hasCorrelationOnly
                      ? locale === 'fr'
                        ? 'Corrélation / observation (causalité non établie)'
                        : 'Correlation / observational only (causation not established)'
                      : null,
                    answer.safeguards.hasLowConfidence
                      ? locale === 'fr'
                        ? 'Score de confiance faible (< 65%)'
                        : 'Low confidence score (< 65%)'
                      : null,
                    answer.safeguards.hasUnvalidatedClaims
                      ? locale === 'fr'
                        ? 'Contient des affirmations non validées par un expert'
                        : 'Includes claims pending human expert validation'
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-md border border-slate-200 dark:border-slate-800 p-4 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-cyan-800 dark:text-cyan-300">
                {locale === 'fr'
                  ? `Passages favorables / principaux (${answer.supportingPassages.length})`
                  : `Supporting / Primary Passages (${answer.supportingPassages.length})`}
              </h3>
              {answer.supportingPassages.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {locale === 'fr'
                    ? 'Aucun passage favorable identifié.'
                    : 'No supporting passages identified.'}
                </p>
              ) : (
                <ul className="space-y-3">
                  {answer.supportingPassages.map((item) => (
                    <li
                      key={item.passage.id}
                      className="border-t border-slate-100 dark:border-slate-800/80 pt-2.5 first:border-t-0 first:pt-0 space-y-1"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-slate-500 dark:text-slate-400">
                        <span>
                          {item.passage.id} ·{' '}
                          {SECTION_LABELS[locale][item.passage.section]} ·{' '}
                          {item.publication.year}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            onOpenPublication(
                              item.publication.id,
                              item.passage.id,
                            )
                          }
                          className="inline-flex items-center gap-1 font-sans font-medium text-cyan-700 dark:text-cyan-400 hover:underline"
                        >
                          <BookOpen className="h-3 w-3" aria-hidden="true" />
                          <span>{item.publication.id}</span>
                        </button>
                      </div>
                      <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                        {locale === 'fr'
                          ? item.passage.textFr ?? item.passage.text
                          : item.passage.text}
                      </p>
                      {item.claims[0] && (
                        <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                          {DIRECTION_LABELS[locale][item.claims[0].effectDirection]}{' '}
                          · n = {item.claims[0].sampleSize ?? '?'}{' '}
                          {item.claims[0].sampleUnit} ·{' '}
                          {item.claims[0].organism}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-md border border-slate-200 dark:border-slate-800 p-4 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-rose-800 dark:text-rose-300">
                {locale === 'fr'
                  ? `Passages contradictoires ou nuancés (${answer.contradictingPassages.length})`
                  : `Contradicting or Nuanced Passages (${answer.contradictingPassages.length})`}
              </h3>
              {answer.contradictingPassages.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {locale === 'fr'
                    ? 'Aucune contradiction directe détectée parmi les meilleurs résultats.'
                    : 'No direct contradiction detected among top hits.'}
                </p>
              ) : (
                <ul className="space-y-3">
                  {answer.contradictingPassages.map((item) => (
                    <li
                      key={item.passage.id}
                      className="border-t border-slate-100 dark:border-slate-800/80 pt-2.5 first:border-t-0 first:pt-0 space-y-1"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-slate-500 dark:text-slate-400">
                        <span>
                          {item.passage.id} ·{' '}
                          {SECTION_LABELS[locale][item.passage.section]} ·{' '}
                          {item.publication.year}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            onOpenPublication(
                              item.publication.id,
                              item.passage.id,
                            )
                          }
                          className="inline-flex items-center gap-1 font-sans font-medium text-cyan-700 dark:text-cyan-400 hover:underline"
                        >
                          <BookOpen className="h-3 w-3" aria-hidden="true" />
                          <span>{item.publication.id}</span>
                        </button>
                      </div>
                      <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                        {locale === 'fr'
                          ? item.passage.textFr ?? item.passage.text
                          : item.passage.text}
                      </p>
                      {item.claims[0] && (
                        <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                          {DIRECTION_LABELS[locale][item.claims[0].effectDirection]}{' '}
                          · n = {item.claims[0].sampleSize ?? '?'}{' '}
                          {item.claims[0].sampleUnit} ·{' '}
                          {item.claims[0].organism}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
