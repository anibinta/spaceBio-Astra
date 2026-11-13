import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { buildEvidenceCells } from '../../src/domain/evidenceEngine';
import { buildSearchIndex } from '../../src/domain/localSearch';
import type {
  Claim,
  EvidenceCell,
  OfflineIndexBundle,
  Passage,
  Publication,
} from '../../src/domain/types';
import { CORPUS_TARGET_COUNT, DEMO_DATA_VERSION, generateDemoDataset } from './demoDataset';

export interface AtlasRepository {
  version: string;
  isDemoData: boolean;
  corpusTargetCount: number;
  publications: Publication[];
  passages: Passage[];
  claims: Claim[];
  evidenceCells: EvidenceCell[];
  publicationsById: Map<string, Publication>;
  passagesById: Map<string, Passage>;
  passagesByPubId: Map<string, Passage[]>;
  claimsByPubId: Map<string, Claim[]>;
  claimsByCellId: Map<string, Claim[]>;
  cellsById: Map<string, EvidenceCell>;
  searchIndex: ReturnType<typeof buildSearchIndex>;
  offlineBundle: OfflineIndexBundle;
  offlineJsonBuffer: Buffer;
  offlineGzipBuffer: Buffer;
  offlineSha256: string;
  offlineEtag: string;
}

let cachedRepo: AtlasRepository | null = null;

export function getRepository(): AtlasRepository {
  if (cachedRepo) return cachedRepo;

  const { publications, passages, claims } = generateDemoDataset();
  const evidenceCells = buildEvidenceCells(claims);

  const publicationsById = new Map(publications.map((p) => [p.id, p]));
  const passagesById = new Map(passages.map((p) => [p.id, p]));
  const cellsById = new Map(evidenceCells.map((c) => [c.id, c]));

  const passagesByPubId = new Map<string, Passage[]>();
  for (const p of passages) {
    const arr = passagesByPubId.get(p.publicationId) ?? [];
    arr.push(p);
    passagesByPubId.set(p.publicationId, arr);
  }

  const claimsByPubId = new Map<string, Claim[]>();
  const claimsByCellId = new Map<string, Claim[]>();
  for (const c of claims) {
    const pubArr = claimsByPubId.get(c.publicationId) ?? [];
    pubArr.push(c);
    claimsByPubId.set(c.publicationId, pubArr);

    const cellKey = `${c.biologicalSystem}__${c.spaceCondition}__${c.durationBucket}`;
    const cellArr = claimsByCellId.get(cellKey) ?? [];
    cellArr.push(c);
    claimsByCellId.set(cellKey, cellArr);
  }

  const searchIndex = buildSearchIndex(publications, passages, claims);

  const offlineBundle: OfflineIndexBundle = {
    version: DEMO_DATA_VERSION,
    generatedAt: new Date().toISOString(),
    isDemoData: true,
    corpusTargetCount: CORPUS_TARGET_COUNT,
    demoPublicationCount: publications.length,
    publications,
    passages,
    claims,
    evidenceCells,
  };

  const offlineJsonBuffer = Buffer.from(JSON.stringify(offlineBundle), 'utf-8');
  const offlineGzipBuffer = gzipSync(offlineJsonBuffer, { level: 9 });
  const offlineSha256 = createHash('sha256').update(offlineJsonBuffer).digest('hex');
  const offlineEtag = `"${DEMO_DATA_VERSION}-${offlineSha256.slice(0, 12)}"`;

  cachedRepo = {
    version: DEMO_DATA_VERSION,
    isDemoData: true,
    corpusTargetCount: CORPUS_TARGET_COUNT,
    publications,
    passages,
    claims,
    evidenceCells,
    publicationsById,
    passagesById,
    passagesByPubId,
    claimsByPubId,
    claimsByCellId,
    cellsById,
    searchIndex,
    offlineBundle,
    offlineJsonBuffer,
    offlineGzipBuffer,
    offlineSha256,
    offlineEtag,
  };

  return cachedRepo;
}
