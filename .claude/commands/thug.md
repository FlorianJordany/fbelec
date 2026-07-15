# /thug — Met à jour HANDOFF.md pour la passation au prochain développeur

Tu vas remplir le fichier `HANDOFF.md` à la racine du projet, sans me demander de le rédiger moi-même.

**D'abord, détecte dans quel cas tu es :**

- **CAS A — Premier remplissage / projet existant** : si `HANDOFF.md` est encore vide ou dans son état initial (aucune vraie session précédente enregistrée), tu ne peux pas t'appuyer sur une conversation passée. Dans ce cas, établis l'état actuel du projet en **analysant le code** : parcours l'arborescence, lis `package.json`, identifie frontend/backend/routes/services/DB/variables d'env, lis le handoff de Claude Design s'il existe, et repère ce qui semble fait, en cours, et ce qui reste. Écris ce constat comme première entrée du handoff.
- **CAS B — Passation normale** : si une session précédente est déjà enregistrée, appuie-toi sur ce qu'on a fait ensemble dans cette conversation (source principale) + au besoin les fichiers récemment modifiés.

Étapes :

1. Récupère le contexte réel selon le cas détecté ci-dessus, et récupère la date du jour.

2. Si tu ne connais pas le nom du développeur de cette session, demande-le-moi (une seule question), sinon réutilise celui de l'entrée précédente s'il est pertinent.

3. Mets à jour `HANDOFF.md` ainsi :
   - **Déplace** l'entrée "Dernière session" actuelle vers la section "Historique des sessions précédentes" (sous forme de résumé court).
   - **Crée une nouvelle entrée "Dernière session" en haut** avec : date et développeur.
   - Remplis les sous-sections de façon précise et concrète (pas de généralités) :
     - **Ce qui a été fait** : fonctionnalités/corrections terminées cette session.
     - **En cours / pas terminé** : ce qui est commencé mais incomplet, avec les fichiers concernés et ce qu'il reste à faire.
     - **Prochaines étapes** : ce que le prochain dev devrait attaquer en priorité.
     - **Pièges / décisions / à savoir** : bugs connus, choix techniques faits, points sensibles à ne pas casser, éléments de sécurité en attente (cf. SECURITY_AUDIT.md).

4. Reste factuel et synthétique. Ne réécris pas tout l'historique du projet, seulement le delta de cette session.

5. Quand c'est fait, affiche-moi un court récapitulatif de ce que tu as écrit, et rappelle-moi de bien laisser Google Drive synchroniser le fichier avant de fermer.
