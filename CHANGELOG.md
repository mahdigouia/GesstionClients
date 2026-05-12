# Changelog - GesstionClients

Ce document trace l'historique des modifications majeures apportées au projet pour assurer la continuité du développement.

## [2026-05-12] - Optimisation de l'Import et de l'Affichage

### Corrigé
- **Bug d'Import Multiple** : Correction de la condition de course lors de l'importation simultanée de plusieurs fichiers. Seul le dernier fichier était conservé ; désormais, tous les fichiers sont fusionnés correctement en une seule transaction.
- **Tri des Clients** : Correction de l'ordre dans l'onglet "Clients" qui était forcé par solde. Les clients suivent maintenant l'ordre d'extraction original.

### Ajouté
- **`updateDebtsFromFiles`** dans `DebtContext` : Nouvelle méthode robuste pour gérer les imports par lots.
- **Tri Global vs Local** : Amélioration de `DebtTable` pour permettre un tri global (sans groupement par fichier) lorsque l'utilisateur trie manuellement par Nom, Montant, Solde ou Âge.

---

## [2026-05-11] - Modernisation et Cashflow

### Ajouté
- **Logo dans les PDF** : Restauration et centrage du logo dans les exports PDF.
- **Cashflow & Recovery Manager** : Nouvelle interface simplifiée sur la page Factures.
- **Filtres Tristate** : Implémentation des filtres Contentieux, Retenues et Partiels avec états Inclure/Exclure/Off.

### Corrigé
- **Visibilité des Factures Spéciales** : Correction de la logique pour que les avoirs (montants négatifs) ne soient jamais masqués par les filtres de solde positif.

---

## [2026-05-05] - OCR et Analytics

### Corrigé
- **Parsing OCR** : Amélioration de la détection des séparateurs de milliers (espaces) dans les montants tunisiens.
- **Nettoyage des descriptions** : Suppression des résidus numériques dans les intitulés de factures.

### Ajouté
- **Historique d'Évolution de la Dette** : Suivi des KPIs sur 30 jours via Firestore.
- **Notifications** : Système de marquage "Tout lire" pour les alertes de risque.
