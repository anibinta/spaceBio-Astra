import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import http from 'node:http';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { createApp } from '../server/app';
import { BENCHMARK_QUESTIONS } from '../server/data/benchmarkQuestions';

async function withServer(
  fn: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  assert.ok(addr && typeof addr === 'object');
  const baseUrl = `http://127.0.0.1:${addr.port}`;
  try {
    await fn(baseUrl);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  }
}

test('GET /api/v1/health and /api/v1/openapi.json return valid metadata and OpenAPI 3.1 spec', async () => {
  await withServer(async (baseUrl) => {
    const healthRes = await fetch(`${baseUrl}/api/v1/health`);
    assert.equal(healthRes.status, 200);
    assert.ok(healthRes.headers.get('x-response-time-ms'));
    const health = (await healthRes.json()) as {
      status: string;
      counts: { publications: number; corpusTargetCount: number };
      meta: { isDemoData: boolean };
    };
    assert.equal(health.status, 'ok');
    assert.equal(health.meta.isDemoData, true);
    assert.equal(health.counts.corpusTargetCount, 608);
    assert.ok(health.counts.publications >= 20);

    const specRes = await fetch(`${baseUrl}/api/v1/openapi.json`);
    assert.equal(specRes.status, 200);
    const spec = (await specRes.json()) as {
      openapi: string;
      paths: Record<string, unknown>;
    };
    assert.equal(spec.openapi, '3.1.0');
    assert.ok(spec.paths['/publications']);
    assert.ok(spec.paths['/mission-twin/risks']);
    assert.ok(spec.paths['/export/offline-index']);
  });
});

test('GET /api/v1/publications supports pagination, detail lookup, and structured 404', async () => {
  await withServer(async (baseUrl) => {
    const listRes = await fetch(`${baseUrl}/api/v1/publications?page=1&pageSize=5`);
    assert.equal(listRes.status, 200);
    const listBody = (await listRes.json()) as {
      data: Array<{ id: string; isDemoData: boolean }>;
      sourcePassageIds: string[];
      meta: { pageSize: number; totalPages: number };
    };
    assert.equal(listBody.data.length, 5);
    assert.equal(listBody.meta.pageSize, 5);
    assert.ok(listBody.sourcePassageIds.length > 0);
    assert.equal(listBody.data[0].isDemoData, true);

    const detailRes = await fetch(
      `${baseUrl}/api/v1/publications/${listBody.data[0].id}`,
    );
    assert.equal(detailRes.status, 200);
    const detail = (await detailRes.json()) as {
      data: { publication: { id: string }; passages: unknown[]; claims: unknown[] };
      sourcePassageIds: string[];
    };
    assert.equal(detail.data.publication.id, listBody.data[0].id);
    assert.ok(detail.data.passages.length >= 1);

    const notFoundRes = await fetch(`${baseUrl}/api/v1/publications/DOES-NOT-EXIST`);
    assert.equal(notFoundRes.status, 404);
    const errBody = (await notFoundRes.json()) as {
      error: { code: string; requestId: string };
    };
    assert.equal(errBody.error.code, 'VALIDATION_ERROR');
    assert.ok(errBody.error.requestId);
  });
});

