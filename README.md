# SpaceBio Atlas

Plateforme scientifique interactive (PWA front-end + API REST back-end) permettant d'explorer un corpus de biologie spatiale financé par la NASA (cible : **608 publications**), de cartographier les **consensus**, **contradictions** et **lacunes** de la recherche, et d'évaluer les risques physiologiques pour les missions **Lune** et **Mars**.

> **Transparence sur les données** : Le jeu embarqué par défaut est explicitement étiqueté **`DONNÉES DE DÉMONSTRATION`** (24 publications synthétiques représentatives, 26 passages, 25 affirmations, licence `CC-BY-4.0`, aucun DOI réel inventé). Il respecte strictement le schéma JSON cible pour être remplacé par l'index réel des 608 publications NASA OSDR.

---

## 1. Profils utilisateurs ciblés

1. **Scientifique** : recherche en langage naturel avec traçabilité phrase par phrase (`[DEMO-PAS-*]`), séparation résultats favorables / contradictoires, distinction mesure vs interprétation et accès au tiroir détaillé de publication.
2. **Gestionnaire de programme** : vue globale par systèmes biologiques (barres empilées, matrice de consensus/contradictions/lacunes) et export CSV pour orienter les financements.
3. **Architecte de mission** : **Jumeau Mission** (Lune / Mars, curseur de durée 7–720 jours, matrice Systèmes × Phases `transit / surface / stay / return`) distinguant ce qui est **documenté**, **extrapolé** et **non étudié**, avec mention permanente *« Piste à valider par des experts »*.
4. **Étudiant / Citoyen scientifique** : application **PWA** installable, **mode hors ligne** complet via **IndexedDB** (`< 200 ms` par recherche locale), **mode faible consommation de données** et bilinguisme **FR / EN** extensible par fichiers JSON.

---

## 2. Modèle de données à 4 niveaux & Schémas JSON

Chaque donnée suit une chaîne de preuve stricte et vérifiable :

1. **Publication** (`src/domain/schemas/publication.schema.json`) : identifiant, DOI/PMID, titre (`title` / `titleFr`), auteurs, année, revue, mots-clés, statut de texte intégral, liens externes, licence.
2. **Passage** (`src/domain/schemas/passage.schema.json`) : rattaché à une publication (`publicationId`), section (`Results | Discussion | Conclusion | Introduction`), texte, position exacte, distinction `isAuthorInterpretation` (mesure vs interprétation).
3. **Affirmation / Claim** (`src/domain/schemas/claim.schema.json`) : proposition élémentaire extraite d'un passage (`passageId`), organisme, condition spatiale, durée d'exposition, système biologique, sens de l'effet (`increase | decrease | no_effect | inconclusive`), `relationType` (`correlation | causation | observational`), taille d'échantillon `n`, niveau de preuve, score de confiance, validation humaine et limites méthodologiques.
4. **Cellule de preuve / EvidenceCell** (`src/domain/schemas/evidence-cell.schema.json`) : agrégation par `système × condition × durée` calculant le statut (`consensus | contradiction | single_replication | empty`), les effectifs dédupliqués par publication et les identifiants de passages sources.

---

## 3. Architecture du projet

Séparation stricte entre logique métier pure, back-end API REST et interface PWA :

