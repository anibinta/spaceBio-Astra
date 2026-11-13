import assert from 'node:assert/strict';
import test from 'node:test';
import { getRepository } from '../../server/data/repository';
import {
  buildEvidenceCells,
  computeCellStatus,
  detectClaimSafeguards,
} from './evidenceEngine';
import {
  filterClaims,
  filtersToSearchParams,
  searchParamsToFilters,
} from './filters';
import { searchLocalIndex } from './localSearch';
import { buildMissionRisks } from './missionTwinEngine';
import type { Claim, Passage } from './types';

function makeClaim(overrides: Partial<Claim>): Claim {
  return {
    id: 'C1',
    passageId: 'P1',
    publicationId: 'DEMO-PUB-001',
    statement: 'Test statement',
    organism: 'Mus musculus',
    isModelOrganism: true,
    spaceCondition: 'microgravity',
    exposureDurationDays: 30,
    durationBucket: 'medium_14_90d',
    biologicalSystem: 'bone',
    effectDirection: 'decrease',
    relationType: 'causation',
    sampleSize: 12,
    sampleUnit: 'mice',
    evidenceLevel: 'flight_controlled',
    confidenceScore: 0.85,
    humanValidated: true,
    limitations: ['Modèle murin'],
    year: 2022,
    isDemoData: true,
    ...overrides,
  };
}

test('computeCellStatus returns empty, single_replication, consensus, and contradiction accurately', () => {
  assert.equal(computeCellStatus([], []), 'empty');

  const single = [makeClaim({ id: 'C1', publicationId: 'DEMO-PUB-001' })];
  assert.equal(computeCellStatus(single, ['DEMO-PUB-001']), 'single_replication');

  const consensusClaims = [
    makeClaim({ id: 'C1', publicationId: 'DEMO-PUB-001', effectDirection: 'decrease' }),
    makeClaim({ id: 'C2', publicationId: 'DEMO-PUB-002', effectDirection: 'decrease' }),
  ];
  assert.equal(
    computeCellStatus(consensusClaims, ['DEMO-PUB-001', 'DEMO-PUB-002']),
    'consensus',
  );

  const contradictionClaims = [
    makeClaim({ id: 'C1', publicationId: 'DEMO-PUB-001', effectDirection: 'decrease' }),
    makeClaim({ id: 'C2', publicationId: 'DEMO-PUB-002', effectDirection: 'increase' }),
  ];
  assert.equal(
    computeCellStatus(contradictionClaims, ['DEMO-PUB-001', 'DEMO-PUB-002']),
    'contradiction',
  );

  const noEffectVsDecrease = [
    makeClaim({ id: 'C1', publicationId: 'DEMO-PUB-001', effectDirection: 'decrease' }),
    makeClaim({ id: 'C2', publicationId: 'DEMO-PUB-002', effectDirection: 'no_effect' }),
  ];
  assert.equal(
    computeCellStatus(noEffectVsDecrease, ['DEMO-PUB-001', 'DEMO-PUB-002']),
    'contradiction',
  );
});

test('buildEvidenceCells deduplicates sample sizes per publication and preserves passageIds', () => {
  const claims = [
    makeClaim({ id: 'C1', passageId: 'P1', publicationId: 'DEMO-PUB-001', sampleSize: 10 }),
    makeClaim({ id: 'C2', passageId: 'P2', publicationId: 'DEMO-PUB-001', sampleSize: 10 }),
    makeClaim({ id: 'C3', passageId: 'P3', publicationId: 'DEMO-PUB-002', sampleSize: 15 }),
  ];
  const cells = buildEvidenceCells(claims, {
    systems: ['bone'],
    conditions: ['microgravity'],
    durations: ['medium_14_90d'],
  });
  assert.equal(cells.length, 1);
  assert.equal(cells[0].status, 'consensus');
  assert.equal(cells[0].totalSubjects, 25);
  assert.equal(cells[0].publicationCount, 2);
  assert.deepEqual(cells[0].passageIds, ['P1', 'P2', 'P3']);
});

