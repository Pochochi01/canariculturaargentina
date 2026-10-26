const router = require('express').Router();
const ctrl = require('../controllers/usuario.controller');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate, authorize('admin_general'));

router.get('/',       ctrl.listar);
router.get('/:id',    ctrl.obtener);
router.post('/',      ctrl.crear);
router.put('/:id',    ctrl.actualizar);
router.delete('/:id', ctrl.eliminar);

module.exports = router;
