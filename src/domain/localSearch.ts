import { detectClaimSafeguards } from './evidenceEngine';
import { filterClaims } from './filters';
import type {
  AnswerSentence,
  Claim,
  FilterState,
  NaturalLanguageAnswer,
  Passage,
  Publication,
  SearchHit,
} from './types';

const STOP_WORDS = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'et', 'ou', 'en', 'dans',
  'pour', 'par', 'sur', 'avec', 'sans', 'est', 'sont', 'il', 'elle', 'ce', 'qui',
  'que', 'quoi', 'quel', 'quelle', 'quels', 'quelles', 'comment', 'au', 'aux',
  'the', 'a', 'an', 'and', 'or', 'in', 'on', 'for', 'by', 'with', 'without',
  'is', 'are', 'does', 'do', 'what', 'how', 'of', 'to', 'from', 'at', 'as',
]);

// Bilingual scientific synonym expansion so FR queries match EN/FR passages deterministically
const SYNONYM_MAP: Record<string, string[]> = {
  os: ['bone', 'osseuse', 'osseux', 'osteocyte', 'bmd', 'trabecular', 'skeletal', 'densite'],
  osseuse: ['bone', 'os', 'bmd', 'trabecular', 'densite'],
  bone: ['os', 'osseuse', 'bmd', 'trabecular', 'skeletal'],
  muscle: ['musculaire', 'myofiber', 'atrophy', 'atrophie', 'soleus', 'sarcopenia'],
  musculaire: ['muscle', 'atrophy', 'atrophie', 'soleus'],
  immunitaire: ['immune', 't-cell', 'cytokine', 'lymphocyte', 'immunosuppression'],
  immune: ['immunitaire', 't-cell', 'cytokine', 'lymphocyte'],
  vision: ['ocular', 'sans', 'optic', 'retinal', 'eye', 'oculaire', 'retine'],
  oculaire: ['vision', 'ocular', 'sans', 'optic', 'retinal'],
  cognition: ['cognitive', 'neuroplasticity', 'hippocampus', 'memory', 'memoire', 'cerveau'],
  cognitive: ['cognition', 'neuroplasticity', 'memory'],
  microbiome: ['microbiote', 'gut', 'intestinal', 'dysbiosis', 'dysbiose'],
  microbiote: ['microbiome', 'gut', 'intestinal'],
  cardiovasculaire: ['cardiovascular', 'vascular', 'arterial', 'endothelial', 'heart'],
  cardiovascular: ['cardiovasculaire', 'vascular', 'arterial'],
  microgravite: ['microgravity', 'weightlessness', 'apesanteur', 'iss', 'spaceflight'],
  microgravity: ['microgravite', 'weightlessness', 'iss', 'spaceflight'],
  radiation: ['radiations', 'gcr', 'cosmic', 'ionizing', 'rayonnements'],
  radiations: ['radiation', 'gcr', 'cosmic', 'ionizing'],
  regolithe: ['regolith', 'lunar', 'lunaire', 'dust', 'poussiere'],
  regolith: ['regolithe', 'lunar', 'dust'],
  lunaire: ['lunar', 'moon', 'lune', 'regolith'],
  lunar: ['lunaire', 'moon', 'lune', 'regolith'],
  mars: ['martian', 'deep_space_gt_365d', 'transit'],
  longue: ['long', '90', '180', '365', 'deep_space'],
  courte: ['short', '14'],
};

export function tokenize(text: string): string[] {
  const normalized = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_>-]+/g, ' ')
    .trim();

  if (!normalized) return [];
  return normalized
    .split(/\s+/)
    .filter((tok) => tok.length >= 2 && !STOP_WORDS.has(tok));
}

export function expandQueryTokens(tokens: string[]): string[] {
  const expanded = new Set<string>(tokens);
  for (const tok of tokens) {
    const syns = SYNONYM_MAP[tok];
    if (syns) {
      for (const s of syns) expanded.add(s);
    }
  }
  return Array.from(expanded);
}

export interface SearchIndexDoc {
  passageId: string;
  publicationId: string;
  tokens: Map<string, number>;
  length: number;
}

export interface LocalSearchIndex {
  docs: SearchIndexDoc[];
  df: Map<string, number>;
  avgDocLength: number;
  publicationsById: Map<string, Publication>;
  passagesById: Map<string, Passage>;
  claimsByPassageId: Map<string, Claim[]>;
}

