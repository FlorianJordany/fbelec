# CLAUDE.md

<!-- Chef d'orchestre du projet. Lu en entier au début de chaque session.
     Gardé court volontairement (adhérence + tokens). Le détail est dans DEV_RULES.md. -->

## ⚠️ Protocole de début de session (à faire AVANT tout)
1. Lis `HANDOFF.md` : c'est la **source de vérité** de l'état du projet laissé par le dernier développeur (fait / en cours / prochaines étapes / pièges).
2. Si besoin, parcours l'arborescence et les fichiers récemment modifiés pour confirmer l'état réel du code.
3. S'il existe, lis le handoff de Claude Design fourni dans le projet.
4. Résume-moi en quelques lignes l'état actuel et ce sur quoi on s'apprête à travailler, AVANT de coder.

## 📜 Règles de développement
La constitution du projet (méthode de dev, stack, déploiement cPanel/Passenger, sécurité, audit)
est importée ci-dessous et chargée à CHAQUE session. Applique-la pour toute fonctionnalité.

@DEV_RULES.md
<!-- Import auto à chaque session (fiable, ~5-6k tokens/session).
     Pour repasser en lecture à la demande : remplace la ligne @DEV_RULES.md
     par "Avant de coder, lis DEV_RULES.md en entier et applique-le." -->

## 🔒 Invariants non négociables (toujours actifs)
Même sans relire DEV_RULES.md, ne JAMAIS enfreindre :
- SQL : requêtes paramétrées ($1, $2…) uniquement. Aucune concaténation de valeur utilisateur.
- Sécurité côté backend uniquement : le front React n'est jamais une barrière de sécurité. Valider `req.body/params/query`. Vérifier les rôles côté backend. 401 si non authentifié, 403 si non autorisé.
- Aucun secret dans le front ni dans le repo. Rien de sensible en `VITE_*` (tout `VITE_` est public).
- Aucun schéma `http://`/`https://` codé en dur (sauf liens e-mails). API via `VITE_API_URL` / `PUBLIC_API_URL` protocol-relative.
- Anti-IDOR : un utilisateur n'accède qu'à ses ressources. UPDATE partiel = merge avec l'existant (ne pas écraser les colonnes absentes).
- Responsive mobile + desktop. Livraison de bout en bout (un bouton sans son action = non livré).
- Ne suppose jamais les valeurs d'infra (versions, domaines, ports, chemins) : demande-les.

## 🧱 Stack
Node.js 22.22.2 · Express · PostgreSQL 9.6.22 · React · Vite.
Déploiement cPanel "Setup Node.js App" (Passenger) : front statique (`dist/`) et API Express séparés.
<!-- PostgreSQL 9.6 : pas de syntaxe SQL trop récente. Migrations idempotentes (IF NOT EXISTS). -->

## 🔁 Collaboration (2 développeurs, chacun son tour)
- On ne travaille jamais en même temps sur le dossier partagé.
- **Fin de session (obligatoire)** : tape `/thug` pour que je mette à jour `HANDOFF.md` automatiquement, puis laisse Google Drive synchroniser. Sans git, c'est le seul enregistrement de la passation — ne pas l'oublier.
- **Début de session** : voir le protocole en haut.

## 📂 Fichiers de référence
- `DEV_RULES.md` — règles complètes de dev et de sécurité.
- `HANDOFF.md` — passation entre développeurs (rempli via `/thug`).
- `SECURITY_AUDIT.md` — à créer/maintenir pendant le dev (voir DEV_RULES.md).