test('detectClaimSafeguards flags small samples, animal models, correlation, and author interpretations', () => {
  const passagesById = new Map<string, Passage>([
    [
      'P1',
      {
        id: 'P1',
        publicationId: 'DEMO-PUB-001',
        section: 'Discussion',
        text: 'Authors suggest...',
        position: { paragraphIndex: 0, charStart: 0, charEnd: 18 },
        isAuthorInterpretation: true,
        language: 'en',
        autoTranslated: false,
        isDemoData: true,
      },
    ],
  ]);
  const claims = [
    makeClaim({
      sampleSize: 8,
      isModelOrganism: true,
      relationType: 'correlation',
      confidenceScore: 0.52,
      humanValidated: false,
    }),
  ];
  const flags = detectClaimSafeguards(claims, passagesById);
  assert.equal(flags.hasLowConfidence, true);
  assert.equal(flags.hasSmallSample, true);
  assert.equal(flags.hasAnimalModelsOnly, true);
  assert.equal(flags.hasCorrelationOnly, true);
  assert.equal(flags.hasUnvalidatedClaims, true);
  assert.equal(flags.hasAuthorInterpretations, true);
});

test('filters serialize and deserialize cleanly to URLSearchParams', () => {
  const original = {
    q: 'densité osseuse',
    system: 'bone' as const,
    condition: 'microgravity' as const,
    duration: 'long_90_365d' as const,
    yearFrom: 2018,
    yearTo: 2024,
    section: 'Results' as const,
    status: 'contradiction' as const,
    lang: 'fr' as const,
  };
  const params = filtersToSearchParams(original);
  const restored = searchParamsToFilters(params);
  assert.deepEqual(restored, original);
});

test('localSearch runs in under 200ms and filters by section', () => {
  const repo = getRepository();
  const start = performance.now();
  const hits = searchLocalIndex(
    repo.searchIndex,
    'densité osseuse microgravité',
    { section: 'Results' },
    repo.claims,
  );
  const elapsed = performance.now() - start;
  assert.ok(elapsed < 200, `Expected < 200ms, got ${elapsed}ms`);
  assert.ok(hits.length >= 2);
  assert.ok(hits.every((h) => h.passage.section === 'Results'));

  const claimFiltered = filterClaims(
    repo.claims,
    repo.passagesById,
    repo.publicationsById,
    { system: 'vision', duration: 'long_90_365d' },
  );
  assert.ok(claimFiltered.length >= 2);
});

test('buildMissionRisks distinguishes documented, extrapolated, and unstudied with mandatory disclaimers', () => {
  const repo = getRepository();
  const lunarRisks = buildMissionRisks(repo.evidenceCells, {
    profile: 'lunar',
    durationDays: 180,
  });

  const boneTransit = lunarRisks.find(
    (r) => r.biologicalSystem === 'bone' && r.missionPhase === 'transit',
  );
  assert.ok(boneTransit);
  assert.equal(boneTransit.coverage, 'documented');
  assert.ok(boneTransit.sourcePassageIds.length > 0);
  assert.equal(boneTransit.expertValidationRequired, true);
  assert.equal(boneTransit.noMedicalAdvice, true);

  const cognitionSurface = lunarRisks.find(
    (r) => r.biologicalSystem === 'cognition' && r.missionPhase === 'surface',
  );
  assert.ok(cognitionSurface);
  assert.equal(cognitionSurface.coverage, 'unstudied');
  assert.equal(cognitionSurface.sourcePassageIds.length, 0);

  const immuneSurface = lunarRisks.find(
    (r) => r.biologicalSystem === 'immune' && r.missionPhase === 'surface',
  );
  assert.ok(immuneSurface);
  assert.equal(immuneSurface.coverage, 'extrapolated');
  assert.ok(immuneSurface.extrapolationBasis);
});
