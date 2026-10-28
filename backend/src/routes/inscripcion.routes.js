const router = require('express').Router();
const ctrl = require('../controllers/inscripcion.controller');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/buscar-socio', authorize('admin_general', 'admin_sociedad'), ctrl.buscarSocio);
router.get('/verificar-anillos', authorize('admin_general', 'admin_sociedad'), ctrl.verificarAnillos);
router.get('/composicion', authorize('admin_general', 'admin_sociedad'), ctrl.getComposicion);
router.post('/composicion', authorize('admin_general', 'admin_sociedad'), ctrl.recomponer);
router.get('/composicion/auditoria', authorize('admin_general', 'admin_sociedad'), ctrl.getAuditoria);
router.get('/', authorize('admin_general', 'admin_sociedad', 'socio'), ctrl.getAll);
router.get('/lotes/:competenciaId', authorize('admin_general', 'admin_sociedad'), ctrl.getLotes);
router.get('/:id', authorize('admin_general', 'admin_sociedad'), ctrl.getById);
router.post('/', authorize('admin_general', 'admin_sociedad'), ctrl.create);
router.put('/:id', authorize('admin_general', 'admin_sociedad'), ctrl.update);
router.delete('/grupo/:grupoPresentacion', authorize('admin_general', 'admin_sociedad'), ctrl.removeGrupo);
router.delete('/:id', authorize('admin_general', 'admin_sociedad'), ctrl.remove);

module.exports = router;
