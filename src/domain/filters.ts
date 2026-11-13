import type {
  BiologicalSystem,
  Claim,
  DurationBucket,
  EvidenceCell,
  EvidenceStatus,
  FilterState,
  Passage,
  PassageSection,
  Publication,
  SpaceCondition,
} from './types';

export function filterClaims(
  claims: Claim[],
  passagesById: Map<string, Passage>,
  publicationsById: Map<string, Publication>,
  filters: FilterState,
): Claim[] {
  const q = filters.q?.trim().toLowerCase() ?? '';
  return claims.filter((claim) => {
    if (filters.system && claim.biologicalSystem !== filters.system) return false;
    if (filters.condition && claim.spaceCondition !== filters.condition) return false;
    if (filters.duration && claim.durationBucket !== filters.duration) return false;
    if (filters.yearFrom !== undefined && claim.year < filters.yearFrom) return false;
    if (filters.yearTo !== undefined && claim.year > filters.yearTo) return false;

    const passage = passagesById.get(claim.passageId);
    if (filters.section && (!passage || passage.section !== filters.section)) {
      return false;
    }

    if (q) {
      const pub = publicationsById.get(claim.publicationId);
      const haystack = [
        claim.statement,
        claim.statementFr ?? '',
        claim.organism,
        claim.biologicalSystem,
        claim.spaceCondition,
        passage?.text ?? '',
        passage?.textFr ?? '',
        pub?.title ?? '',
        pub?.titleFr ?? '',
        ...(pub?.keywords ?? []),
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    return true;
  });
}

export function filterEvidenceCells(
  cells: EvidenceCell[],
  filters: FilterState,
): EvidenceCell[] {
  return cells.filter((cell) => {
    if (filters.system && cell.biologicalSystem !== filters.system) return false;
    if (filters.condition && cell.spaceCondition !== filters.condition) return false;
    if (filters.duration && cell.durationBucket !== filters.duration) return false;
    if (filters.status && cell.status !== filters.status) return false;
    return true;
  });
}

export function filtersToSearchParams(filters: FilterState): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.system) params.set('system', filters.system);
  if (filters.condition) params.set('condition', filters.condition);
  if (filters.duration) params.set('duration', filters.duration);
  if (filters.yearFrom !== undefined) params.set('yearFrom', String(filters.yearFrom));
  if (filters.yearTo !== undefined) params.set('yearTo', String(filters.yearTo));
  if (filters.section) params.set('section', filters.section);
  if (filters.status) params.set('status', filters.status);
  if (filters.lang) params.set('lang', filters.lang);
  return params;
}

export function searchParamsToFilters(params: URLSearchParams): FilterState {
  const yearFromRaw = params.get('yearFrom');
  const yearToRaw = params.get('yearTo');
  const yearFrom = yearFromRaw ? Number(yearFromRaw) : undefined;
  const yearTo = yearToRaw ? Number(yearToRaw) : undefined;
  const langParam = params.get('lang');

  return {
    q: params.get('q') ?? undefined,
    system: (params.get('system') as BiologicalSystem | null) ?? undefined,
    condition: (params.get('condition') as SpaceCondition | null) ?? undefined,
    duration: (params.get('duration') as DurationBucket | null) ?? undefined,
    yearFrom: Number.isFinite(yearFrom) ? yearFrom : undefined,
    yearTo: Number.isFinite(yearTo) ? yearTo : undefined,
    section: (params.get('section') as PassageSection | null) ?? undefined,
    status: (params.get('status') as EvidenceStatus | null) ?? undefined,
    lang: langParam === 'fr' || langParam === 'en' ? langParam : undefined,
  };
}

export function paginate<T>(items: T[], page = 1, pageSize = 20) {
  const safePageSize = Math.max(1, Math.min(100, pageSize));
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const safePage = Math.max(1, Math.min(totalPages, page));
  const start = (safePage - 1) * safePageSize;
  return {
    items: items.slice(start, start + safePageSize),
    page: safePage,
    pageSize: safePageSize,
    total,
    totalPages,
  };
}
