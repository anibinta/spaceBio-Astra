import { filtersToSearchParams } from '../domain/filters';
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
  Passage,
  Publication,
  SearchHit,
  SystemEvidenceSummary,
  TimelinePoint,
} from '../domain/types';

export interface ApiEnvelope<T> {
  data: T;
  sourcePassageIds: string[];
  meta: ApiMeta;
}

export interface HealthResponse {
  status: string;
  service: string;
  synthesisMode: 'gemini_grounded' | 'extractive_fallback';
  counts: {
    publications: number;
    passages: number;
    claims: number;
    evidenceCells: number;
    corpusTargetCount: number;
  };
  offlineIndex: {
    version: string;
    jsonBytes: number;
    gzipBytes: number;
    sha256: string;
  };
  meta: ApiMeta;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    let message = `Erreur HTTP ${res.status}`;
    try {
      const errBody = (await res.json()) as { error?: { message?: string } };
      if (errBody?.error?.message) {
        message = errBody.error.message;
      }
    } catch {
      // ignore non-JSON body
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

export const apiClient = {
  getHealth(): Promise<HealthResponse> {
    return fetchJson<HealthResponse>('/api/v1/health');
  },

  getEvidenceCells(filters: FilterState = {}): Promise<
    ApiEnvelope<{
      cells: EvidenceCell[];
      systemSummary: SystemEvidenceSummary[];
    }>
  > {
    const qs = filtersToSearchParams(filters).toString();
    return fetchJson(`/api/v1/evidence-cells${qs ? `?${qs}` : ''}`);
  },

  getEvidenceCellDetail(cellId: string): Promise<
    ApiEnvelope<{
      cell: EvidenceCell;
      claims: Claim[];
      passages: Passage[];
      publications: Publication[];
    }>
  > {
    return fetchJson(`/api/v1/evidence-cells/${encodeURIComponent(cellId)}`);
  },

  getPublications(
    filters: FilterState = {},
    page = 1,
    pageSize = 20,
  ): Promise<ApiEnvelope<Publication[]>> {
    const params = filtersToSearchParams(filters);
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));
    return fetchJson(`/api/v1/publications?${params.toString()}`);
  },

  getPublicationDetail(id: string): Promise<
    ApiEnvelope<{
      publication: Publication;
      passages: Passage[];
      claims: Claim[];
    }>
  > {
    return fetchJson(`/api/v1/publications/${encodeURIComponent(id)}`);
  },

  searchPassages(
    filters: FilterState = {},
    page = 1,
    pageSize = 20,
  ): Promise<ApiEnvelope<SearchHit[]>> {
    const params = filtersToSearchParams(filters);
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));
    return fetchJson(`/api/v1/search?${params.toString()}`);
  },

  askNaturalLanguage(
    query: string,
    lang: 'fr' | 'en',
    filters: FilterState = {},
  ): Promise<ApiEnvelope<NaturalLanguageAnswer>> {
    return fetchJson('/api/v1/search/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, lang, filters }),
    });
  },

  getMissionRisks(params: {
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
    const qs = new URLSearchParams({
      profile: params.profile,
      durationDays: String(params.durationDays),
      ...(params.system ? { system: params.system } : {}),
      ...(params.phase ? { phase: params.phase } : {}),
    });
    return fetchJson(`/api/v1/mission-twin/risks?${qs.toString()}`);
  },

  getTimeline(filters: FilterState = {}): Promise<ApiEnvelope<TimelinePoint[]>> {
    const qs = filtersToSearchParams(filters).toString();
    return fetchJson(`/api/v1/timeline${qs ? `?${qs}` : ''}`);
  },

  getGraph(filters: FilterState = {}): Promise<ApiEnvelope<GraphData>> {
    const qs = filtersToSearchParams(filters).toString();
    return fetchJson(`/api/v1/graph${qs ? `?${qs}` : ''}`);
  },

  getBenchmarkQuestions(): Promise<ApiEnvelope<BenchmarkQuestion[]>> {
    return fetchJson('/api/v1/benchmark/questions');
  },
};
