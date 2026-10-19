# Audit de sécurité — FB ELEC Suivi de chantier (v2)

**Périmètre :** `backend/` (Express/Node), `frontend/` (React/Vite), `db/schema.sql`, configs.
**Date :** 2026-06-14
**Auteur :** Audit applicatif (Node/Express/React).

---

## 1. Résumé du niveau de risque

Niveau global **MODÉRÉ**. L'architecture est saine sur les points les plus sensibles :

- **Injection SQL : aucune.** Toutes les requêtes utilisent des **requêtes paramétrées**
  (`$1, $2, …`). Les rares clauses dynamiques (`UPDATE … SET`) ne concatènent que des
  **noms de colonnes issus d'une liste blanche** ; les valeurs restent paramétrées.
- **Contrôle d'accès :** routes admin protégées par `authAdmin`, routes client par
  `authClient` ; les ressources client sont systématiquement filtrées par `client_id`
  (pas d'IDOR côté client).
- **XSS :** React échappe par défaut, **aucun** `dangerouslySetInnerHTML` / `innerHTML` /
  `eval` / `new Function` dans le frontend.
- **CSRF :** non applicable — authentification par **JWT en en-tête `Authorization`**
  (pas de cookie de session).

Les vulnérabilités à corriger concernent surtout les **uploads de fichiers**, la
**verbosité des erreurs**, le **durcissement CORS / JWT / rate-limiting** et la
**validation d'entrées**.

---

## 2. Vulnérabilités identifiées

| # | Gravité | Fichier | Vulnérabilité |
|---|---------|---------|----------------|
| 1 | **Haute** | `backend/src/middleware/upload.js` | **Path traversal** via `req.params.id` dans le chemin de stockage multer. |
| 2 | **Haute** | `backend/src/middleware/upload.js` | **Upload de fichier dangereux** : l'extension stockée vient du nom d'origine (`.php`, etc.), filtre basé sur le seul `mimetype` (falsifiable) → risque d'exécution si Apache sert le dossier. |
| 3 | **Moyenne** | `backend/src/server.js` | **Fuite d'informations** : le gestionnaire d'erreurs renvoie `err.message` brut sur les 500 (messages internes DB, etc.). |
| 4 | **Moyenne** | `backend/src/server.js` | **CORS potentiellement permissif** : `origin: '*'` possible ; pas de refus explicite des origines non whitelistées. |
| 5 | **Moyenne** | `backend/src/middleware/*.js`, `auth.js` | **JWT** : algorithme non épinglé à la vérification (`algorithms` non fixé). |
| 6 | **Moyenne** | `backend/src/routes/client/chantiers.js` | **Pas de rate-limiting** sur `/api/client/contact` (envoi d'e-mails → spam/abus) ni de limite globale API. |
| 7 | **Basse** | `backend/src/server.js` | Taille du corps des requêtes non bornée explicitement (défaut 100 kb). |
| 8 | **Basse** | tous les handlers d'écriture | **Validation d'entrée** limitée (présence/trim) : pas de bornes de longueur ni de format e-mail strict → abus/stockage non borné. |
| 9 | **Basse** | `frontend` (`window.open`) | Ouverture d'onglet sans `noreferrer` (déjà `noopener`). |
| 10 | **Basse / à vérifier** | déploiement o2switch | `.env` situé dans la racine du sous-domaine API : exposition possible si Apache sert les fichiers statiques directement. À **vérifier** (voir §5). |
| 11 | **Info** | `frontend` (localStorage) | JWT stocké en `localStorage` (exposé en cas de XSS). Acceptable ici (pas de cookie/CSRF, React échappe), documenté. |

Points **vérifiés sans défaut** : SQL injection (aucune), IDOR client (filtrage `client_id`),
SSRF (aucun fetch d'URL utilisateur côté serveur — la feature « agents » a été retirée),
open redirect (navigation interne, `?chantier=` casté en entier), secrets frontend
(seul `VITE_API_URL` est exposé, ce qui est voulu).

---

## 3. Corrections prévues

1. **Upload (path traversal)** — forcer `req.params.id` à un **entier positif** avant
   de construire le chemin de stockage ; sinon rejeter.
2. **Upload (extension)** — n'accepter que des **extensions en liste blanche** (cohérentes
   avec les mimetypes), refuser le reste ; écrire un `.htaccess` dans le dossier `uploads`
   qui **désactive l'exécution de scripts** (défense en profondeur).
3. **Erreurs** — masquer le message des **500** (`Erreur serveur.`) et logguer le détail
   côté serveur ; conserver les messages 4xx (utiles à l'utilisateur) ; gérer proprement
   les erreurs multer (400).
4. **CORS** — whitelist stricte par origine (liste séparée par virgules) ; refus implicite
   des origines non autorisées ; `*` possible uniquement si explicitement configuré.
5. **JWT** — épingler `algorithms: ['HS256']` à la vérification.
6. **Rate-limiting** — limiteur dédié sur `/api/client/contact`, limiteur global généreux
   sur l'API (en plus du limiteur d'auth existant).
7. **Corps de requête** — limite explicite (`100kb`) sur JSON / urlencoded.
8. **Validation** — helper interne (sans dépendance lourde) : bornes de longueur et
   format e-mail, appliqué aux points d'écriture sensibles (login, création client,
   création chantier, contact).
9. **Frontend** — `noopener,noreferrer` sur les `window.open`.
10. **Déploiement** — instructions de vérification/protection du `.env` (§5).

> **Choix d'outillage :** plutôt que d'introduire une grosse dépendance de validation
> (zod/express-validator) et de réécrire toutes les routes — au risque de régressions —
> j'ajoute un **petit validateur interne** ciblé. L'adoption de `zod` reste une
> amélioration recommandée (voir §6).

---

## 4. Corrections appliquées

| # | Statut | Fichier(s) | Détail |
|---|--------|-----------|--------|
| 1 | ✅ | `middleware/upload.js` | `req.params.id` forcé en entier positif strict avant construction du chemin (anti path-traversal). `req.schema` restreint à `[a-z0-9_]`. |
| 2 | ✅ | `middleware/upload.js`, `server.js` | Liste blanche **mimetype + extension** ; extension stockée forcée depuis la liste (sinon `.bin`). `.htaccess` écrit dans `uploads/` (désactive l'exécution de scripts). `toPublicUrl` refuse tout chemin sortant du dossier uploads. |
| 3 | ✅ | `server.js` | Gestionnaire d'erreurs : **500 masqués** (`Erreur serveur.`, détail loggué côté serveur uniquement), erreurs multer → 400 lisible, 4xx conservés. `/health` ne renvoie plus le message d'erreur DB. |
| 4 | ✅ | `server.js` | CORS : whitelist stricte par origine (liste `,`), refus implicite des origines non autorisées. |
| 5 | ✅ | `middleware/authAdmin.js`, `authClient.js`, `routes/auth.js` | JWT épinglé à **HS256** (signature + vérification). |
| 6 | ✅ | `server.js` | Rate-limiting : global API (600/15min), auth (10/15min échecs), **contact (5/h)**. |
| 7 | ✅ | `server.js` | `express.json`/`urlencoded` limités à **100 kb** ; `x-powered-by` désactivé ; static `/uploads` en `dotfiles: deny`. |
| 8 | ✅ | `utils/validate.js` (nouveau), `routes/admin/clients.js`, `routes/client/chantiers.js` | Validation : bornes de longueur + format e-mail sur création client et message de contact. Les autres champs texte sont bornés par la limite de corps (100 kb). |
| 9 | ✅ | `frontend/src/client.jsx`, `admin.jsx` | `window.open(..., 'noopener,noreferrer')`. |
| — | ✅ | `package.json` | **`nodemailer` 6 → ^8.0.11** (corrige 1 faille haute : injection commande SMTP / DoS addressparser). `npm audit` → **0 vulnérabilité**. |

### Fichiers modifiés
- `backend/src/server.js`
- `backend/src/middleware/upload.js`, `authAdmin.js`, `authClient.js`
- `backend/src/routes/auth.js`, `routes/admin/clients.js`, `routes/client/chantiers.js`
- `backend/src/utils/validate.js` *(nouveau)*
- `backend/package.json`
- `frontend/src/client.jsx`, `frontend/src/admin.jsx`

### Vérifications effectuées
- `node --check` OK sur tous les fichiers backend.
- Chargement complet du module `server.js` sans erreur (imports/middlewares résolus).
- `npm audit` → **0 vulnérabilité**.
- `npm run build` (frontend) OK (35 modules).

---

## 5. À vérifier / faire manuellement

1. **Exposition du `.env`** — ✅ **VÉRIFIÉ / NON EXPOSÉ**. `curl http://…/.env` renvoie
   un **403** de la couche « Tiger Protect » d'o2switch, qui bloque par défaut (non
   désactivable) les fichiers sensibles (`.env`, `.htaccess`, `.git`, `package.json`…).
   ⚠️ **Correction 2026-10-13 : les fichiers source SONT exposés.** Contrairement au constat
   initial, Apache sert directement les fichiers existants du dossier de l'appli (qui est
   aussi la racine web du sous-domaine API) : `/src/server.js`, `/src/db.js`, `/app.js`,
   `/package.json` et surtout **`/assets/signature-fbelec.png`** (tampon/signature scannés)
   répondaient **200** en PROD et en DEV. Le `.env` reste bloqué (403, Tiger Protect).
   **Correctif** : `backend/src/.htaccess` et `backend/assets/.htaccess` (`Require all denied`)
   — Node lit ces fichiers sur le disque, Apache ne les sert plus ; le `.htaccess` racine géré
   par cPanel n'est pas modifié. Fichiers déployés avec `src/` et `assets/`. Reste exposé
   (non sensible) : `app.js` (3 lignes d'amorçage), `package.json`, `node_modules/` (code npm
   public). Solution de fond à terme : dossier de l'appli distinct de la racine web.
