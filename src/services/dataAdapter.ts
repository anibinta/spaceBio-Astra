import {
  buildEvidenceCells,
  buildKnowledgeGraph,
  buildTimeline,
  summarizeBySystem,
} from '../domain/evidenceEngine';
import {
  filterClaims,
  filterEvidenceCells,
  paginate,
} from '../domain/filters';
import {
  buildExtractiveAnswer,
  buildSearchIndex,
  searchLocalIndex,
  type LocalSearchIndex,
} from '../domain/localSearch';
import { buildMissionRisks } from '../domain/missionTwinEngine';
import type {
  ApiMeta,
  BenchmarkQuestion,
  Claim,
  EvidenceCell,
  FilterState,
  GraphData,
  MissionPhase,
  MissionProfile,
  MissionRiskEntry,
  NaturalLanguageAnswer,
  OfflineIndexBundle,
  Passage,
  Publication,
  SearchHit,
  SystemEvidenceSummary,
  TimelinePoint,
} from '../domain/types';
import { apiClient, type ApiEnvelope, type HealthResponse } from './apiClient';
import {
  recordApiLatency,
  recordLocalSearchLatency,
  setActiveDataSource,
} from './diagnostics';
import {
  getStoredBenchmarkQuestions,
  getStoredOfflineBundle,
  saveBenchmarkQuestions,
  syncOfflineIndexFromServer,
  type StoredOfflineBundleRecord,
} from './offlineStore';

interface CompiledOfflineContext {
  version: string;
  bundle: OfflineIndexBundle;
  searchIndex: LocalSearchIndex;
  publicationsById: Map<string, Publication>;
  passagesById: Map<string, Passage>;
  passagesByPubId: Map<string, Passage[]>;
  claimsByPubId: Map<string, Claim[]>;
  claimsByCellId: Map<string, Claim[]>;
  cellsById: Map<string, EvidenceCell>;
}

let compiledContext: CompiledOfflineContext | null = null;
let simulatedOffline = false;
let lowDataMode = false;
const modeListeners = new Set<() => void>();

function notifyModeListeners() {
  for (const listener of modeListeners) listener();
}

export function isOfflineActive(): boolean {
  const navOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
  return simulatedOffline || navOffline;
}

export function getSimulatedOffline(): boolean {
  return simulatedOffline;
}

export function setSimulatedOffline(next: boolean): void {
  simulatedOffline = next;
  setActiveDataSource(isOfflineActive() ? 'indexeddb' : 'api');
  notifyModeListeners();
}

export function getLowDataMode(): boolean {
  return lowDataMode;
}

export function setLowDataMode(next: boolean): void {
  lowDataMode = next;
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('reduce-motion', next);
  }
  notifyModeListeners();
}

export function subscribeAdapterState(listener: () => void): () => void {
  modeListeners.add(listener);
  return () => modeListeners.delete(listener);
}

export function compileOfflineContext(
  bundle: OfflineIndexBundle,
): CompiledOfflineContext {
  if (compiledContext && compiledContext.version === bundle.version && compiledContext.bundle === bundle) {
    return compiledContext;
  }
  const publicationsById = new Map(bundle.publications.map((p) => [p.id, p]));
  const passagesById = new Map(bundle.passages.map((p) => [p.id, p]));
  const passagesByPubId = new Map<string, Passage[]>();
  const claimsByPubId = new Map<string, Claim[]>();
  const claimsByCellId = new Map<string, Claim[]>();

  for (const p of bundle.passages) {
    const arr = passagesByPubId.get(p.publicationId) ?? [];
    arr.push(p);
    passagesByPubId.set(p.publicationId, arr);
  }
  for (const c of bundle.claims) {
    const pubArr = claimsByPubId.get(c.publicationId) ?? [];
    pubArr.push(c);
    claimsByPubId.set(c.publicationId, pubArr);

    const cellId = `${c.biologicalSystem}__${c.spaceCondition}__${c.durationBucket}`;
    const cellArr = claimsByCellId.get(cellId) ?? [];
    cellArr.push(c);
    claimsByCellId.set(cellId, cellArr);
  }

  const cellsById = new Map(bundle.evidenceCells.map((c) => [c.id, c]));
  const searchIndex = buildSearchIndex(
    bundle.publications,
    bundle.passages,
    bundle.claims,
  );

  compiledContext = {
    version: bundle.version,
    bundle,
    searchIndex,
    publicationsById,
    passagesById,
    passagesByPubId,
    claimsByPubId,
    claimsByCellId,
    cellsById,
  };
  return compiledContext;
}

