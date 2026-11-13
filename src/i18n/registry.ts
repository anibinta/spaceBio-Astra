import enPack from './locales/en.json';
import frPack from './locales/fr.json';

export type LocalePack = typeof frPack;
export type BuiltinLocale = 'fr' | 'en';

const localeRegistry = new Map<string, LocalePack>([
  ['fr', frPack],
  ['en', enPack],
]);

export function getAvailableLocales(): Array<{ code: string; nativeName: string }> {
  return Array.from(localeRegistry.entries()).map(([code, pack]) => ({
    code,
    nativeName: pack.meta.nativeName,
  }));
}

/**
 * Registers an external locale JSON pack at runtime without modifying UI code.
 * Missing keys gracefully fall back to the English or French base dictionary.
 */
export function registerLocalePack(code: string, partialPack: Partial<LocalePack>): void {
  const base = enPack;
  const merged: LocalePack = {
    meta: { ...base.meta, ...(partialPack.meta ?? {}), code },
    systems: { ...base.systems, ...(partialPack.systems ?? {}) },
    conditions: { ...base.conditions, ...(partialPack.conditions ?? {}) },
    durations: { ...base.durations, ...(partialPack.durations ?? {}) },
    statuses: { ...base.statuses, ...(partialPack.statuses ?? {}) },
    directions: { ...base.directions, ...(partialPack.directions ?? {}) },
    evidenceLevels: { ...base.evidenceLevels, ...(partialPack.evidenceLevels ?? {}) },
    sections: { ...base.sections, ...(partialPack.sections ?? {}) },
    phases: { ...base.phases, ...(partialPack.phases ?? {}) },
    nav: { ...base.nav, ...(partialPack.nav ?? {}) },
    offline: { ...base.offline, ...(partialPack.offline ?? {}) },
    diagnostics: { ...base.diagnostics, ...(partialPack.diagnostics ?? {}) },
  };
  localeRegistry.set(code, merged);
}

export function getLocalePack(locale: string): LocalePack {
  return localeRegistry.get(locale) ?? frPack;
}

export function verifyLocaleKeyParity(
  reference: Record<string, unknown> = frPack as unknown as Record<string, unknown>,
  candidate: Record<string, unknown> = enPack as unknown as Record<string, unknown>,
  prefix = '',
): string[] {
  const missing: string[] = [];
  for (const key of Object.keys(reference)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const refVal = reference[key];
    const candVal = candidate[key];
    if (candVal === undefined) {
      missing.push(fullKey);
      continue;
    }
    if (
      typeof refVal === 'object' &&
      refVal !== null &&
      typeof candVal === 'object' &&
      candVal !== null
    ) {
      missing.push(
        ...verifyLocaleKeyParity(
          refVal as Record<string, unknown>,
          candVal as Record<string, unknown>,
          fullKey,
        ),
      );
    }
  }
  return missing;
}
