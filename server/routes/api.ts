import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { Router, type Request, type Response } from 'express';
import {
  buildEvidenceCells,
  buildKnowledgeGraph,
  buildTimeline,
  summarizeBySystem,
} from '../../src/domain/evidenceEngine';
import {
  filterClaims,
  filterEvidenceCells,
  paginate,
} from '../../src/domain/filters';
import {
  buildExtractiveAnswer,
  searchLocalIndex,
} from '../../src/domain/localSearch';
import { buildMissionRisks } from '../../src/domain/missionTwinEngine';
import type { AnswerSentence, ApiMeta, NaturalLanguageAnswer } from '../../src/domain/types';
import { BENCHMARK_QUESTIONS } from '../data/benchmarkQuestions';
import { getRepository } from '../data/repository';
import { buildOpenApiSpec } from '../openapi';
import {
  ApiValidationError,
  parseFilterQuery,
  parseMissionTwinQuery,
  parsePagination,
} from '../validators';

function hasValidGeminiKey(): boolean {
  const key = process.env.GEMINI_API_KEY?.trim();
  return Boolean(key && key !== 'MY_GEMINI_API_KEY' && key.length > 10);
}

function makeMeta(
  req: Request,
  startedAt: number,
  extra?: Partial<ApiMeta>,
): ApiMeta {
  const repo = getRepository();
  return {
    tookMs: Number((performance.now() - startedAt).toFixed(2)),
    requestId: (req as Request & { requestId?: string }).requestId ?? 'req-unknown',
    isDemoData: repo.isDemoData,
    corpusTargetCount: repo.corpusTargetCount,
    dataVersion: repo.version,
    ...extra,
  };
}

