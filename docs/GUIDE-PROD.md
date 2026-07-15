# Déploiement — Environnement de PRODUCTION (o2switch, vrai domaine, HTTPS)

Guide complet pour la mise en production sur un **vrai domaine** (ex. `fbelec.fr`).
La procédure est la même qu'en dev, **en plus simple** : sur un vrai domaine, les
certificats SSL Let's Encrypt s'émettent normalement → tout passe en **`https://`**.

> Différences clés avec le dev : DNS du vrai domaine, génération du **certificat SSL**,
> et toutes les URLs en **`https://`** (4 variables). Le reste est identique.

## Repères (à adapter)

| | Exemple (choisis tes noms) |
|---|---|
| SSH / SFTP | `sc1qize9193@foulque.o2switch.net` |
| Home | `/home2/sc1qize9193` |
| Sous-domaine **front** | `suivi.fbelec.fr` → `~/suivi.fbelec.fr` |
| Sous-domaine **API** | `api-suivi.fbelec.fr` → `~/api-suivi.fbelec.fr` |
| Base PostgreSQL | ex. `sc1qize9193_fbelecprod` / user `sc1qize9193_fbprod` |

> Utilise une **base de prod distincte** de la base de dev.

---

## Étape 0 — DNS : pointer le domaine vers o2switch

**Si `fbelec.fr` est déjà géré chez o2switch** → rien à faire, passe à l'étape 1.

**Si le domaine est ailleurs** (OVH, Gandi…) : dans la zone DNS du registrar, crée les
enregistrements pour tes sous-domaines pointant vers l'IP du serveur o2switch
(visible dans cPanel → *Informations générales* → « IP partagée ») :
```
suivi      IN A   <IP_o2switch>
api-suivi  IN A   <IP_o2switch>
```
Attends la propagation (quelques minutes à quelques heures). Vérifie :
```bash
nslookup suivi.fbelec.fr
```

---

## Étape 1 — Créer les 2 sous-domaines

cPanel → **Domaines / Sous-domaines** :
- `suivi` . `fbelec.fr`      → le **front**
- `api-suivi` . `fbelec.fr`  → l'**API**

---

## Étape 2 — Générer les certificats SSL (HTTPS)

cPanel → **Statut SSL/TLS** :
1. Repère `suivi.fbelec.fr` et `api-suivi.fbelec.fr`.
2. Sélectionne-les et clique **Exécuter AutoSSL**.
3. Attends quelques minutes → le cadenas doit passer **vert** (certificat valide).

> Sur un vrai domaine, pas d'erreur CAA comme en dev : les certificats s'émettent.
> Vérifie en ouvrant `https://api-suivi.fbelec.fr/health` plus tard (étape 7).

---

## Étape 3 — Créer la base PostgreSQL

cPanel → **Bases de données PostgreSQL** :
1. Base → ex. `sc1qize9193_fbelecprod`.
2. Utilisateur → ex. `sc1qize9193_fbprod` (mot de passe **alphanumérique** de préférence).
3. **Ajoute l'utilisateur à la base** avec tous les privilèges.

---

## Étape 4 — Créer l'application Node.js (backend)

cPanel → **Setup Node.js App** → *Create Application* :
- **Node.js version** : 20 ou 22
- **Application mode** : Production
- **Application root** : `api-suivi.fbelec.fr`
- **Application URL** : `api-suivi.fbelec.fr`
- **Application startup file** : `app.js`

---

## Étape 5 — Envoyer le code du backend

**PC (PowerShell) :**
```powershell
scp -r F:\OutiLab\fbelecv2\backend sc1qize9193@foulque.o2switch.net:/home2/sc1qize9193/backend-tmp
```
**SSH :**
```bash
ssh sc1qize9193@foulque.o2switch.net
shopt -s dotglob
mv ~/backend-tmp/* ~/api-suivi.fbelec.fr/
rmdir ~/backend-tmp
ls ~/api-suivi.fbelec.fr     # doit montrer package.json, app.js, src
```

---

## Étape 6 — Configurer le `.env` du backend (valeurs HTTPS)