2. **Rotation des secrets.** Le mot de passe PostgreSQL a été saisi en clair pendant
   l'installation (chat/logs). **Change-le** dans cPanel et mets à jour `DATABASE_URL`.
   Vérifie aussi que `JWT_SECRET` est long et unique (différent dev/prod).
3. **`UPLOAD_ROOT` hors racine web** (optionnel, recommandé) : définir `UPLOAD_ROOT`
   sur un dossier **en dehors** du sous-domaine (ex. `~/fbelec-uploads`) pour que les
   fichiers ne soient jamais servis directement par Apache. Le code le supporte déjà
   (variable d'env) ; pense à déplacer les fichiers existants et à réécrire la colonne
   `url` en conséquence.
4. **CORS en prod** : `CORS_ORIGIN` doit valoir l'origine **exacte** du front (pas `*`).
5. **HTTPS en prod** (voir `docs/GUIDE-PROD.md`) — le HSTS de helmet ne prend effet
   qu'en HTTPS.
6. **Données héritées** : les e-mails clients importés de l'ancienne base n'ont pas été
   re-validés ; rien de bloquant, mais à garder en tête.

## 6. Recommandations de déploiement sécurisé

- `NODE_ENV=production` (positionné par cPanel « Application mode: Production »).
- Utilisateur PostgreSQL **dédié à l'app** avec le minimum de privilèges (pas de superuser).
- Sauvegardes régulières base + `uploads/`.
- Tenir les dépendances à jour : `npm audit` périodique, surveiller `multer`/`sharp`/`nodemailer`.
- **Amélioration future** : adopter `zod` pour une validation par schéma sur **toutes**
  les routes (actuellement validation ciblée sur les points sensibles).
- Ne jamais exposer de secret via une variable `VITE_` (seul `VITE_API_URL`, public, est utilisé).

## 7. Évolution UI — autocomplétion d'adresse (2026-06-18)

- **Fonctionnalité** : autocomplétion d'adresse sur les 4 formulaires (création/édition de
  chantier, côté admin et client, + adresses de facturation). Sélectionner une suggestion
  remplit automatiquement adresse + code postal + commune (champs restant éditables).
