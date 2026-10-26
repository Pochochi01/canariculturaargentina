const router = require('express').Router();
const ctrl = require('../controllers/sociedad.controller');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getById);
router.post('/', authorize('admin_general'), ctrl.create);
router.put('/:id', authorize('admin_general'), ctrl.update);
router.patch('/:id/toggle-activa', authorize('admin_general'), ctrl.toggleActiva);
router.get('/:id/resumen-eliminacion', authorize('admin_general'), ctrl.resumenEliminacion);
router.delete('/:id', authorize('admin_general'), ctrl.remove);
router.post('/:id/admin', authorize('admin_general'), ctrl.asignarAdmin);

module.exports = router;
