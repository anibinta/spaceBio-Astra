import type {
  BiologicalSystem,
  DurationBucket,
  EffectDirection,
  EvidenceLevel,
  EvidenceStatus,
  MissionPhase,
  PassageSection,
  SpaceCondition,
} from '../domain/types';
import enPack from './locales/en.json';
import frPack from './locales/fr.json';

export type Locale = 'fr' | 'en';

export const SYSTEM_LABELS: Record<Locale, Record<BiologicalSystem, string>> = {
  fr: frPack.systems as Record<BiologicalSystem, string>,
  en: enPack.systems as Record<BiologicalSystem, string>,
};

export const CONDITION_LABELS: Record<Locale, Record<SpaceCondition, string>> = {
  fr: frPack.conditions as Record<SpaceCondition, string>,
  en: enPack.conditions as Record<SpaceCondition, string>,
};

export const DURATION_LABELS: Record<Locale, Record<DurationBucket, string>> = {
  fr: frPack.durations as Record<DurationBucket, string>,
  en: enPack.durations as Record<DurationBucket, string>,
};

export const STATUS_LABELS: Record<Locale, Record<EvidenceStatus, string>> = {
  fr: frPack.statuses as Record<EvidenceStatus, string>,
  en: enPack.statuses as Record<EvidenceStatus, string>,
};

export const DIRECTION_LABELS: Record<Locale, Record<EffectDirection, string>> = {
  fr: frPack.directions as Record<EffectDirection, string>,
  en: enPack.directions as Record<EffectDirection, string>,
};

export const EVIDENCE_LEVEL_LABELS: Record<Locale, Record<EvidenceLevel, string>> = {
  fr: frPack.evidenceLevels as Record<EvidenceLevel, string>,
  en: enPack.evidenceLevels as Record<EvidenceLevel, string>,
};

export const SECTION_LABELS: Record<Locale, Record<PassageSection, string>> = {
  fr: frPack.sections as Record<PassageSection, string>,
  en: enPack.sections as Record<PassageSection, string>,
};

export const PHASE_LABELS: Record<Locale, Record<MissionPhase, string>> = {
  fr: frPack.phases as Record<MissionPhase, string>,
  en: enPack.phases as Record<MissionPhase, string>,
};
