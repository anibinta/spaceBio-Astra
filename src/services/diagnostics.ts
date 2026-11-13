export type ActiveDataSource = 'api' | 'indexeddb';

export interface DiagnosticsSnapshot {
  initialLoadMs: number | null;
  lastApiLatencyMs: number | null;
  lastLocalSearchMs: number | null;
  avgLocalSearchMs: number | null;
  activeSource: ActiveDataSource;
  apiCallCount: number;
  localSearchCount: number;
  offlineJsonBytes: number;
  offlineGzipBytes: number;
  offlineStoredBytes: number;
  lastSyncedAt: string | null;
  etag: string | null;
  sha256: string | null;
}

const state: DiagnosticsSnapshot = {
  initialLoadMs: null,
  lastApiLatencyMs: null,
  lastLocalSearchMs: null,
  avgLocalSearchMs: null,
  activeSource: 'api',
  apiCallCount: 0,
  localSearchCount: 0,
  offlineJsonBytes: 0,
  offlineGzipBytes: 0,
  offlineStoredBytes: 0,
  lastSyncedAt: null,
  etag: null,
  sha256: null,
};

let localSearchSum = 0;
const listeners = new Set<(snap: DiagnosticsSnapshot) => void>();

function emit() {
  const snap = { ...state };
  for (const listener of listeners) {
    listener(snap);
  }
}

export function measureInitialLoadMs(): number | null {
  if (typeof performance === 'undefined' || !performance.getEntriesByType) {
    return null;
  }
  const navEntries = performance.getEntriesByType(
    'navigation',
  ) as PerformanceNavigationTiming[];
  const nav = navEntries[0];
  if (nav) {
    const raw =
      nav.domContentLoadedEventEnd > 0
        ? nav.domContentLoadedEventEnd - nav.startTime
        : performance.now();
    state.initialLoadMs = Number(Math.max(1, raw).toFixed(1));
  } else if (state.initialLoadMs === null) {
    state.initialLoadMs = Number(performance.now().toFixed(1));
  }
  return state.initialLoadMs;
}

export function recordApiLatency(ms: number) {
  state.lastApiLatencyMs = Number(ms.toFixed(2));
  state.apiCallCount += 1;
  state.activeSource = 'api';
  emit();
}

export function recordLocalSearchLatency(ms: number, usedOfflineSource = true) {
  state.lastLocalSearchMs = Number(ms.toFixed(2));
  state.localSearchCount += 1;
  localSearchSum += ms;
  state.avgLocalSearchMs = Number((localSearchSum / state.localSearchCount).toFixed(2));
  if (usedOfflineSource) {
    state.activeSource = 'indexeddb';
  }
  emit();
}

export function setActiveDataSource(source: ActiveDataSource) {
  if (state.activeSource !== source) {
    state.activeSource = source;
    emit();
  }
}

export function updateOfflineIndexTelemetry(meta: {
  jsonBytes: number;
  gzipBytes: number;
  storedBytes: number;
  syncedAt: string | null;
  etag: string | null;
  sha256: string | null;
}) {
  state.offlineJsonBytes = meta.jsonBytes;
  state.offlineGzipBytes = meta.gzipBytes;
  state.offlineStoredBytes = meta.storedBytes;
  state.lastSyncedAt = meta.syncedAt;
  state.etag = meta.etag;
  state.sha256 = meta.sha256;
  emit();
}

export function getDiagnosticsSnapshot(): DiagnosticsSnapshot {
  if (state.initialLoadMs === null) {
    measureInitialLoadMs();
  }
  return { ...state };
}

export function subscribeDiagnostics(
  listener: (snap: DiagnosticsSnapshot) => void,
): () => void {
  listeners.add(listener);
  listener(getDiagnosticsSnapshot());
  return () => {
    listeners.delete(listener);
  };
}