```text
├── public/
│   ├── manifest.webmanifest         # Manifeste PWA (standalone, icônes 192/512 + maskable)
│   ├── sw.js                        # Service Worker (App Shell + cache bundle hors ligne)
│   ├── icon.svg & icons/*.png       # Icônes PWA (192, 512, maskable-512, apple-touch-icon)
├── server/
│   ├── app.ts                       # Middleware Express, X-Request-Id, X-Response-Time-Ms, erreurs JSON
│   ├── openapi.ts                   # Spécification OpenAPI 3.1 (/api/v1/openapi.json)
│   ├── validators.ts                # Validation stricte des paramètres et pagination
│   ├── routes/api.ts                # Endpoints REST /api/v1/* + synthèse Gemini avec fallback extractif
│   └── data/
│       ├── demoDataset.ts           # Jeu de démonstration structuré (24 pubs / 26 passages / 25 claims)
│       ├── benchmarkQuestions.ts    # 22 questions officielles de non-régression (FR/EN)
│       └── repository.ts            # Index précalculé + export JSON / Gzip + ETag + SHA-256
├── src/
│   ├── domain/                      # Couche métier pure (0 dépendance React/Node fs)
│   │   ├── types.ts
│   │   ├── evidenceEngine.ts        # Cellules de preuve, garde-fous, graphe, chronologie
│   │   ├── filters.ts               # Filtres combinables & sérialisation URL bidirectionnelle
│   │   ├── localSearch.ts           # Moteur BM25 + synonymes FR/EN + réponses extractives (< 200 ms)
│   │   ├── missionTwinEngine.ts     # Moteur Jumeau Mission Lune/Mars
│   │   └── schemas/*.schema.json    # Schémas JSON Draft 2020-12
│   ├── i18n/
│   │   ├── locales/{fr,en}.json     # Dictionnaires externalisés extensibles
│   │   ├── registry.ts              # Registre dynamique & vérificateur de parité de clés
│   │   └── labels.ts
│   ├── services/
│   │   ├── apiClient.ts             # Client REST typé
│   │   ├── offlineStore.ts          # Persistance IndexedDB + décompression gzip + ETag
│   │   ├── dataAdapter.ts           # Adaptateur hybride (API online -> fallback IndexedDB local)
│   │   └── diagnostics.ts           # Mesures temps réel (NavigationTiming, BM25, API, taille index)
│   ├── hooks/usePWAInstall.ts       # Détection beforeinstallprompt, iOS & statut Service Worker
│   ├── components/                  # Composants UI modulaires (Matrice, Graphe, Chronologie, Recherche, Tiroir)
│   └── pages/                       # 5 écrans (Home, EvidenceAtlas, MissionTwin, OfflineKnowledge, Diagnostics)
├── tests/
│   ├── api.test.ts                  # Tests d'intégration REST, OpenAPI, gzip/ETag & 22 questions
│   └── offline.test.ts              # Tests hors ligne pur (< 200 ms), parité i18n & assets PWA
└── server.ts                        # Point d'entrée unique (Express + Vite dev / dist prod sur port 3000)
```

---

## 4. API REST documentée (OpenAPI 3.1)

Toutes les routes renvoient `sourcePassageIds` ainsi que `meta` (`tookMs`, `requestId`, `isDemoData`, `corpusTargetCount`, `dataVersion`) et l'en-tête HTTP `X-Response-Time-Ms`.

| Méthode & Route | Rôle |
|---|---|
| `GET /api/v1/health` | État du serveur, mode de synthèse, compteurs et métadonnées d'index |
| `GET /api/v1/openapi.json` | Spécification OpenAPI 3.1 complète incluant les 4 schémas JSON |
| `GET /api/v1/publications` | Liste paginée et filtrable des publications |
| `GET /api/v1/publications/:id` | Détail complet d'une publication, ses passages et ses affirmations |
| `GET /api/v1/search` | Recherche de passages avec scoring BM25 et filtres combinables |
| `POST /api/v1/search/ask` | Synthèse en langage naturel ancrée sur passages (`Gemini` ou repli extractif) |
| `GET /api/v1/claims` | Liste paginée et filtrée des affirmations |
| `GET /api/v1/evidence-cells` | Cellules de preuve et synthèse par système biologique |
| `GET /api/v1/evidence-cells/:id` | Détail complet d'une cellule (affirmations, passages, publications) |
| `GET /api/v1/mission-twin/risks` | Registre de risques Lune/Mars filtré par durée, système et phase |
| `GET /api/v1/timeline` | Chronologie annuelle des publications, consensus et contradictions |
| `GET /api/v1/graph` | Graphe de connaissances Organismes ↔ Conditions ↔ Systèmes ↔ Publications |
| `GET /api/v1/export/offline-index` | Export complet JSON ou Gzip (`?format=gzip`) avec `ETag` (`304`) et `X-Content-SHA256` |
| `GET /api/v1/benchmark/questions` | Liste des 22 questions de référence |

---

## 5. Installation locale & Lancement en une commande

### Prérequis
- **Node.js ≥ 20** (testé avec Node `v22`) et **npm**

### Étapes d'installation

1. Cloner le dépôt et installer les dépendances :
   ```bash
   npm install
   ```
2. *(Optionnel)* Copier le fichier d'exemple des variables d'environnement :
   ```bash
   cp .env.example .env
   ```
   > **Note** : `GEMINI_API_KEY` est entièrement optionnelle. Sans clé API, le serveur et le front-end basculent automatiquement sur le mode extractif déterministe ancré sur passages (`extractive_fallback`).

3. **Commande unique de lancement en local** :
   ```bash
   npm run dev
   ```
   L'application et l'API REST démarrent ensemble sur **http://localhost:3000**.

### Build de production & Vérifications

```bash
npm run lint    # Vérification TypeScript (tsc --noEmit)
npm test        # 16 tests automatisés (domaine, API REST, 22 questions, mode hors ligne < 200 ms, PWA)
npm run build   # Build front-end Vite dans dist/
npm start       # Serveur Express de production sur le port 3000
```