export function buildSearchIndex(
  publications: Publication[],
  passages: Passage[],
  claims: Claim[],
): LocalSearchIndex {
  const publicationsById = new Map(publications.map((p) => [p.id, p]));
  const passagesById = new Map(passages.map((p) => [p.id, p]));
  const claimsByPassageId = new Map<string, Claim[]>();

  for (const c of claims) {
    const arr = claimsByPassageId.get(c.passageId) ?? [];
    arr.push(c);
    claimsByPassageId.set(c.passageId, arr);
  }

  const df = new Map<string, number>();
  const docs: SearchIndexDoc[] = [];
  let totalLength = 0;

  for (const passage of passages) {
    const pub = publicationsById.get(passage.publicationId);
    const passageClaims = claimsByPassageId.get(passage.id) ?? [];
    const combinedText = [
      passage.text,
      passage.textFr ?? '',
      passage.section,
      pub?.title ?? '',
      pub?.titleFr ?? '',
      ...(pub?.keywords ?? []),
      ...passageClaims.map((c) =>
        [
          c.statement,
          c.statementFr ?? '',
          c.organism,
          c.biologicalSystem,
          c.spaceCondition,
          c.durationBucket,
          c.effectDirection,
        ].join(' '),
      ),
    ].join(' ');

    const tokensList = tokenize(combinedText);
    const tf = new Map<string, number>();
    for (const t of tokensList) {
      tf.set(t, (tf.get(t) ?? 0) + 1);
    }
    for (const uniqueTok of tf.keys()) {
      df.set(uniqueTok, (df.get(uniqueTok) ?? 0) + 1);
    }

    totalLength += tokensList.length;
    docs.push({
      passageId: passage.id,
      publicationId: passage.publicationId,
      tokens: tf,
      length: tokensList.length,
    });
  }

  return {
    docs,
    df,
    avgDocLength: docs.length > 0 ? totalLength / docs.length : 1,
    publicationsById,
    passagesById,
    claimsByPassageId,
  };
}

export function searchLocalIndex(
  index: LocalSearchIndex,
  query: string,
  filters: FilterState = {},
  claimsList?: Claim[],
): SearchHit[] {
  const rawTokens = tokenize(query);
  const queryTokens = expandQueryTokens(rawTokens);
  const N = Math.max(1, index.docs.length);
  const k1 = 1.4;
  const b = 0.75;

  // Determine allowed passages via combinable filters (excluding q so BM25 ranks q)
  const filterWithoutQ: FilterState = { ...filters, q: undefined };
  let allowedPassageIds: Set<string> | null = null;
  const hasStructuralFilter = Boolean(
    filterWithoutQ.system ||
      filterWithoutQ.condition ||
      filterWithoutQ.duration ||
      filterWithoutQ.yearFrom !== undefined ||
      filterWithoutQ.yearTo !== undefined ||
      filterWithoutQ.section,
  );

  if (hasStructuralFilter) {
    const allClaims =
      claimsList ?? Array.from(index.claimsByPassageId.values()).flat();
    const matchingClaims = filterClaims(
      allClaims,
      index.passagesById,
      index.publicationsById,
      filterWithoutQ,
    );
    allowedPassageIds = new Set(matchingClaims.map((c) => c.passageId));
    // Also filter passages directly by section/year if no claims exist on passage
    if (filterWithoutQ.section) {
      for (const p of index.passagesById.values()) {
        if (p.section !== filterWithoutQ.section) {
          allowedPassageIds.delete(p.id);
        }
      }
    }
  }

  const hits: SearchHit[] = [];

  for (const doc of index.docs) {
    if (allowedPassageIds && !allowedPassageIds.has(doc.passageId)) {
      continue;
    }

    const passage = index.passagesById.get(doc.passageId);
    const publication = index.publicationsById.get(doc.publicationId);
    if (!passage || !publication) continue;

    const claims = index.claimsByPassageId.get(doc.passageId) ?? [];

    if (queryTokens.length === 0) {
      hits.push({
        publication,
        passage,
        claims,
        score: 1,
        matchedTerms: [],
      });
      continue;
    }

    let score = 0;
    const matchedTerms: string[] = [];

    for (const term of queryTokens) {
      const tf = doc.tokens.get(term) ?? 0;
      if (tf === 0) continue;
      const docFreq = index.df.get(term) ?? 0;
      const idf = Math.log(1 + (N - docFreq + 0.5) / (docFreq + 0.5));
      const norm = tf * (k1 + 1) / (tf + k1 * (1 - b + (b * doc.length) / index.avgDocLength));
      const exactBoost = rawTokens.includes(term) ? 1.5 : 0.7;
      score += idf * norm * exactBoost;
      matchedTerms.push(term);
    }

    if (score > 0) {
      hits.push({
        publication,
        passage,
        claims,
        score: Number(score.toFixed(4)),
        matchedTerms: Array.from(new Set(matchedTerms)),
      });
    }
  }

  return hits.sort((a, bHit) => bHit.score - a.score);
}

