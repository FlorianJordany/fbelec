# HANDOFF.md — Cahier de relais

<!-- NE PAS remplir à la main : en fin de session, tape /thug dans Claude Code,
     il remplit cette section à partir de notre conversation. -->

> Passation entre les deux développeurs (on travaille chacun son tour).
> Fin de session → `/thug` pour remplir. Début de session → lire ce fichier.

---

## 🔄 Dernière session

- **Date :** 2026-11-06
- **Développeur :** Florian

### Ce qui a été fait

- **« Nouveau chantier » (client `NouveauChantierClient` dans `client.jsx`, admin `AdminNouveauChantier`
  dans `admin.jsx`, code identique)** : la carte est toujours affichée (plus de bouton « Pas encore
  d'adresse ? »). Règle : adresse OU point obligatoire. Choisir une adresse BAN zoome dessus (zoom 18 sur
  un numéro, 16 sinon). Retoucher ou effacer l'adresse rend la main au centrage par commune. La commune
  n'est déduite du point que s'il n'y a pas d'adresse. Bouton « Retirer le point ». Point sans adresse :
  la facturation passe d'office sur « Différente » (`factForcee`) et revient sur « Identique » dès qu'une
  adresse est tapée, sauf si l'utilisateur a choisi lui-même. Le texte d'aide sous la carte est supprimé
  (demande de Florian).
- **Carte Google (`MapGoogle.jsx`)** : boutons Google remplacés par des boutons compacts Plan / Satellite /
  Cadastre (30 px, `TAILLE_BOUTONS`) sur une ligne. Le cadastre est masquable et affiché au départ.
  Commandes Google réduites (`controlSize`). Nouveau prop `centre` dans `MapGoogle`, `MapPicker` et
  `CarteGps` (`ui.jsx`). `AddressAutocomplete` renvoie `position`.
- **Carte de secours Leaflet (`MapPicker.jsx`)** : `dragging: !L.Browser.mobile`. Sur mobile, un doigt
  fait défiler la page et deux doigts déplacent la carte. `.fb-map-pin{touch-action:none}` dans
  `theme.css`.
- **« Chantiers suivis » (`AdminList`, `admin.jsx`)** : nouveaux chantiers (`vu_admin=false`) dans un
  bandeau en haut et aussi dans leur bloc. Le reste est groupé en blocs repliables par société
  (« Sans société » en dernier). Les blocs ouverts sont mémorisés (`sessionStorage`
  `fb_blocs_ouverts`). Un filtre ouvre les blocs concernés, qui restent refermables. Le bloc d'un
  chantier ouvert reste ouvert au retour de sa fiche. Backend : `GET /api/admin/chantiers` renvoie
  `cl.societe_id` (`routes/admin/chantiers.js`).
- **Revue en 8 agents** : 4 constats confirmés et corrigés (forçage de la facturation, défilement mobile
  Leaflet, centre de carte périmé, bloc refermé au retour de fiche). Le constat « regroupement sans
  `societe_id` si l'API n'est pas redémarrée » a été écarté : il suffit de déployer l'API avant le front.
- **Vérifié en preview** (PC + mobile 375 px). Builds `dist/dev` et `dist/prod` refaits et contrôlés.
- **Git** : tout est commité (`d4b333c`, y compris le lot du 2026-11-02) et poussé sur `DEV`. La PR #2
  (`DEV` → `main`) a un nouveau titre et une nouvelle description.

### En cours / pas terminé

- **Déploiement : lignes données, exécution non confirmée.** Ordre : migrations du lot 2026-11-02
  (si pas déjà faites), puis `backend/src` + restart (pour `societe_id`), puis le front `dist/dev` /
  `dist/prod`. Florian n'a pas dit quelles migrations il a déjà lancées.
- **Questions ouvertes pour Florian** :
  - Garder ou supprimer la phrase sous le champ adresse (« Pas encore d'adresse ? Laissez ce champ vide
    et placez un point sur la carte. ») ?
  - Les questions du 2026-11-02 restent sans réponse (formulation « contactez votre administrateur »,
    les 4 problèmes antérieurs : voir Pièges).

### Prochaines étapes

1. Confirmer le déploiement DEV puis PROD. Tester : la carte toujours visible, la facturation forcée
   avec un point sans adresse, les blocs société, les boutons Plan / Satellite / Cadastre sur
   téléphone réel.
2. Tester en PROD Mon compte et le mot de passe oublié avec un vrai mail (jamais testés avec un vrai
   SMTP ni sur le vrai PG 9.6).
3. Relire puis merger la PR #2 vers `main` quand la PROD est validée.
4. Reprendre les étapes encore ouvertes du 2026-11-02 : expéditeur « FB ELEC> », SMTP en DEV, rotation
   du mot de passe DB et de `JWT_SECRET`, supprimer `apercu-guide.html`.

### Pièges / décisions / à savoir

- **Ordre de déploiement : API (avec migrations) avant le front.** Sinon tous les chantiers d'une
  société tombent dans un seul bloc (`societe_id` absent) et Mon compte ne répond pas.
- **Plan / Satellite sont nos propres boutons** (`mapTypeControl:false`) : `controlSize` ne réduit pas le
  texte des boutons Google. Leur taille se règle avec `TAILLE_BOUTONS` dans `MapGoogle.jsx`.
- **`centreCarte` n'est posé que par `onSelect`** (choix d'une adresse BAN) et remis à `null` à chaque
  frappe dans le champ adresse. Tant qu'il est posé, il bloque le centrage par commune.
- **Tout choix manuel de facturation annule `factForcee`** (`setFactForcee(false)` dans le `onChange`).
  À ne pas retirer, sinon un choix manuel est écrasé.
- **Google Maps marche maintenant en local** (facturation apparemment active). Le repli IGN reste en
  place (délai de 10 s, clé refusée).
- **Preview** : monter les composants avec les dépendances `/node_modules/.vite/deps/...?v=<hash>`. Après
  une modification, naviguer de nouveau sur la page, sinon d'anciens modules restent en cache. Les captures
  Google peuvent arriver avec quelques secondes de retard.
- **`.htaccess` du front** : absent de `frontend/public` et donc des builds. Il n'existe que sur le
  serveur, et `scp -r *` ne l'écrase pas. Ne pas vider le dossier distant.
- Rappels du 2026-11-02 toujours valables : `desktop.ini` fantômes à supprimer avant chaque build ;
  mauvais mot de passe actuel = 403 ; ne pas remonter les limiteurs sur le chemin complet ; clés Google
  jamais affichées ni commitées ; commandes complètes sans variables pour Florian.

---

## 🗄️ Historique des sessions précédentes

<!-- /passation descend ici l'ancienne entrée à chaque nouvelle passation. -->

- **2026-11-02 — Florian (carte Google + cadastre, Mon compte, mot de passe oublié)** : `MapGoogle.jsx`
  + `carte.js` avec repli IGN ; espace Mon compte (`routes/compte.js`) ; sessions coupées par
  `mdp_version` ; mot de passe oublié avec temporaire de 24 h rangé à part ; alerte à l'ancienne adresse
  à chaque changement d'e-mail ; plafonds par compte ; 2e revue (24 corrections) ; migrations
  `2026-11-02_mon_compte.sql` et `2026-11-02_mdp_oublie.sql` ; SECURITY_AUDIT §21-22 ; 199/199 tests
  sur PGlite.

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
