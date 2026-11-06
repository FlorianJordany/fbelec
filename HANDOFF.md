# HANDOFF.md — Cahier de relais

<!-- NE PAS remplir à la main : en fin de session, tape /thug dans Claude Code,
     il remplit cette section à partir de notre conversation. -->

> Passation entre les deux développeurs (on travaille chacun son tour).
> Fin de session → `/thug` pour remplir. Début de session → lire ce fichier.

---

## 🔄 Dernière session

- **Date :** 2026-11-02
- **Développeur :** Florian

### Ce qui a été fait

- **Carte Google + cadastre IGN**, selon la spec de Tony : `frontend/src/MapGoogle.jsx`,
  `frontend/src/carte.js`, `MapPicker.jsx`, `CarteGps` (`ui.jsx`). Repli automatique sur la carte
  IGN/Leaflet si Google échoue. Clés dans `frontend/.env` (DEV) et `frontend/.env.production`
  (PROD), ignorés par git. Détail : `SECURITY_AUDIT.md` §21.
- **Espace « Mon compte »** (clients et FB ELEC) : `backend/src/routes/compte.js`, vue `MonCompte`
  dans `client.jsx`, bouton dans `AppHeader`. Nom, e-mail, téléphone, mot de passe. Le mot de passe
  actuel est exigé pour changer d'e-mail ou de mot de passe. Disposition PC : deux cartes alignées
  sur l'en-tête, une colonne sous 640 px.
- **Coupure des sessions** : colonne `mdp_version`, claim `mv` dans le jeton
  (`middleware/session.js`, `authClient`, `authAdmin`). `change-code` réservé au claim `provisoire`.
- **Mot de passe oublié refait** : temporaire rangé à part (`code_provisoire_hash`,
  `code_provisoire_expire`), valable 24 h. Le mot de passe actuel reste valable jusqu'à la première
  utilisation du temporaire. Réponse à Florian : oui à cette protection.
- **Alerte à l'ancienne adresse** à chaque changement d'e-mail (`sendEmailModifie`), sans nom ni
  nouvelle adresse. Réponse à Florian : oui à l'alerte.
- **Corrections de la 2e revue** (28 constats confirmés, 24 corrigés) :
  - Plafonds par compte, en base : 1 demande d'oubli par 5 min et 6 par 24 h ; 3 changements
    d'e-mail par client sur 24 h (429 au-delà, FB ELEC peut toujours corriger).
  - Limiteurs d'oubli et de contact testés depuis le montage du routeur (`skip`) : ferme le
    contournement par double barre (`/api/auth//forgot-password`, `/api/client//contact`).
  - Délais égalisés (`HASH_FACTICE`) : un compte inexistant ne se distingue plus au chronomètre.
  - Le front essaie la connexion client avant FB ELEC.
  - Mail d'oubli en échec : le temporaire est annulé. E-mail changé pendant une demande : aucun code.
  - `vEmail` refuse `/ : < > , ; " ( ) \ [ ]`. Codes générés sans `!@#`.
  - FB ELEC corrige l'e-mail d'un compte au mot de passe provisoire non remplacé : nouveau code
    envoyé à la bonne adresse, ancien code annulé, sessions coupées.
  - Toast lisible sur mobile, en-tête FB ELEC réparé entre 641 et 720 px (`.fb-hide-entete`),
    formulaire d'oubli (Retour, envoi vide, textes).
- **`SECURITY_AUDIT.md` §22** à jour.
- **Tests** : 199/199 de bout en bout (PGlite, vrai Express, vraies requêtes HTTP), attaques rejouées
  et bloquées, écrans vérifiés en preview. Scripts hors repo (scratchpad de la session de Florian).
  **Pas testé sur le vrai PostgreSQL 9.6 ni avec un vrai SMTP.**
- **Builds prêts** : `frontend/dist/dev` et `frontend/dist/prod`, contrôlés (bonne API, bonne clé
  Google dans chacun, pas de `localhost`).

### En cours / pas terminé

