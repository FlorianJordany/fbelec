# HANDOFF.md — Cahier de relais

<!-- NE PAS remplir à la main : en fin de session, tape /thug dans Claude Code,
     il remplit cette section à partir de notre conversation. -->

> Passation entre les deux développeurs (on travaille chacun son tour).
> Fin de session → `/thug` pour remplir. Début de session → lire ce fichier.

---

## 🔄 Dernière session

- **Date :** 2026-07-30 (sessions du 21 au 30 juillet)
- **Développeur :** Florian

### Ce qui a été fait

- **Mandat EDF PDF prérempli** : service `backend/src/services/mandat.js` (pdf-lib, dessin par
  coordonnées sur `backend/assets/mandat-vierge.pdf`). Contenu final : mandant = référence
  client ; « autorise **Société F.B ELEC ( Monsieur Franck BORDIER )** » ; RGPD tout coché ;
  souscription/résiliation = **seule la case « branchement provisoire »** cochée ; adresse du
  chantier ; fait à + date du jour + 1 exemplaire ; **signature (tampon détouré) côté
  mandataire** (x:337). **Généré automatiquement à la création** et rangé dans les documents du
  chantier **sauf si un mandat est uploadé** (`mandat_fourni`) ; bouton de téléchargement au
  récapitulatif (masqué si mandat fourni).
- **Contact facturation** (migration `2026-07-21_facturation_contact.sql`) : si facturation
  « différente », référence préremplie (modifiable) + champs Téléphone/Mail facultatifs.
  Mandat retiré des documents obligatoires ; **documents obligatoires réellement bloquants**
  côté admin aussi (gate `canStep3`).
- **Fil de messages client ↔ FB ELEC** (migration `2026-07-22_commentaire_notes_client.sql`) :
  `POST /api/client/contact` accepte `chantier_id` (anti-IDOR via `allowedClientIds`) → message
  stocké dans `fbelec.notes` (`de_client=TRUE`, auteur = nom serveur). Fil affiché des deux
  côtés avec le **composant `Notes` partagé** (exporté de `client.jsx`, importé par `admin.jsx` ;
  avatars : initiales grises = client, « FB » jaune = FB ELEC). L'admin répond via la carte
  « Message au client » existante. E-mail enrichi (société, tél, chantier, références) +
  bouton « Voir et répondre sur le site » → `PUBLIC_URL?chantier=<id>`.
- **Commentaire de création** : textarea facultatif à l'étape 2 Documents (client + admin),
  colonne `chantiers.commentaire`, affiché au récap et dans « Informations du dossier ».
- **Référence client en avant côté client** : cartes « Mes chantiers » et gros titre de la
  fiche = `reference_client`, **repli sur l'adresse si absente** (adresse toujours en
  sous-ligne). Idem « Vue côté client » admin (+ `de_client` ajouté à son détail).
- **Fix « Référence déjà utilisée » (409)** : la création insérait une référence provisoire
  fixe `'TMP'` (unique en base) → remplacée par `'TMP-'||md5(random()::text)` (admin + client),
  validations sorties de la transaction, log de la contrainte réelle en cas de 23505.
  Cause déclenchante sur DEV : **base importée de prod sans resync des séquences** → tous les
  `setval` passés le 2026-07-30.
- **Correctifs** : login admin tolère les espaces du clavier mobile (trim) ; largeur en-tête
  fiche (`.fb-wrap{width:100%}`) ; libellé mandat court « Généré automatiquement si absent ».
- **Écran de connexion : vraie cause affichée** (fin de journée) : « Identifiants incorrects »
  masquait TOUTE erreur (c'est ce qui a fait croire à un mauvais mot de passe alors qu'un
  wifi d'hôtel bloquait l'API). Désormais : serveur injoignable/portail captif → message
  réseau ; 429 anti-bruteforce → « Trop de tentatives… » ; 401 → « Identifiants incorrects ».
  (`client.jsx` / `tryLogin`, 4 cas vérifiés en preview, **déployé en prod**).
- **Référence client dans les e-mails de notification** (fin de journée) : objet + corps de
  `sendEtapeAvancement` et `sendNouvelleNote` incluent `reference_client` (rien si vide).
  Fichiers : `mailer.js`, `routes/admin/chantiers.js`, `routes/admin/notes.js`.
- **Git/GitHub** : repo `FlorianJordany/fbelec`, branches `main` + `DEV`. PR #1 mergée ;
  **PR #2 ouverte** (contient les commits `806cbac` + `980d5ca` = tout le travail ci-dessus).
- **Déploiement : PROD et DEV à jour et validés au 2026-07-30** (base, backend complet avec
  pdf-lib + assets, front). Incident prod du 30/07 (`/health` 503 = connexion DB) résolu.

### En cours / pas terminé

