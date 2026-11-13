import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { BENCHMARK_QUESTIONS } from '../server/data/benchmarkQuestions';
import { getRepository } from '../server/data/repository';
import {
  getAvailableLocales,
  getLocalePack,
  registerLocalePack,
  verifyLocaleKeyParity,
} from '../src/i18n/registry';
import {
  compileOfflineContext,
  dataAdapter,
  setLowDataMode,
  setSimulatedOffline,
} from '../src/services/dataAdapter';
import { saveOfflineBundleRecord } from '../src/services/offlineStore';

test('i18n: fr.json and en.json have identical key parity and support runtime locale extension', () => {
  const missingInEn = verifyLocaleKeyParity();
  assert.equal(missingInEn.length, 0, `Missing keys in en.json: ${missingInEn.join(', ')}`);

  registerLocalePack('es', {
    meta: {
      code: 'es',
      nativeName: 'Español',
      autoTranslatedNotice: 'Contenido traducido automáticamente.',
    },
    statuses: {
      consensus: 'Consenso',
      contradiction: 'Contradicción',
      single_replication: 'Réplica única',
      empty: 'Vacío',
    },
  });

  const locales = getAvailableLocales();
  assert.ok(locales.some((l) => l.code === 'es'));
  assert.equal(getLocalePack('es').statuses.consensus, 'Consenso');
});

test('PWA assets: manifest.webmanifest, sw.js, and required PNG icons exist and are valid', () => {
  const root = process.cwd();
  const manifestPath = path.join(root, 'public/manifest.webmanifest');
  const swPath = path.join(root, 'public/sw.js');

  assert.ok(fs.existsSync(manifestPath), 'public/manifest.webmanifest must exist');
  assert.ok(fs.existsSync(swPath), 'public/sw.js must exist');

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
    id?: string;
    name?: string;
    short_name?: string;
    display?: string;
    start_url?: string;
    scope?: string;
    icons?: Array<{ src: string; sizes: string; purpose?: string }>;
  };

  assert.equal(manifest.id, '/');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.scope, '/');
  assert.ok(
    manifest.short_name && manifest.short_name.length <= 12,
    'short_name must be <= 12 chars',
  );
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 3);
  assert.ok(manifest.icons.some((i) => i.purpose === 'any' && i.sizes === '192x192'));
  assert.ok(manifest.icons.some((i) => i.purpose === 'any' && i.sizes === '512x512'));
  assert.ok(manifest.icons.some((i) => i.purpose === 'maskable' && i.sizes === '512x512'));

  for (const iconFile of [
    'public/icons/icon-192.png',
    'public/icons/icon-512.png',
    'public/icons/icon-maskable-512.png',
    'public/icons/apple-touch-icon.png',
  ]) {
    const full = path.join(root, iconFile);
    assert.ok(fs.existsSync(full), `${iconFile} must exist`);
    assert.ok(fs.statSync(full).size > 200, `${iconFile} must be a non-empty PNG`);
  }
});

test('Offline Mode: all 22 benchmark questions and core views run purely offline in < 200ms', async () => {
  const repo = getRepository();
  await saveOfflineBundleRecord({
    bundle: repo.offlineBundle,
    etag: repo.offlineEtag,
    sha256: repo.offlineSha256,
    jsonBytes: repo.offlineJsonBuffer.byteLength,
    gzipBytes: repo.offlineGzipBuffer.byteLength,
    storedBytes: repo.offlineJsonBuffer.byteLength,
    syncedAt: new Date().toISOString(),
  });
  compileOfflineContext(repo.offlineBundle);

  setSimulatedOffline(true);
  setLowDataMode(true);

  try {
    // 1. Offline Atlas Evidence Cells
    const cellsRes = await dataAdapter.getEvidenceCells({});
    assert.equal(cellsRes.meta.requestId, 'local-idb');
    assert.ok(cellsRes.data.cells.length > 0);
    assert.ok(cellsRes.meta.tookMs < 200);

    // 2. Offline Mission Twin (Mars 400d)
    const marsRes = await dataAdapter.getMissionRisks({
      profile: 'mars',
      durationDays: 400,
    });
    assert.equal(marsRes.meta.requestId, 'local-idb');
    assert.ok(marsRes.data.risks.every((r) => r.expertValidationRequired && r.noMedicalAdvice));

    // 3. Offline Publication Detail + Timeline + Graph
    const pubRes = await dataAdapter.getPublicationDetail(
      repo.offlineBundle.publications[0].id,
    );
    assert.ok(pubRes.data.passages.length >= 1);

    const timelineRes = await dataAdapter.getTimeline({});
    assert.ok(timelineRes.data.length >= 5);

    const graphRes = await dataAdapter.getGraph({});
    assert.ok(graphRes.data.nodes.length >= 5);

    // 4. Execute all 22 benchmark questions purely offline and assert < 200ms each
    assert.equal(BENCHMARK_QUESTIONS.length, 22);
    for (const q of BENCHMARK_QUESTIONS) {
      const start = performance.now();
      const ans = await dataAdapter.askNaturalLanguage(q.question, q.lang);
      const elapsed = performance.now() - start;
      assert.ok(
        elapsed < 200,
        `Offline query ${q.id} took ${elapsed.toFixed(2)}ms (>= 200ms budget)`,
      );
      assert.equal(ans.data.mode, 'extractive_fallback');
      if (q.expectedStatus !== 'empty') {
        assert.ok(
          ans.sourcePassageIds.length >= q.expectedMinPassages,
          `Offline query ${q.id} expected >= ${q.expectedMinPassages} passages, got ${ans.sourcePassageIds.length}`,
        );
      }
    }
  } finally {
    setSimulatedOffline(false);
    setLowDataMode(false);
  }
});
