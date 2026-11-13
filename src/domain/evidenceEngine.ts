import type {
  BiologicalSystem,
  Claim,
  DirectionBreakdown,
  DurationBucket,
  EvidenceCell,
  EvidenceStatus,
  GraphData,
  GraphEdge,
  GraphNode,
  Passage,
  Publication,
  SpaceCondition,
  SystemEvidenceSummary,
  TimelinePoint,
} from './types';

export const BIOLOGICAL_SYSTEMS: BiologicalSystem[] = [
  'bone',
  'muscle',
  'immune',
  'vision',
  'cognition',
  'microbiome',
  'cardiovascular',
];

export const SPACE_CONDITIONS: SpaceCondition[] = [
  'microgravity',
  'simulated_microgravity',
  'space_radiation',
  'lunar_regolith',
  'combined_stress',
  'isolation_confinement',
  'hypergravity',
];

export const DURATION_BUCKETS: DurationBucket[] = [
  'short_lt_14d',
  'medium_14_90d',
  'long_90_365d',
  'deep_space_gt_365d',
];

export function durationDaysToBucket(days: number): DurationBucket {
  if (days < 14) return 'short_lt_14d';
  if (days <= 90) return 'medium_14_90d';
  if (days <= 365) return 'long_90_365d';
  return 'deep_space_gt_365d';
}

export function computeCellStatus(
  claims: Claim[],
  publicationIds: string[],
): EvidenceStatus {
  if (claims.length === 0 || publicationIds.length === 0) {
    return 'empty';
  }
  if (publicationIds.length === 1) {
    return 'single_replication';
  }

  let increase = 0;
  let decrease = 0;
  let noEffect = 0;
  for (const c of claims) {
    if (c.effectDirection === 'increase') increase++;
    else if (c.effectDirection === 'decrease') decrease++;
    else if (c.effectDirection === 'no_effect') noEffect++;
  }

  const directionalTotal = increase + decrease + noEffect;
  if (directionalTotal === 0) {
    return 'contradiction';
  }

  // Opposite directional effects across >= 2 publications
  if (increase > 0 && decrease > 0) {
    return 'contradiction';
  }

  const dominant = Math.max(increase, decrease, noEffect);
  const ratio = dominant / directionalTotal;
  if (ratio >= 0.75) {
    return 'consensus';
  }
  return 'contradiction';
}

export function detectClaimSafeguards(claims: Claim[], passagesById: Map<string, Passage>) {
  const hasLowConfidence = claims.some((c) => c.confidenceScore < 0.65);
  const hasSmallSample = claims.some((c) => c.sampleSize !== null && c.sampleSize < 15);
  const hasAnimalModelsOnly =
    claims.length > 0 && claims.every((c) => c.isModelOrganism);
  const hasCorrelationOnly =
    claims.length > 0 && claims.every((c) => c.relationType !== 'causation');
  const hasUnvalidatedClaims = claims.some((c) => !c.humanValidated);
  const hasAuthorInterpretations = claims.some((c) => {
    const p = passagesById.get(c.passageId);
    return p ? p.isAuthorInterpretation : false;
  });

  return {
    hasLowConfidence,
    hasSmallSample,
    hasAnimalModelsOnly,
    hasCorrelationOnly,
    hasUnvalidatedClaims,
    hasAuthorInterpretations,
  };
}