- **2 retouches non commitées** (login messages d'erreur + référence dans les e-mails) :
  à committer sur `DEV` (elles rejoindront la PR #2). Le déploiement backend des e-mails
  (3 fichiers + restart, DEV et PROD — commandes données en fin de conversation) restait
  **à confirmer** ; la retouche login est en prod mais **pas encore redéployée sur DEV**
  (le `dist/` local est un build **prod**).
- **PR #2 à merger** vers `main` sur GitHub (tout est déjà déployé et validé).
- **SMTP toujours non configuré** (prod ET dev) → aucun e-mail ne part (le fil de messages
  fonctionne quand même : stockage en base). Variables cPanel : `SMTP_HOST/PORT/SECURE/USER/
  PASS/FROM` + `CONTACT_EMAIL`, puis restart.
- **AutoSSL DEV impossible** : la zone `universe.wf` répond SERVFAIL aux requêtes CAA
  (côté o2switch). Voie A = ticket o2switch ; voie B = sous-domaines dev sous `fbelec.fr`
  (OVH A → 109.234.166.144 + Create Domain + AutoSSL + refaire `.env`/CORS/build).
- `apercu-guide.html` (racine) toujours à supprimer.

### Prochaines étapes

1. Merger la PR #2.
2. Configurer le SMTP puis tester en réel : message client → e-mail enrichi + bouton
   « Voir et répondre » ; avancement d'étape → e-mail client.
3. HTTPS sur l'environnement DEV (voie A ou B ci-dessus).
4. Sécurité en attente : rotation mot de passe DB + `JWT_SECRET`, suppression
  `apercu-guide.html`, dette URL logo codée en dur (`ui.jsx`/`client.jsx`).

### Pièges / décisions / à savoir

- **Deux builds front distincts** : prod = `npm run build` (`.env.production` →
  `//api-suividechantier.fbelec.fr`) ; DEV = `npx vite build --mode development` (`.env` →
  `//fbelec-api.sc1qize9193.universe.wf`). `dist/` ne contient qu'un seul build à la fois
  (actuellement **prod**) — vérifier avec `grep sc1qize9193 dist/assets/*.js` avant un scp prod.
- **`backend/assets/` est gitignoré** (mandat vierge + signature scannée) → à **scp
  manuellement** vers chaque serveur, comme le `.env`.
- **Base DEV importée de prod** : après toute réimportation, **repasser les `setval`** de
  toutes les séquences, sinon 409/23505 trompeurs (« Référence déjà utilisée » couvre tout
  doublon, y compris la pkey ; le log `[chantiers] doublon 23505:` dans `stderr.log` donne la
  contrainte réelle).
- **Fil de messages** : toute nouvelle SELECT de notes doit inclure `de_client` (3 endroits
  faits : client, admin, vue-client). Le composant `Notes` est partagé — le modifier change
  les deux côtés.
- **Anti-IDOR** : toute nouvelle route client passe par `allowedClientIds()` (jamais
  `client_id = req.clientId` en dur).
- **Vérif front sans API** : mocker `window.fetch` en preview avec des données réalistes ;
  pour naviguer le SPA malgré le reload au login, passer par le parcours `must_change_code`
  (pas de reload) ou réutiliser le token localStorage existant.
- **Pièges o2switch/Drive inchangés** : `chmod 755/644` après chaque scp (sinon 403/page
  blanche) ; supprimer les `desktop.ini` avant chaque build ; npm install sur H: tronque des
  fichiers → installer sur C: puis copier ; venv Node :
  `source ~/nodevenv/<dossier-api>/22/bin/activate`.

---

## 🗄️ Historique des sessions précédentes

<!-- /passation descend ici l'ancienne entrée à chaque nouvelle passation. -->

- **2026-07-13 — Florian (sociétés, listes, mobile)** : sociétés + rôles Basic/Admin (visibilité
  société via `allowedClientIds()`, page dédiée « Sociétés »), références + type Mono/Triphasé
  obligatoires, bloc « Informations du dossier », drag & drop étapes (reorder 2 passes),
  téléchargement photos, reload au login, Chantiers suivis (réf noir/gras 1ʳᵉ ligne + filtres),
  Gestion clients (recherche + filtres colonnes), gros fix CSS mobile (min-width:0 sur spans,
  StatusPill ellipsis). Boutons WordPress confirmés (cache Cloudflare).

- **2026-06-26 — Florian (bouton Espace client WordPress)** : bouton « ESPACE CLIENT » ajouté
  dans l'en-tête du site vitrine `fbelec.fr` → header codé en dur dans `header.php` du thème
  sur-mesure (pas Elementor) ; lien desktop + mobile + fix CSS largeurs ; vérifié en ligne.
  Piège : fbelec.fr derrière Cloudflare → purger le cache pour voir les changements.
  Migration `terrain_viabilise` appliquée en prod.

- **2026-06-26 — Florian (champ « Terrain viabilisé »)** : champ obligatoire Oui/Non à la
  création (colonne nullable + validation backend + formulaires + affichages). Bug corrigé :
  `PUT /client/.../infos` transformait `false` en `null`.

- **2026-06-26 — Tony (page Guide)** : page « Guide » côté client (bouton `help`, client
  uniquement). `apercu-guide.html` = aperçu local à supprimer après validation.

- **2026-06-20 — Florian** : déblocage prod (500 Passenger = `node_modules` manquant),
  autocomplétion BAN, footer OutiLab, responsive mobile, archivage chantiers, édition/
  suppression d'étapes, dates d'étapes, e-mail à chaque avancement d'étape, badge dérivé de
  l'étape en cours.

- **(état initial)** — Projet initialisé (backend Express ESM, frontend React/Vite, schéma
  PostgreSQL `db/schema.sql`, sécurité durcie cf. SECURITY_AUDIT.md).