async function ensureCompiledContext(): Promise<CompiledOfflineContext> {
  if (compiledContext) return compiledContext;
  const stored = await getStoredOfflineBundle();
  if (stored) {
    return compileOfflineContext(stored.bundle);
  }
  if (!isOfflineActive()) {
    const { record } = await syncOfflineIndexFromServer();
    return compileOfflineContext(record.bundle);
  }
  throw new Error(
    'Index hors ligne non encore synchronisé. Reconnectez-vous brièvement pour télécharger le bundle local.',
  );
}

function makeOfflineMeta(
  ctx: CompiledOfflineContext,
  startedAt: number,
  extra?: Partial<ApiMeta>,
): ApiMeta {
  return {
    tookMs: Number((performance.now() - startedAt).toFixed(2)),
    requestId: 'local-idb',
    isDemoData: ctx.bundle.isDemoData,
    corpusTargetCount: ctx.bundle.corpusTargetCount,
    dataVersion: ctx.bundle.version,
    ...extra,
  };
}

async function runWithHybridFallback<T>(
  onlineCall: () => Promise<T>,
  offlineCall: (ctx: CompiledOfflineContext) => T | Promise<T>,
): Promise<T> {
  if (isOfflineActive()) {
    const ctx = await ensureCompiledContext();
    const start = performance.now();
    const result = await offlineCall(ctx);
    recordLocalSearchLatency(performance.now() - start, true);
    return result;
  }

  const start = performance.now();
  try {
    const res = await onlineCall();
    recordApiLatency(performance.now() - start);
    return res;
  } catch (err) {
    // Seamless offline fallback if network dropped mid-session
    const stored = await getStoredOfflineBundle();
    if (stored) {
      const ctx = compileOfflineContext(stored.bundle);
      const localStart = performance.now();
      const result = await offlineCall(ctx);
      recordLocalSearchLatency(performance.now() - localStart, true);
      return result;
    }
    throw err;
  }
}

export async function bootstrapOfflineCache(): Promise<StoredOfflineBundleRecord | null> {
  try {
    const existing = await getStoredOfflineBundle();
    if (isOfflineActive()) return existing;
    const { record } = await syncOfflineIndexFromServer({ force: !existing });
    compileOfflineContext(record.bundle);
    // Pre-cache benchmark questions for offline Diagnostics as well
    try {
      const bq = await apiClient.getBenchmarkQuestions();
      await saveBenchmarkQuestions(bq.data);
    } catch {
      // non-fatal
    }
    return record;
  } catch {
    return await getStoredOfflineBundle();
  }
}

