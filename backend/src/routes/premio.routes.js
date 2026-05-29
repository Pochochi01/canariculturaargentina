const router = require('express').Router();
const ctrl = require('../controllers/premio.controller');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', ctrl.getAll);
router.put('/:tipo', authorize('admin_general'), ctrl.update);
router.post('/inicializar', authorize('admin_general'), ctrl.inicializar);

module.exports = router;