- **Déploiement du dernier lot : lignes données à Florian, exécution non confirmée au moment de
  cette passation.** La 1re version de Mon compte est en DEV (capture de Florian), carte incluse dans
  ce build. Pour la PROD, ni la carte, ni Mon compte, ni le nouvel oubli ne sont confirmés.
  - DEV : migration `2026-11-02_mdp_oublie.sql`, puis `backend/src`, puis `dist/dev`.
  - PROD : vérification des e-mails en double, `2026-11-02_mon_compte.sql`,
    `2026-11-02_mdp_oublie.sql`, puis `backend/src`, puis `dist/prod`.
- **Rien n'est commité depuis `f681750`** : 25 fichiers modifiés ou nouveaux sur la branche `DEV`
  (carte, Mon compte, oubli, audit, ce fichier). Florian n'a pas encore répondu pour le push.
- **Questions ouvertes pour Florian** :
  - Garder « Compte FB ELEC : contactez votre administrateur » sur l'écran d'oubli, ou donner un
    contact précis ?
  - Corriger ou non les 4 problèmes antérieurs (voir Pièges) ?
- **Facturation Google** : dernier test en erreur `BillingNotEnabledMapError`, alors que la
  passation de Tony indiquait la facturation associée. À vérifier dans Google Cloud. En attendant,
  la carte reste sur IGN, repli vérifié.

### Prochaines étapes

1. Confirmer avec Florian où en est la DEV. Tester : Mon compte sur PC, « Demande enregistrée » à
   l'oubli, 4e changement d'e-mail refusé sur un client de test.
2. Déployer en PROD (migrations avant le backend), puis tester le mot de passe oublié avec un vrai
   mail : il n'a jamais été testé avec un vrai SMTP.
3. Commiter et pousser sur `DEV` si Florian le valide, puis merger la **PR #2** vers `main`.
4. Résoudre la facturation Google, puis retester la vraie carte (DEV et PROD, mobile et desktop).
5. Regarder un vrai mail de prod : si l'expéditeur affiche « FB ELEC> », corriger `mailer.js`.
6. Tester en PROD les notifications par chantier (créateur Basic coche un collègue → lecture seule
   + e-mails), repris de la passation de Tony.
7. (Optionnel) SMTP sur le DEV. Vitrine : AutoSSL de l'API dev + protection par mot de passe du site DEV.
8. Sécurité en attente : rotation mot de passe DB + `JWT_SECRET` ; supprimer `apercu-guide.html` ;
   vérifier le dossier local orphelin `backend/uploads/fbelec/chantiers/999/`.

### Pièges / décisions / à savoir

- **Migrations AVANT le backend**, sinon 500 sur toutes les routes authentifiées (`mdp_version`) et
  sur l'oubli. `2026-11-02_mdp_oublie.sql` ajoute 6 colonnes à `fbelec.clients`. Toutes deux sont
  idempotentes.
- **Builds séparés**, plus de `dist/` unique. Depuis `frontend/` :
  `npx vite build --mode production --outDir dist/prod --emptyOutDir` et
  `npx vite build --mode development --outDir dist/dev --emptyOutDir`. Le contrôle avant scp PROD
  devient `grep sc1qize9193 dist/prod/assets/*.js`.
- **`desktop.ini` fantômes** dans `frontend/public` : invisibles depuis Git Bash, ils font échouer
  Vite (ENOENT) et vident le dossier de sortie. Suppression en PowerShell :
  `Get-ChildItem -Force -Recurse frontend\public -Filter desktop.ini | ForEach-Object { Remove-Item -LiteralPath $_.FullName -Force -Confirm:$false }`.
  Git affiche aussi `ignoring broken ref refs/.../desktop.ini` : sans effet.
- **Mauvais mot de passe actuel = 403, jamais 401** : `apiFetch` supprime le jeton et recharge sur 401.
- **Ne pas remonter les limiteurs sur le chemin complet** (`app.use('/api/auth/forgot-password', …)`) :
  c'est ce qui permettait la double barre.
- **Connexion** : un mauvais mot de passe coûte 2 échecs (client puis FB ELEC), donc blocage de l'IP
  après 5 essais, jusqu'à 15 minutes. Limiteurs par IP en mémoire, remis à zéro au redémarrage ; les
  plafonds par compte sont en base.
