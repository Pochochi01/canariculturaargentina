const router = require('express').Router();
const ctrl = require('../controllers/puesta.controller');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.use(authorize('socio'));

// Puestas por pareja
router.get('/pareja/:parejaId', ctrl.getByPareja);
router.get('/pareja/:parejaId/descendientes', ctrl.getDescendientes);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

// Huevos dentro de una puesta
router.put('/:id/huevos/set', ctrl.addHuevos);
router.put('/:id/huevos/:huevoId', ctrl.updateHuevo);

module.exports = router;
