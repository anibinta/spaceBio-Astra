import { BIOLOGICAL_SYSTEMS, durationDaysToBucket } from './evidenceEngine';
import type {
  BiologicalSystem,
  DurationBucket,
  EvidenceCell,
  MissionPhase,
  MissionProfile,
  MissionRiskEntry,
  RiskCoverage,
} from './types';

export const MISSION_PHASES: MissionPhase[] = ['transit', 'surface', 'stay', 'return'];

function getPhaseConditions(phase: MissionPhase, profile: MissionProfile) {
  switch (phase) {
    case 'transit':
      return profile === 'mars'
        ? ['microgravity', 'space_radiation', 'combined_stress', 'isolation_confinement']
        : ['microgravity', 'space_radiation', 'combined_stress'];
    case 'surface':
      return profile === 'lunar'
        ? ['lunar_regolith', 'combined_stress']
        : ['space_radiation', 'combined_stress', 'isolation_confinement'];
    case 'stay':
      return ['microgravity', 'isolation_confinement', 'combined_stress', 'space_radiation'];
    case 'return':
      return ['hypergravity', 'microgravity', 'combined_stress'];
  }
}

export function buildMissionRisks(
  cells: EvidenceCell[],
  options: {
    profile: MissionProfile;
    durationDays: number;
    system?: BiologicalSystem | '';
    phase?: MissionPhase | '';
  },
): MissionRiskEntry[] {
  const targetBucket = durationDaysToBucket(options.durationDays);
  const systems = options.system ? [options.system] : BIOLOGICAL_SYSTEMS;
  const phases = options.phase ? [options.phase] : MISSION_PHASES;

  const bucketOrder: DurationBucket[] = [
    'short_lt_14d',
    'medium_14_90d',
    'long_90_365d',
    'deep_space_gt_365d',
  ];
  const targetIdx = bucketOrder.indexOf(targetBucket);

  const entries: MissionRiskEntry[] = [];

  for (const system of systems) {
    for (const phase of phases) {
      const relevantConditions = getPhaseConditions(phase, options.profile);

      // 1. Direct documented evidence for the exact duration bucket (or longer) and phase condition
      const directCells = cells.filter(
        (c) =>
          c.biologicalSystem === system &&
          relevantConditions.includes(c.spaceCondition) &&
          bucketOrder.indexOf(c.durationBucket) >= targetIdx &&
          c.status !== 'empty',
      );

      // 2. Adjacent evidence (shorter duration or simulated analog) for extrapolation
      const adjacentCells = cells.filter(
        (c) =>
          c.biologicalSystem === system &&
          c.status !== 'empty' &&
          (relevantConditions.includes(c.spaceCondition) ||
            c.spaceCondition === 'simulated_microgravity' ||
            c.spaceCondition === 'microgravity'),
      );

      let coverage: RiskCoverage = 'unstudied';
      let matchedCells: EvidenceCell[] = [];
      let extrapolationBasis: string | null = null;

      if (directCells.length > 0) {
        // Surface lunar regolith is only documented if lunar_regolith specifically has cells
        if (
          phase === 'surface' &&
          options.profile === 'lunar' &&
          !directCells.some((c) => c.spaceCondition === 'lunar_regolith')
        ) {
          coverage = 'extrapolated';
          matchedCells = directCells;
          extrapolationBasis =
            'Extrapolé depuis des études de stress combiné / microgravité sans exposition directe au régolithe lunaire sur cette durée.';
        } else {
          coverage = 'documented';
          matchedCells = directCells;
        }
      } else if (adjacentCells.length > 0) {
        coverage = 'extrapolated';
        matchedCells = adjacentCells;
        const sourceConditions = Array.from(
          new Set(adjacentCells.map((c) => c.spaceCondition)),
        ).join(', ');
        const sourceDurations = Array.from(
          new Set(adjacentCells.map((c) => c.durationBucket)),
        ).join(', ');
        extrapolationBasis = `Extrapolé depuis conditions voisines (${sourceConditions}) sur durées (${sourceDurations}).`;
      }

      const evidenceCellIds = matchedCells.map((c) => c.id);
      const sourcePassageIds = Array.from(
        new Set(matchedCells.flatMap((c) => c.passageIds)),
      );
      const publicationIds = Array.from(
        new Set(matchedCells.flatMap((c) => c.publicationIds)),
      );
      const totalSubjects = matchedCells.reduce((acc, c) => acc + c.totalSubjects, 0);
      const avgConfidence =
        matchedCells.length > 0
          ? Number(
              (
                matchedCells.reduce((acc, c) => acc + c.avgConfidence, 0) /
                matchedCells.length
              ).toFixed(3),
            )
          : 0;

      const hasContradiction = matchedCells.some((c) => c.status === 'contradiction');
      const hasConsensus = matchedCells.some((c) => c.status === 'consensus');
      const dominantStatus =
        matchedCells.length === 0
          ? 'empty'
          : hasContradiction
            ? 'contradiction'
            : hasConsensus
              ? 'consensus'
              : 'single_replication';

      const limitations = Array.from(
        new Set(matchedCells.flatMap((c) => c.limitationsSummary)),
      );

      entries.push({
        id: `${options.profile}__${system}__${phase}__${targetBucket}`,
        biologicalSystem: system,
        missionPhase: phase,
        missionProfile: options.profile,
        durationDays: options.durationDays,
        coverage,
        dominantStatus,
        evidenceCellIds,
        sourcePassageIds,
        publicationIds,
        totalSubjects,
        publicationCount: publicationIds.length,
        avgConfidence,
        extrapolationBasis,
        limitations,
        expertValidationRequired: true,
        noMedicalAdvice: true,
      });
    }
  }

  return entries;
}
