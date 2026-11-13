import type { BenchmarkQuestion, OfflineIndexBundle } from '../domain/types';
import { updateOfflineIndexTelemetry } from './diagnostics';

const DB_NAME = 'spacebio-atlas-db';
const DB_VERSION = 1;
const STORE_NAME = 'offline_records';
const BUNDLE_KEY = 'active_index_bundle';
const BENCHMARK_KEY = 'benchmark_questions';

export interface StoredOfflineBundleRecord {
  bundle: OfflineIndexBundle;
  etag: string | null;
  sha256: string | null;
  jsonBytes: number;
  gzipBytes: number;
  storedBytes: number;
  syncedAt: string;
}

let memoryBundleFallback: StoredOfflineBundleRecord | null = null;
let memoryBenchmarkFallback: BenchmarkQuestion[] | null = null;

function hasIndexedDB(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open error'));
  });
}

async function idbGet<T>(key: string): Promise<T | null> {
  if (!hasIndexedDB()) return null;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(key);
    req.onsuccess = () => resolve((req.result as T | undefined) ?? null);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB read error'));
  });
}

async function idbSet<T>(key: string, value: T): Promise<void> {
  if (!hasIndexedDB()) return;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error('IndexedDB write error'));
  });
}

async function decompressGzipBlob(blob: Blob): Promise<string> {
  if (typeof DecompressionStream !== 'undefined') {
    const stream = blob.stream().pipeThrough(new DecompressionStream('gzip'));
    return await new Response(stream).text();
  }
  throw new Error('DecompressionStream unavailable');
}

export async function getStoredOfflineBundle(): Promise<StoredOfflineBundleRecord | null> {
  if (memoryBundleFallback) {
    return memoryBundleFallback;
  }
  try {
    const record = await idbGet<StoredOfflineBundleRecord>(BUNDLE_KEY);
    if (record) {
      memoryBundleFallback = record;
      updateOfflineIndexTelemetry({
        jsonBytes: record.jsonBytes,
        gzipBytes: record.gzipBytes,
        storedBytes: record.storedBytes,
        syncedAt: record.syncedAt,
        etag: record.etag,
        sha256: record.sha256,
      });
    }
    return record;
  } catch {
    return memoryBundleFallback;
  }
}

export async function saveOfflineBundleRecord(
  record: StoredOfflineBundleRecord,
): Promise<void> {
  memoryBundleFallback = record;
  updateOfflineIndexTelemetry({
    jsonBytes: record.jsonBytes,
    gzipBytes: record.gzipBytes,
    storedBytes: record.storedBytes,
    syncedAt: record.syncedAt,
    etag: record.etag,
    sha256: record.sha256,
  });
  try {
    await idbSet(BUNDLE_KEY, record);
  } catch {
    // In-memory fallback already populated
  }
}

export async function getStoredBenchmarkQuestions(): Promise<BenchmarkQuestion[] | null> {
  if (memoryBenchmarkFallback) return memoryBenchmarkFallback;
  try {
    const stored = await idbGet<BenchmarkQuestion[]>(BENCHMARK_KEY);
    if (stored) memoryBenchmarkFallback = stored;
    return stored;
  } catch {
    return memoryBenchmarkFallback;
  }
}

export async function saveBenchmarkQuestions(
  questions: BenchmarkQuestion[],
): Promise<void> {
  memoryBenchmarkFallback = questions;
  try {
    await idbSet(BENCHMARK_KEY, questions);
  } catch {
    // ignore storage quota errors
  }
}

export async function syncOfflineIndexFromServer(options?: {
  force?: boolean;
}): Promise<{
  status: 'updated' | 'up_to_date';
  record: StoredOfflineBundleRecord;
}> {
  const existing = await getStoredOfflineBundle();
  const headers: Record<string, string> = {};
  if (!options?.force && existing?.etag) {
    headers['If-None-Match'] = existing.etag;
  }

  const canDecompressGzip = typeof DecompressionStream !== 'undefined';
  const format = canDecompressGzip ? 'gzip' : 'json';
  const res = await fetch(`/api/v1/export/offline-index?format=${format}`, {
    headers,
  });

  if (res.status === 304 && existing) {
    const refreshed: StoredOfflineBundleRecord = {
      ...existing,
      syncedAt: new Date().toISOString(),
    };
    await saveOfflineBundleRecord(refreshed);
    return { status: 'up_to_date', record: refreshed };
  }

  if (!res.ok) {
    throw new Error(`Échec de synchronisation de l'index (${res.status})`);
  }

  const etag = res.headers.get('ETag');
  const sha256 = res.headers.get('X-Content-SHA256');
  const headerJsonBytes = Number(res.headers.get('X-Index-Json-Bytes') ?? 0);
  const headerGzipBytes = Number(res.headers.get('X-Index-Gzip-Bytes') ?? 0);

  let jsonText = '';
  let measuredWireBytes = 0;

  if (format === 'gzip') {
    const blob = await res.blob();
    measuredWireBytes = blob.size;
    try {
      jsonText = await decompressGzipBlob(blob);
    } catch {
      const jsonRes = await fetch('/api/v1/export/offline-index?format=json');
      jsonText = await jsonRes.text();
    }
  } else {
    jsonText = await res.text();
    measuredWireBytes = new Blob([jsonText]).size;
  }

  const bundle = JSON.parse(jsonText) as OfflineIndexBundle;
  const storedBytes = new Blob([jsonText]).size;

  const record: StoredOfflineBundleRecord = {
    bundle,
    etag,
    sha256,
    jsonBytes: headerJsonBytes || storedBytes,
    gzipBytes: headerGzipBytes || measuredWireBytes,
    storedBytes,
    syncedAt: new Date().toISOString(),
  };

  await saveOfflineBundleRecord(record);
  return { status: 'updated', record };
}