- **Alerte sans nom ni nouvelle adresse : voulu.** Ces valeurs sont saisies par le compte et le mail
  peut viser la boîte d'un tiers.
- **Comptes FB ELEC** : pas de récupération autonome, l'oubli ne concerne que les clients (SQL seulement).
- **Limites acceptées** : le provisoire peut rester en place si l'utilisateur recharge la page
  (décision de Florian : ne pas forcer) ; le nouvel e-mail n'est pas confirmé par un lien.
- **4 problèmes antérieurs laissés de côté, à la décision de Florian** :
  - Expéditeur « FB ELEC> » si `SMTP_FROM` a la forme `Nom <adresse>` donnée dans les guides.
  - Toast « Nouveau mot de passe envoyé » affiché même si le mail échoue (`admin.jsx`).
  - Guide client : 3 documents obligatoires annoncés au lieu de 2 (`client.jsx`).
  - Petites cibles tactiles sur l'écran de connexion à 375 px.
- **SMTP** : configuré en PROD ; sans SMTP en DEV, aucun mail ne part et aucune erreur n'apparaît.
- **Clés Google** : ne jamais les afficher ni les commiter. Un nouveau domaine front doit être ajouté
  aux référents de la clé (sinon `RefererNotAllowedMapError`). Ne pas activer d'autres API Google : la
  recherche d'adresse reste sur la BAN.
- **Rappels toujours valables** : domaine front PROD = `https://suividechantier.fbelec.fr`, sans `www`
  (`docs/GUIDE-PROD.md` cite `suivi.fbelec.fr`, obsolète) ; accès client via le fragment SQL `VISIBLE`
  (`routes/client/chantiers.js`) ; logique des abonnés dans `backend/src/services/abonnes.js` ;
  `NotificationsChantier` partagé client/admin ; racine Passenger = docroot (`.htaccess`
  `Require all denied` sur tout dossier sensible) ; commande de migration
  `psql "$(grep '^DATABASE_URL' ~/<dossier-api>/.env | cut -d= -f2- | tr -d "'\"")" -f ~/fichier.sql` ;
  Florian préfère des commandes complètes sans variables.

---

## 🗄️ Historique des sessions précédentes

<!-- /passation descend ici l'ancienne entrée à chaque nouvelle passation. -->

- **2026-10-24 — Tony (Google Cloud, spec de la carte)** : décision carte Google + cadastre IGN (modèle
  du formulaire Enedis) ; facturation, budget et alertes ; Maps JavaScript API seule ; clés
  « FBELEC carte DEV » et « FBELEC carte PROD » restreintes par référents, transmises à Florian hors
  Drive ; environ 10 000 chargements par mois gratuits ; Tony a un accès admin au projet Google Cloud.
  Aucun code modifié.

- **2026-10-19 — Florian (GPS, badge Nouveau, notifications par chantier, sécurité)** : point
  GPS à la création (`gps_lat/gps_lng`, `MapPicker.jsx` Leaflet + IGN/OSM/cadastre) ; badge
  « Nouveau » (`chantiers.vu_admin`) ; notifications par chantier (`fbelec.chantier_abonnes`,
  rôles société Admin/Basic uniquement, abonnés en lecture seule + e-mails) ; durcissements
  (`.htaccess` deny sur `backend/src` et `backend/assets`, compte désactivé refusé, `esc()` dans
  les e-mails, contrôle avant multer) ; diagnostic blocage réseau d'un client ; revue + tests
  PGlite 40/40. DEV et PROD déployés ; commits dans la PR #2 (non mergée).

- **2026-07-30 — Florian (mandat, facturation, fil de messages)** : mandat EDF PDF prérempli et
  généré à la création (`services/mandat.js`, pdf-lib) ; contact facturation ; documents
  obligatoires bloquants ; fil de messages client ↔ FB ELEC (`notes.de_client`, composant `Notes`
  partagé) ; commentaire de création ; référence client en titre côté client ; fix 409
  « Référence déjà utilisée » (`'TMP-'||md5`, setval DEV) ; vraie cause d'erreur au login ;
  référence client dans les e-mails. PR #1 mergée.

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