export function buildExtractiveAnswer(
  query: string,
  hits: SearchHit[],
  lang: 'fr' | 'en',
  tookMs: number,
  passagesById: Map<string, Passage>,
): NaturalLanguageAnswer {
  const topHits = hits.slice(0, 6);
  const allClaims = topHits.flatMap((h) => h.claims);
  const safeguardsRaw = detectClaimSafeguards(allClaims, passagesById);

  const supportingPassages: NaturalLanguageAnswer['supportingPassages'] = [];
  const contradictingPassages: NaturalLanguageAnswer['contradictingPassages'] = [];

  // Dominant direction among top hits
  const dirCounts = { increase: 0, decrease: 0, no_effect: 0, inconclusive: 0 };
  for (const c of allClaims) {
    dirCounts[c.effectDirection]++;
  }
  const dominantDir = (
    Object.entries(dirCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'inconclusive'
  ) as keyof typeof dirCounts;

  for (const hit of topHits) {
    const hasOpposing = hit.claims.some(
      (c) =>
        c.effectDirection !== dominantDir &&
        (c.effectDirection === 'increase' ||
          c.effectDirection === 'decrease' ||
          c.effectDirection === 'no_effect'),
    );
    const entry = {
      passage: hit.passage,
      publication: hit.publication,
      claims: hit.claims,
    };
    if (hasOpposing) {
      contradictingPassages.push(entry);
    } else {
      supportingPassages.push(entry);
    }
  }

  const sentences: AnswerSentence[] = [];
  if (topHits.length === 0) {
    sentences.push({
      text:
        lang === 'fr'
          ? `Aucune preuve documentée ne correspond directement à « ${query} » dans l'index actuel (zone de lacune potentielle).`
          : `No documented evidence directly matches "${query}" in the current index (potential research gap).`,
      passageIds: [],
      supportType: 'gap',
    });
  } else {
    for (const item of supportingPassages.slice(0, 2)) {
      const claim = item.claims[0];
      const textBody =
        lang === 'fr'
          ? claim?.statementFr ?? item.passage.textFr ?? item.passage.text
          : claim?.statement ?? item.passage.text;
      sentences.push({
        text: `${textBody} (${item.publication.id}, ${item.passage.section})`,
        passageIds: [item.passage.id],
        supportType: 'supporting',
      });
    }
    for (const item of contradictingPassages.slice(0, 2)) {
      const claim = item.claims[0];
      const textBody =
        lang === 'fr'
          ? claim?.statementFr ?? item.passage.textFr ?? item.passage.text
          : claim?.statement ?? item.passage.text;
      sentences.push({
        text:
          lang === 'fr'
            ? `Résultat divergent ou nuancé : ${textBody} (${item.publication.id}, ${item.passage.section})`
            : `Divergent or nuanced finding: ${textBody} (${item.publication.id}, ${item.passage.section})`,
        passageIds: [item.passage.id],
        supportType: 'contradicting',
      });
    }
  }

  const sourcePassageIds = Array.from(new Set(topHits.map((h) => h.passage.id)));

  return {
    query,
    mode: 'extractive_fallback',
    lang,
    sentences,
    supportingPassages,
    contradictingPassages,
    sourcePassageIds,
    safeguards: {
      hasLowConfidence: safeguardsRaw.hasLowConfidence,
      hasSmallSample: safeguardsRaw.hasSmallSample,
      hasAnimalModelsOnly: safeguardsRaw.hasAnimalModelsOnly,
      hasCorrelationOnly: safeguardsRaw.hasCorrelationOnly,
      hasUnvalidatedClaims: safeguardsRaw.hasUnvalidatedClaims,
    },
    tookMs,
  };
}