- **Fournisseur** : **Base Adresse Nationale** (`https://api-adresse.data.gouv.fr/search/`),
  API publique officielle, **sans clé**, CORS activé.
- **Sécurité** :
  - **Aucun secret, aucune clé** → rien à exposer côté `VITE_`. **Aucune dépendance npm**
    ajoutée (`fetch` natif, composant `AddressAutocomplete` dans `ui.jsx`).
  - **Endpoint tiers fixe** côté client : pas de SSRF (aucune URL contrôlée par
    l'utilisateur ; le backend ne fait aucun appel sortant). La requête `q` est
    `encodeURIComponent`-ée. La réponse n'est jamais injectée en HTML brut (React échappe).
  - Schéma `https://` explicite assumé (endpoint tiers, jamais en mixed-content puisque
    le front prod est servi en HTTPS).
- **Fichiers** : `frontend/src/ui.jsx` (composants `AddressAutocomplete`, `Footer`,
  hook `useIsMobile`), `frontend/src/admin.jsx`, `frontend/src/client.jsx`,
  `frontend/src/theme.css` (refonte responsive : tableaux clients/chantiers en cartes
  empilées sur mobile, référentiel d'étapes et grilles de formulaire empilés, barres
  d'outils en wrap). Ajout du footer signature **OutiLab** sur toutes les pages.
- **Build** : `npm run build` OK (35 modules). Bundle vérifié : API prod
  (`//api-suividechantier.fbelec.fr`) + BAN présents, **aucun `localhost`**.

## 8. Archivage des chantiers + édition/suppression d'étapes (2026-06-19)

- **Archivage** : nouvelle colonne `fbelec.chantiers.archive boolean NOT NULL DEFAULT false`
  (migration idempotente `db/migrations/2026-06-19_archive_chantiers.sql`). Distincte de
  `actif` : `actif=FALSE` bloque tout accès client (inchangé), `archive=TRUE` retire le
  chantier des listes « en cours » mais le laisse consultable dans la section « Archivés »
  (admin ET client).
  - **Anti-IDOR préservé** : la liste client archivés filtre toujours
    `client_id = $1 AND actif = TRUE` ; le paramètre `?archived` n'est qu'un booléen
    (`'1'/'true'`), aucune donnée utilisateur en SQL (requête paramétrée `$2`).
  - Champ `archive` ajouté à la liste blanche du `PUT /admin/chantiers/:id` (merge partiel,
    pas d'écrasement). Routes admin protégées par `authAdmin`.
- **Étapes du référentiel** : `DELETE /admin/etapes/:id` passe d'un soft-delete à une
  **suppression définitive transactionnelle** (purge des `chantier_etapes` liés, puis
  `ref_etapes` ; `photos.etape_id` → SET NULL via FK). `POST`/`PUT` renvoient un **409**
  lisible en cas de conflit d'ordre (index unique `ordre` sur étapes actives) au lieu d'un
  500. Édition (label/sous_texte/ordre) via `PUT` existant. Routes admin uniquement.
- **Fichiers** : `db/schema.sql`, `db/migrations/2026-06-19_archive_chantiers.sql` (nouveau),
  `backend/src/routes/admin/chantiers.js`, `backend/src/routes/admin/etapes.js`,
  `backend/src/routes/client/chantiers.js`, `frontend/src/ui.jsx`, `admin.jsx`, `client.jsx`.
- **Validation** : `node --check` OK (3 fichiers backend) ; `npm run build` OK (35 modules).

## 9. E-mail à chaque changement de statut + dates sur étapes (2026-06-19)

- **E-mails** : un e-mail client est envoyé à **chaque avancement d'étape** (route
  `PUT /admin/chantiers/:id/etapes`, comparaison de l'état avant/après, un mail par étape
  réellement modifiée, envoi asynchrone via `sendEtapeAvancement`). Le changement de
  **statut** (badge global) ne déclenche **pas** d'e-mail. Toujours derrière `authAdmin` ;
  aucune donnée utilisateur en SQL (requêtes paramétrées) ; l'échec d'envoi n'impacte pas
  la réponse HTTP (catch + log, pas de fuite).
- **Dates d'étapes** : `ref_etapes.avec_date` (bool) + `chantier_etapes.date_valeur` (date)
  — migration idempotente `db/migrations/2026-06-19_etapes_date.sql`. La date est saisie côté
  admin (`PUT /admin/chantiers/:id/etapes/:etapeId`, colonnes en liste blanche
  `masquee`/`date_valeur`, valeurs paramétrées) et lue côté client via
  `to_char(date_valeur,'YYYY-MM-DD')` (évite les décalages de fuseau, pas d'objet Date sérialisé).
  Affichage client filtré comme avant (`actif=TRUE AND masquee=FALSE`).
- **Fichiers** : `db/schema.sql`, `db/migrations/2026-06-19_etapes_date.sql` (nouveau),
  `backend/src/services/mailer.js`, `backend/src/routes/admin/chantiers.js`,
  `backend/src/routes/admin/etapes.js`, `backend/src/routes/client/chantiers.js`,
  `frontend/src/admin.jsx`, `frontend/src/client.jsx`.
- **Validation** : `node --check` OK (4 fichiers) ; `npm run build` OK (35 modules) ;
  rendu référentiel vérifié (preview) sans erreur.

## 10. Badge dérivé de l'étape « En cours » + retrait du menu statut (2026-06-19)

- Le badge affiché au client n'est plus basé sur la colonne `statut` mais **dérivé des
  étapes** (l'étape `current` prime ; sinon bloquée / terminé / en préparation), via le helper
  front `chantierBadge`. Les requêtes liste exposent `etape_courante` + `a_bloquee`
  (sous-requêtes **statiques**, paramètres `client_id`/`archived` toujours paramétrés ;
  filtre `masquee=FALSE` pour les vues client/vue-client). Le menu « Statut affiché au client »
  (doublon) est retiré de la fiche admin. Colonne/filtre AdminList « Statut » → « Étape ».
  La colonne DB `statut` est conservée (inutilisée à l'affichage, aucun impact sécurité).
- **Fichiers** : `frontend/src/api.js`, `frontend/src/admin.jsx`, `frontend/src/client.jsx`,
  `backend/src/routes/admin/chantiers.js`, `backend/src/routes/client/chantiers.js`,
  `backend/src/routes/admin/vue_client.js`. `node --check` OK ; build OK ; rendu vérifié (preview).

## 11. Champ obligatoire « Terrain viabilisé » (Oui/Non) à la création (2026-06-26)

- Colonne `chantiers.terrain_viabilise boolean` **nullable** (migration idempotente
  `db/migrations/2026-06-26_terrain_viabilise.sql`) — l'existant reste NULL, l'obligation est
  imposée à la **création** (front : bloque l'étape suivante ; back : `typeof !== 'boolean'`
  → 400). Stocké en **booléen** (pas de chaîne utilisateur), inséré en **requête paramétrée**.
- Éditable via `PUT /admin/chantiers/:id` (liste blanche) et `PUT /client/chantiers/:id/infos`
  (correctif au passage : `req.body[f] || null` → `=== '' ? null : value` pour **préserver
  `false`**, qui devenait NULL). Affiché côté client dans « Informations du dossier ».
- **Fichiers** : `db/schema.sql`, `db/migrations/2026-06-26_terrain_viabilise.sql` (nouveau),
  `backend/src/routes/admin/chantiers.js`, `backend/src/routes/client/chantiers.js`,
  `frontend/src/admin.jsx`, `frontend/src/client.jsx`. `node --check` OK ; build OK ; rendu vérifié.

## 12. Fiche admin « Informations du dossier » + références client (2026-06-26)

- **Fiche admin** : nouveau bloc « Informations du dossier » (client, adresse, puissance, durée,
  date de début, facturation, terrain viabilisé, références) **au-dessus de l'Avancement**. Le
  `GET /admin/chantiers/:id` fait désormais un **JOIN clients** (renvoie `client_nom`/`client_email`).
- **Références optionnelles** (client crée pour l'un de ses clients) : colonnes
  `chantiers.reference_client` + `reference_facturation` (text, migration
  `2026-06-26_references.sql`). Champs **facultatifs** dans les formulaires de création
  **client ET admin** (« Référence » sous Client / 1ᵉ champ + une « Référence » avant l'adresse
  de facturation quand « différente »). Insertion en requête paramétrée
  (`?.trim()||null`), éditables via les listes blanches PUT (client `/infos` + admin).
- **Fichiers** : `db/schema.sql`, `db/migrations/2026-06-26_references.sql` (nouveau),
  `backend/src/routes/admin/chantiers.js`, `backend/src/routes/client/chantiers.js`,
  `frontend/src/admin.jsx`, `frontend/src/client.jsx`. `node --check` OK ; build OK ; formulaire
  client vérifié en preview (2 champs Référence, bascule facturation, 0 erreur).

## 19. Abonnés aux notifications par chantier — remplace le rôle « Suivi » (2026-10-19)

- **Rôle « suivi » retiré** (décision produit) : `role_societe` ∈ `basic` | `admin` (liste
  blanche backend). La migration `2026-10-19_chantier_abonnes.sql` repasse les comptes `suivi`
  en `basic`.
- **Table `fbelec.chantier_abonnes`** (PK chantier+client, FK `ON DELETE CASCADE`) : sur chaque
  chantier, l'**admin de la société du propriétaire** choisit les collègues abonnés
  (`PUT /api/client/chantiers/:id/abonnes`, corps `{client_ids:[entiers]}`, remplace la liste en
  transaction). Contrôles **backend** : demandeur admin de la même société que le propriétaire
  (sinon 403 si visible, 404 sinon), ids entiers ≤ 500, uniquement des membres **actifs** de
  cette société, propriétaire exclu (toujours notifié) → 400 sinon.
- **Accès d'un abonné** : consultation **seule** du chantier (fragment SQL `VISIBLE` : propres
  chantiers/société pour l'admin, OU abonnement **tant que l'abonné est membre de la société du
  propriétaire**). Toutes les routes d'écriture restent filtrées sur `ecriture` → 403. Changer de
  société ou être désactivé (contrôle `authClient`) coupe l'accès et les e-mails.
- **E-mails** (`services/abonnes.js`, abonnés actifs de la société du propriétaire, hors
  propriétaire/auteur) : changement d'étape, message FB ELEC, copie des messages envoyés à
  FB ELEC depuis ce chantier. L'e-mail « nouveau chantier » du rôle suivi est supprimé.
- Front : encadré « Notifications du chantier » sur la fiche (admin de la société uniquement :
  cases à cocher, créateur verrouillé, enregistrement explicite) ; consultation seule pour les
  abonnés (bandeau, actions masquées) ; rôle suivi retiré de l'admin FB ELEC.
- **Revue adversariale (17 agents, 9 confirmations sur 14 → 6 correctifs)** : copie au
  **créateur** quand un autre membre (admin) écrit à FB ELEC depuis son chantier ; bornes
  `integer` sur les ids (400/404 au lieu de 500) ; verrou `FOR NO KEY UPDATE` contre deux
  enregistrements simultanés de la liste ; resynchronisation de l'encadré après rechargement ;
  écran « Chantier non disponible » au lieu d'un chargement infini (lien d'e-mail après retrait
  d'abonnement) ; commentaire obsolète.
- **Tests** : code exact des routes (liste, fiche, PUT abonnés, contact, refus d'écriture) et du
  service exécuté sur PostgreSQL (PGlite), envois d'e-mails espionnés → 35/35 OK (droits,
  validations, consultation seule, copies au créateur/abonnés, sortie de société, désactivation,
  cascade, migration rejouable). UI vérifiée desktop + 375 px.

## 18. Rôle société « Suivi » (retiré au § 19) + carte satellite par défaut (2026-10-17)

- Rôle « suivi » livré puis **retiré le 2026-10-19** (voir § 19). Restent valables ci-dessous :
  la carte satellite par défaut et les correctifs de la revue (compte désactivé, uploads,
  échappement des e-mails).
- **Carte** : la vue aérienne IGN (gratuite, sans clé) devient la vue par défaut ; plan
  OpenStreetMap et cadastre restent activables.
- **Revue adversariale (14 agents, 4 défauts confirmés sur 11, préexistants) → corrigés** :
  - **Compte désactivé** : `authClient` vérifie désormais `clients.actif` à chaque requête
    (401 « Compte désactivé »). Avant, un compte désactivé gardait l'accès jusqu'à l'expiration
    du JWT (7 j) — impact élargi par le rôle suivi (lecture de toute la société).
  - **Uploads** : le droit d'écriture est vérifié **avant** multer (`exigeEcriture`) → un envoi
    refusé n'écrit plus rien sur le disque ; fichier supprimé si l'enregistrement échoue.
  - **E-mails vers FB ELEC** (`sendContactClient`, `sendNouveauChantierAdmin`) : valeurs saisies
    par les clients échappées (`esc()`) — empêchait l'injection d'un faux bouton/lien.
  - Page Sociétés : message de confirmation correct pour le rôle suivi + texte d'explication.
- **Tests** : logique d'accès et destinataires exécutés sur PostgreSQL (PGlite) avec le code
  exact des fonctions → 19/19 OK (6 profils dont suivi sans société, 403/404, inactifs exclus,
  autre société exclue) + 9/9 sur les correctifs (compte désactivé/supprimé, jeton invalide,
  contrôle avant upload). Parcours UI vérifiés en preview.
- À vérifier manuellement : `backend/uploads/fbelec/chantiers/999/` (copie locale) ressemble à un
  dossier orphelin laissé par l'ancien comportement d'upload.

## 17. Localisation par point GPS + badge « Nouveau » (2026-09-30)

- **Badge « Nouveau »** : colonne `chantiers.vu_admin` (BOOLEAN NOT NULL DEFAULT TRUE → les
  chantiers existants sont « vus »). `POST /api/client/chantiers` insère `FALSE` ; la première
  ouverture de la fiche par un admin (`GET /api/admin/chantiers/:id`, derrière authAdmin) repasse
  à `TRUE` (UPDATE paramétré, conditionné à `vu_admin = FALSE` → une seule écriture). Liste admin :
  non-vus épinglés en tête + badge + fond jaune. Indicateur global partagé par les admins.
  Note : le trigger `set_updated_at` bumpe `updated_at` lors de ce marquage (une seule fois,
  sur un chantier qui vient d'être créé : impact négligeable sur les tris).
- **Point GPS remplaçant l'adresse** (création uniquement, client + admin) : colonnes
  `gps_lat/gps_lng` (DOUBLE PRECISION). Validation **backend** `gps()` (`utils/validate.js`) :
  les deux coordonnées ou aucune, type `number` strict, finies, bornées (±90/±180) → 400 sinon.
  L'adresse devient facultative seulement si un point valide est fourni ; elle est alors
  stockée comme libellé `Point GPS lat, lng` (`libelleGps()`), ce qui garde intacts nom,
  référence auto, mandat PDF, e-mails et listes. Commune toujours obligatoire. En mode GPS la
  facturation « identique » est désactivée (une adresse postale réelle est exigée).
  Non modifiables après création (hors whitelists PUT, décision produit).
- **Nouvelle dépendance front : `leaflet` 1.9.4** (BSD-2-Clause, maintenue, **aucune
  dépendance**). Chargée à la demande (`React.lazy`, chunk séparé ~45 Ko gzip) → la page de
  connexion n'est pas alourdie. Marqueur en `divIcon` CSS (pas d'images externes).
  Installée hors Google Drive (C:) puis recopiée (tailles de fichiers vérifiées).
- **Services tiers appelés par le navigateur** (sans clé, sans donnée personnelle — seulement
  des coordonnées/noms de commune) : tuiles `tile.openstreetmap.org` (attribution affichée),
  IGN Géoplateforme `data.geopf.fr/wmts` (photo aérienne, cadastre), `api-adresse.data.gouv.fr`
  (centrage sur la commune, déjà utilisé par l'autocomplétion) et `geo.api.gouv.fr/communes`
  (commune contenant le point → préremplit commune/CP). CORS vérifié. Liens externes des fiches
  (OpenStreetMap / Google Maps) en `target="_blank" rel="noopener noreferrer"`.
- **Carte** : contexte d'empilement isolé (`.fb-map{position:relative;z-index:0}`) pour que
  les z-index Leaflet (≥400) ne passent jamais au-dessus du header/modales.
- **Revue adversariale multi-agents (20 agents, 9 défauts confirmés sur 17) → corrigés** :
  - **Échappement HTML des e-mails client** (`esc()` dans `mailer.js`, `sendEtapeAvancement` et
    `sendNouvelleNote`) : un admin de société pouvait injecter du HTML (lien piégé) via la
    référence ou l'adresse d'un chantier d'un collègue, repris dans l'e-mail officiel reçu par
    ce collègue. Objets d'e-mail (texte brut) non concernés.
  - **Trigger `updated_at`** recréé avec `WHEN (OLD.vu_admin IS NOT DISTINCT FROM NEW.vu_admin)`
    : le marquage « vu » ne réordonne plus les listes. La fonction diffère selon les bases
    (`core.` vs `fbelec.set_updated_at`) → relue dans `pg_trigger` par un bloc `DO` atomique.
  - **Nom recalculé** dans `PUT /api/client/chantiers/:id/infos` quand adresse/commune changent,
    uniquement s'il est encore le nom automatique « adresse, commune » (paramètres `$n::text`,
    anti-IDOR inchangé). Évite un nom figé sur « Point GPS … » après saisie de l'adresse réelle.
  - Front : code postal non forcé pour les communes à plusieurs CP, bascule adresse ⇄ carte non
    destructive (adresse et facturation restaurées), double-clic ne place plus le point,
    échec de chargement du chunk carte (ex. après redéploiement) → message de secours au lieu
    d'une page blanche.
  - **Tests** : migration + trigger + requête PUT exécutés sur PostgreSQL (PGlite) pour les
    deux variantes de fonction → 24/24 OK (idempotence, `updated_at`, nom auto/personnalisé,
    anti-IDOR). Parcours UI vérifiés en preview (desktop + 375 px, 0 débordement).
- **Fichiers** : `db/migrations/2026-09-30_gps_vu_admin.sql` (nouveau), `db/schema.sql`,
  `backend/src/utils/validate.js`, `backend/src/routes/{admin,client}/chantiers.js`,
  `backend/src/services/mailer.js`,
  `frontend/src/{MapPicker.jsx (nouveau), ui.jsx, api.js, admin.jsx, client.jsx, theme.css}`,
  `frontend/package.json` + `package-lock.json`.

## 16. Fil de messages client, commentaire de création, ajustements mandat (2026-07-22)

- **Mandat EDF (ajustements)** : mandataire = « Société F.B ELEC ( Monsieur Franck BORDIER) »
  (10 pt, tient dans la ligne calibrée : 213 pt / 320 max) ; cases « contrat de fourniture
  d'électricité » **décochées** (souscription + résiliation → seul « branchement provisoire »
  reste coché) ; signature repositionnée **côté mandataire** (x:337, position d'origine déjà
  validée visuellement).
- **Message client → fil de discussion** : `POST /api/client/contact` accepte un `chantier_id`
  facultatif (validé entier > 0, **accès contrôlé par `allowedClientIds()` — anti-IDOR**,
  404 sinon). Le message est stocké dans `fbelec.notes` (`de_client=TRUE`, auteur = nom du
  client côté serveur, jamais du payload ; requête paramétrée) → visible dans la carte
  « Message au client » (admin, bordure jaune + auteur) et dans le fil « Messages » côté
  client (avatar initiales). L'admin répond via la carte existante (note e-mailée au client) :
  fil bidirectionnel. **E-mail enrichi** (`sendContactClient`) : société, téléphone, chantier
  (nom/adresse/références) + bouton « Voir et répondre sur le site » →
  `PUBLIC_URL?chantier=<id>` (deep-link existant, ouvre la fiche admin après connexion).
  Migration `2026-07-22_commentaire_notes_client.sql` (`notes.de_client`).
- **Commentaire de création** : colonne `chantiers.commentaire` (TEXT, facultatif, validé
  `str(max 5000)` backend), textarea à l'étape 2 Documents (client + admin), transmis au POST,
  affiché dans le récapitulatif et dans « Informations du dossier » (gestion admin).
- **Fichiers** : `db/migrations/2026-07-22_commentaire_notes_client.sql` (nouveau),
  `backend/src/services/{mandat.js, mailer.js}`, `backend/src/routes/{admin,client}/chantiers.js`,
  `frontend/src/{admin.jsx, client.jsx}`. `node --check` OK (4 fichiers) ; build OK ; parcours
  vérifiés en preview (payloads capturés : `commentaire` et `chantier_id` transmis ; gate
  documents obligatoires intact ; affichages admin/client contrôlés).

## 15. Mandat EDF PDF, contact facturation, deps (2026-07-21)

- **Génération du mandat EDF prérempli** : service `backend/src/services/mandat.js` (pdf-lib,
  dessin par coordonnées sur `backend/assets/mandat-vierge.pdf`) — référence mandant,
  F.B ELEC mandataire, 8 droits RGPD cochés, souscription/résiliation (élec + branchement
  provisoire) avec adresse du chantier, fait à/le/1 exemplaire, tampon+paraphe
  `backend/assets/signature-fbelec.png` sous « Signature du mandataire » (mandant vide).
  Routes `POST /api/client/mandat` (authClient) et `POST /api/admin/chantiers/mandat`
  (authAdmin), **entrées validées** (str required/bornées), réponse PDF en attachment.
  - **Enregistrement automatique** : à la création d'un chantier (admin + client), le mandat
    est généré et ajouté aux **documents du chantier** (`genererMandatFichier` : chantierId
    forcé entier positif, schéma whitelisté `[a-z0-9_]` — mêmes gardes anti-traversal que
    les uploads ; nommage aléatoire ; catégorie 'mandat', statut 'attente', visible client).
    Échec non bloquant (la création aboutit, erreur logguée).
  - ⚠️ **`backend/assets/` est dans `.gitignore`** (la signature scannée ne doit pas aller
    sur GitHub) → à **scp manuellement** vers chaque serveur, comme le `.env`.
  - **Nouvelle dépendance : `pdf-lib` ^1.17** (pur JS, maintenu, sans binaire natif — OK
    Passenger). Front : helper `downloadPdf()` (fetch POST + blob, token en header).
- **Contact de facturation** : colonnes `chantiers.facturation_telephone/facturation_email`
  (facultatives, migration `2026-07-21_facturation_contact.sql`), formulaires (si facturation
  « différente », réf préremplie depuis la référence client, modifiable), whitelists PUT,
  affichages. **Mandat retiré des documents obligatoires** (front, `CAT_REQUIRED`).
- **Dépendances corrigées** (npm audit) : `body-parser` ≥1.20.6 (DoS, low) et
  **`nodemailer` ^9.0.3** (high : contournement disableFileAccess via option `raw` — non
  utilisée chez nous ; API createTransport/sendMail inchangée). `npm audit` → **0 vulnérabilité**.
  - ⚠️ Piège Drive : npm install sur H: **tronque des fichiers** (package.json à 0 octet) →
    modules réparés par install locale (C:) puis copie. Dossiers `*.broken` laissés dans
    node_modules (inertes). Sur les serveurs, `npm install` normal (pas de Drive).

## 14. Colonnes Société + recherche/filtres clients (2026-07-03)

- **Chantiers suivis** : colonne **Société** (jointure `LEFT JOIN societes` via le client
  propriétaire dans `GET /admin/chantiers` → `societe_nom`) + **tri par défaut sur la société**
  (comptes sans société en dernier) + filtre Société. Vérifié en preview (tri correct,
  0 débordement desktop/mobile).
- **Gestion clients** : colonne **Société** (+ badge « Admin société »), **tri par défaut
  société**, **barre de recherche** (nom/e-mail/téléphone/société) et **filtres** (par société,
  dont « Sans société », et par rôle). Filtrage 100 % côté front sur les données déjà
  chargées ; aucune donnée sensible supplémentaire exposée.
- **Fichiers** : `backend/src/routes/admin/chantiers.js`, `frontend/src/admin.jsx`.

## 13. Sociétés/rôles, téléchargement photos, type de courant, DnD étapes (2026-06-27)

- **Sociétés + rôles** : table `fbelec.societes`, colonnes `clients.societe_id` (FK SET NULL)
  et `clients.role_societe` ('basic'|'admin', **whitelist backend**, jamais de confiance au
  front). Migration `2026-06-27_societes_type.sql`. Routes `GET/POST/PUT/DELETE /api/admin/societes`
  (authAdmin ; PUT = renommage, nom validé/borné). **Page dédiée** `AdminSocietes`
  (bouton « Sociétés » dans la barre de la liste chantiers) : création, renommage,
  suppression, et changement de rôle des comptes rattachés (via `PUT /admin/clients/:id`,
  whitelist inchangée). **Visibilité côté client (anti-IDOR étendu)** : helper `allowedClientIds()` dans
  `client/chantiers.js` — un 'basic' n'accède qu'à ses chantiers ; un 'admin' de société accède
  aux chantiers de tous les comptes de SA société (`client_id = ANY($ids)`, appliqué à
  **toutes** les routes client : liste, détail, édition, uploads, suppressions). Les ids
  proviennent du serveur (JWT → DB), jamais du client.
- **Téléchargement des photos** (client + admin) : `downloadFile()` (`api.js`) — fetch + blob
  (l'attribut download est ignoré en cross-origin), repli `window.open` noopener. Aucun
  chemin utilisateur : on télécharge l'URL déjà servie par l'API.
- **Connexion** : rechargement complet (`window.location.reload()`) après login → aucun état
  résiduel en mémoire (sauf parcours « changer le mot de passe » conservé).
- **Type de courant** : colonne `chantiers.puissance_type` ('monophase'|'triphase',
  **whitelist backend**, obligatoire à la création admin + client). Références
  `reference_client` désormais **obligatoire** (validée backend), placeholder « Société ou nom
  du client » ; `reference_facturation` exigée par le front quand facturation différente.
- **Étapes : réordonnancement par glisser-déposer** (+ flèches ▲▼ tactiles). Champ « ordre »
  retiré de l'UI ; POST = fin de liste (MAX+10) ; `PUT /etapes/reorder` validé (ids/ordres
  entiers) et en **2 passes** transactionnelles (contourne l'index unique sur `ordre`).
- **CSS mobile** : audit mesuré à 375px (login, dashboard, formulaires, guide, admin list/
  clients/étapes + modales) → 0 débordement ; règle `div[style*="max-width"]{max-width:100%}`
  ≤640px pour des largeurs de champs uniformes.
- **Fichiers** : `db/schema.sql`, `db/migrations/2026-06-27_societes_type.sql` (nouveau),
  `backend/src/routes/admin/{societes.js (nouveau), clients.js, chantiers.js, etapes.js, index.js}`,
  `backend/src/routes/client/chantiers.js`, `frontend/src/{api.js, ui.jsx, admin.jsx, client.jsx, theme.css}`.
  `node --check` OK (6 fichiers) ; build OK ; parcours vérifiés en preview.

