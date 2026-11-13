import claimSchema from '../src/domain/schemas/claim.schema.json' with { type: 'json' };
import evidenceCellSchema from '../src/domain/schemas/evidence-cell.schema.json' with { type: 'json' };
import passageSchema from '../src/domain/schemas/passage.schema.json' with { type: 'json' };
import publicationSchema from '../src/domain/schemas/publication.schema.json' with { type: 'json' };

export function buildOpenApiSpec() {
  return {
    openapi: '3.1.0',
    info: {
      title: 'SpaceBio Atlas REST API',
      version: '1.0.0',
      description:
        'API scientifique pour explorer les publications de biologie spatiale, passages sources, affirmations, cellules de preuve, Jumeau Mission Lune/Mars, chronologie et export hors ligne PWA.',
    },
    servers: [{ url: '/api/v1', description: 'Serveur local SpaceBio Atlas' }],
    paths: {
      '/health': {
        get: {
          summary: 'État de santé de l’API et mode de synthèse',
          responses: { '200': { description: 'Statut opérationnel' } },
        },
      },
      '/openapi.json': {
        get: {
          summary: 'Spécification OpenAPI 3.1',
          responses: { '200': { description: 'Document OpenAPI JSON' } },
        },
      },
      '/publications': {
        get: {
          summary: 'Recherche et liste paginée des publications',
          parameters: [
            { name: 'q', in: 'query', schema: { type: 'string' } },
            { name: 'system', in: 'query', schema: { type: 'string' } },
            { name: 'yearFrom', in: 'query', schema: { type: 'integer' } },
            { name: 'yearTo', in: 'query', schema: { type: 'integer' } },
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 20 } },
          ],
          responses: { '200': { description: 'Liste paginée + passageIds' } },
        },
      },
      '/publications/{id}': {
        get: {
          summary: 'Détail complet d’une publication, ses passages et ses affirmations',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': { description: 'Détail de publication' },
            '404': { description: 'Publication introuvable' },
          },
        },
      },
      '/search': {
        get: {
          summary: 'Recherche plein texte sur publications et passages avec filtres combinables',
          parameters: [
            { name: 'q', in: 'query', schema: { type: 'string' } },
            { name: 'system', in: 'query', schema: { type: 'string' } },
            { name: 'condition', in: 'query', schema: { type: 'string' } },
            { name: 'duration', in: 'query', schema: { type: 'string' } },
            { name: 'section', in: 'query', schema: { type: 'string' } },
            { name: 'yearFrom', in: 'query', schema: { type: 'integer' } },
            { name: 'yearTo', in: 'query', schema: { type: 'integer' } },
            { name: 'page', in: 'query', schema: { type: 'integer' } },
            { name: 'pageSize', in: 'query', schema: { type: 'integer' } },
          ],
          responses: { '200': { description: 'Passages pertinents classés par score + passageIds' } },
        },
      },
      '/search/ask': {
        post: {
          summary: 'Question en langage naturel avec réponse sourcée phrase par phrase (fallback extractif)',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['query'],
                  properties: {
                    query: { type: 'string', minLength: 2 },
                    lang: { type: 'string', enum: ['fr', 'en'], default: 'fr' },
                    filters: { type: 'object' },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'Réponse sourcée avec sourcePassageIds' } },
        },
      },
      '/claims': {
        get: {
          summary: 'Liste et filtrage des affirmations scientifiques',
          responses: { '200': { description: 'Affirmations paginées + passageIds' } },
        },
      },
      '/evidence-cells': {
        get: {
          summary: 'Cellules de preuve par système, condition et durée',
          responses: { '200': { description: 'Matrice de cellules et synthèse par système' } },
        },
      },
      '/evidence-cells/{id}': {
        get: {
          summary: 'Détail d’une cellule de preuve avec affirmations et passages sources',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Cellule détaillée' }, '404': { description: 'Introuvable' } },
        },
      },
      '/mission-twin/risks': {
        get: {
          summary: 'Registre de risques Jumeau Mission par système et phase de mission',
          parameters: [
            { name: 'profile', in: 'query', schema: { type: 'string', enum: ['lunar', 'mars'] } },
            { name: 'durationDays', in: 'query', schema: { type: 'number' } },
            { name: 'system', in: 'query', schema: { type: 'string' } },
            { name: 'phase', in: 'query', schema: { type: 'string', enum: ['transit', 'surface', 'stay', 'return'] } },
          ],
          responses: { '200': { description: 'Registre de risques avec traçabilité et mention expert' } },
        },
      },
      '/timeline': {
        get: {
          summary: 'Chronologie des connaissances par année',
          responses: { '200': { description: 'Points annuels + passageIds' } },
        },
      },
      '/graph': {
        get: {
          summary: 'Graphe Organismes ↔ Conditions ↔ Systèmes ↔ Publications',
          responses: { '200': { description: 'Nœuds, arêtes et passageIds' } },
        },
      },
      '/export/offline-index': {
        get: {
          summary: 'Export complet compressé (gzip) ou JSON pour synchronisation PWA hors ligne',
          parameters: [
            { name: 'format', in: 'query', schema: { type: 'string', enum: ['json', 'gzip'], default: 'json' } },
          ],
          responses: { '200': { description: 'Bundle complet avec ETag et X-Content-SHA256' } },
        },
      },
      '/benchmark/questions': {
        get: {
          summary: 'Jeu des 22 questions de référence pour tests de non-régression',
          responses: { '200': { description: 'Liste des questions de référence' } },
        },
      },
    },
    components: {
      schemas: {
        Publication: publicationSchema,
        Passage: passageSchema,
        Claim: claimSchema,
        EvidenceCell: evidenceCellSchema,
      },
    },
  };
}
