import { Router } from 'express';
import authAdmin from '../../middleware/authAdmin.js';
import etapesRouter    from './etapes.js';
import clientsRouter   from './clients.js';
import societesRouter  from './societes.js';
import chantiersRouter from './chantiers.js';
import photosRouter    from './photos.js';
import documentsRouter from './documents.js';
import notesRouter     from './notes.js';
import vueClientRouter from './vue_client.js';

const router = Router();
router.use(authAdmin);

router.use('/etapes',    etapesRouter);
router.use('/clients',   clientsRouter);
router.use('/societes',  societesRouter);

// Les routes POST /chantiers/:id/notes|photos|documents sont dans leurs routers
// On les monte à la racine pour que le chemin complet fonctionne
router.use(photosRouter);
router.use(documentsRouter);
router.use(notesRouter);

// Ensuite les routes CRUD par id (PUT/DELETE /photos/:id etc.)
router.use('/photos',    photosRouter);
router.use('/documents', documentsRouter);
router.use('/notes',     notesRouter);

// Vue client admin (doit être avant /chantiers pour éviter collision)
router.use('/vue-client', vueClientRouter);

// Chantiers en dernier car /:id est générique
router.use('/chantiers', chantiersRouter);

export default router;
