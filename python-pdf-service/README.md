# Microservice d'Extraction PDF (Python)

Ce microservice utilise **pdfplumber** et **Camelot** pour extraire les tableaux des PDFs natifs avec une haute précision.

## Architecture

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│  Next.js App    │ ───▶ │  /api/pdf-extract │ ───▶ │ Python Service │
│  (Import Page)  │      │  (Route Handler)  │      │ (pdfplumber)   │
└─────────────────┘      └──────────────────┘      └─────────────────┘
```

## Démarrage avec Docker

### 1. Démarrer uniquement le service Python

```bash
cd python-pdf-service
docker build -t pdf-extractor .
docker run -p 8000:8000 pdf-extractor
```

### 2. Démarrer avec Docker Compose (toute l'application)

```bash
# À la racine du projet
docker-compose up -d
```

Cela démarre :
- Le service Python sur le port 8000
- L'application Next.js sur le port 9002

## Démarrage en Développement (sans Docker)

### Prérequis

- Python 3.11+
- Ghostscript (`apt-get install ghostscript` ou `brew install ghostscript`)
- Poppler (`apt-get install poppler-utils` ou `brew install poppler`)

### Installation

```bash
cd python-pdf-service
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## API Endpoints

### POST `/extract`
Extrait les tableaux d'un PDF avec métadonnées.

**Request:** `multipart/form-data` avec fichier PDF

**Response:**
```json
{
  "success": true,
  "tables": [
    {
      "page": 1,
      "table_index": 0,
      "data": [["cell1", "cell2"], ["cell3", "cell4"]],
      "parsing_method": "pdfplumber"
    }
  ],
  "total_pages": 5,
  "method_used": "pdfplumber"
}
```

### POST `/extract-debts`
Extrait directement les créances au format structuré (endpoint optimisé).

**Request:** `multipart/form-data` avec fichier PDF

**Response:**
```json
{
  "success": true,
  "debts": [
    {
      "client_code": "0424",
      "client_name": "LA MANGEARIA",
      "due_date": "2024-01-15",
      "document_number": "FT123456",
      "amount": 1264.277,
      "settlement": 0.0,
      "balance": 1264.277
    }
  ],
  "count": 42,
  "commercial": {
    "code": "C01",
    "name": "MOHAMED TRABELSI"
  }
}
```

### GET `/health`
Vérification de santé du service.

**Response:**
```json
{
  "status": "healthy",
  "service": "pdf-extractor",
  "version": "1.0.0"
}
```

## Stratégies d'Extraction

1. **pdfplumber** (primaire): Extraction native des tableaux avec positions
2. **Camelot lattice** (fallback): Détection de lignes de tableau
3. **Camelot stream** (dernier recours): Détection par flux de texte

## Configuration

La configuration se fait via variables d'environnement côté Next.js :

```env
PDF_SERVICE_URL=http://localhost:8000
```

## Dépannage

### Erreur: "Ghostscript is not installed"
```bash
# Ubuntu/Debian
sudo apt-get install ghostscript poppler-utils

# macOS
brew install ghostscript poppler

# Windows
# Télécharger et installer Ghostscript depuis https://ghostscript.com/download/gsdnld.html
```

### Le service Python ne répond pas
Vérifiez que le service est bien démarré :
```bash
curl http://localhost:8000/health
```

L'application Next.js a un fallback automatique sur l'extraction legacy si le service est indisponible.
