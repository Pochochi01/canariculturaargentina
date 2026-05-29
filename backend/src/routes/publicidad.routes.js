const path    = require('path');
const fs      = require('fs');
const router  = require('express').Router();
const multer  = require('multer');
const ctrl    = require('../controllers/publicidad.controller');
const { authenticate, authorize } = require('../middleware/auth');

const ADS_ROOT = path.join(__dirname, '../../uploads/advertisements');
fs.mkdirSync(ADS_ROOT, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, ADS_ROOT),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },   // 20 MB
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif)$/i.test(file.mimetype)) cb(null, true);
    else cb(new Error('Solo se permiten imágenes JPG, PNG, WEBP o GIF'));
  }
});

router.use(authenticate);

// La ruta de revista debe ir ANTES del DELETE /:id para evitar conflictos
router.get('/revista/:competenciaId',
  authorize('admin_general', 'admin_sociedad'),
  ctrl.generarRevista
);

router.post('/upload',
  authorize('admin_general', 'admin_sociedad'),
  upload.single('imagen'),
  ctrl.upload
);

router.get('/',
  authorize('admin_general', 'admin_sociedad'),
  ctrl.getByCompetencia
);

router.delete('/:id',
  authorize('admin_general', 'admin_sociedad'),
  ctrl.remove
);

module.exports = router;
