const router = require('express').Router();
const ctrl = require('../controllers/juez.controller');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getById);
router.post('/', authorize('admin_general'), ctrl.create);
router.put('/:id', authorize('admin_general'), ctrl.update);
router.delete('/:id', authorize('admin_general'), ctrl.remove);

module.exports = router;
