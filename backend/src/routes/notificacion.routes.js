const router = require('express').Router();
const ctrl = require('../controllers/notificacion.controller');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.use(authorize('socio'));

router.get('/', ctrl.getAll);
router.put('/leer-todas', ctrl.marcarTodasLeidas);
router.put('/:id/leer', ctrl.marcarLeida);
router.delete('/:id', ctrl.remove);

module.exports = router;
