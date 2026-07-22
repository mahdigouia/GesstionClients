# Règles Métier et Plan d'Analyse (GesstionClients)

Ce document répertorie toutes les règles métier appliquées par l'application pour classifier les créances, détecter les contentieux, et évaluer les niveaux de risque après extraction OCR des "États de Recouvrement".

## 1. Types de Pièces (Documents)

L'application identifie le type de document grâce au préfixe du Numéro de Pièce (ex: `IC000262`, `FT252992`, `AV12345`, `AVT250102`).

| Préfixe | Type de Document | Description |
| :--- | :--- | :--- |
| **IC** | Facture Impayée | Factures de type "Impayé Client". Ces factures sont soumises à la règle stricte des contentieux (voir section 3). |
| **AV** | Avoir (Note de crédit) | Document créditeur. Automatiquement considéré avec un statut de paiement `Payé` (solde neutre). N'est jamais classifié en contentieux. |
| **AVT** | Avoir sur Vente | Document créditeur lié à un retour ou annulation de vente. **Le montant est négatif** et doit être comptabilisé en moins dans le solde du client. Statut `Payé`, jamais en contentieux. |
| **AVS** | Avoir Service | Document créditeur lié à un avoir de service. **Le montant est négatif** et doit être extrait en négatif. Statut `Payé`, jamais en contentieux. |
| **FRS** | Facture de Retour Sfax | Facture avoir (note de crédit) liée à un retour Sfax. **Le montant est négatif** et doit être extrait en négatif. Statut `Payé`, jamais en contentieux. |
| **FRT** | Facture de Retour Tunis | Facture avoir (note de crédit) liée à un retour Tunis. **Le montant est négatif** et doit être extrait en négatif. Statut `Payé`, jamais en contentieux. |
| **FT** | Facture de Vente | Facture standard. Son statut de paiement est finement analysé selon le pourcentage du règlement par rapport au montant initial (voir section 2). |
| **Autre** | Document Générique | Par défaut, tout autre document avec un solde > 0 est considéré comme `Non payé`. |

## 2. Statut de Paiement (Paiement Partiel, Retenus...)

Pour les factures standard (**FT**), l'application analyse le ratio entre le *Solde restant* et le *Montant total* pour affiner le statut de paiement :

1.  **Soldé (`paid`)** : Solde ≤ 0.
2.  **Impayé total (`unpaid`)** : Règlement = 0.
3. **Retenus non réglé (`retained`)** : Le ratio (Solde / Montant) est compris entre **0.5% et 1.5%**. Cela indique souvent une petite retenus, un timbre, ou une erreur d'arrondi plutôt qu'un réel impayé problématique.
4.  **Paiement partiel (`partial`)** : Le ratio (Solde / Montant) est strictement supérieur à 1.5% et inférieur à 99%. Le client a effectué un versement significatif mais n'a pas tout réglé.

### Filtres de Statut de Paiement (UI)

L'interface utilisateur propose des filtres dédiés pour identifier rapidement les factures selon leur statut de paiement :

*   **🛡️ Filtre "Retenus 0.5%-1.5%"** : Affiche uniquement les factures **FT** et **FS** dont le ratio Solde/Montant est compris entre 0.5% et 1.5%. Ces factures représentent des retenus, timbres, ou erreurs d'arrondi. Ce filtre fonctionne **indépendamment de la valeur du règlement** (peut être 0 ou > 0).
*   **💳 Filtre "Paiement partiel 1.5%-99%"** : Affiche uniquement les factures **FT** et **FS** avec un ratio Solde/Montant entre 1.5% et 99%. Ce filtre identifie les factures partiellement payées ou en cours de règlement. Il fonctionne **indépendamment de la valeur du règlement** (peut être 0 ou > 0).

**Important** : Ces deux filtres s'appliquent uniquement aux factures de type **FT** (Facture de Vente) et **FS** (Facture de Service), car seules celles-ci peuvent avoir des statuts de paiement intermédiaires. Les avoirs (AV/AVT/AVS/FRS/FRT) sont toujours considérés comme "Payés".

## 3. Règle des "Contentieux"