export function createApiRouter(): Router {
  const router = Router();

  router.get('/health', (req: Request, res: Response) => {
    const startedAt = performance.now();
    const repo = getRepository();
    res.json({
      status: 'ok',
      service: 'SpaceBio Atlas API',
      synthesisMode: hasValidGeminiKey() ? 'gemini_grounded' : 'extractive_fallback',
      counts: {
        publications: repo.publications.length,
        passages: repo.passages.length,
        claims: repo.claims.length,
        evidenceCells: repo.evidenceCells.length,
        corpusTargetCount: repo.corpusTargetCount,
      },
      offlineIndex: {
        version: repo.version,
        jsonBytes: repo.offlineJsonBuffer.byteLength,
        gzipBytes: repo.offlineGzipBuffer.byteLength,
        sha256: repo.offlineSha256,
      },
      meta: makeMeta(req, startedAt),
    });
  });

  router.get('/openapi.json', (_req: Request, res: Response) => {
    res.json(buildOpenApiSpec());
  });

  router.get('/publications', (req: Request, res: Response, next) => {
    try {
      const startedAt = performance.now();
      const repo = getRepository();
      const { page, pageSize } = parsePagination(req.query);
      const filters = parseFilterQuery(req.query);

      const matchingClaims = filterClaims(
        repo.claims,
        repo.passagesById,
        repo.publicationsById,
        filters,
      );

      const hasClaimFilters = Boolean(
        filters.system ||
          filters.condition ||
          filters.duration ||
          filters.section ||
          filters.q ||
          filters.yearFrom !== undefined ||
          filters.yearTo !== undefined,
      );

      const allowedPubIds = new Set(matchingClaims.map((c) => c.publicationId));
      const filteredPubs = repo.publications.filter((pub) => {
        if (filters.yearFrom !== undefined && pub.year < filters.yearFrom) return false;
        if (filters.yearTo !== undefined && pub.year > filters.yearTo) return false;
        if (hasClaimFilters) {
          if (allowedPubIds.has(pub.id)) return true;
          if (filters.q) {
            const q = filters.q.toLowerCase();
            return (
              pub.title.toLowerCase().includes(q) ||
              (pub.titleFr?.toLowerCase().includes(q) ?? false) ||
              pub.keywords.some((k) => k.toLowerCase().includes(q))
            );
          }
          return false;
        }
        return true;
      });

      const paged = paginate(filteredPubs, page, pageSize);
      const sourcePassageIds = Array.from(
        new Set(
          paged.items.flatMap((pub) =>
            (repo.passagesByPubId.get(pub.id) ?? []).map((p) => p.id),
          ),
        ),
      );

      res.json({
        data: paged.items,
        sourcePassageIds,
        meta: makeMeta(req, startedAt, {
          page: paged.page,
          pageSize: paged.pageSize,
          total: paged.total,
          totalPages: paged.totalPages,
        }),
      });
    } catch (err) {
      next(err);
    }
  });

  router.get('/publications/:id', (req: Request, res: Response, next) => {
    try {
      const startedAt = performance.now();
      const repo = getRepository();
      const id = String(req.params.id);
      const publication = repo.publicationsById.get(id);

      if (!publication) {
        throw new ApiValidationError(
          `Publication '${id}' introuvable`,
          { id: 'not_found' },
          404,
        );
      }

      const passages = repo.passagesByPubId.get(id) ?? [];
      const claims = repo.claimsByPubId.get(id) ?? [];

      res.json({
        data: {
          publication,
          passages,
          claims,
        },
        sourcePassageIds: passages.map((p) => p.id),
        meta: makeMeta(req, startedAt),
      });
    } catch (err) {
      next(err);
    }
  });

  router.get('/search', (req: Request, res: Response, next) => {
    try {
      const startedAt = performance.now();
      const repo = getRepository();
      const { page, pageSize } = parsePagination(req.query);
      const filters = parseFilterQuery(req.query);

      const hits = searchLocalIndex(
        repo.searchIndex,
        filters.q ?? '',
        filters,
        repo.claims,
      );
      const paged = paginate(hits, page, pageSize);
      const sourcePassageIds = paged.items.map((h) => h.passage.id);

      res.json({
        data: paged.items,
        sourcePassageIds,
        meta: makeMeta(req, startedAt, {
          page: paged.page,
          pageSize: paged.pageSize,
          total: paged.total,
          totalPages: paged.totalPages,
        }),
      });
    } catch (err) {
      next(err);
    }
  });

  router.post('/search/ask', async (req: Request, res: Response, next) => {
    try {
      const startedAt = performance.now();
      const repo = getRepository();
      const body = req.body ?? {};
      const query = typeof body.query === 'string' ? body.query.trim() : '';
      const lang: 'fr' | 'en' = body.lang === 'en' ? 'en' : 'fr';

      if (query.length < 2) {
        throw new ApiValidationError('La question doit contenir au moins 2 caractères', {
          query: 'required_min_2_chars',
        });
      }

      const filters = parseFilterQuery(
        typeof body.filters === 'object' && body.filters !== null ? body.filters : {},
      );
      const hits = searchLocalIndex(repo.searchIndex, query, filters, repo.claims);
      const extractive = buildExtractiveAnswer(
        query,
        hits,
        lang,
        Number((performance.now() - startedAt).toFixed(2)),
        repo.passagesById,
      );

      if (!hasValidGeminiKey() || hits.length === 0) {
        return res.json({
          data: extractive,
          sourcePassageIds: extractive.sourcePassageIds,
          meta: makeMeta(req, startedAt),
        });
      }

      // Grounded synthesis using server-side @google/genai SDK with strict fallback
      try {
        const ai = new GoogleGenAI({
          apiKey: process.env.GEMINI_API_KEY,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
        });

        const contextPassages = hits.slice(0, 6).map((h) => ({
          passageId: h.passage.id,
          publicationId: h.publication.id,
          section: h.passage.section,
          text: h.passage.text,
          claims: h.claims.map((c) => ({
            direction: c.effectDirection,
            system: c.biologicalSystem,
            condition: c.spaceCondition,
            durationDays: c.exposureDurationDays,
            sampleSize: c.sampleSize,
            organism: c.organism,
          })),
        }));

        const validPassageSet = new Set(contextPassages.map((p) => p.passageId));
        const geminiPromise = ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: `Question (${lang}): ${query}\n\nPassages sources:\n${JSON.stringify(contextPassages)}`,
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            systemInstruction:
              `You are SpaceBio Atlas scientific synthesis assistant. Answer concisely in ${lang === 'fr' ? 'French' : 'English'} using ONLY the provided source passages. Every sentence MUST cite at least one valid passageId from the provided passages. Never invent DOIs, numbers, or claims. Distinguish correlation from causation and avoid medical advice.`,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                sentences: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      text: { type: Type.STRING },
                      passageIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                      supportType: { type: Type.STRING },
                    },
                  },
                },
              },
            },
          },
        });

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Gemini timeout')), 6000),
        );
        const response = await Promise.race([geminiPromise, timeoutPromise]);

        const parsed = JSON.parse((response.text ?? '{}').trim()) as {
          sentences?: Array<{
            text?: string;
            passageIds?: string[];
            supportType?: string;
          }>;
        };

        const validSentences: AnswerSentence[] = (parsed.sentences ?? [])
          .filter((s) => typeof s.text === 'string' && s.text.trim().length > 0)
          .map((s) => {
            const filteredIds = (s.passageIds ?? []).filter((id) =>
              validPassageSet.has(id),
            );
            return {
              text: s.text!.trim(),
              passageIds:
                filteredIds.length > 0
                  ? filteredIds
                  : extractive.sourcePassageIds.slice(0, 1),
              supportType: (
                ['supporting', 'contradicting', 'gap', 'contextual'].includes(
                  s.supportType ?? '',
                )
                  ? s.supportType
                  : 'supporting'
              ) as AnswerSentence['supportType'],
            };
          });

        if (validSentences.length > 0) {
          const answer: NaturalLanguageAnswer = {
            ...extractive,
            mode: 'gemini_grounded',
            sentences: validSentences,
            tookMs: Number((performance.now() - startedAt).toFixed(2)),
          };
          return res.json({
            data: answer,
            sourcePassageIds: answer.sourcePassageIds,
            meta: makeMeta(req, startedAt),
          });
        }
      } catch {
        // Automatic fallback to deterministic extractive passages
      }

      return res.json({
        data: extractive,
        sourcePassageIds: extractive.sourcePassageIds,
        meta: makeMeta(req, startedAt),
      });
    } catch (err) {
      next(err);
    }
  });

  router.get('/claims', (req: Request, res: Response, next) => {
    try {
      const startedAt = performance.now();
      const repo = getRepository();
      const { page, pageSize } = parsePagination(req.query);
      const filters = parseFilterQuery(req.query);

      let filtered = filterClaims(
        repo.claims,
        repo.passagesById,
        repo.publicationsById,
        filters,
      );

      if (filters.status) {
        const matchingCellIds = new Set(
          repo.evidenceCells
            .filter((cell) => cell.status === filters.status)
            .map((cell) => cell.id),
        );
        filtered = filtered.filter((c) =>
          matchingCellIds.has(
            `${c.biologicalSystem}__${c.spaceCondition}__${c.durationBucket}`,
          ),
        );
      }

      const paged = paginate(filtered, page, pageSize);
      const sourcePassageIds = Array.from(
        new Set(paged.items.map((c) => c.passageId)),
      );

      res.json({
        data: paged.items,
        sourcePassageIds,
        meta: makeMeta(req, startedAt, {
          page: paged.page,
          pageSize: paged.pageSize,
          total: paged.total,
          totalPages: paged.totalPages,
        }),
      });
    } catch (err) {
      next(err);
    }
  });

  router.get('/evidence-cells', (req: Request, res: Response, next) => {
    try {
      const startedAt = performance.now();
      const repo = getRepository();
      const filters = parseFilterQuery(req.query);

      const hasClaimFilters = Boolean(
        filters.q ||
          filters.section ||
          filters.yearFrom !== undefined ||
          filters.yearTo !== undefined,
      );

      const baseClaims = hasClaimFilters
        ? filterClaims(repo.claims, repo.passagesById, repo.publicationsById, filters)
        : repo.claims;

      const cells = hasClaimFilters
        ? buildEvidenceCells(baseClaims)
        : repo.evidenceCells;

      const filteredCells = filterEvidenceCells(cells, filters);
      const systemSummary = summarizeBySystem(filteredCells);
      const sourcePassageIds = Array.from(
        new Set(filteredCells.flatMap((c) => c.passageIds)),
      );

      res.json({
        data: {
          cells: filteredCells,
          systemSummary,
        },
        sourcePassageIds,
        meta: makeMeta(req, startedAt, { total: filteredCells.length }),
      });
    } catch (err) {
      next(err);
    }
  });

  router.get('/evidence-cells/:id', (req: Request, res: Response, next) => {
    try {
      const startedAt = performance.now();
      const repo = getRepository();
      const id = String(req.params.id);
      const cell = repo.cellsById.get(id);

      if (!cell) {
        throw new ApiValidationError(
          `Cellule de preuve '${id}' introuvable`,
          { id: 'not_found' },
          404,
        );
      }

      const claims = repo.claimsByCellId.get(id) ?? [];
      const passages = cell.passageIds
        .map((pid) => repo.passagesById.get(pid))
        .filter((p): p is NonNullable<typeof p> => Boolean(p));
      const publications = cell.publicationIds
        .map((pubId) => repo.publicationsById.get(pubId))
        .filter((p): p is NonNullable<typeof p> => Boolean(p));

      res.json({
        data: {
          cell,
          claims,
          passages,
          publications,
        },
        sourcePassageIds: cell.passageIds,
        meta: makeMeta(req, startedAt),
      });
    } catch (err) {
      next(err);
    }
  });

  router.get('/mission-twin/risks', (req: Request, res: Response, next) => {
    try {
      const startedAt = performance.now();
      const repo = getRepository();
      const params = parseMissionTwinQuery(req.query);
      const risks = buildMissionRisks(repo.evidenceCells, params);
      const sourcePassageIds = Array.from(
        new Set(risks.flatMap((r) => r.sourcePassageIds)),
      );

      res.json({
        data: {
          profile: params.profile,
          durationDays: params.durationDays,
          disclaimer:
            'Piste à valider par des experts — aucune recommandation médicale individuelle.',
          risks,
        },
        sourcePassageIds,
        meta: makeMeta(req, startedAt, { total: risks.length }),
      });
    } catch (err) {
      next(err);
    }
  });

  router.get('/timeline', (req: Request, res: Response, next) => {
    try {
      const startedAt = performance.now();
      const repo = getRepository();
      const filters = parseFilterQuery(req.query);

      const matchingClaims = filterClaims(
        repo.claims,
        repo.passagesById,
        repo.publicationsById,
        filters,
      );
      const matchingPubIds = new Set(matchingClaims.map((c) => c.publicationId));
      const pubs =
        filters.system || filters.condition || filters.duration || filters.q || filters.section
          ? repo.publications.filter((p) => matchingPubIds.has(p.id))
          : repo.publications.filter((p) => {
              if (filters.yearFrom !== undefined && p.year < filters.yearFrom) return false;
              if (filters.yearTo !== undefined && p.year > filters.yearTo) return false;
              return true;
            });

      const timeline = buildTimeline(pubs, matchingClaims, repo.passages);
      const sourcePassageIds = Array.from(
        new Set(timeline.flatMap((t) => t.passageIds)),
      );

      res.json({
        data: timeline,
        sourcePassageIds,
        meta: makeMeta(req, startedAt, { total: timeline.length }),
      });
    } catch (err) {
      next(err);
    }
  });

  router.get('/graph', (req: Request, res: Response, next) => {
    try {
      const startedAt = performance.now();
      const repo = getRepository();
      const filters = parseFilterQuery(req.query);
      const limitRaw = req.query.limit !== undefined ? Number(req.query.limit) : 120;
      const limit = Number.isInteger(limitRaw) && limitRaw >= 1 && limitRaw <= 500 ? limitRaw : 120;

      const matchingClaims = filterClaims(
        repo.claims,
        repo.passagesById,
        repo.publicationsById,
        filters,
      );
      const graph = buildKnowledgeGraph(repo.publications, matchingClaims, limit);

      res.json({
        data: graph,
        sourcePassageIds: graph.passageIds,
        meta: makeMeta(req, startedAt),
      });
    } catch (err) {
      next(err);
    }
  });

  router.get('/export/offline-index', (req: Request, res: Response, next) => {
    try {
      const repo = getRepository();
      const format = req.query.format === 'gzip' ? 'gzip' : 'json';

      res.setHeader('ETag', repo.offlineEtag);
      res.setHeader('X-Content-SHA256', repo.offlineSha256);
      res.setHeader('X-Index-Version', repo.version);
      res.setHeader('X-Index-Json-Bytes', String(repo.offlineJsonBuffer.byteLength));
      res.setHeader('X-Index-Gzip-Bytes', String(repo.offlineGzipBuffer.byteLength));

      if (req.headers['if-none-match'] === repo.offlineEtag) {
        return res.status(304).end();
      }

      if (format === 'gzip') {
        res.setHeader('Content-Type', 'application/gzip');
        res.setHeader(
          'Content-Disposition',
          'attachment; filename="spacebio-atlas-offline-index.json.gz"',
        );
        return res.send(repo.offlineGzipBuffer);
      }

      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.send(repo.offlineJsonBuffer);
    } catch (err) {
      next(err);
    }
  });

  router.get('/benchmark/questions', (req: Request, res: Response) => {
    const startedAt = performance.now();
    const sourcePassageIds = Array.from(
      new Set(getRepository().passages.map((p) => p.id)),
    );
    res.json({
      data: BENCHMARK_QUESTIONS,
      sourcePassageIds,
      meta: makeMeta(req, startedAt, { total: BENCHMARK_QUESTIONS.length }),
    });
  });

  return router;
}
