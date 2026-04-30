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

## 2. Statut de Paiement (Paiement Partiel, Retenues...)

Pour les factures standard (**FT**), l'application analyse le ratio entre le *Solde restant* et le *Montant total* pour affiner le statut de paiement :

1.  **Soldé (`paid`)** : Solde ≤ 0.
2.  **Impayé total (`unpaid`)** : Règlement = 0.
3.  **Retenu non réglé (`retained`)** : Le ratio (Solde / Montant) est compris entre **0.5% et 1.5%**. Cela indique souvent une petite retenue de garantie, un timbre, ou une erreur d'arrondi plutôt qu'un réel impayé problématique.
4.  **Paiement partiel (`partial`)** : Le ratio (Solde / Montant) est strictement supérieur à 1.5% et inférieur à 99%. Le client a effectué un versement significatif mais n'a pas tout réglé.

### Filtres de Statut de Paiement (UI)

L'interface utilisateur propose des filtres dédiés pour identifier rapidement les factures selon leur statut de paiement :

*   **🛡️ Filtre "Retenue 0.5%-1.5%"** : Affiche uniquement les factures **FT** et **FS** dont le ratio Solde/Montant est compris entre 0.5% et 1.5%. Ces factures représentent des retenues de garantie, timbres, ou erreurs d'arrondi. Ce filtre fonctionne **indépendamment de la valeur du règlement** (peut être 0 ou > 0).
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

Pour éviter les doublons et garantir l'exactitude des statistiques (notamment quand plusieurs utilisateurs importent les mêmes fichiers), l'application applique la règle suivante :

*   **Identifiant Unique** : Le **nom du fichier** (insensible à la casse, ex: `C01.pdf` = `c01.PDF`) sert d'identifiant unique pour une source de données.
*   **Écrasement Automatique** : Tout nouvel import d'un fichier portant un nom déjà existant dans la base de données entraîne la suppression immédiate des anciennes données de ce fichier et leur remplacement par les nouvelles.
*   **Conséquence** : Si vous importez deux fois le fichier "C01", seule la version la plus récente est conservée pour les calculs du Dashboard et de la Performance.