export const dataAdapter = {
  async syncNow(force = true) {
    const res = await syncOfflineIndexFromServer({ force });
    compileOfflineContext(res.record.bundle);
    try {
      const bq = await apiClient.getBenchmarkQuestions();
      await saveBenchmarkQuestions(bq.data);
    } catch {
      // non-fatal
    }
    notifyModeListeners();
    return res;
  },

  async getHealth(): Promise<HealthResponse> {
    return runWithHybridFallback(
      () => apiClient.getHealth(),
      (ctx) => {
        const startedAt = performance.now();
        return {
          status: 'offline_ready',
          service: 'SpaceBio Atlas (IndexedDB Local)',
          synthesisMode: 'extractive_fallback',
          counts: {
            publications: ctx.bundle.publications.length,
            passages: ctx.bundle.passages.length,
            claims: ctx.bundle.claims.length,
            evidenceCells: ctx.bundle.evidenceCells.length,
            corpusTargetCount: ctx.bundle.corpusTargetCount,
          },
          offlineIndex: {
            version: ctx.bundle.version,
            jsonBytes: 0,
            gzipBytes: 0,
            sha256: 'local-indexeddb',
          },
          meta: makeOfflineMeta(ctx, startedAt),
        };
      },
    );
  },

  async getEvidenceCells(filters: FilterState = {}): Promise<
    ApiEnvelope<{
      cells: EvidenceCell[];
      systemSummary: SystemEvidenceSummary[];
    }>
  > {
    return runWithHybridFallback(
      () => apiClient.getEvidenceCells(filters),
      (ctx) => {
        const startedAt = performance.now();
        const hasClaimFilters = Boolean(
          filters.q ||
            filters.section ||
            filters.yearFrom !== undefined ||
            filters.yearTo !== undefined,
        );
        const baseClaims = hasClaimFilters
          ? filterClaims(
              ctx.bundle.claims,
              ctx.passagesById,
              ctx.publicationsById,
              filters,
            )
          : ctx.bundle.claims;
        const cells = hasClaimFilters
          ? buildEvidenceCells(baseClaims)
          : ctx.bundle.evidenceCells;
        const filteredCells = filterEvidenceCells(cells, filters);
        const systemSummary = summarizeBySystem(filteredCells);
        return {
          data: { cells: filteredCells, systemSummary },
          sourcePassageIds: Array.from(
            new Set(filteredCells.flatMap((c) => c.passageIds)),
          ),
          meta: makeOfflineMeta(ctx, startedAt, { total: filteredCells.length }),
        };
      },
    );
  },

  async getEvidenceCellDetail(cellId: string): Promise<
    ApiEnvelope<{
      cell: EvidenceCell;
      claims: Claim[];
      passages: Passage[];
      publications: Publication[];
    }>
  > {
    return runWithHybridFallback(
      () => apiClient.getEvidenceCellDetail(cellId),
      (ctx) => {
        const startedAt = performance.now();
        const cell = ctx.cellsById.get(cellId);
        if (!cell) {
          throw new Error(`Cellule '${cellId}' introuvable dans l'index local`);
        }
        const claims = ctx.claimsByCellId.get(cellId) ?? [];
        const passages = cell.passageIds
          .map((pid) => ctx.passagesById.get(pid))
          .filter((p): p is Passage => Boolean(p));
        const publications = cell.publicationIds
          .map((pubId) => ctx.publicationsById.get(pubId))
          .filter((p): p is Publication => Boolean(p));
        return {
          data: { cell, claims, passages, publications },
          sourcePassageIds: cell.passageIds,
          meta: makeOfflineMeta(ctx, startedAt),
        };
      },
    );
  },

  async getPublications(
    filters: FilterState = {},
    page = 1,
    pageSize = 20,
  ): Promise<ApiEnvelope<Publication[]>> {
    return runWithHybridFallback(
      () => apiClient.getPublications(filters, page, pageSize),
      (ctx) => {
        const startedAt = performance.now();
        const matchingClaims = filterClaims(
          ctx.bundle.claims,
          ctx.passagesById,
          ctx.publicationsById,
          filters,
        );
        const hasClaimFilters = Boolean(
          filters.system ||
            filters.condition ||
            filters.duration ||
            filters.section ||
            filters.q ||
            filters.yearFrom !== undefined ||
            filters.yearTo !== undefined,
        );
        const allowedPubIds = new Set(matchingClaims.map((c) => c.publicationId));
        const filteredPubs = ctx.bundle.publications.filter((pub) => {
          if (filters.yearFrom !== undefined && pub.year < filters.yearFrom) {
            return false;
          }
          if (filters.yearTo !== undefined && pub.year > filters.yearTo) {
            return false;
          }
          if (hasClaimFilters) {
            if (allowedPubIds.has(pub.id)) return true;
            if (filters.q) {
              const q = filters.q.toLowerCase();
              return (
                pub.title.toLowerCase().includes(q) ||
                (pub.titleFr?.toLowerCase().includes(q) ?? false) ||
                pub.keywords.some((k) => k.toLowerCase().includes(q))
              );
            }
            return false;
          }
          return true;
        });
        const paged = paginate(filteredPubs, page, pageSize);
        const sourcePassageIds = Array.from(
          new Set(
            paged.items.flatMap((pub) =>
              (ctx.passagesByPubId.get(pub.id) ?? []).map((p) => p.id),
            ),
          ),
        );
        return {
          data: paged.items,
          sourcePassageIds,
          meta: makeOfflineMeta(ctx, startedAt, {
            page: paged.page,
            pageSize: paged.pageSize,
            total: paged.total,
            totalPages: paged.totalPages,
          }),
        };
      },
    );
  },

  async getPublicationDetail(id: string): Promise<
    ApiEnvelope<{
      publication: Publication;
      passages: Passage[];
      claims: Claim[];
    }>
  > {
    return runWithHybridFallback(
      () => apiClient.getPublicationDetail(id),
      (ctx) => {
        const startedAt = performance.now();
        const publication = ctx.publicationsById.get(id);
        if (!publication) {
          throw new Error(`Publication '${id}' introuvable dans l'index local`);
        }
        const passages = ctx.passagesByPubId.get(id) ?? [];
        const claims = ctx.claimsByPubId.get(id) ?? [];
        return {
          data: { publication, passages, claims },
          sourcePassageIds: passages.map((p) => p.id),
          meta: makeOfflineMeta(ctx, startedAt),
        };
      },
    );
  },

  async searchPassages(
    filters: FilterState = {},
    page = 1,
    pageSize = 20,
  ): Promise<ApiEnvelope<SearchHit[]>> {
    return runWithHybridFallback(
      () => apiClient.searchPassages(filters, page, pageSize),
      (ctx) => {
        const startedAt = performance.now();
        const hits = searchLocalIndex(
          ctx.searchIndex,
          filters.q ?? '',
          filters,
          ctx.bundle.claims,
        );
        const paged = paginate(hits, page, pageSize);
        return {
          data: paged.items,
          sourcePassageIds: paged.items.map((h) => h.passage.id),
          meta: makeOfflineMeta(ctx, startedAt, {
            page: paged.page,
            pageSize: paged.pageSize,
            total: paged.total,
            totalPages: paged.totalPages,
          }),
        };
      },
    );
  },

  async searchLocalDirect(
    query: string,
    filters: FilterState = {},
    page = 1,
    pageSize = 20,
  ): Promise<ApiEnvelope<SearchHit[]>> {
    const ctx = await ensureCompiledContext();
    const startedAt = performance.now();
    const hits = searchLocalIndex(
      ctx.searchIndex,
      query,
      filters,
      ctx.bundle.claims,
    );
    const paged = paginate(hits, page, pageSize);
    const elapsed = performance.now() - startedAt;
    recordLocalSearchLatency(elapsed, isOfflineActive());
    return {
      data: paged.items,
      sourcePassageIds: paged.items.map((h) => h.passage.id),
      meta: makeOfflineMeta(ctx, startedAt, {
        page: paged.page,
        pageSize: paged.pageSize,
        total: paged.total,
        totalPages: paged.totalPages,
      }),
    };
  },

  async askNaturalLanguage(
    query: string,
    lang: 'fr' | 'en',
    filters: FilterState = {},
  ): Promise<ApiEnvelope<NaturalLanguageAnswer>> {
    // In offline mode or low-data mode, execute deterministic local extractive synthesis in <200ms
    if (isOfflineActive() || lowDataMode) {
      const ctx = await ensureCompiledContext();
      const startedAt = performance.now();
      const hits = searchLocalIndex(
        ctx.searchIndex,
        query,
        filters,
        ctx.bundle.claims,
      );
      const elapsed = performance.now() - startedAt;
      const answer = buildExtractiveAnswer(
        query,
        hits,
        lang,
        Number(elapsed.toFixed(2)),
        ctx.passagesById,
      );
      recordLocalSearchLatency(elapsed, isOfflineActive());
      return {
        data: answer,
        sourcePassageIds: answer.sourcePassageIds,
        meta: makeOfflineMeta(ctx, startedAt),
      };
    }

    return runWithHybridFallback(
      () => apiClient.askNaturalLanguage(query, lang, filters),
      (ctx) => {
        const startedAt = performance.now();
        const hits = searchLocalIndex(
          ctx.searchIndex,
          query,
          filters,
          ctx.bundle.claims,
        );
        const answer = buildExtractiveAnswer(
          query,
          hits,
          lang,
          Number((performance.now() - startedAt).toFixed(2)),
          ctx.passagesById,
        );
        return {
          data: answer,
          sourcePassageIds: answer.sourcePassageIds,
          meta: makeOfflineMeta(ctx, startedAt),
        };
      },
    );
  },

  async getMissionRisks(params: {
    profile: MissionProfile;
    durationDays: number;
    system?: string;
    phase?: MissionPhase | '';
  }): Promise<
    ApiEnvelope<{
      profile: MissionProfile;
      durationDays: number;
      disclaimer: string;
      risks: MissionRiskEntry[];
    }>
  > {
    return runWithHybridFallback(
      () => apiClient.getMissionRisks(params),
      (ctx) => {
        const startedAt = performance.now();
        const risks = buildMissionRisks(ctx.bundle.evidenceCells, {
          profile: params.profile,
          durationDays: params.durationDays,
          system: params.system as MissionRiskEntry['biologicalSystem'] | undefined,
          phase: params.phase || undefined,
        });
        return {
          data: {
            profile: params.profile,
            durationDays: params.durationDays,
            disclaimer:
              'Piste à valider par des experts — aucune recommandation médicale individuelle.',
            risks,
          },
          sourcePassageIds: Array.from(
            new Set(risks.flatMap((r) => r.sourcePassageIds)),
          ),
          meta: makeOfflineMeta(ctx, startedAt, { total: risks.length }),
        };
      },
    );
  },

  async getTimeline(filters: FilterState = {}): Promise<ApiEnvelope<TimelinePoint[]>> {
    return runWithHybridFallback(
      () => apiClient.getTimeline(filters),
      (ctx) => {
        const startedAt = performance.now();
        const matchingClaims = filterClaims(
          ctx.bundle.claims,
          ctx.passagesById,
          ctx.publicationsById,
          filters,
        );
        const matchingPubIds = new Set(matchingClaims.map((c) => c.publicationId));
        const pubs =
          filters.system ||
          filters.condition ||
          filters.duration ||
          filters.q ||
          filters.section
            ? ctx.bundle.publications.filter((p) => matchingPubIds.has(p.id))
            : ctx.bundle.publications.filter((p) => {
                if (filters.yearFrom !== undefined && p.year < filters.yearFrom) {
                  return false;
                }
                if (filters.yearTo !== undefined && p.year > filters.yearTo) {
                  return false;
                }
                return true;
              });
        const timeline = buildTimeline(pubs, matchingClaims, ctx.bundle.passages);
        return {
          data: timeline,
          sourcePassageIds: Array.from(
            new Set(timeline.flatMap((t) => t.passageIds)),
          ),
          meta: makeOfflineMeta(ctx, startedAt, { total: timeline.length }),
        };
      },
    );
  },

  async getGraph(filters: FilterState = {}): Promise<ApiEnvelope<GraphData>> {
    return runWithHybridFallback(
      () => apiClient.getGraph(filters),
      (ctx) => {
        const startedAt = performance.now();
        const matchingClaims = filterClaims(
          ctx.bundle.claims,
          ctx.passagesById,
          ctx.publicationsById,
          filters,
        );
        const graph = buildKnowledgeGraph(ctx.bundle.publications, matchingClaims, 120);
        return {
          data: graph,
          sourcePassageIds: graph.passageIds,
          meta: makeOfflineMeta(ctx, startedAt),
        };
      },
    );
  },

  async getBenchmarkQuestions(): Promise<ApiEnvelope<BenchmarkQuestion[]>> {
    return runWithHybridFallback(
      async () => {
        const res = await apiClient.getBenchmarkQuestions();
        await saveBenchmarkQuestions(res.data);
        return res;
      },
      async (ctx) => {
        const startedAt = performance.now();
        const cached = await getStoredBenchmarkQuestions();
        const list = cached ?? [];
        return {
          data: list,
          sourcePassageIds: Array.from(
            new Set(ctx.bundle.passages.map((p) => p.id)),
          ),
          meta: makeOfflineMeta(ctx, startedAt, { total: list.length }),
        };
      },
    );
  },
};
