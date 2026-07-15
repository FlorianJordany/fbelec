// ════════════════════════════════════════════════════════
//  app.js — point d'entrée (cPanel « Setup Node.js App » / Passenger)
//  Sur o2switch, ce fichier est l'« Application startup file ».
//  Passenger fournit process.env.PORT et lance ce fichier.
// ════════════════════════════════════════════════════════
import 'dotenv/config';
import app from './src/server.js';

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Backend FB ELEC démarré sur le port ${PORT}`));