export function buildEvidenceCells(
  claims: Claim[],
  options?: {
    systems?: BiologicalSystem[];
    conditions?: SpaceCondition[];
    durations?: DurationBucket[];
  },
): EvidenceCell[] {
  const systems = options?.systems ?? BIOLOGICAL_SYSTEMS;
  const conditions = options?.conditions ?? SPACE_CONDITIONS;
  const durations = options?.durations ?? DURATION_BUCKETS;

  const grouped = new Map<string, Claim[]>();
  for (const claim of claims) {
    const key = `${claim.biologicalSystem}__${claim.spaceCondition}__${claim.durationBucket}`;
    const list = grouped.get(key) ?? [];
    list.push(claim);
    grouped.set(key, list);
  }

  const cells: EvidenceCell[] = [];
  for (const biologicalSystem of systems) {
    for (const spaceCondition of conditions) {
      for (const durationBucket of durations) {
        const id = `${biologicalSystem}__${spaceCondition}__${durationBucket}`;
        const cellClaims = grouped.get(id) ?? [];

        const publicationIds = Array.from(new Set(cellClaims.map((c) => c.publicationId)));
        const passageIds = Array.from(new Set(cellClaims.map((c) => c.passageId)));
        const claimIds = cellClaims.map((c) => c.id);

        // Sum unique subjects per publication to avoid double-counting multiple claims from same study
        const subjectsPerPub = new Map<string, number>();
        for (const c of cellClaims) {
          if (c.sampleSize !== null) {
            const prev = subjectsPerPub.get(c.publicationId) ?? 0;
            if (c.sampleSize > prev) {
              subjectsPerPub.set(c.publicationId, c.sampleSize);
            }
          }
        }
        let totalSubjects = 0;
        for (const n of subjectsPerPub.values()) {
          totalSubjects += n;
        }

        const directionBreakdown: DirectionBreakdown = {
          increase: 0,
          decrease: 0,
          no_effect: 0,
          inconclusive: 0,
        };
        let confSum = 0;
        let hasHumanValidatedClaim = false;
        const limitSet = new Set<string>();

        for (const c of cellClaims) {
          directionBreakdown[c.effectDirection]++;
          confSum += c.confidenceScore;
          if (c.humanValidated) hasHumanValidatedClaim = true;
          for (const lim of c.limitations) {
            limitSet.add(lim);
          }
        }

        const status = computeCellStatus(cellClaims, publicationIds);
        const avgConfidence =
          cellClaims.length > 0 ? Number((confSum / cellClaims.length).toFixed(3)) : 0;

        cells.push({
          id,
          biologicalSystem,
          spaceCondition,
          durationBucket,
          status,
          claimIds,
          passageIds,
          publicationIds,
          claimCount: cellClaims.length,
          publicationCount: publicationIds.length,
          totalSubjects,
          directionBreakdown,
          avgConfidence,
          hasHumanValidatedClaim,
          limitationsSummary: Array.from(limitSet),
          isDemoData: cellClaims.length === 0 ? true : cellClaims.every((c) => c.isDemoData),
        });
      }
    }
  }

  return cells;
}

export function summarizeBySystem(cells: EvidenceCell[]): SystemEvidenceSummary[] {
  const summaries: SystemEvidenceSummary[] = [];
  for (const system of BIOLOGICAL_SYSTEMS) {
    const sysCells = cells.filter((c) => c.biologicalSystem === system);
    const pubIds = new Set<string>();
    let consensus = 0;
    let contradiction = 0;
    let single_replication = 0;
    let empty = 0;
    let totalClaims = 0;
    let totalSubjects = 0;

    for (const cell of sysCells) {
      if (cell.status === 'consensus') consensus++;
      else if (cell.status === 'contradiction') contradiction++;
      else if (cell.status === 'single_replication') single_replication++;
      else empty++;

      totalClaims += cell.claimCount;
      totalSubjects += cell.totalSubjects;
      for (const pid of cell.publicationIds) {
        pubIds.add(pid);
      }
    }

    summaries.push({
      biologicalSystem: system,
      consensus,
      contradiction,
      single_replication,
      empty,
      totalClaims,
      totalSubjects,
      publicationCount: pubIds.size,
    });
  }
  return summaries;
}

