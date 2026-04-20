# Migration Extraction PDF - Résumé d'Implémentation

## Changements Effectués

### 1. Microservice Python (`python-pdf-service/`)

**Fichiers créés:**
- `main.py` - Service FastAPI avec pdfplumber et Camelot
- `requirements.txt` - Dépendances Python
- `Dockerfile` - Configuration Docker
- `README.md` - Documentation d'utilisation

**Fonctionnalités:**
- Endpoint `/extract` - Extraction générique de tableaux
- Endpoint `/extract-debts` - Extraction optimisée des créances
- Parsing intelligent des montants TND (format tunisien)
- Détection automatique des clients, commerciaux et données
- Fallback automatique: pdfplumber → Camelot lattice → Camelot stream

### 2. API Route Next.js (`src/app/api/pdf-extract/route.ts`)

**Fonctionnalités:**
- Route POST pour recevoir les fichiers PDF
- Forwarding vers le service Python
- Fallback automatique sur `/api/ocr` (extraction legacy)
- Route GET `/health` pour vérifier la disponibilité du service Python

### 3. Transformateur de Données (`src/lib/table-extractor/transformer.ts`)

**Fonctionnalités:**
- Conversion des données Python en `ClientDebt[]`
- Classification automatique des documents (FT, IC, AV)
- Classification du risque par âge
- Gestion des commerciaux

### 4. Service OCR Mis à Jour (`src/lib/ocr.ts`)

**Nouvelles méthodes:**
- `extractDebtsFromPDF()` - Méthode recommandée utilisant Python
- `checkPythonServiceHealth()` - Vérification de santé

**Fallback intelligent:**
1. Essaie d'abord le service Python
2. Fallback sur extraction legacy si indisponible
3. Logging détaillé de la méthode utilisée

### 5. Page Import Mise à Jour (`src/app/import/page.tsx`)

**Changements:**
- Utilisation de `extractDebtsFromPDF()` au lieu de `extractTextFromPDF()`
- Affichage de la méthode utilisée (Python vs legacy) dans les logs

### 6. Docker Compose (`docker-compose.yml`)

**Services:**
- `pdf-service` - Microservice Python sur port 8000
- `nextjs` - Application Next.js sur port 9002

## Architecture

```
┌─────────────────┐      ┌─────────────────────┐      ┌──────────────────┐
│   Import Page   │─────▶ │  /api/pdf-extract   │─────▶ │ Python Service   │
│  (React/TS)     │      │  (Next.js Route)    │      │ (pdfplumber)     │
└─────────────────┘      └─────────────────────┘      └──────────────────┘
                                │                           │
                                │ (fallback)                │
                                ▼                           ▼
                         ┌─────────────┐           ┌──────────────┐
                         │ /api/ocr    │           │ JSON Debts   │
                         │ (legacy)    │           │ Structurés   │
                         └─────────────┘           └──────────────┘
```

## Avantages vs Extraction Actuelle

| Aspect | Ancien (pdf-parse) | Nouveau (pdfplumber) |
|--------|-------------------|----------------------|
| Extraction | Texte brut | Tableaux structurés |
| Parsing | Regex complexes | Détection colonnes native |
| Précision | Variable | Haute (positions exactes) |
| Fallback | Manuel | Automatique |
| Scannés | Échec | Détection possible |

## Démarrage

### Option 1: Docker Compose (Recommandé)

```bash
docker-compose up -d
```

Accès:
- App: http://localhost:9002
- API Python: http://localhost:8000

### Option 2: Développement Manuel

**Terminal 1 - Service Python:**
```bash
cd python-pdf-service
docker build -t pdf-extractor .
docker run -p 8000:8000 pdf-extractor
```

**Terminal 2 - Next.js:**
```bash
npm run dev
```

## Vérification

```bash
# Tester le service Python
curl http://localhost:8000/health

# Tester l'API Next.js
curl http://localhost:9002/api/pdf-extract
```

## Variables d'Environnement

```env
PDF_SERVICE_URL=http://localhost:8000
```

Par défaut: `http://localhost:8000`

## Prochaines Étapes Recommandées

1. **Tester avec des PDFs réels** - Vérifier la précision sur les "Etats de Recouvrement Client"
2. **Benchmark** - Comparer nombre de créances extraites (pdf-parse vs pdfplumber)
3. **Ajuster le parsing** - Affiner les patterns si nécessaire
4. **Monitoring** - Ajouter des métriques de performance et taux de succès
5. **Production** - Déployer le service Python sur un hôte avec Docker

## Notes

- L'ancien système (`pdf-parse`) reste fonctionnel comme fallback
- Le service Python détecte automatiquement les clients, commerciaux et montants
- Les montants sont parsés au format tunisien (espace = milliers, virgule = décimales)
- La classification des documents (FT/IC/AV) est préservée
