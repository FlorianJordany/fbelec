# Déploiement — Environnement de DEV (o2switch, univers de dev, HTTP)

Guide complet de A à Z pour mettre le site en ligne sur l'univers de **dev** o2switch.

> **Pourquoi HTTP en dev ?** L'univers de dev utilise le domaine provisoire
> `*.sc1qize9193.universe.wf`. Let's Encrypt n'arrive pas à émettre de certificat
> dessus (erreur CAA `SERVFAIL` sur `universe.wf`). On travaille donc **en `http://`**
> (o2switch ne force pas la redirection HTTPS sur ces domaines). Le passage en HTTPS
> se fera en prod, sur le vrai domaine → voir `GUIDE-PROD.md`.

## Repères

| | Valeur |
|---|---|
| SSH / SFTP | `sc1qize9193@foulque.o2switch.net` (port 22) |
| Home | `/home2/sc1qize9193` |
| Sous-domaine **front** | `fbelec.sc1qize9193.universe.wf` → dossier `~/fbelec.sc1qize9193.universe.wf` |
| Sous-domaine **API** | `fbelec-api.sc1qize9193.universe.wf` → dossier `~/fbelec-api.sc1qize9193.universe.wf` |
| Base PostgreSQL | version **9.6** |

Architecture : **frontend statique** (build Vite) sur un sous-domaine, **backend Node/Express**
sur un autre. Les deux communiquent en HTTP via l'API.

---

## Étape 1 — Créer les 2 sous-domaines

cPanel → **Domaines** (ou *Sous-domaines*). Crée :
- `fbelec` . `sc1qize9193.universe.wf`  → le **front**
- `fbelec-api` . `sc1qize9193.universe.wf` → l'**API**

Note les dossiers proposés (par défaut `~/fbelec.sc1qize9193.universe.wf` et
`~/fbelec-api.sc1qize9193.universe.wf`).

---

## Étape 2 — Créer la base PostgreSQL

cPanel → **Bases de données PostgreSQL** :
1. Crée une base → nom final préfixé, ex. `sc1qize9193_fbelec`.
2. Crée un utilisateur → ex. `sc1qize9193_admin`, avec un mot de passe.
   > Conseil : mot de passe **lettres + chiffres uniquement** (évite `@ : / # ? [ ]`),
   > ça évite les soucis d'échappement plus tard.
3. **Ajoute l'utilisateur à la base** (section « Ajouter un utilisateur à une base »)
   avec tous les privilèges.

---

## Étape 3 — Créer l'application Node.js (backend)

cPanel → **Setup Node.js App** → *Create Application* :
- **Node.js version** : 20 ou 22
- **Application mode** : Production
- **Application root** : `fbelec-api.sc1qize9193.universe.wf` (le dossier du sous-domaine API)
- **Application URL** : `fbelec-api.sc1qize9193.universe.wf`
- **Application startup file** : `app.js`

> ⚠️ L'**Application root** ne se modifie pas après coup. Si tu te trompes, supprime
> l'app et recrée-la. Le code va dans ce dossier ; le « dossier web » du sous-domaine
> est géré automatiquement par Passenger.

---

## Étape 4 — Envoyer le code du backend

Le `scp` peut imbriquer les fichiers s'il vise un dossier existant → on passe par un
dossier temporaire puis on déplace.

**Sur ton PC (PowerShell) :**
```powershell
scp -r F:\OutiLab\fbelecv2\backend sc1qize9193@foulque.o2switch.net:/home2/sc1qize9193/backend-tmp
```

**En SSH :**
```bash
ssh sc1qize9193@foulque.o2switch.net
shopt -s dotglob
mv ~/backend-tmp/* ~/fbelec-api.sc1qize9193.universe.wf/
rmdir ~/backend-tmp
ls ~/fbelec-api.sc1qize9193.universe.wf
```
Tu dois voir `package.json`, `app.js`, `src`, `.env.example` à la racine (l'`app.js`
d'exemple d'o2switch est remplacé par le nôtre ; les dossiers `public`/`tmp` restent).

---

## Étape 5 — Configurer le `.env` du backend (valeurs HTTP)

