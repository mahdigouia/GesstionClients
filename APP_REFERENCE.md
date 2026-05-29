# 📚 RÉFÉRENCE COMPLÈTE — Gestion Clients Mehdi / GesstionClients

> **Fichier de contextualisation pour IA/Dev.**
> Ce document décrit l'intégralité de l'application : architecture, fonctionnalités, base de données, APIs, rôles utilisateurs, système de notifications push, et état d'avancement du développement.
> **Dernière mise à jour : 29 mai 2026**

---

## 🧭 Vue d'ensemble

**Nom du projet** : GesstionClients  
**Type** : Application web Next.js 15 de gestion de créances clients pour une équipe commerciale  
**Déploiement** : Vercel (Hobby plan) connecté au dépôt GitHub `mahdigouia/GesstionClients`  
**URL de production** : `https://gesstion-clients.vercel.app` (ou URL Vercel assignée)  
**Repository GitHub** : `https://github.com/mahdigouia/GesstionClients`  
**Branche principale** : `main` (déploiement automatique Vercel)

---

## 🛠️ Stack Technique

| Technologie | Version | Rôle |
|---|---|---|
| Next.js | 15.5.9 | Framework fullstack (App Router) |
| React | 19.2.1 | UI |
| TypeScript | 5 | Typage statique |
| Firebase Auth | 11.10.0 | Authentification email/mot de passe |
| Firestore | 11.10.0 | Base de données temps réel (client SDK) |
| TailwindCSS | 3.4 | Styles |
| Radix UI | Multiple | Composants UI accessibles |
| Recharts | 2.15 | Graphiques et visualisations |
| web-push | 3.6.7 | Envoi de notifications push Web Push (VAPID) |
| Vercel | Hobby | Hébergement + Cron Jobs (1x/jour max) |
| Tesseract.js | 5.1 | OCR local (extraction texte depuis images) |
| pdf-parse | 1.1.1 | Extraction texte depuis PDFs |
| GROQ API | - | NLP vocal (reconnaissance d'entités) |

---

## 🗂️ Structure du Projet

```
GesstionClients/
├── public/
│   ├── sw.js                    ← Service Worker (notifications push background)
│   ├── manifest.json            ← Manifeste PWA
│   ├── logo.png                 ← Logo principal
│   ├── icon-192x192.png         ← Icône PWA
│   └── icon-512x512.png         ← Icône PWA grande
│
├── src/
│   ├── app/                     ← Pages Next.js (App Router)
│   │   ├── page.tsx             ← Dashboard principal (/)
│   │   ├── layout.tsx           ← Layout racine avec providers
│   │   ├── clients/page.tsx     ← Onglet Clients (vue par client)
│   │   ├── analysis/page.tsx    ← Onglet Analyse
│   │   ├── contentieux/page.tsx ← Onglet Contentieux
│   │   ├── invoices/page.tsx    ← Onglet Factures (vue par ligne)
│   │   ├── import/page.tsx      ← Import de fichiers Excel/PDF
│   │   ├── settings/page.tsx    ← Paramètres + notifications push
│   │   ├── login/page.tsx       ← Page connexion
│   │   ├── register/page.tsx    ← Page inscription
│   │   └── api/
│   │       ├── webpush/
│   │       │   ├── notify/route.ts          ← Envoi push payment+conflit
│   │       │   ├── subscribe/route.ts       ← Enregistrement abonnement
│   │       │   ├── test-notification/route.ts ← Test push depuis Settings
│   │       │   ├── vapid-public-key/route.ts  ← Retourne la clé publique VAPID
│   │       │   └── generate-vapid/route.ts    ← Génère paires VAPID (usage admin)
│   │       ├── cron/
│   │       │   └── payment-notifications/route.ts ← Cron job backup (1x/jour)
│   │       ├── pdf-extract/route.ts         ← Extraction PDF via service Python
│   │       ├── ocr/route.ts                 ← OCR via Tesseract.js
│   │       ├── voice-nlp/route.ts           ← NLP vocal via GROQ API
│   │       └── rules/route.ts               ← Règles métier pour analysis
│   │
│   ├── components/
│   │   ├── Sidebar.tsx               ← Navigation principale
│   │   ├── AuthGuard.tsx             ← Protection routes + enregistrement SW
│   │   ├── ClientRemarkModal.tsx     ← Modal suivi relance (★ composant central)
│   │   ├── DebtTable.tsx             ← Tableau de créances
│   │   ├── Dashboard.tsx             ← Composant dashboard stats
│   │   ├── VoiceAssistant.tsx        ← Assistant vocal
│   │   ├── SmartCalculator.tsx       ← Calculateur intelligent
│   │   ├── NotificationPopover.tsx   ← Popover notifications in-app
│   │   ├── PaymentPromisesAgenda.tsx ← Agenda des promesses de paiement
│   │   ├── QuickClientProfile.tsx    ← Profil rapide d'un client
│   │   ├── CommercialAnalysis.tsx    ← Analyse par commercial
│   │   └── ...autres composants UI
│   │
│   ├── lib/
│   │   ├── firebase.ts          ← Initialisation Firebase (auth + db)
│   │   ├── AuthContext.tsx      ← Contexte Auth + rôles utilisateurs
│   │   ├── DebtContext.tsx      ← ★ Contexte global de l'app (données + push)
│   │   ├── analysis.ts          ← Service d'analyse des créances
│   │   ├── export.ts            ← Exports Excel/PDF/Word
│   │   ├── ocr.ts               ← Logique OCR locale
│   │   └── voiceNLP.ts          ← Logique NLP vocal
│   │
│   └── types/
│       └── debt.ts              ← Types TypeScript (ClientDebt, RecoveryAction, etc.)
│
├── CONTEXT_NOTIFICATIONS.md    ← Contexte spécifique aux notifications push
├── FIREBASE_CONFIG.md          ← Guide de configuration Firebase
├── vercel.json                 ← Config Vercel (cron job 1x/jour)
└── package.json
```

---

## 👥 Système de Rôles Utilisateurs

### Rôles disponibles

| Rôle | Description | Accès |
|---|---|---|
| `admin` | Administrateur | Tout (import, paramètres, réinitialisation, logs, toutes données) |
| `gestionnaire` | Gestionnaire | Toutes données, pas d'import, pas de config système |
| `commercial` | Commercial terrain | Vue Clients uniquement (filtré par son code commercial) |
| `pending` | En attente | Compte créé mais pas encore activé par un admin |

### Admins hardcodés (auto-promotion)
- `moslem.gouia@gmail.com`
- `mahdigouia@gmail.com`

### Où sont stockés les rôles ?
**Firestore** → Collection `users` → Document `{uid}` → champ `role`

### Logique d'accès commercial
Un utilisateur `commercial` possède un `commercialCode` (ex: `C01`, `C02`) stocké dans son document Firestore. La page Clients filtre automatiquement les créances pour n'afficher que celles qui correspondent à son code commercial.

---

## 🗄️ Structure Firestore (Base de données)

### Collections principales

#### `app_data` / document `main`
Document unique contenant toutes les données centrales :
```typescript
{
  debts: ClientDebt[],         // Toutes les créances actives
  archiveDebts: ClientDebt[],  // Créances archivées (imports précédents)
  recoveryActions: RecoveryAction[],
  clientRemarks: Record<string, ClientRemark[]>,
  readAlertIds: string[],
  settings: AppSettings,
  history: HistoryPoint[],
  updatedAt: Timestamp,
  updatedBy: string,
  debtCount: number
}
```

#### `users` / document `{uid}`
```typescript
{
  role: 'admin' | 'gestionnaire' | 'commercial' | 'pending',
  commercialCode: string | null,  // ex: 'C01'
  email: string,
  firstName: string,
  lastName: string,
  createdAt: Timestamp
}
```

#### `push_subscriptions` / document `{hash_endpoint}`
```typescript
{
  uid: string,
  email: string,
  subscription: PushSubscription,  // endpoint + keys.p256dh + keys.auth
  userAgent: string,
  createdAt: string
}
```

#### `pending_payments` / document auto-id
```typescript
{
  clientName: string,
  content: string,         // texte de la remarque
  promiseAmount: number,
  user: string,            // email
  createdAt: string,
  status: 'pending' | 'sent'
}
```

#### `notifications` / document auto-id
```typescript
{
  type: 'payment' | 'conflit',
  message: string,
  severity: 'low' | 'high',
  createdAt: string,
  status: 'pending',
  metadata: { clientName: string }
}
```

#### `audit_logs` / document `{timestamp}_{user}`
```typescript
{
  user: string,
  action: string,
  details: string,
  timestamp: Timestamp
}
```

---

## 📊 Types de Données Principaux

### `ClientDebt`
```typescript
{
  id: string,
  clientName: string,
  clientCode: string,
  commercialCode: string,    // ex: 'C01'
  commercialName: string,
  documentNumber: string,    // ex: 'FT23001234'
  amount: number,            // montant original de la facture
  balance: number,           // solde restant dû
  age: number,               // âge de la créance en jours
  dueDate?: string,
  sourceFile: string,        // nom du fichier Excel source
  lastImportDate: string,
  isRecentlyUpdated?: boolean,
  isContentieux?: boolean,   // age > 365 jours
  isArchived?: boolean
}
```

### `ClientRemark`
```typescript
{
  id: string,
  clientName: string,
  content: string,     // commence par: 'Payé :', 'Payé Partiellement :', 'Reporté :', 'Client à Conflit :'
  date: string,
  user: string,        // email de l'utilisateur
  promiseDate?: string,
  promiseAmount?: number
}
```

---

## 📄 Pages de l'Application

### `/` — Dashboard
- KPIs : total créances, total encaissé, taux de recouvrement, créances contentieuses
- Graphique d'évolution temporelle
- Alertes automatiques (créances critiques, tendances)
- Agenda des promesses de paiement
- Assistant vocal intégré

### `/clients` — Vue Clients
- Liste groupée par client avec toutes leurs factures
- Filtres avancés : commercial, contentieux, retenu, partiel, âge, montant min
- Barre de recherche
- **Deep link depuis push notifications** : `?search=NOM&open=remark` → auto-filtre + ouvre modal
- Bouton 💬 sur chaque client → ouvre `ClientRemarkModal`

### `/invoices` — Vue Factures
- Tableau de toutes les lignes de créance
- Tri et filtres multiples
- Export Excel/PDF

### `/analysis` — Analyse
- Analyse par commercial
- Top clients à risque
- Graphiques de répartition

### `/contentieux` — Contentieux
- Liste des créances de plus de 365 jours
- Actions légales et suivi

### `/import` — Import (Admin/Gestionnaire seulement)
- Upload de fichiers Excel (.xlsx, .xls)
- Upload de PDFs (via service OCR Python ou Tesseract local)
- Fusion intelligente avec les données existantes (par commercialCode et sourceFile)

### `/settings` — Paramètres
- Paramètres d'analyse (seuil contentieux, retenu, etc.)
- **Section Notifications Push** :
  - Activer/Désactiver les notifications sur l'appareil actuel
  - Bouton "Tester la notification push"

---

## 🔔 Système de Notifications Push (Web Push)

### Architecture
```
Utilisateur marque client PAYÉ ou CONFLIT (ClientRemarkModal)
    ↓
DebtContext.tsx → getDocs(push_subscriptions)  [client-side, authentifié]
    ↓
POST /api/webpush/notify { clientName, type, subscriptions[] }
    ↓
Serveur Vercel → webpush.sendNotification() avec clés VAPID
    ↓
Serveurs Push Google (FCM) / Mozilla
    ↓
Service Worker sw.js reçoit l'événement 'push'
    ↓
self.registration.showNotification() → bannière native OS
    ↓
Clic sur la notification → navigation vers /clients?search=NOM&open=remark
```

### Variables d'environnement requises (Vercel)
| Variable | Description |
|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Clé publique VAPID (visible côté client) |
| `VAPID_PRIVATE_KEY` | Clé privée VAPID (uniquement serveur) |
| `VAPID_SUBJECT` | `mailto:moslem.gouia@gmail.com` |
| `PAYMENT_WEBHOOK_URL` | URL webhook Discord/Slack (optionnel) |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Config Firebase |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Config Firebase |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Config Firebase |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Config Firebase |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Config Firebase |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Config Firebase |
| `GROQ_API_KEY` | API GROQ pour NLP vocal |
| `PDF_SERVICE_URL` | URL du service Python PDF (Render) |

### Types de notifications push

#### Type `payment` (Paiement recouvré)
- **Déclencheur** : remarque commençant par `Payé :`
- **Titre** : `💰 Nouveau Paiement Recouvré !`
- **Corps** : `[user] a marqué le client [NOM] comme PAYÉ ([montant] TND).`
- **Action** : `💰 Voir les factures du client`
- **URL cible** : `/clients?search=NOM_CLIENT&open=remark`
- **Vibration** : `[200, 100, 200]`

#### Type `conflit` (Client en conflit)
- **Déclencheur** : remarque commençant par `Client à Conflit :`
- **Titre** : `⚠️ ALERTE CONFLIT CLIENT !`
- **Corps** : `⚠️ [user] a signalé un CONFLIT avec le client [NOM] !`
- **Action** : `⚠️ Voir le client`
- **URL cible** : `/clients?search=NOM_CLIENT&open=remark`
- **Vibration** : `[300, 100, 300, 100, 300, 100, 300]` (urgence)
- **requireInteraction** : `true` (reste visible jusqu'à clic)

### Service Worker (`public/sw.js`)
- `install` : `skipWaiting()` → activation immédiate sans attendre fermeture des onglets
- `activate` : `clients.claim()` → prend le contrôle de tous les onglets immédiatement
- `push` : reçoit le payload JSON, affiche `showNotification` avec `requireInteraction: true`
- `notificationclick` : navigue vers l'URL absolue `origin + relativePath`
- `fetch` : handler vide (requis pour reconnaissance SW)

### Activation côté utilisateur
1. Aller dans **Paramètres** de l'app
2. Section "Notifications Push" → cliquer **Activer sur cet appareil**
3. Autoriser dans la boîte de dialogue du navigateur
4. Le document est créé dans Firestore `push_subscriptions/{uid_hash}`

---

## 📝 ClientRemarkModal — Composant Central

Le composant `src/components/ClientRemarkModal.tsx` est le cœur du workflow commercial.

### Statuts de remarque disponibles
| Statut | Préfixe généré | Notification push |
|---|---|---|
| Payé (total) | `Payé : Règlement total par [mode] de [montant] TND.` | ✅ Type `payment` |
| Payé Partiellement | `Payé Partiellement : [mode] de [montant] TND.` | ✅ Type `payment` |
| Reporté | `Reporté : [raison]. (Prochaine visite le DD/MM/YYYY)` | ❌ |
| Client à Conflit | `Client à Conflit : [description]` | ✅ Type `conflit` |

### Modes de règlement
- `versement` → "Versement de X TND"
- `espece` → "Règlement en espèce de X TND"
- `traite` → "Traite de X TND"
- `cheque` → "Règlement total par chèque de X TND"

### Bouton Réinitialiser Paiements (Admin uniquement)
- Supprime toutes les remarques `Payé*` de l'historique du client
- Supprime les documents `pending_payments` correspondants en Firestore
- Visible uniquement pour `admin` ou les emails hardcodés

---

## 🔄 Flux d'Import de Données

### Import Excel
1. L'admin/gestionnaire va sur `/import`
2. Upload du fichier `.xlsx` ou `.xls`
3. Parsing côté client via la librairie `xlsx`
4. Fusion avec les données existantes :
   - Données filtrées par `sourceFile` ET `commercialCode`
   - Les anciennes données du même fichier sont archivées (pas supprimées)
   - Les nouvelles données remplacent les actives
5. Sauvegarde dans Firestore `app_data/main`

### Import PDF
- Tentative via le service Python externe (`PDF_SERVICE_URL` sur Render.com)
- Fallback sur OCR local Tesseract.js si le service est indisponible
- L'OCR extrait les tableaux de données (numéros de facture, montants, dates)

---

## ⚙️ APIs Disponibles

| Endpoint | Méthode | Description |
|---|---|---|
| `/api/webpush/notify` | POST | Envoie push à tous les abonnés (payment ou conflit) |
| `/api/webpush/subscribe` | POST | Enregistre/supprime un abonnement push |
| `/api/webpush/test-notification` | POST | Envoie une notif de test à un abonnement spécifique |
| `/api/webpush/vapid-public-key` | GET | Retourne la clé publique VAPID |
| `/api/webpush/generate-vapid` | GET | Génère une nouvelle paire VAPID (admin) |
| `/api/cron/payment-notifications` | GET | Cron backup - envoie les push pending (1x/jour) |
| `/api/pdf-extract` | POST | Extraction texte depuis PDF (service Python) |
| `/api/ocr` | POST | OCR Tesseract sur image |
| `/api/voice-nlp` | POST | NLP GROQ pour commandes vocales |
| `/api/rules` | GET | Règles métier d'analyse |

### Corps du POST `/api/webpush/notify`
```json
{
  "clientName": "NOM DU CLIENT",
  "content": "Payé : Règlement total par chèque...",
  "promiseAmount": 1500,
  "user": "email@exemple.com",
  "type": "payment",
  "subscriptions": [
    {
      "id": "doc_id_firestore",
      "subscription": {
        "endpoint": "https://fcm.googleapis.com/...",
        "keys": {
          "p256dh": "base64url...",
          "auth": "base64url..."
        }
      }
    }
  ]
}
```

---

## 🚀 Déploiement & CI/CD

### Workflow
```
Développeur local → git push origin main → GitHub → Vercel auto-deploy
```

### Commandes locales
```bash
npm run dev        # Démarrage dev sur port 9002
npm run build      # Build production
npm run typecheck  # Vérification TypeScript
npm run lint       # Linting
```

### Vercel Configuration (`vercel.json`)
```json
{
  "crons": [
    {
      "path": "/api/cron/payment-notifications",
      "schedule": "0 0 * * *"
    }
  ]
}
```
> ⚠️ Hobby plan : 1 seul cron max par jour. Ne pas changer la fréquence ou le build sera bloqué.

---

## 🔐 Sécurité & Règles Firestore

> ⚠️ **IMPORTANT** : Le SDK client Firebase (utilisé côté navigateur) est soumis aux règles de sécurité Firestore. Le SDK côté serveur (routes Next.js) n'est PAS authentifié et peut être bloqué par ces règles.

### Contournement des permissions serveur
Pour cette raison, la lecture de `push_subscriptions` se fait **côté client** (dans `DebtContext.tsx`, où l'utilisateur est connecté), et les abonnements sont passés en `body` de la requête API. Le serveur ne lit jamais directement cette collection.

### Collections nécessitant authentification (client uniquement)
- `push_subscriptions` (lecture/écriture)
- `notifications` (écriture)
- `pending_payments` (lecture/écriture)
- `app_data` (lecture/écriture)

---

## 📱 Compatibilité Push Notifications

| Plateforme | Navigateur | Support |
|---|---|---|
| Android | Chrome | ✅ Fonctionne en background |
| Android | Firefox | ✅ Fonctionne en background |
| iOS 16.4+ | Safari (PWA) | ✅ App ajoutée à l'écran d'accueil uniquement |
| iOS | Chrome/Firefox | ❌ Non supporté (limitation Apple) |
| Desktop | Chrome/Firefox/Edge | ✅ Fonctionne en background |
| macOS | Safari 16+ | ✅ Avec permission système |

---

## 🐛 Problèmes Connus & Solutions

### 1. Erreur Firestore "Missing or insufficient permissions" en API route
**Cause** : L'API Next.js (serveur) n'est pas authentifiée, Firestore bloque la lecture.  
**Solution** : Récupérer les données depuis le client React (utilisateur connecté) et les passer dans le body de la requête API.

### 2. Service Worker non mis à jour après modification de sw.js
**Cause** : L'ancien SW reste actif jusqu'à fermeture de tous les onglets.  
**Solution** : `skipWaiting()` dans l'event `install` force l'activation immédiate.

### 3. Vercel Hobby Cron Error
**Cause** : Le plan Hobby autorise seulement 1 cron par jour.  
**Solution** : Schedule fixé à `0 0 * * *` (minuit). Ne pas modifier.

### 4. Notifications reçues seulement quand l'app est ouverte
**Cause** : SW pas activé (`skipWaiting`/`clients.claim` manquants) OU subscription expirée.  
**Solution** : Désactiver et réactiver les notifications dans Paramètres pour forcer un nouveau subscription frais.

---

## 📋 Fonctionnalités À Développer (Backlog)

- [ ] Rapport d'activité quotidien par email (via cron)
- [ ] Centre de notifications (historique des 20 dernières alertes)
- [ ] Filtrage des notifications par commercial (ne notifier que les autres commerciaux, pas l'émetteur)
- [ ] Lecture du QR code sur facture pour lier au client
- [ ] Export rapport PDF mensuel automatisé

---

## 🔑 Accès & Contacts

| Élément | Valeur |
|---|---|
| Admin principal | `moslem.gouia@gmail.com` |
| Admin secondaire | `mahdigouia@gmail.com` |
| GitHub | `mahdigouia/GesstionClients` |
| Service PDF (Render) | `https://pdf-extractor-zcni.onrender.com` |

---

*Ce document est le point de vérité unique pour comprendre et reprendre le développement de l'application depuis n'importe quel appareil ou IDE.*

---

## 🗂️ Structure du Projet — Fichiers Public (mis à jour)

```
public/
├── sw.js                ← Service Worker push notifications
├── manifest.json        ← Manifeste PWA
├── badge-96x96.png      ← Badge monochrome MDS (barre statut Android)
├── icon-192x192.png     ← Icône PWA couleur (corps notification)
├── icon-512x512.png     ← Icône PWA grande
└── logo.png             ← Logo principal
```

### Navigation depuis notification push (deep link)
- URL format : `/clients?search=NOM_CLIENT&open=remark`
- La page `/clients` lit ces paramètres via `useSearchParams()`
- Auto-filtre + expand + ouvre le `ClientRemarkModal` du client
- L'URL est nettoyée après avec `router.replace('/clients')`

### Service Worker — Stratégie de clic mobile (postMessage)
```
Clic notification (mobile)
  ↓
SW cherche une fenêtre de l'app ouverte (matchAll)
  ├── Fenêtre trouvée → postMessage({ type: 'SW_NAVIGATE', url })
  │                   → AuthGuard écoute ce message → router.push(url)
  └── Pas de fenêtre → clients.openWindow(absoluteUrl)
```
> `postMessage` + `router.push()` est plus fiable que `client.navigate()` sur Android Chrome.

---

## 📦 Changelog des Commits

> Cette section est mise à jour à chaque nouveau commit poussé sur `main`.

| Date | Hash | Description |
|---|---|---|
| 29/05/2026 | `a28dffc` | `feat(push)` : fix background notifications - skipWaiting/claim, conflit type, improved sw.js |
| 29/05/2026 | `12124f7` | `feat(push)` : click notification redirects directly to client invoices and remark modal |
| 29/05/2026 | `8792de0` | `fix(sw)` : fix sw.js click handler - absolute URL navigation and remove duplicate code |
| 29/05/2026 | `d8ac105` | `docs` : add APP_REFERENCE.md - comprehensive app context for AI/Dev continuity |
| 29/05/2026 | `b80094d` | `feat(push)` : add MDS Group monochrome badge icon for Android status bar notifications |
| 29/05/2026 | `40166dd` | `fix(push)` : proper transparent badge PNG + async mobile notification click handler |
| 29/05/2026 | `[next]`  | `fix(sw)` : reliable mobile click handler via postMessage + SW_NAVIGATE listener in AuthGuard |

---

*Ce document est le point de vérité unique pour comprendre et reprendre le développement de l'application depuis n'importe quel appareil ou IDE.*
