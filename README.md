# README — Mise en route (projet Appli)

Ce dossier contient la configuration Claude Code et le workflow de collaboration du projet.
On travaille **à deux, chacun son tour**, sur le dossier partagé.

---

## 🧩 Les fichiers

| Fichier | Rôle |
|---|---|
| `CLAUDE.md` | Lu automatiquement par Claude Code à chaque session. Donne le protocole de démarrage, les règles critiques, et importe `DEV_RULES.md`. |
| `DEV_RULES.md` | La "constitution" du projet : méthode de dev, stack, déploiement cPanel/Passenger, sécurité, audit. Chargée à chaque session. |
| `HANDOFF.md` | Le cahier de passation entre nous deux. **Ne pas le remplir à la main.** |
| `.claude/commands/thug.md` | La commande `/thug` qui remplit `HANDOFF.md` automatiquement. |

---

## ⚙️ Première fois (à faire une seule fois sur ta machine)

1. Récupère le dossier partagé via Google Drive pour ordinateur (raccourci ajouté à "Mon Drive", droit **Éditeur** requis).
2. Ouvre un terminal **dans le dossier du projet**, puis lance Claude Code :
   ```
   claude
   ```
3. À la première session, Claude Code va demander l'autorisation pour l'import `@DEV_RULES.md`.
   👉 **Accepte.** Sinon le fichier de règles ne sera pas chargé (et la demande ne reviendra plus).

> Ton `CLAUDE.md` personnel dans `C:\Users\<toi>\.claude\` reste à toi : il ne se partage pas, ne le touche pas.

---

## 📦 Intégrer dans un projet DÉJÀ en cours

Tu peux déposer ces fichiers dans un projet existant. Deux précautions :

1. **CLAUDE.md déjà présent ?** Si le projet a déjà un `CLAUDE.md` (généré par `/init` ou par Claude Design), **ne l'écrase pas**. Fusionne : garde le contenu existant et ajoute en haut la ligne d'import `@DEV_RULES.md` + le "Protocole de début de session". Au doute, ouvre une session et demande à Claude de fusionner les deux fichiers proprement.
2. **Initialiser le HANDOFF une seule fois.** Comme le handoff démarre vide, lance dès la première session :
   ```
   /thug
   ```
   Claude détecte que c'est un projet existant, **analyse le code** (arborescence, package.json, routes, DB…) et écrit l'état actuel comme point de départ. Ensuite, `/thug` fonctionne normalement (il ne note plus que le delta de chaque session).

---

## 🔁 Le workflow à chaque tour

### ▶️ En début de session
1. Lance `claude` dans le dossier du projet.
2. Si tu as un nouveau handoff de Claude Design, colle-le.
3. Dis simplement : **« mets-toi à jour »**.
   Claude lit `HANDOFF.md`, te résume où en est le projet, et confirme au besoin en regardant les fichiers récemment modifiés — avant de coder.

### ⏹️ En fin de session
1. Tape la commande :
   ```
   /thug
   ```
   Claude remplit `HANDOFF.md` tout seul (ce qui a été fait, en cours, prochaines étapes, pièges).
2. **Ferme proprement** et laisse Google Drive **terminer la synchronisation** (l'icône Drive ne doit plus tourner) avant d'éteindre.

C'est tout. L'autre récupère, fait « mets-toi à jour », et continue.

---

## ⚠️ Bon à savoir

- **Ne jamais travailler à deux en même temps** sur le dossier partagé.
- **Ne pas éditer `HANDOFF.md` à la main** : la commande `/thug` s'en charge.
- Les règles de sécurité de `DEV_RULES.md` s'appliquent automatiquement à chaque session — pas besoin de les rappeler.
- ⚠️ **`/thug` en fin de session est obligatoire.** Comme on n'utilise pas git, le `HANDOFF.md` est le **seul** enregistrement de la passation : si on l'oublie, le suivant repart sans contexte.
- ⚠️ **Bien attendre la fin de la synchro Drive** avant de fermer, et ne pas ouvrir le projet des deux côtés en même temps (risque de conflit de fichiers et de version "(1)").
- 💡 Filet de sécurité : Google Drive conserve un **historique des versions** de chaque fichier (clic droit sur un fichier → *Gérer les versions* / *Historique des versions*), utile pour récupérer un fichier écrasé par erreur.