```bash
cd ~/fbelec-api.sc1qize9193.universe.wf
cp .env.example .env
nano .env
```
```env
DATABASE_URL=postgresql://sc1qize9193_admin:MOT_DE_PASSE_ENCODE@localhost:5432/sc1qize9193_fbelec
JWT_SECRET=colle_une_longue_chaine_aleatoire
JWT_EXPIRES_IN=7d
PUBLIC_API_URL=//fbelec-api.sc1qize9193.universe.wf
CORS_ORIGIN=http://fbelec.sc1qize9193.universe.wf,https://fbelec.sc1qize9193.universe.wf
PUBLIC_URL=http://fbelec.sc1qize9193.universe.wf
SMTP_HOST=ssl0.ovh.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=contact@fbelec.fr
SMTP_PASS=mot_de_passe_email
SMTP_FROM=FB ELEC <contact@fbelec.fr>
CONTACT_EMAIL=contact@fbelec.fr
```
Générer un `JWT_SECRET` :
```bash
source ~/nodevenv/fbelec-api.sc1qize9193.universe.wf/20/bin/activate   # adapte 20 à ta version
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

> **Points critiques** (sources d'erreurs vécues) :
> - **URLs « protocol-relative »** : `PUBLIC_API_URL` (et plus bas `VITE_API_URL`)
>   commencent par `//` **sans `http:`/`https:`**. L'app suit alors automatiquement le
>   schéma de la page → **http en dev, https en prod, jamais de « mixed content »**,
>   sans variable à basculer. Vérifie bien l'hôte exact (`fbelec-api`, pas `api-fbelec`).
> - `CORS_ORIGIN` liste l'origine du front **dans les deux schémas** (séparés par une
>   virgule, sans `/` final) : en dev le navigateur peut charger la page en http **ou**
>   https selon son humeur.
> - **Mot de passe BDD à caractères spéciaux** : il doit être **encodé** dans
>   `DATABASE_URL` (URL-encoding) : `,`→`%2C`, `@`→`%40`, `[`→`%5B`, `]`→`%5D`, `#`→`%23`…
>   Exemple : mot de passe `,ZZ@p6R[_,[roQsI` → `%2CZZ%40p6R%5B_%2C%5BroQsI`.
>   (Ou plus simple : un mot de passe **alphanumérique**.)

---

## Étape 6 — Installer les dépendances + démarrer

cPanel → **Setup Node.js App** → ton app → **Run NPM Install**, puis **Restart**.

> ⚠️ **Gotcha `.env`** : le bouton Restart ne recharge pas toujours le `.env`.
> Pour forcer : `touch ~/fbelec-api.sc1qize9193.universe.wf/tmp/restart.txt`

Teste :
```
http://fbelec-api.sc1qize9193.universe.wf/health
```
→ `{"status":"ok","db":"connected",...}`. Si `db` n'est pas `connected` → revois `DATABASE_URL`.

---

## Étape 7 — Créer les tables (schéma PostgreSQL)

Le schéma `db/schema.sql` est déjà compatible PostgreSQL 9.6 (`serial`, `EXECUTE PROCEDURE`).

**Sur ton PC :**
```powershell
scp F:\OutiLab\fbelecv2\db\schema.sql sc1qize9193@foulque.o2switch.net:/home2/sc1qize9193/schema.sql
```
**En SSH** (le `PGPASSWORD=...` évite de mettre le mot de passe dans l'URL ; protège les
caractères spéciaux avec des guillemets simples) :
```bash
PGPASSWORD='MOT_DE_PASSE_BDD' psql -h localhost -p 5432 -U sc1qize9193_admin -d sc1qize9193_fbelec < ~/schema.sql
```
Attendu : `DROP SCHEMA`, `CREATE SCHEMA`, plein de `CREATE TABLE`/`CREATE TRIGGER`,
`INSERT 0 6` — **sans ERREUR**.
> Le fichier commence par `DROP SCHEMA IF EXISTS fbelec CASCADE;` → on peut le rejouer
> pour repartir propre (⚠️ il efface les données fbelec existantes).

---

## Étape 8 — Créer le compte administrateur

Active l'environnement Node pour avoir `node` en SSH :
```bash
source ~/nodevenv/fbelec-api.sc1qize9193.universe.wf/20/bin/activate   # adapte la version
cd ~/fbelec-api.sc1qize9193.universe.wf
node -e "console.log(require('bcryptjs').hashSync('TON_MOT_DE_PASSE_ADMIN',12))"
```
Copie le hash `$2a$12$...`, puis :
```bash
PGPASSWORD='MOT_DE_PASSE_BDD' psql -h localhost -p 5432 -U sc1qize9193_admin -d sc1qize9193_fbelec -c "INSERT INTO fbelec.admins (nom,email,password_hash) VALUES ('Franck Bordier','contact@fbelec.fr','COLLE_LE_HASH');"
```
→ `INSERT 0 1`.

