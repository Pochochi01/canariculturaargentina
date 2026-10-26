const router = require('express').Router();
const ctrl = require('../controllers/ayuda.controller');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/',           ctrl.obtener);
router.post('/regenerar', authorize('admin_general'), ctrl.regenerar);

module.exports = router;
