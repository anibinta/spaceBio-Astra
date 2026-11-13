export type FullTextStatus = 'full_text_available' | 'abstract_only' | 'metadata_only';

export type PassageSection = 'Results' | 'Discussion' | 'Conclusion' | 'Introduction';

export type BiologicalSystem =
  | 'bone'
  | 'muscle'
  | 'immune'
  | 'vision'
  | 'cognition'
  | 'microbiome'
  | 'cardiovascular';

export type SpaceCondition =
  | 'microgravity'
  | 'simulated_microgravity'
  | 'space_radiation'
  | 'lunar_regolith'
  | 'combined_stress'
  | 'isolation_confinement'
  | 'hypergravity';

export type DurationBucket =
  | 'short_lt_14d'
  | 'medium_14_90d'
  | 'long_90_365d'
  | 'deep_space_gt_365d';

export type EffectDirection = 'increase' | 'decrease' | 'no_effect' | 'inconclusive';

export type RelationType = 'correlation' | 'causation' | 'observational';

export type EvidenceLevel =
  | 'systematic_review'
  | 'flight_controlled'
  | 'flight_observational'
  | 'ground_analog'
  | 'in_vitro';

export type EvidenceStatus = 'consensus' | 'contradiction' | 'single_replication' | 'empty';

export type MissionPhase = 'transit' | 'surface' | 'stay' | 'return';

export type MissionProfile = 'lunar' | 'mars';

export type RiskCoverage = 'documented' | 'extrapolated' | 'unstudied';

export interface ExternalLink {
  label: string;
  url: string;
  type: 'osdr' | 'pubmed' | 'doi' | 'pmc' | 'demo_placeholder';
}

export interface Publication {
  id: string;
  doi: string | null;
  pmid: string | null;
  title: string;
  titleFr?: string | null;
  authors: string[];
  year: number;
  journal: string;
  keywords: string[];
  fullTextStatus: FullTextStatus;
  externalLinks: ExternalLink[];
  license: string;
  language: string;
  autoTranslated: boolean;
  isDemoData: boolean;
}

export interface PassagePosition {
  paragraphIndex: number;
  charStart: number;
  charEnd: number;
  pageLabel?: string | null;
}

export interface Passage {
  id: string;
  publicationId: string;
  section: PassageSection;
  text: string;
  textFr?: string | null;
  position: PassagePosition;
  isAuthorInterpretation: boolean;
  language: string;
  autoTranslated: boolean;
  isDemoData: boolean;
}

export interface Claim {
  id: string;
  passageId: string;
  publicationId: string;
  statement: string;
  statementFr?: string | null;
  organism: string;
  isModelOrganism: boolean;
  spaceCondition: SpaceCondition;
  exposureDurationDays: number;
  durationBucket: DurationBucket;
  biologicalSystem: BiologicalSystem;
  effectDirection: EffectDirection;
  relationType: RelationType;
  sampleSize: number | null;
  sampleUnit: string;
  evidenceLevel: EvidenceLevel;
  confidenceScore: number;
  humanValidated: boolean;
  limitations: string[];
  year: number;
  isDemoData: boolean;
}

export interface DirectionBreakdown {
  increase: number;
  decrease: number;
  no_effect: number;
  inconclusive: number;
}

export interface EvidenceCell {
  id: string;
  biologicalSystem: BiologicalSystem;
  spaceCondition: SpaceCondition;
  durationBucket: DurationBucket;
  status: EvidenceStatus;
  claimIds: string[];
  passageIds: string[];
  publicationIds: string[];
  claimCount: number;
  publicationCount: number;
  totalSubjects: number;
  directionBreakdown: DirectionBreakdown;
  avgConfidence: number;
  hasHumanValidatedClaim: boolean;
  limitationsSummary: string[];
  isDemoData: boolean;
}

export interface SystemEvidenceSummary {
  biologicalSystem: BiologicalSystem;
  consensus: number;
  contradiction: number;
  single_replication: number;
  empty: number;
  totalClaims: number;
  totalSubjects: number;
  publicationCount: number;
}

export interface MissionRiskEntry {
  id: string;
  biologicalSystem: BiologicalSystem;
  missionPhase: MissionPhase;
  missionProfile: MissionProfile;
  durationDays: number;
  coverage: RiskCoverage;
  dominantStatus: EvidenceStatus;
  evidenceCellIds: string[];
  sourcePassageIds: string[];
  publicationIds: string[];
  totalSubjects: number;
  publicationCount: number;
  avgConfidence: number;
  extrapolationBasis: string | null;
  limitations: string[];
  expertValidationRequired: true;
  noMedicalAdvice: true;
}

export interface FilterState {
  q?: string;
  system?: BiologicalSystem | '';
  condition?: SpaceCondition | '';
  duration?: DurationBucket | '';
  yearFrom?: number;
  yearTo?: number;
  section?: PassageSection | '';
  status?: EvidenceStatus | '';
  lang?: 'fr' | 'en';
}

export interface SearchHit {
  publication: Publication;
  passage: Passage;
  claims: Claim[];
  score: number;
  matchedTerms: string[];
}

export interface AnswerSentence {
  text: string;
  passageIds: string[];
  supportType: 'supporting' | 'contradicting' | 'gap' | 'contextual';
}

export interface NaturalLanguageAnswer {
  query: string;
  mode: 'gemini_grounded' | 'extractive_fallback';
  lang: 'fr' | 'en';
  sentences: AnswerSentence[];
  supportingPassages: Array<{
    passage: Passage;
    publication: Publication;
    claims: Claim[];
  }>;
  contradictingPassages: Array<{
    passage: Passage;
    publication: Publication;
    claims: Claim[];
  }>;
  sourcePassageIds: string[];
  safeguards: {
    hasLowConfidence: boolean;
    hasSmallSample: boolean;
    hasAnimalModelsOnly: boolean;
    hasCorrelationOnly: boolean;
    hasUnvalidatedClaims: boolean;
  };
  tookMs: number;
}

export interface TimelinePoint {
  year: number;
  publicationCount: number;
  claimCount: number;
  consensusClaims: number;
  contradictionClaims: number;
  singleReplicationClaims: number;
  passageIds: string[];
  publicationIds: string[];
  highlights: string[];
}

export interface GraphNode {
  id: string;
  type: 'organism' | 'condition' | 'system' | 'publication';
  label: string;
  status?: EvidenceStatus;
  count: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relation: string;
  effectDirection?: EffectDirection;
  claimCount: number;
  passageIds: string[];
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  passageIds: string[];
}

export interface OfflineIndexBundle {
  version: string;
  generatedAt: string;
  isDemoData: boolean;
  corpusTargetCount: number;
  demoPublicationCount: number;
  publications: Publication[];
  passages: Passage[];
  claims: Claim[];
  evidenceCells: EvidenceCell[];
}

export interface BenchmarkQuestion {
  id: string;
  lang: 'fr' | 'en';
  question: string;
  expectedSystem: BiologicalSystem;
  expectedCondition?: SpaceCondition;
  expectedDuration?: DurationBucket;
  expectedStatus: EvidenceStatus;
  expectedMinPassages: number;
  notes: string;
}

export interface ApiMeta {
  tookMs: number;
  requestId: string;
  isDemoData: boolean;
  corpusTargetCount: number;
  dataVersion: string;
  page?: number;
  pageSize?: number;
  total?: number;
  totalPages?: number;
}

export interface ApiErrorPayload {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId: string;
  };
}