```bash
cd ~/api-suivi.fbelec.fr
cp .env.example .env
nano .env
```
```env
DATABASE_URL=postgresql://sc1qize9193_fbprod:MOT_DE_PASSE_ENCODE@localhost:5432/sc1qize9193_fbelecprod
JWT_SECRET=UNE_AUTRE_chaine_aleatoire_longue_que_le_dev
JWT_EXPIRES_IN=7d
PUBLIC_API_URL=//api-suivi.fbelec.fr
CORS_ORIGIN=https://suivi.fbelec.fr
PUBLIC_URL=https://suivi.fbelec.fr
SMTP_HOST=ssl0.ovh.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=contact@fbelec.fr
SMTP_PASS=mot_de_passe_email
SMTP_FROM=FB ELEC <contact@fbelec.fr>
CONTACT_EMAIL=contact@fbelec.fr
```
> **Différences avec le dev :**
> - `PUBLIC_API_URL` reste en **`//host`** (protocol-relative) : comme la prod force le
>   HTTPS (voir étape 10), tout est servi en `https`. _(Tu peux aussi écrire
>   `https://api-suivi.fbelec.fr` explicitement, c'est équivalent.)_
> - `CORS_ORIGIN` = une **seule** origine `https://…` (pas de http en prod), sans `/` final.
> - `JWT_SECRET` **différent** du dev. Générer (après
>   `source ~/nodevenv/api-suivi.fbelec.fr/20/bin/activate`) :
>   `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
> - Mot de passe BDD : **URL-encodé** dans `DATABASE_URL` s'il a des caractères spéciaux
>   (`@`→`%40`, `[`→`%5B`…), ou alphanumérique.

---

## Étape 7 — Installer + démarrer + tester

cPanel → **Setup Node.js App** → **Run NPM Install** → **Restart**
(si le `.env` ne semble pas pris en compte : `touch ~/api-suivi.fbelec.fr/tmp/restart.txt`).

Test :
```
https://api-suivi.fbelec.fr/health   →  {"status":"ok","db":"connected",...}
```

---

## Étape 8 — Importer le schéma + créer l'admin

**PC :**
```powershell
scp F:\OutiLab\fbelecv2\db\schema.sql sc1qize9193@foulque.o2switch.net:/home2/sc1qize9193/schema.sql
```
**SSH :**
```bash
PGPASSWORD='MOT_DE_PASSE_BDD' psql -h localhost -p 5432 -U sc1qize9193_fbprod -d sc1qize9193_fbelecprod < ~/schema.sql
```
Admin :
```bash
source ~/nodevenv/api-suivi.fbelec.fr/20/bin/activate
cd ~/api-suivi.fbelec.fr
node -e "console.log(require('bcryptjs').hashSync('MDP_ADMIN_PROD',12))"
```
```bash
PGPASSWORD='MOT_DE_PASSE_BDD' psql -h localhost -p 5432 -U sc1qize9193_fbprod -d sc1qize9193_fbelecprod -c "INSERT INTO fbelec.admins (nom,email,password_hash) VALUES ('Franck Bordier','contact@fbelec.fr','COLLE_LE_HASH');"
```

---

## Étape 9 — Construire le frontend EN LOCAL (en https)

**PC :**
```powershell
cd F:\OutiLab\fbelecv2\frontend
```
Édite `frontend\.env` (protocol-relative — ce fichier reste local, il n'est jamais uploadé) :
```env
VITE_API_URL=//api-suivi.fbelec.fr
```
Vérifie le logo `frontend\public\assets\logo-fbelec.png`, puis :
```powershell
npm run build
```
> Rappel : l'URL de l'API est figée au build. Pour la prod, on rebuild avec l'URL **https**.

---

## Étape 10 — Envoyer le frontend + `.htaccess`

**PC :**
```powershell
scp -r F:\OutiLab\fbelecv2\frontend\dist\* sc1qize9193@foulque.o2switch.net:/home2/sc1qize9193/suivi.fbelec.fr/
```
**SSH :**
```bash
nano ~/suivi.fbelec.fr/.htaccess
```
```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  # Forcer HTTPS (prod uniquement)
  RewriteCond %{HTTPS} off
  RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
  # Routage SPA
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```
> En prod on **force le HTTPS** (les 2 lignes `RewriteCond %{HTTPS} off`), contrairement au dev.

---

## Étape 11 — Tester

`https://suivi.fbelec.fr` → connexion admin → vérifier qu'une image de chantier s'affiche.

---

## Migration des données / fichiers depuis le dev (optionnel)

Si tu veux reprendre les chantiers/clients/photos de l'environnement de dev :

1. **Données** — dump des données seules depuis la base de dev, puis import en prod :
   ```bash
   PGPASSWORD='MDP_DEV' pg_dump -h localhost -U sc1qize9193_admin -d sc1qize9193_fbelec --data-only --schema=fbelec > ~/data.sql
   PGPASSWORD='MDP_PROD' psql -h localhost -U sc1qize9193_fbprod -d sc1qize9193_fbelecprod < ~/data.sql
   ```
2. **Fichiers** — copier tout le dossier uploads :
   ```bash
   cp -r ~/fbelec-api.sc1qize9193.universe.wf/uploads/* ~/api-suivi.fbelec.fr/uploads/
   ```
3. **Réécrire les chemins** des fichiers en base (l'Application root a changé) :
   ```bash
   PGPASSWORD='MDP_PROD' psql -h localhost -U sc1qize9193_fbprod -d sc1qize9193_fbelecprod -c "
   UPDATE fbelec.photos    SET url = replace(url, '/home2/sc1qize9193/fbelec-api.sc1qize9193.universe.wf/uploads/', '/home2/sc1qize9193/api-suivi.fbelec.fr/uploads/');
   UPDATE fbelec.documents SET url = replace(url, '/home2/sc1qize9193/fbelec-api.sc1qize9193.universe.wf/uploads/', '/home2/sc1qize9193/api-suivi.fbelec.fr/uploads/');"
   ```
   > La colonne `url` contient le **chemin disque absolu** ; le backend en déduit l'URL
   > publique via `PUBLIC_API_URL`. Il suffit donc d'aligner le préfixe sur le nouveau dossier.

---

## Récapitulatif des différences DEV → PROD

| | DEV | PROD |
|---|---|---|
| Domaine | `*.sc1qize9193.universe.wf` (provisoire) | vrai domaine (`fbelec.fr`) |
| Protocole effectif | `http` (la page est en http) | `https` (forcé) |
| SSL | impossible (CAA sur `universe.wf`) | AutoSSL (Let's Encrypt) |
| `PUBLIC_API_URL` / `VITE_API_URL` | `//host` (suit le schéma de la page) | `//host` (suit le schéma de la page) |
| `CORS_ORIGIN` | front en **http + https** | une seule origine **https** |
| `PUBLIC_URL` (e-mails) | `http://…` | `https://…` |
| `.htaccess` front | SPA seul | SPA + **redirection HTTPS forcée** |
| Base / admin / `JWT_SECRET` | env. de dev | base dédiée, secrets distincts |
