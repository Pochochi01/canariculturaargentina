const router = require('express').Router();
const ctrl = require('../controllers/competencia.controller');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// Histórico público — accesible también por socios
router.get('/historico', authorize('admin_general', 'admin_sociedad', 'socio'), ctrl.getHistorico);
router.get('/historico/:competenciaId/resultados', authorize('admin_general', 'admin_sociedad', 'socio'), ctrl.getResultadosHistorico);

router.get('/mis-competencias', authorize('socio'), ctrl.getMisCompetencias);
router.get('/', authorize('admin_general', 'admin_sociedad'), ctrl.getAll);
router.get('/:id', authorize('admin_general', 'admin_sociedad', 'socio'), ctrl.getById);
router.post('/', authorize('admin_general', 'admin_sociedad'), ctrl.create);
router.put('/:id', authorize('admin_general', 'admin_sociedad'), ctrl.update);
router.delete('/:id', authorize('admin_general', 'admin_sociedad'), ctrl.remove);
router.post('/:id/cerrar-inscripcion', authorize('admin_general', 'admin_sociedad'), ctrl.cerrarInscripcion);
router.put('/:id/finalizar', authorize('admin_general', 'admin_sociedad'), ctrl.finalizarCompetencia);
router.get('/:id/aves-nacional',  authorize('admin_general', 'admin_sociedad'), ctrl.getAvesNacional);
router.post('/:id/aves-nacional', authorize('admin_general', 'admin_sociedad'), ctrl.enviarAvesNacional);
router.put('/:id/reabrir',   authorize('admin_general', 'admin_sociedad'), ctrl.reabrirCompetencia);

module.exports = router;
