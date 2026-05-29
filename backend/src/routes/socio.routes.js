const path = require('path');
const fs = require('fs');
const multer = require('multer');
const router = require('express').Router();
const ctrl = require('../controllers/socio.controller');
const { authenticate, authorize } = require('../middleware/auth');

const uploadsDir = path.join(__dirname, '../../uploads/fotos');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `foto_${Date.now()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Solo se permiten imágenes'));
  }
});

router.use(authenticate);

// Rutas de perfil propio del socio
router.get('/me', authorize('socio'), ctrl.getMe);
router.put('/me', authorize('socio'), ctrl.updateMe);
router.post('/me/foto', authorize('socio'), upload.single('foto'), ctrl.uploadFoto);

router.get('/', authorize('admin_general', 'admin_sociedad'), ctrl.getAll);
router.get('/verificar', authorize('admin_general', 'admin_sociedad'), ctrl.verificarDisponibilidad);
router.get('/anillo/:anillo', ctrl.getByAnillo);
router.get('/:id', authorize('admin_general', 'admin_sociedad', 'socio'), ctrl.getById);
router.post('/', authorize('admin_general', 'admin_sociedad'), ctrl.create);
router.put('/:id', authorize('admin_general', 'admin_sociedad', 'socio'), ctrl.update);
router.post('/:id/usuario', authorize('admin_general', 'admin_sociedad'), ctrl.crearUsuario);
router.put('/:id/resetear-clave', authorize('admin_general', 'admin_sociedad'), ctrl.resetearClave);
router.delete('/:id', authorize('admin_general', 'admin_sociedad'), ctrl.remove);

module.exports = router;