export function buildTimeline(
  publications: Publication[],
  claims: Claim[],
  passages: Passage[],
): TimelinePoint[] {
  const years = Array.from(new Set(publications.map((p) => p.year))).sort((a, b) => a - b);
  const cellsByYear = new Map<number, Claim[]>();
  for (const c of claims) {
    const arr = cellsByYear.get(c.year) ?? [];
    arr.push(c);
    cellsByYear.set(c.year, arr);
  }

  const passageMap = new Map<string, Passage[]>();
  for (const p of passages) {
    const arr = passageMap.get(p.publicationId) ?? [];
    arr.push(p);
    passageMap.set(p.publicationId, arr);
  }

  return years.map((year) => {
    const yearPubs = publications.filter((p) => p.year === year);
    const yearClaims = cellsByYear.get(year) ?? [];
    const yearCells = buildEvidenceCells(yearClaims).filter((c) => c.status !== 'empty');

    let consensusClaims = 0;
    let contradictionClaims = 0;
    let singleReplicationClaims = 0;
    for (const cell of yearCells) {
      if (cell.status === 'consensus') consensusClaims += cell.claimCount;
      else if (cell.status === 'contradiction') contradictionClaims += cell.claimCount;
      else if (cell.status === 'single_replication') singleReplicationClaims += cell.claimCount;
    }

    const passageIds = Array.from(
      new Set(
        yearPubs.flatMap((pub) => (passageMap.get(pub.id) ?? []).map((ps) => ps.id)),
      ),
    );

    return {
      year,
      publicationCount: yearPubs.length,
      claimCount: yearClaims.length,
      consensusClaims,
      contradictionClaims,
      singleReplicationClaims,
      passageIds,
      publicationIds: yearPubs.map((p) => p.id),
      highlights: yearPubs.slice(0, 3).map((p) => p.title),
    };
  });
}

export function buildKnowledgeGraph(
  publications: Publication[],
  claims: Claim[],
  limit = 120,
): GraphData {
  const slicedClaims = claims.slice(0, limit);
  const pubById = new Map(publications.map((p) => [p.id, p]));

  const nodesMap = new Map<string, GraphNode>();
  const edgesMap = new Map<string, GraphEdge>();
  const passageIds = new Set<string>();

  const ensureNode = (node: GraphNode) => {
    const existing = nodesMap.get(node.id);
    if (existing) {
      existing.count += 1;
    } else {
      nodesMap.set(node.id, { ...node, count: 1 });
    }
  };

  const addEdge = (
    source: string,
    target: string,
    relation: string,
    passageId: string,
    effectDirection?: Claim['effectDirection'],
  ) => {
    const id = `${source}-->${target}__${relation}`;
    const existing = edgesMap.get(id);
    if (existing) {
      existing.claimCount += 1;
      if (!existing.passageIds.includes(passageId)) {
        existing.passageIds.push(passageId);
      }
    } else {
      edgesMap.set(id, {
        id,
        source,
        target,
        relation,
        effectDirection,
        claimCount: 1,
        passageIds: [passageId],
      });
    }
  };

  for (const c of slicedClaims) {
    passageIds.add(c.passageId);
    const orgId = `org:${c.organism}`;
    const condId = `cond:${c.spaceCondition}`;
    const sysId = `sys:${c.biologicalSystem}`;
    const pubId = `pub:${c.publicationId}`;
    const pub = pubById.get(c.publicationId);

    ensureNode({ id: orgId, type: 'organism', label: c.organism, count: 1 });
    ensureNode({ id: condId, type: 'condition', label: c.spaceCondition, count: 1 });
    ensureNode({ id: sysId, type: 'system', label: c.biologicalSystem, count: 1 });
    ensureNode({
      id: pubId,
      type: 'publication',
      label: pub ? `${pub.id} (${pub.year})` : c.publicationId,
      count: 1,
    });

    addEdge(orgId, condId, 'exposed_to', c.passageId);
    addEdge(condId, sysId, c.effectDirection, c.passageId, c.effectDirection);
    addEdge(sysId, pubId, 'documented_in', c.passageId);
  }

  return {
    nodes: Array.from(nodesMap.values()),
    edges: Array.from(edgesMap.values()),
    passageIds: Array.from(passageIds),
  };
}
