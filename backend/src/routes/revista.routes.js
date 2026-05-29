const router = require('express').Router();
const ctrl   = require('../controllers/revista.controller');
const { authenticate, authorize } = require('../middleware/auth');

// ── Rutas públicas (sin autenticación) ───────────────────────────────────────
router.get('/publica/:token', ctrl.getByToken);
router.get('/',               ctrl.getAll);    // listado visible para todos

// ── Rutas autenticadas ────────────────────────────────────────────────────────
router.use(authenticate);

router.get('/:id', ctrl.getById);

router.post('/publicar/:competenciaId',
  authorize('admin_general', 'admin_sociedad'),
  ctrl.publicar
);

router.delete('/:id',
  authorize('admin_general', 'admin_sociedad'),
  ctrl.remove
);

module.exports = router;
