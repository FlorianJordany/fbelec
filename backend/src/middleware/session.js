// Le jeton porte la version du mot de passe lue à la connexion (mv, absent = 0 : jeton émis avant
// cette colonne). Chaque changement incrémente la version : les jetons précédents sont refusés.
export const sessionPerimee = (payload, version) => (payload.mv ?? 0) !== version;
