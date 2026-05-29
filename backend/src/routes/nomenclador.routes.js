const router = require('express').Router();
const multer = require('multer');
const ctrl = require('../controllers/nomenclador.controller');
const { authenticate, authorize } = require('../middleware/auth');

// Multer: memoria (sin guardar en disco), solo PDF, máximo 10 MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos con extensión .pdf'));
    }
  }
});

router.use(authenticate);

// ── Colores ───────────────────────────────────────────────────────────────────
// IMPORTANTE: la ruta específica /importar-pdf va ANTES de la ruta genérica POST /
router.post('/colores/importar-pdf',
  authorize('admin_general'),
  upload.single('archivo'),
  ctrl.importarColoresPDF
);
router.get('/colores',          ctrl.color.getAll);
router.get('/colores/:id',      ctrl.color.getById);
router.post('/colores',         authorize('admin_general'), ctrl.color.create);
router.put('/colores/:id',      authorize('admin_general'), ctrl.color.update);
router.delete('/colores/:id',   authorize('admin_general'), ctrl.color.remove);

// ── Formas / Posturas ─────────────────────────────────────────────────────────
router.post('/formas/importar-pdf',
  authorize('admin_general'),
  upload.single('archivo'),
  ctrl.importarFormasPDF
);
router.get('/formas',           ctrl.forma.getAll);
router.get('/formas/:id',       ctrl.forma.getById);
router.post('/formas',          authorize('admin_general'), ctrl.forma.create);
router.put('/formas/:id',       authorize('admin_general'), ctrl.forma.update);
router.delete('/formas/:id',    authorize('admin_general'), ctrl.forma.remove);

// ── Canto ─────────────────────────────────────────────────────────────────────
router.post('/canto/importar-pdf',
  authorize('admin_general'),
  upload.single('archivo'),
  ctrl.importarCantoPDF
);
router.get('/canto',            ctrl.canto.getAll);
router.get('/canto/:id',        ctrl.canto.getById);
router.post('/canto',           authorize('admin_general'), ctrl.canto.create);
router.put('/canto/:id',        authorize('admin_general'), ctrl.canto.update);
router.delete('/canto/:id',     authorize('admin_general'), ctrl.canto.remove);

// Convierte errores de multer (tipo de archivo inválido, tamaño excedido) en JSON
// eslint-disable-next-line no-unused-vars
router.use((err, _req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'El archivo supera el tamaño máximo permitido (10 MB)' });
  }
  if (err.message?.includes('.pdf')) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

module.exports = router;
