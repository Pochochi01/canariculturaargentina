const router = require('express').Router();
const ctrl = require('../controllers/asignacionJuez.controller');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/',        authorize('admin_general', 'admin_sociedad', 'operador'), ctrl.getByCompetencia);
router.get('/:id',     authorize('admin_general', 'admin_sociedad', 'operador'), ctrl.getById);
router.put('/upsert',  authorize('admin_general', 'admin_sociedad', 'operador'), ctrl.upsert);
router.delete('/:id',  authorize('admin_general', 'admin_sociedad'), ctrl.remove);

module.exports = router;
