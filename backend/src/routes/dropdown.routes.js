const router = require('express').Router();
const ctrl = require('../controllers/dropdown.controller');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// Federaciones
router.get('/federaciones',          ctrl.getFederaciones);           // todos los roles
router.post('/federaciones',         authorize('admin_general'), ctrl.createFederacion);
router.put('/federaciones/:id',      authorize('admin_general'), ctrl.updateFederacion);
router.delete('/federaciones/:id',   authorize('admin_general'), ctrl.deleteFederacion);

// Tipos de Juez
router.get('/tipos-juez',            ctrl.getTiposJuez);              // todos los roles
router.post('/tipos-juez',           authorize('admin_general'), ctrl.createTipoJuez);
router.put('/tipos-juez/:id',        authorize('admin_general'), ctrl.updateTipoJuez);
router.delete('/tipos-juez/:id',     authorize('admin_general'), ctrl.deleteTipoJuez);

// Opciones Máximo por Socio
router.get('/opciones-max',          ctrl.getOpcionesMax);            // todos los roles
router.post('/opciones-max',         authorize('admin_general'), ctrl.createOpcionMax);
router.put('/opciones-max/:id',      authorize('admin_general'), ctrl.updateOpcionMax);
router.delete('/opciones-max/:id',   authorize('admin_general'), ctrl.deleteOpcionMax);

module.exports = router;