---

## Étape 9 — Construire le frontend EN LOCAL

> Le frontend est compilé par Vite **sur ton PC** : l'URL de l'API est « gravée » dans
> le build. On ne met **jamais** les sources sur le serveur, seulement le dossier `dist/`.
> Si tu changes une variable, il faut **refaire `npm run build`**.

**Sur ton PC :**
```powershell
cd F:\OutiLab\fbelecv2\frontend
```
Crée/édite `frontend\.env` (URL **protocol-relative**, sans `http:`/`https:`) :
```env
VITE_API_URL=//fbelec-api.sc1qize9193.universe.wf
```
> ⚠️ Ce fichier `.env` **ne s'uploade jamais** : il est lu par Vite **au build** et
> l'URL est figée dans le `dist`. On n'envoie sur le serveur que le dossier `dist/`.

Vérifie que le logo est présent : `frontend\public\assets\logo-fbelec.png`.
Puis build :
```powershell
npm install   # la première fois seulement
npm run build
```
→ génère `frontend\dist\`.

---

## Étape 10 — Envoyer le frontend + routage SPA

**Sur ton PC** — envoie le **contenu** de `dist` (pas le dossier lui-même) :
```powershell
scp -r F:\OutiLab\fbelecv2\frontend\dist\* sc1qize9193@foulque.o2switch.net:/home2/sc1qize9193/fbelec.sc1qize9193.universe.wf/
```
**En SSH** — crée le `.htaccess` (sinon les rafraîchissements de page font 404) :
```bash
nano ~/fbelec.sc1qize9193.universe.wf/.htaccess
```
```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

---

## Étape 11 — Tester

Ouvre **`http://fbelec.sc1qize9193.universe.wf`** (bien en `http://`, en navigation
privée si ton navigateur force le `https`). Connecte-toi avec l'email + mot de passe admin.

---

## Mémo des pièges (déjà rencontrés)

| Symptôme | Cause / Solution |
|---|---|
| `npm install` : *package.json manquant* | Le code n'est pas à la racine de l'Application root → déplace-le (étape 4). |
| `/health` → 404 (page Apache) | App Node pas démarrée → Restart, vérifier startup file = `app.js`. |
| `/health` → `authentification échouée` | `DATABASE_URL` vide/mal formé → utilisateur/base préfixés, pas de guillemets dans l'URL. |
| `psql ... < schema.sql` : erreur `GENERATED`/`EXECUTE FUNCTION` | PostgreSQL ancien → le `schema.sql` fourni est déjà compatible (serial + EXECUTE PROCEDURE). |
| `psql` : *IPv6 host address* | Mot de passe à caractères spéciaux dans l'URL → utiliser `PGPASSWORD='...' psql -h ... -U ... -d ...`. |
| `node: command not found` (SSH) | Activer le venv : `source ~/nodevenv/<approot>/<version>/bin/activate`. |
| Modif `.env` sans effet | `touch <approot>/tmp/restart.txt`. |
| CORS : *No 'Access-Control-Allow-Origin'* | `CORS_ORIGIN` ≠ origine exacte du front, ou app pas rechargée → corriger + `touch tmp/restart.txt`. |
| Image `ERR_NAME_NOT_RESOLVED` | `PUBLIC_API_URL` erroné (faute de frappe dans l'hôte) → corriger + restart. |
| Image `ERR_CERT...` / page force https | HSTS mémorisé → purger via `chrome://net-internals/#hsts`. |
| `Mixed Content` (page https → API http bloquée) | Utiliser des URLs **`//host`** (protocol-relative) pour `VITE_API_URL` et `PUBLIC_API_URL` → l'app suit le schéma de la page. |
| `DATABASE_URL` : *IPv6 host* / auth échoue | Caractères spéciaux du mot de passe non encodés → URL-encoder (`%40`, `%5B`…). |
| `.env` local avec lignes coupées (78 car. + `$`) | Fichier corrompu → ne pas l'uploader ; le `.env` de référence est **sur le serveur**. |