La qualification de **Contentieux** (`isContentieux = true`) n'est pas appliquée à tous les documents. Elle obéit à des conditions strictes concernant le type de document ou l'ancienneté :

*   **Condition Générale** : Tout document dont le solde est supérieur à 0 et l'ancienneté (Âge) dépasse strictement **365 jours**.
*   **Par Type de Pièce** :
    *   **IC** (Impayé Client) : Devient contentieux si l'âge > 365 jours ET solde > 0.
    *   **FT** (Facture de Vente) et **FS** (Facture de Service) : Devient contentieux si l'âge > 365 jours ET solde > 0.
    *   **AV / AVT / AVS / FRS / FRT** : Jamais en contentieux.

*Exemple pratique :* 
- La facture `IC000262` âgée de 2436 jours avec un solde de 1264,277 TND **est** un contentieux.
- La facture `FT260304` âgée de plus de 365 jours non soldée **est** également classée en contentieux depuis cette mise à jour (en plus d'avoir un risque "Critique").

## 4. Évaluation du Risque (Risk Level)

Chaque ligne de créance reçoit un niveau de risque, indépendant du type de pièce, basé uniquement sur **l'ancienneté (Âge)** :

*   🟢 **Sain (`healthy`)** : Solde = 0 OU Âge ≤ 30 jours.
*   🟡 **À surveiller (`monitoring`)** : Âge compris entre 31 et 90 jours.
*   🟠 **En retard (`overdue`)** : Âge compris entre 91 et 365 jours.
*   🔴 **Critique (`critical`)** : Âge supérieur à 365 jours.

## 5. Règles Spécifiques d'Extraction (OCR & Parsing Tunisien)

Pour traiter les relevés de comptes locaux, l'Extracteur OCR suit des règles spécifiques aux devises tunisiennes :
*   **Séparateur de milliers** : L'espace (ex: `12 771,360` ou `1 264,277`). L'application doit recoller ces chiffres avant de calculer pour éviter que "1" soit confondu avec un numéro et "264,277" avec le montant.
*   **Décimales** : L'application s'attend à une virgule suivie d'exactement 3 chiffres décimaux pour isoler les montants (`,\d{3}`).
*   **Montants négatifs** : Les documents `AVT`, `AVS`, `FRS` et `FRT` peuvent avoir un montant négatif (ex: `-28,808`). Le signe `-` doit être préservé lors du parsing. Ces factures avoirs sont comptabilisées en négatif dans le solde du client.
*   **Noms de clients avec chiffres** : Un nom de client peut contenir des chiffres (ex: `VIVARIUM 2 COMMERCE`). Le parser ne doit pas confondre ces chiffres avec un code client ou un nouveau bloc.
*   **Cohérence Mathématique** : L'algorithme valide que `Montant - Règlement ≈ Solde` (avec une tolérance de 1 TND) pour être certain de ne pas capturer de mauvais chiffres sur des documents mal scannés.

## 6. Méthodes de Calcul des Indicateurs (KPI)

Pour garantir la fiabilité des rapports, les formules suivantes sont appliquées dans l'application :

### 1. Widgets du Tableau de Bord (Cards)

*   **Total Créances** : Somme de tous les montants initiaux extraits des documents.
    *   *Formule* : `Σ Montant`
*   **En attente (Solde)** : Somme de tous les soldes restants à payer extraits.
    *   *Formule* : `Σ Solde`
*   **Taux d'Impayés Global (Carte Verte)** : Part de l'argent dû par rapport au montant total facturé.
    *   *Formule* : `(Σ Solde / Σ Montant) * 100`

### 2. Indicateurs de Performance (Sidebar Gauche)

*   **Recouvrement Global** : Mesure l'efficacité historique du recouvrement sur la base des règlements déjà effectués.
    *   *Formule* : `(Σ Règlements / Σ Montant) * 100`
*   **Taux Courant (Sans contentieux)** : Mesure la performance sur l'activité récente en excluant les factures de plus de 365 jours.
    *   *Formule* : `(Σ Règlements_hors_contentieux / Σ Montant_hors_contentieux) * 100`

### 3. Note sur la Cohérence des Chiffres
Si `Taux d'Impayé + Taux de Recouvrement` n'est pas égal à 100%, cela signifie que pour certaines lignes du document PDF, le `Montant Initial` n'est pas simplement égal à `Règlement + Solde` (par exemple en cas d'avoirs, de remises, ou de dettes déjà provisionnées dans le document source). L'application respecte les chiffres bruts tels qu'ils sont écrits dans le document.

## 7. Règle d'Unicité des Sources
... (lignes existantes)

## 8. Filtres d'Exclusion par Âge (Interface Clients)

Pour permettre une analyse focalisée sur les créances anciennes, l'application propose 5 filtres d'exclusion multisélectionnables. Lorsqu'un filtre est activé (badge rouge), toutes les factures dont l'âge est compris dans la plage sélectionnée sont masquées de l'affichage et exclues du calcul du solde client.

| Plage d'Âge | Catégorie | Description |
| :--- | :--- | :--- |
| **0 - 15 jours** | Très Récent | Factures venant d'être émises, flux de trésorerie immédiat. |
| **16 - 30 jours** | Récent | Factures en attente de premier cycle de règlement. |
| **31 - 60 jours** | À Surveiller | Premier niveau de retard, nécessite une vigilance commerciale. |
| **61 - 100 jours** | Retard Modéré | Retard confirmé, nécessite des relances actives. |
| **101 - 364 jours** | Retard Important | Phase pré-contentieuse, risque élevé de non-recouvrement. |

**Comportement** :
*   **Multisélection** : On peut exclure plusieurs tranches simultanément (ex: exclure tout ce qui a moins de 60 jours).
*   **Impact calculé** : Le solde total affiché par client est dynamiquement recalculé pour ne prendre en compte que les factures non exclues.

*   **Synergie** : Ce filtre peut être combiné avec les exclusions d'âge pour identifier les gros montants très anciens.

## 10. Gestion des Imports (Multi-fichiers)

L'application permet l'importation simultanée de plusieurs documents PDF. La gestion des données suit une logique de **fusion intelligente par source** :

*   **Batch processing** : Lorsqu'un utilisateur sélectionne plusieurs fichiers, l'application extrait les données de chaque fichier individuellement, puis effectue une mise à jour groupée de l'état global.
*   **Règle de remplacement par fichier** : L'importation d'un fichier nommé `C01.pdf` remplacera toutes les données précédemment stockées associées à ce même nom de fichier `C01.pdf`. Cela permet de mettre à jour un état de recouvrement sans dupliquer les factures si on importe une version plus récente du même document.
*   **Persistance** : Les données sont synchronisées en temps réel sur **Firebase Firestore** (collection `shared_data/current_debts`) et sauvegardées localement dans le `localStorage` du navigateur comme secours.

## 11. Règles d'Ordre d'Affichage (Sorting)

Pour garantir une expérience cohérente avec les documents originaux, l'ordre d'affichage suit des règles strictes :

### A. Ordre Document (Défaut)
L'ordre par défaut ("Ordre Document") respecte la séquence d'extraction :
1.  **Groupement par Fichier Source** : Les créances sont regroupées par document (ordre alphabétique des noms de fichiers).
2.  **Index d'Extraction** : À l'intérieur de chaque fichier, l'ordre exact du PDF original est préservé via la propriété `extractIndex`.

### B. Onglet "Clients"
Les clients sont listés selon leur **ordre d'apparition** dans les documents sources. Un client qui apparaît en haut de la première page du premier PDF sera toujours en haut de la liste des clients, même si des filtres sont appliqués.

### C. Tris Personnalisés (Global)
Contrairement à l'ordre par défaut, lorsqu'un utilisateur choisit un critère de tri spécifique (Nom, Montant, Solde, Âge), le groupement par fichier est **supprimé**. Le tri devient **global** sur l'ensemble de la base de données pour permettre, par exemple, de voir les plus gros montants de tous les fichiers confondus en haut de liste.

---

## 12. Seuil de Paiement Effectif (98.5%)

Une facture est considérée **effectivement payée** lorsque le rapport `Règlement / Montant ≥ 98.5%`. Le reliquat de ≤ 1.5% correspond à une **retenue** (timbre, garantie, arrondi) et ne constitue pas un impayé réel.

**Applications de cette règle :**
- **Filtrage des Commentaires** : Un commentaire lié à une facture à ≥ 98.5% payée est traité comme facture réglée pour le filtrage (elle reste visible pour audit mais n'est plus dans les "factures actives")
- **Interface Remarques Client** : Les factures à ≥ 98.5% n'apparaissent pas dans la liste des factures "actives" à sélectionner

**Formule** : `isPaid = (settlement / amount) >= 0.985` (si `amount > 0`)

---

## 13. Règles de Filtrage des Commentaires (Liste de Créances)

Les commentaires affichés dans la liste de créances suivent ces règles strictes :

### Règle 1 : Client absent de l'import actuel
**Si un client n'a aucune facture dans l'import actuel → AUCUN commentaire ne s'affiche**, même les commentaires généraux. L'historique reste stocké en Firestore mais n'est pas affiché.

### Règle 2 : Commentaire avec référence de facture
Un commentaire mentionnant un numéro de facture (préfixes : `FT`, `FS`, `IC`, `AVS`, `AVT`, `FRS`, `FRT`) :
- **S'affiche** si au moins une des factures mentionnées existe encore dans l'import actuel
- **Disparaît** si toutes les factures mentionnées ont disparu de l'import

### Règle 3 : Commentaire général
Un commentaire sans référence de facture s'affiche si le client est présent dans l'import (Règle 1 satisfaite).

---

## 14. Règles de l'Assistant Vocal (Matching Intelligent)

### Moteur de matching multi-stratégies (8 niveaux)

1. **Exact** : Correspondance exacte normalisée
2. **Phonétique canonique** : Forme phonétique unique (H=ح, gh=غ, kh=خ, ou/w=و, ch=ش, q/k/g=ق)
3. **Squelette consonantique** : Suppression des voyelles
4. **Token-based ORDER-INDEPENDENT** : Résout les inversions ("heykel ben ghorbel" → "ben ghorbel heykal")
5. **Containment** : Sous-chaîne contenue ("missaoui" → "missaoui distribution emballage")
6. **Containment du squelette**
7. **N-grammes trigrammes** (Dice) : Résistant aux erreurs STT ("el oueda" → "el wehda")
8. **Alternatives** : Sans préfixe légal (Ste, Sarl, ETS...)

### Mappings phonétiques Arabes-Tunisiens reconnus

| Lettre | Transcriptions | Forme canonique |
|:---|:---|:---|
| ح (ha) | h | h |
| غ (ghain) | gh, g | g |
| خ (kha) | kh, k | k |
| ق (qaf) | q, k, g | k |
| و (waw) | ou, w | u |
| ش (shin) | ch, sh | s |
| ث (tha) | th | t |
| ذ (dhal) | dh | d |

### Stop-words ignorés dans le matching
`societe, ste, sarl, ets, etablissement, distribution, commerce, service, general, nationale, internationale, trading, groupe, et, de, du, des, le, la, les, en, au, aux`

**Particules tunisiennes conservées** : `ben, bel, bou, el, al`

### Auto-apprentissage
Corrections utilisateur mémorisées dans `localStorage['gc_voice_corrections']`. Format : `normalizedSpokenText → clientName`. Priorité absolue sur l'algorithme lors des prochaines utilisations (seuil fuzzy de réutilisation : 92%).

### Seuil de confiance : 0.55 (abaissé depuis 0.60 pour mieux capturer les noms partiels)

### Recherche selon le rôle
- **Commercial** : Uniquement son portefeuille
- **Admin / Gestionnaire** : Tous les clients

---

## 15. Règle de Sélection de Factures pour Marquage "Payé"

1. **Client avec 1 seule facture active** → auto-sélection automatique
2. **Client avec plusieurs factures actives** → sélection **obligatoire** d'au moins une facture (erreur bloquante sinon)
3. **Bouton "Tout sélectionner"** : coche toutes les factures actives en un clic
4. La sélection multiple est autorisée (paiement atomique de plusieurs factures)

**Justification** : Éviter de marquer accidentellement toutes les factures comme payées.