---

## 6. Remplacer les données de démonstration par le corpus NASA réel (608 publications)

1. Préparer les fichiers d'extraction respectant `src/domain/schemas/{publication,passage,claim}.schema.json` (avec `isDemoData: false`).
2. Remplacer l'export `DEMO_PUBLICATIONS`, `DEMO_PASSAGES`, `DEMO_CLAIMS` dans `server/data/demoDataset.ts` (ou brancher votre chargeur JSON dans `server/data/repository.ts`).
3. Les cellules de preuve (`buildEvidenceCells`), l'index BM25 (`buildSearchIndex`), le bundle compressé `/api/v1/export/offline-index` et le registre Jumeau Mission se recalculeront automatiquement au démarrage.

### Ajouter une nouvelle langue (i18n extensible)
Créer un fichier `src/i18n/locales/<code>.json` sur le modèle de `fr.json` et l'enregistrer via `registerLocalePack('es', pack)` dans `src/i18n/registry.ts` sans modifier les composants UI.

---

## 7. Script de démonstration Jury (3 minutes)

- **0:00 – 0:35 | Accueil & Recherche en langage naturel**
  - Montrer le ruban de transparence (`DONNÉES DE DÉMONSTRATION`, statut réseau `En ligne · API`, sélecteur `FR / EN`, thème sombre/clair).
  - Lancer la question rapide : *« La microgravité diminue-t-elle la densité osseuse entre 14 et 90 jours ? »*.
  - Montrer que chaque phrase pointe vers `[DEMO-PAS-*]`, la séparation *Passages favorables* / *Passages contradictoires*, les garde-fous (*petits effectifs*, *modèles animaux*) et le clic vers le **Tiroir de publication**.
- **0:35 – 1:30 | Atlas des preuves (Scientifique & Gestionnaire)**
  - Ouvrir **Atlas des preuves** : montrer la matrice `Systèmes × Durées` colorée + icônes daltoniens (`✓`, `△`, `○`, `—`).
  - Cliquer sur une contradiction (ex. *Système osseux · 90–365 jours*) pour inspecter les passages sources et limites dans le panneau latéral.
  - Basculer rapidement sur les onglets **Graphe** (zoom, filtres, tableau) et **Chronologie**, puis montrer le partage d'état exact via l'URL (`?view=atlas&...`).
- **1:30 – 2:20 | Jumeau Mission Lune & Mars (Architecte de mission)**
  - Ouvrir **Jumeau Mission** : basculer de *Lune (Artemis)* à *Mars (Conjonction)* et ajuster le curseur de durée à `400 jours`.
  - Souligner la distinction **Documenté / Extrapolé / Non étudié**, le panneau latéral expliquant la base d'extrapolation, et la mention permanente **« Piste à valider par des experts — aucune recommandation médicale »**.
- **2:20 – 3:00 | Hors ligne PWA, Mode léger & Diagnostics**
  - Ouvrir **Hors ligne** : montrer le poids réel de l'index synchronisé dans IndexedDB (`12,3 Ko gzip`), activer **Simuler mode hors ligne** + **Mode léger**, et effectuer une recherche locale instantanée (`< 2 ms`).
  - Terminer sur **Diagnostics** (lien pied de page) : afficher les métriques réelles mesurées (`Chargement < 3000 ms`, `BM25 < 200 ms`) et cliquer sur **Exécuter les 22 questions de référence** pour démontrer le **`22 / 22 PASS`**.

---

## 8. Check-list pré-soumission

- [x] **Modèle 4 niveaux strict** (`Publication → Passage → Claim → EvidenceCell`) + 4 schémas JSON validés.
- [x] **Aucune donnée inventée présentée comme réelle** : étiquetage permanent `DONNÉES DE DÉMONSTRATION`.
- [x] **API REST documentée (OpenAPI 3.1)** avec validation, pagination, erreurs structurées et `X-Response-Time-Ms`.
- [x] **PWA + Mode hors ligne réel** : `manifest.webmanifest`, `sw.js`, icônes PNG, stockage **IndexedDB** (`gzip` + `ETag`), recherche locale `< 200 ms`.
- [x] **Garde-fous scientifiques & éthiques** : distinction mesure/interprétation, corrélation/causalité, petits effectifs, traduction automatique signalée, mention *« Piste à valider par des experts »* sans avis médical.
- [x] **Accessibilité & frugalité** : contrastes WCAG AA, formes + libellés daltoniens, version tabulaire + CSV sur chaque graphique, mode léger, FR/EN JSON extensible.
- [x] **Tests & Build** : `npm run lint`, `npm test` (16/16), `npm run build` et vérification navigateur réel validés.
