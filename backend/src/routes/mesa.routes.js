const router = require('express').Router();
const ctrl = require('../controllers/mesa.controller');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/mi-mesa', authorize('operador'), ctrl.getMiMesa);
router.get('/competencia/:competenciaId', authorize('admin_general', 'admin_sociedad'), ctrl.getByCompetencia);
router.get('/lotes-jurados/:competenciaId', authorize('admin_general', 'admin_sociedad', 'socio', 'operador'), ctrl.getLotesJurados);
router.get('/:id', authorize('admin_general', 'admin_sociedad', 'operador'), ctrl.getById);
router.post('/', authorize('admin_general', 'admin_sociedad'), ctrl.create);
router.put('/:id', authorize('admin_general', 'admin_sociedad'), ctrl.update);
router.delete('/:id', authorize('admin_general', 'admin_sociedad'), ctrl.remove);

// Pantalla de jura para operador
router.get('/:id/jura', authorize('admin_general', 'admin_sociedad', 'operador'), ctrl.getJuraData);
router.post('/:id/jura/puntaje', authorize('admin_general', 'admin_sociedad', 'operador'), ctrl.guardarPuntaje);
router.put('/:id/lote-estado', authorize('admin_general', 'admin_sociedad', 'operador'), ctrl.actualizarEstadoLote);
router.post('/competencia/:competenciaId/abrir-todas', authorize('admin_general', 'admin_sociedad'), ctrl.abrirTodosLotes);

module.exports = router;
