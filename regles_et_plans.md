# Règles Métier et Plan d'Analyse (GesstionClients)

Ce document répertorie toutes les règles métier appliquées par l'application pour classifier les créances, détecter les contentieux, et évaluer les niveaux de risque après extraction OCR des "États de Recouvrement".

## 1. Types de Pièces (Documents)

L'application identifie le type de document grâce au préfixe du Numéro de Pièce (ex: `IC000262`, `FT252992`, `AV12345`).

| Préfixe | Type de Document | Description |
| :--- | :--- | :--- |
| **IC** | Facture Impayée | Factures de type "Impayé Client". Ces factures sont soumises à la règle stricte des contentieux (voir section 3). |
| **AV** | Avoir (Note de crédit) | Document créditeur. Automatiquement considéré avec un statut de paiement `Payé` (solde neutre). N'est jamais classifié en contentieux. |
| **FT** | Facture de Vente | Facture standard. Son statut de paiement est finement analysé selon le pourcentage du règlement par rapport au montant initial (voir section 2). |
| **Autre** | Document Générique | Par défaut, tout autre document avec un solde > 0 est considéré comme `Non payé`. |

## 2. Statut de Paiement (Paiement Partiel, Retenues...)

Pour les factures standard (**FT**), l'application analyse le ratio entre le *Solde restant* et le *Montant total* pour affiner le statut de paiement :

1.  **Soldé (`paid`)** : Solde ≤ 0.
2.  **Impayé total (`unpaid`)** : Règlement = 0.
3.  **Retenu non réglé (`retained`)** : Le ratio (Solde / Montant) est compris entre **0.1% et 2%**. Cela indique souvent une petite retenue de garantie, un timbre, ou une erreur d'arrondi plutôt qu'un réel impayé problématique.
4.  **Paiement partiel (`partial`)** : Le ratio (Solde / Montant) est strictement supérieur à 2% et inférieur à 99%. Le client a effectué un versement significatif mais n'a pas tout réglé.

## 3. Règle des "Contentieux"

La qualification de **Contentieux** (`isContentieux = true`) n'est pas appliquée à tous les documents. Elle obéit à des conditions strictes concernant le type de document ou l'ancienneté :

*   **Condition Générale** : Tout document dont le solde est supérieur à 0 et l'ancienneté (Âge) dépasse strictement **365 jours**.
*   **Par Type de Pièce** :
    *   **IC** (Impayé Client) : Devient contentieux si l'âge > 365 jours ET solde > 0.
    *   **FT** (Facture de Vente) : Devient contentieux si l'âge > 365 jours ET solde > 0.

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
*   **Cohérence Mathématique** : L'algorithme valide que `Montant - Règlement ≈ Solde` (avec une tolérance de 1 TND) pour être certain de ne pas capturer de mauvais chiffres sur des documents mal scannés.