test('Validation returns structured 400 error for invalid filter parameters', async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/claims?system=invalid_system&page=0`);
    assert.equal(res.status, 400);
    const body = (await res.json()) as {
      error: { code: string; details: Record<string, string> };
    };
    assert.equal(body.error.code, 'VALIDATION_ERROR');
    assert.ok(body.error.details.page || body.error.details.system);
  });
});

test('Evidence cells, timeline, graph, and mission twin endpoints return traceable passageIds', async () => {
  await withServer(async (baseUrl) => {
    const cellsRes = await fetch(
      `${baseUrl}/api/v1/evidence-cells?system=bone&condition=microgravity`,
    );
    assert.equal(cellsRes.status, 200);
    const cellsBody = (await cellsRes.json()) as {
      data: { cells: Array<{ id: string; status: string }>; systemSummary: unknown[] };
      sourcePassageIds: string[];
    };
    assert.equal(cellsBody.data.cells.length, 4);
    assert.ok(cellsBody.sourcePassageIds.length >= 3);

    const cellDetailRes = await fetch(
      `${baseUrl}/api/v1/evidence-cells/bone__microgravity__long_90_365d`,
    );
    assert.equal(cellDetailRes.status, 200);
    const cellDetail = (await cellDetailRes.json()) as {
      data: { cell: { status: string } };
    };
    assert.equal(cellDetail.data.cell.status, 'contradiction');

    const missionRes = await fetch(
      `${baseUrl}/api/v1/mission-twin/risks?profile=mars&durationDays=400`,
    );
    assert.equal(missionRes.status, 200);
    const missionBody = (await missionRes.json()) as {
      data: { disclaimer: string; risks: Array<{ expertValidationRequired: boolean }> };
    };
    assert.match(missionBody.data.disclaimer, /valider par des experts/i);
    assert.ok(missionBody.data.risks.every((r) => r.expertValidationRequired === true));

    const timelineRes = await fetch(`${baseUrl}/api/v1/timeline`);
    assert.equal(timelineRes.status, 200);
    const timelineBody = (await timelineRes.json()) as {
      data: Array<{ year: number }>;
      sourcePassageIds: string[];
    };
    assert.ok(timelineBody.data.length >= 5);

    const graphRes = await fetch(`${baseUrl}/api/v1/graph?system=bone`);
    assert.equal(graphRes.status, 200);
    const graphBody = (await graphRes.json()) as {
      data: { nodes: unknown[]; edges: unknown[] };
    };
    assert.ok(graphBody.data.nodes.length >= 4);
    assert.ok(graphBody.data.edges.length >= 3);
  });
});

test('POST /api/v1/search/ask returns grounded sentences with passageIds', async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/search/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'La microgravité diminue-t-elle la densité osseuse ?',
        lang: 'fr',
      }),
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      data: {
        sentences: Array<{ text: string; passageIds: string[] }>;
        sourcePassageIds: string[];
      };
    };
    assert.ok(body.data.sentences.length >= 1);
    assert.ok(body.data.sourcePassageIds.length >= 1);
    assert.ok(body.data.sentences.every((s) => s.passageIds.length > 0));
  });
});

test('GET /api/v1/export/offline-index supports gzip, ETag 304, and SHA-256 verification', async () => {
  await withServer(async (baseUrl) => {
    const gzRes = await fetch(
      `${baseUrl}/api/v1/export/offline-index?format=gzip`,
    );
    assert.equal(gzRes.status, 200);
    const etag = gzRes.headers.get('etag');
    const sha = gzRes.headers.get('x-content-sha256');
    assert.ok(etag);
    assert.ok(sha);

    const gzBuf = Buffer.from(await gzRes.arrayBuffer());
    const jsonBuf = gunzipSync(gzBuf);
    const computedSha = createHash('sha256').update(jsonBuf).digest('hex');
    assert.equal(computedSha, sha);

    const parsed = JSON.parse(jsonBuf.toString('utf-8')) as {
      isDemoData: boolean;
      publications: unknown[];
      passages: unknown[];
      claims: unknown[];
      evidenceCells: unknown[];
    };
    assert.equal(parsed.isDemoData, true);
    assert.ok(parsed.publications.length >= 20);
    assert.ok(parsed.evidenceCells.length > 0);

    const cachedRes = await fetch(`${baseUrl}/api/v1/export/offline-index`, {
      headers: { 'If-None-Match': etag },
    });
    assert.equal(cachedRes.status, 304);
  });
});

test('Regression suite: all 22 benchmark questions match expected cell status and passage traceability', async () => {
  await withServer(async (baseUrl) => {
    const qRes = await fetch(`${baseUrl}/api/v1/benchmark/questions`);
    assert.equal(qRes.status, 200);
    const qBody = (await qRes.json()) as { data: typeof BENCHMARK_QUESTIONS };
    assert.ok(qBody.data.length >= 20);

    for (const q of qBody.data) {
      const qs = new URLSearchParams({
        system: q.expectedSystem,
        ...(q.expectedCondition ? { condition: q.expectedCondition } : {}),
        ...(q.expectedDuration ? { duration: q.expectedDuration } : {}),
      });
      const cellRes = await fetch(`${baseUrl}/api/v1/evidence-cells?${qs.toString()}`);
      assert.equal(cellRes.status, 200);
      const cellBody = (await cellRes.json()) as {
        data: { cells: Array<{ status: string; passageIds: string[] }> };
      };
      assert.equal(cellBody.data.cells.length, 1, `Benchmark ${q.id} should isolate 1 cell`);
      assert.equal(
        cellBody.data.cells[0].status,
        q.expectedStatus,
        `Benchmark ${q.id} (${q.question}) status mismatch`,
      );
      assert.ok(
        cellBody.data.cells[0].passageIds.length >= q.expectedMinPassages,
        `Benchmark ${q.id} passage count mismatch`,
      );

      if (q.expectedMinPassages > 0) {
        const searchRes = await fetch(
          `${baseUrl}/api/v1/search?q=${encodeURIComponent(q.question)}&system=${q.expectedSystem}`,
        );
        assert.equal(searchRes.status, 200);
        const searchBody = (await searchRes.json()) as { data: unknown[] };
        assert.ok(
          searchBody.data.length >= 1,
          `Benchmark ${q.id} search returned no hits`,
        );
      }
    }
  });
});
