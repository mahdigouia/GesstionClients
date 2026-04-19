# GesstionClients - Analyse Intelligente des Créances

Application web moderne et intelligente pour la gestion et l'analyse des créances clients avec extraction automatique via OCR.

## 🎯 Objectif

Remplacer l'analyse manuelle des états de recouvrement par une solution automatique, fiable et orientée décision capable de:
- Lire automatiquement des fichiers PDF/scans avec OCR
- Extraire et structurer les données de créances
- Analyser les risques et générer des alertes
- Exporter des rapports détaillés

## ✨ Fonctionnalités

### 📄 OCR & Extraction
- **Extraction automatique** via Tesseract.js
- **Support des formats**: PDF, PNG, JPG, JPEG, TIFF
- **Parsing intelligent** des données structurées
- **Validation et nettoyage** automatique des erreurs OCR

### 🧠 Analyse Intelligente
- **Classification par risque**:
  - 🟢 0-30 jours → Sain
  - 🟡 31-90 jours → À surveiller  
  - 🟠 91-365 jours → En retard
  - 🔴 >365 jours → Critique
- **Indicateurs clés**: taux de recouvrement, total par client, répartition par ancienneté
- **Détection automatique**: retards fréquents, créances anciennes, paiements partiels

### 📈 Dashboard Interactif
- **Graphiques dynamiques** avec Recharts
- **KPIs en temps réel**
- **Alertes visuelles** avec recommandations
- **Filtres avancés** par client, date, niveau de risque

### 📤 Export Multi-Formats
- **Excel** avec analyse détaillée
- **PDF** du dashboard
- **Rapport texte** avec recommandations

## 🛠 Architecture Technique

### Frontend
- **Framework**: Next.js 15 avec TypeScript
- **UI**: Tailwind CSS + shadcn/ui
- **Graphiques**: Recharts
- **OCR**: Tesseract.js
- **Upload**: react-dropzone

### Structure du Projet
```
src/
├── app/                    # Pages Next.js
├── components/            # Composants React
│   ├── ui/               # Composants UI de base
│   ├── FileUpload.tsx     # Upload de fichiers
│   ├── Dashboard.tsx      # Dashboard principal
│   └── DebtTable.tsx      # Tableau des créances
├── lib/                   # Services métier
│   ├── ocr.ts            # Service OCR
│   ├── analysis.ts       # Analyse des données
│   └── export.ts         # Export multi-formats
└── types/                 # Types TypeScript
    └── debt.ts           # Modèles de données
```

## 🚀 Installation

1. **Cloner le projet**
```bash
git clone https://github.com/mahdigouia/GesstionClients.git
cd GesstionClients
```

2. **Installer les dépendances**
```bash
npm install
```

3. **Démarrer le développement**
```bash
npm run dev
```

L'application sera disponible sur `http://localhost:9002`

## 📖 Utilisation

### 1. Importer un fichier
- Glissez-déposez un fichier PDF ou une image
- Ou cliquez pour sélectionner un fichier
- Formats supportés: PDF, PNG, JPG, JPEG, TIFF

### 2. Traitement automatique
L'application effectue automatiquement:
- **Extraction OCR** du texte
- **Parsing** des données de créances
- **Analyse** des risques
- **Génération** des alertes

### 3. Explorer les résultats
- **Dashboard**: Vue d'ensemble avec graphiques
- **Détail**: Tableau complet des créances filtrable
- **Résumé**: Statistiques clés et alertes

### 4. Exporter les données
- **Excel**: Pour analyse approfondie
- **PDF**: Pour présentation
- **Rapport**: Pour documentation

## 📊 Format de Données Attendu

L'application reconnaît les états de recouvrement avec cette structure:

```
Code Client | Nom Client | N° Facture | Date | Montant | Payé | Solde | Âge
```

Les données sont automatiquement:
- **Nettoyées** (correction des erreurs OCR)
- **Validées** (cohérence montant/solde)
- **Classifiées** par niveau de risque

## 🔧 Configuration

### Variables d'environnement
```env
# Configuration OCR (optionnel)
TESS_LANG=fra
```

### Personnalisation
Les patterns de parsing peuvent être adaptés dans `src/lib/ocr.ts` pour différents formats de fichiers.

## 🚀 Déploiement

### Vercel (Recommandé)
```bash
npm run build
vercel --prod
```

### Autres plateformes
L'application est compatible avec toute plateforme supportant Next.js.

## 🤝 Contribuer

1. Fork du projet
2. Créer une branche de fonctionnalité
3. Commit des changements
4. Push vers la branche
5. Créer une Pull Request

## 📝 Licence

Ce projet est sous licence MIT.

## 🆘 Support

Pour toute question ou problème:
- Créer une issue sur GitHub
- Contacter le développeur
