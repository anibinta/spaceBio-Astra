import {
  BIOLOGICAL_SYSTEMS,
  DURATION_BUCKETS,
  SPACE_CONDITIONS,
} from '../src/domain/evidenceEngine';
import { MISSION_PHASES } from '../src/domain/missionTwinEngine';
import type {
  BiologicalSystem,
  DurationBucket,
  EvidenceStatus,
  FilterState,
  MissionPhase,
  MissionProfile,
  PassageSection,
  SpaceCondition,
} from '../src/domain/types';

export class ApiValidationError extends Error {
  code: string;
  statusCode: number;
  details: Record<string, string>;

  constructor(message: string, details: Record<string, string>, statusCode = 400) {
    super(message);
    this.code = 'VALIDATION_ERROR';
    this.statusCode = statusCode;
    this.details = details;
  }
}

const VALID_SECTIONS: PassageSection[] = [
  'Results',
  'Discussion',
  'Conclusion',
  'Introduction',
];

const VALID_STATUSES: EvidenceStatus[] = [
  'consensus',
  'contradiction',
  'single_replication',
  'empty',
];

export function parsePagination(query: Record<string, unknown>) {
  const details: Record<string, string> = {};
  let page = 1;
  let pageSize = 20;

  if (query.page !== undefined) {
    const n = Number(query.page);
    if (!Number.isInteger(n) || n < 1) {
      details.page = 'page must be a positive integer (>= 1)';
    } else {
      page = n;
    }
  }

  if (query.pageSize !== undefined) {
    const n = Number(query.pageSize);
    if (!Number.isInteger(n) || n < 1 || n > 100) {
      details.pageSize = 'pageSize must be an integer between 1 and 100';
    } else {
      pageSize = n;
    }
  }

  if (Object.keys(details).length > 0) {
    throw new ApiValidationError('Paramètres de pagination invalides', details);
  }

  return { page, pageSize };
}

export function parseFilterQuery(query: Record<string, unknown>): FilterState {
  const details: Record<string, string> = {};
  const filters: FilterState = {};

  if (typeof query.q === 'string' && query.q.trim()) {
    filters.q = query.q.trim();
  }

  if (typeof query.system === 'string' && query.system !== '') {
    if (!BIOLOGICAL_SYSTEMS.includes(query.system as BiologicalSystem)) {
      details.system = `Invalid system. Allowed: ${BIOLOGICAL_SYSTEMS.join(', ')}`;
    } else {
      filters.system = query.system as BiologicalSystem;
    }
  }

  if (typeof query.condition === 'string' && query.condition !== '') {
    if (!SPACE_CONDITIONS.includes(query.condition as SpaceCondition)) {
      details.condition = `Invalid condition. Allowed: ${SPACE_CONDITIONS.join(', ')}`;
    } else {
      filters.condition = query.condition as SpaceCondition;
    }
  }

  if (typeof query.duration === 'string' && query.duration !== '') {
    if (!DURATION_BUCKETS.includes(query.duration as DurationBucket)) {
      details.duration = `Invalid duration. Allowed: ${DURATION_BUCKETS.join(', ')}`;
    } else {
      filters.duration = query.duration as DurationBucket;
    }
  }

  if (typeof query.section === 'string' && query.section !== '') {
    if (!VALID_SECTIONS.includes(query.section as PassageSection)) {
      details.section = `Invalid section. Allowed: ${VALID_SECTIONS.join(', ')}`;
    } else {
      filters.section = query.section as PassageSection;
    }
  }

  if (typeof query.status === 'string' && query.status !== '') {
    if (!VALID_STATUSES.includes(query.status as EvidenceStatus)) {
      details.status = `Invalid status. Allowed: ${VALID_STATUSES.join(', ')}`;
    } else {
      filters.status = query.status as EvidenceStatus;
    }
  }

  if (query.yearFrom !== undefined && query.yearFrom !== '') {
    const n = Number(query.yearFrom);
    if (!Number.isInteger(n) || n < 1960 || n > 2035) {
      details.yearFrom = 'yearFrom must be an integer between 1960 and 2035';
    } else {
      filters.yearFrom = n;
    }
  }

  if (query.yearTo !== undefined && query.yearTo !== '') {
    const n = Number(query.yearTo);
    if (!Number.isInteger(n) || n < 1960 || n > 2035) {
      details.yearTo = 'yearTo must be an integer between 1960 and 2035';
    } else {
      filters.yearTo = n;
    }
  }

  if (
    filters.yearFrom !== undefined &&
    filters.yearTo !== undefined &&
    filters.yearFrom > filters.yearTo
  ) {
    details.yearRange = 'yearFrom cannot be greater than yearTo';
  }

  if (typeof query.lang === 'string' && query.lang !== '') {
    if (query.lang !== 'fr' && query.lang !== 'en') {
      details.lang = 'lang must be "fr" or "en"';
    } else {
      filters.lang = query.lang;
    }
  }

  if (Object.keys(details).length > 0) {
    throw new ApiValidationError('Paramètres de filtre invalides', details);
  }

  return filters;
}

export function parseMissionTwinQuery(query: Record<string, unknown>) {
  const details: Record<string, string> = {};
  let profile: MissionProfile = 'lunar';
  let durationDays = 180;
  let system: BiologicalSystem | '' = '';
  let phase: MissionPhase | '' = '';

  if (typeof query.profile === 'string' && query.profile !== '') {
    if (query.profile !== 'lunar' && query.profile !== 'mars') {
      details.profile = 'profile must be "lunar" or "mars"';
    } else {
      profile = query.profile;
    }
  }

  if (query.durationDays !== undefined && query.durationDays !== '') {
    const n = Number(query.durationDays);
    if (!Number.isFinite(n) || n < 1 || n > 1500) {
      details.durationDays = 'durationDays must be a number between 1 and 1500';
    } else {
      durationDays = n;
    }
  }

  if (typeof query.system === 'string' && query.system !== '') {
    if (!BIOLOGICAL_SYSTEMS.includes(query.system as BiologicalSystem)) {
      details.system = `Invalid system. Allowed: ${BIOLOGICAL_SYSTEMS.join(', ')}`;
    } else {
      system = query.system as BiologicalSystem;
    }
  }

  if (typeof query.phase === 'string' && query.phase !== '') {
    if (!MISSION_PHASES.includes(query.phase as MissionPhase)) {
      details.phase = `Invalid phase. Allowed: ${MISSION_PHASES.join(', ')}`;
    } else {
      phase = query.phase as MissionPhase;
    }
  }

  if (Object.keys(details).length > 0) {
    throw new ApiValidationError('Paramètres Jumeau Mission invalides', details);
  }

  return { profile, durationDays, system, phase };
}
